import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { runAnalysisAsync } from "@/lib/analyzer/run";
import {
  buildDayReport,
  dayFileName,
  dayTriggers,
  enumerateDays,
  isWeekend,
  sliceCsvWindow,
  updateStats,
  windowFor,
  type CumulativeStats,
  type StrategyStat,
} from "@/lib/backtest/core";

/** Mirrors the generator's per-second cooldown so a long run stays polite. */
const COOLDOWN_MS = 1000;
const STATE_KEY = "forexlens.backtest.progress";

interface Persisted {
  symbol: string;
  from: string;
  to: string;
  checkpoint: string;
  lastCompletedDay: string | null;
  stats: StrategyStat[];
}

function loadState(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

function saveState(state: Persisted) {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* quota — the in-memory run still completes */
  }
}

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export interface BacktestPanelProps {
  csv: string | null;
  symbol: string;
  /** Last candle datetime of the generated CSV — used to seed the pickers. */
  lastRowDatetime?: string | undefined;
  onLog?: (message: string, tone?: "info" | "warn" | "error" | "success") => void;
}

export function BacktestPanel({ csv, symbol, lastRowDatetime, onLog }: BacktestPanelProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [checkpoint, setCheckpoint] = useState("23:30");
  const [running, setRunning] = useState(false);
  const [percent, setPercent] = useState(0);
  const [current, setCurrent] = useState("");
  const [resume, setResume] = useState<Persisted | null>(null);
  const cancelRef = useRef(false);

  // Seed the pickers from the last generated candle.
  useEffect(() => {
    if (!lastRowDatetime) return;
    const day = lastRowDatetime.slice(0, 10);
    const time = lastRowDatetime.slice(11, 16);
    setTo((prev) => prev || day);
    setFrom((prev) => prev || day);
    if (time) setCheckpoint((prev) => (prev === "23:30" ? time : prev));
  }, [lastRowDatetime]);

  useEffect(() => {
    setResume(loadState());
  }, []);

  const log = useCallback(
    (message: string, tone?: "info" | "warn" | "error" | "success") => onLog?.(message, tone),
    [onLog],
  );

  const run = useCallback(
    async (continueRun: boolean) => {
      if (!csv) return;
      if (!from || !to || from > to) {
        log("Backtest: pick a valid from/to date range", "error");
        return;
      }

      cancelRef.current = false;
      setRunning(true);
      setPercent(0);

      const saved = loadState();
      const sameRun =
        continueRun &&
        saved &&
        saved.symbol === symbol &&
        saved.from === from &&
        saved.to === to &&
        saved.checkpoint === checkpoint;

      const stats: CumulativeStats = new Map(
        sameRun ? saved!.stats.map((s) => [s.strategyId, { ...s }]) : [],
      );
      const allDays = enumerateDays(from, to);
      const startAfter = sameRun ? saved!.lastCompletedDay : null;
      const days = startAfter ? allDays.filter((d) => d > startAfter) : allDays;
      const firstDay = sameRun ? saved!.from : from;
      let daysCompleted = sameRun ? allDays.filter((d) => d <= (startAfter ?? "")).length : 0;

      log(
        `Backtest started · ${symbol} · ${from} → ${to} @ ${checkpoint}${
          startAfter ? ` · resuming after ${startAfter}` : ""
        }`,
        "success",
      );

      const zip = new JSZip();
      let produced = 0;

      for (let i = 0; i < days.length; i++) {
        if (cancelRef.current) {
          log("Backtest stopped by user", "warn");
          break;
        }
        const day = days[i]!;
        setCurrent(day);
        setPercent(Math.round(((i + 1) / days.length) * 100));

        if (isWeekend(day)) {
          log(`${day} · weekend — skipped`, "info");
          daysCompleted++;
          saveState({
            symbol,
            from,
            to,
            checkpoint,
            lastCompletedDay: day,
            stats: [...stats.values()],
          });
          continue;
        }

        const window = windowFor(day, checkpoint);
        const slice = sliceCsvWindow(csv, window);
        let report: string;

        if (!slice.csv || slice.dayRowCount === 0) {
          report = buildDayReport({
            day,
            window,
            symbol,
            checkpoint,
            skipped: slice.csv
              ? "no candles found for this day inside the generated CSV (missing data)"
              : "no candles in the one-month window inside the generated CSV (missing data)",
            triggers: [],
            stats,
            firstDay,
            daysCompleted,
          });
          log(`${day} · data missing or unusable — skipped cleanly`, "warn");
        } else {
          const outcome = await runAnalysisAsync(slice.csv);
          if (!outcome.ok) {
            report = buildDayReport({
              day,
              window,
              symbol,
              checkpoint,
              skipped: `analysis rejected this window — ${outcome.error}`,
              triggers: [],
              stats,
              firstDay,
              daysCompleted,
            });
            log(`${day} · ${outcome.error} — skipped cleanly`, "warn");
          } else {
            const triggers = dayTriggers(outcome.analysis, day);
            updateStats(stats, triggers);
            daysCompleted++;
            report = buildDayReport({
              day,
              window,
              symbol,
              checkpoint,
              analysis: outcome.analysis,
              triggers,
              stats,
              firstDay,
              daysCompleted,
            });
            log(
              `${day} · ${slice.rowCount} candles · ${triggers.length} new trigger(s)`,
              triggers.length > 0 ? "success" : "info",
            );
          }
        }

        const fileName = dayFileName(day);
        zip.file(fileName, report);
        downloadText(fileName, report);
        produced++;

        saveState({
          symbol,
          from,
          to,
          checkpoint,
          lastCompletedDay: day,
          stats: [...stats.values()],
        });

        await new Promise((resolve) => setTimeout(resolve, COOLDOWN_MS));
      }

      if (produced > 0) {
        const blob = await zip.generateAsync({ type: "blob" });
        const zipName = `backtest_${symbol.replace("/", "")}_${from}_to_${to}.zip`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = zipName;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
        log(`Backtest bundle ready · ${produced} day file(s) · ${zipName}`, "success");
      } else {
        log("Backtest produced no day files", "warn");
      }

      setResume(loadState());
      setRunning(false);
      setCurrent("");
    },
    [csv, from, to, checkpoint, symbol, log],
  );

  const canResume =
    !!resume &&
    resume.symbol === symbol &&
    resume.from === from &&
    resume.to === to &&
    resume.checkpoint === checkpoint &&
    !!resume.lastCompletedDay &&
    resume.lastCompletedDay < to;

  return (
    <section className="panel flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium text-foreground">Backtest mode</h2>
        <p className="text-xs text-muted-foreground">
          Walks forward one day at a time over the generated CSV. Each day is analysed against a
          rolling one-month window ending at the time checkpoint, then written to
          <span className="num"> backtest_YYYY-MM-DD.txt</span>. Nothing is sent to any model.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bt-from" className="text-xs">
            From date
          </Label>
          <Input
            id="bt-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            disabled={running}
            className="num"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bt-to" className="text-xs">
            To date
          </Label>
          <Input
            id="bt-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={running}
            className="num"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bt-time" className="text-xs">
            Time checkpoint
          </Label>
          <Input
            id="bt-time"
            type="time"
            value={checkpoint}
            onChange={(e) => setCheckpoint(e.target.value)}
            disabled={running}
            className="num"
          />
        </div>
        <div className="flex items-end gap-2">
          {running ? (
            <Button variant="secondary" onClick={() => (cancelRef.current = true)}>
              Stop
            </Button>
          ) : (
            <>
              <Button onClick={() => void run(false)} disabled={!csv}>
                Run backtest
              </Button>
              {canResume ? (
                <Button variant="secondary" onClick={() => void run(true)}>
                  Continue
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {!csv ? (
        <p className="text-xs text-muted-foreground">
          Generate an OHLC CSV first — the backtester reads the last generated dataset.
        </p>
      ) : null}

      {running ? (
        <div className="flex flex-col gap-2">
          <Progress value={percent} className="animate-pulse" />
          <p className="num text-xs text-muted-foreground">
            {percent}% · analysing {current || "…"}
          </p>
        </div>
      ) : null}

      {resume?.lastCompletedDay ? (
        <p className="num text-[11px] text-muted-foreground">
          last completed day: {resume.lastCompletedDay} ({resume.from} → {resume.to} @{" "}
          {resume.checkpoint})
        </p>
      ) : null}
    </section>
  );
}
