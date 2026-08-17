import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import { VerifierPanel } from "@/components/verifier-panel";

import {
  buildReport,
  downloadReports,
  type DownloadOutcome,
} from "@/lib/analyzer/export";

import { runAnalysis } from "@/lib/analyzer/run";
import type { Analysis, ResultRow } from "@/lib/analyzer/types";

const TITLE = "Structure Scout — Trading Strategy Analyzer";
const DESCRIPTION =
  "Upload a prepared OHLC CSV and get every candle checked against 13 structure-based strategies, with exact PASS/FAIL reasons, RR math and a ranked setup list.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Index,
});

type Status = "idle" | "working" | "ready" | "error";

const STATUS_LABEL: Record<Status, string> = {
  idle: "Awaiting file",
  working: "Analyzing",
  ready: "Analysis complete",
  error: "File rejected",
};

function StatusDot({ status }: { status: Status }) {
  const tone =
    status === "ready"
      ? "bg-success"
      : status === "error"
        ? "bg-destructive"
        : status === "working"
          ? "bg-warning animate-pulse"
          : "bg-muted-foreground";
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span className={`size-2.5 rounded-full ${tone}`} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

function price(value: number | undefined) {
  return value === undefined ? "—" : Number(value.toFixed(5)).toString();
}

function Index() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState<"all" | "PASS" | "FAIL">("all");
  const [delivery, setDelivery] = useState<DownloadOutcome[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStatus("working");
    setError(null);
    setFileName(file.name);
    setDelivery([]);
    const text = await file.text();
    const outcome = runAnalysis(text);
    if (!outcome.ok) {
      setAnalysis(null);
      setError(outcome.error);
      setStatus("error");
      return;
    }
    setAnalysis(outcome.analysis);
    setStrategyFilter("all");
    setResultFilter("all");
    setStatus("ready");
    setDelivery(downloadReports(outcome.analysis));
  }

  async function copyReport(kind: "LIVE" | "HISTORY") {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(buildReport(analysis, kind));
    } catch {
      /* clipboard unavailable */
    }
  }


  const rows: ResultRow[] = useMemo(() => {
    if (!analysis) return [];
    return analysis.results.filter(
      (row) =>
        (strategyFilter === "all" || row.strategyId === strategyFilter) &&
        (resultFilter === "all" || row.result === resultFilter),
    );
  }, [analysis, strategyFilter, resultFilter]);

  const visible = rows.slice(0, 500);

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="num text-xs uppercase tracking-[0.35em] text-primary">Structure Scout</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Trading strategy analyzer
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Every candle is checked against 13 structure strategies. Nothing is estimated — each
            result traces back to a real row in your file.
          </p>
        </header>

        <section className="panel flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-medium text-foreground">Upload prepared CSV</h2>
              <p className="text-xs text-muted-foreground">
                JSON metadata header line, then the CSV header and rows.
              </p>
            </div>
            <StatusDot status={status} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Choose file
            </button>
            {fileName ? (
              <span className="num text-xs text-muted-foreground">{fileName}</span>
            ) : null}
            {analysis ? (
              <button
                type="button"
                onClick={() => setDelivery(downloadReports(analysis))}
                className="rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
              >
                Download both reports
              </button>
            ) : null}
          </div>

          {delivery.some((d) => !d.autoDownloaded) ? (
            <div className="flex flex-col gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-3 text-sm text-foreground">
              <p>
                The preview window blocks automatic downloads. Save the reports manually, or open the
                app in its own browser tab to get them automatically.
              </p>
              {delivery.map((item) => (
                <div key={item.kind} className="flex flex-wrap items-center gap-3">
                  <a
                    href={item.url}
                    download={item.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="num rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Save {item.fileName}
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyReport(item.kind)}
                    className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
                  >
                    Copy {item.kind} text
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="num rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

        </section>

        {analysis ? (
          <>
            <section className="panel flex flex-col gap-6 p-6">
              <div className="flex flex-col gap-2 border-b border-border pb-5">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  data_age
                </span>
                <span className="num text-2xl font-semibold text-warning">
                  {analysis.meta.data_age}
                </span>
                <span className="text-xs text-muted-foreground">
                  spread_convention: {analysis.meta.spread_convention} · applied spread{" "}
                  {analysis.spread} · atr_method: {analysis.meta.atr_method} · swing rule:{" "}
                  {analysis.meta.similar_swing_selection_rule}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["Total candles", analysis.totalRows],
                  ["PASS setups", analysis.passing.length],
                  ["Live/actionable", analysis.live.length],
                  ["Historical", analysis.historical.length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md bg-secondary/60 p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="num mt-1 text-xl font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-foreground">Per strategy</h3>
                <div className="flex flex-col gap-2">
                  {analysis.perStrategy.map((strategy) => (
                    <details
                      key={strategy.strategyId}
                      className="rounded-md border border-border bg-secondary/40 px-4 py-3"
                    >
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm text-foreground">
                        <span>{strategy.strategy}</span>
                        <span className="num text-xs">
                          <span className="text-success">PASS {strategy.passCount}</span>
                          {"  ·  "}
                          <span className="text-muted-foreground">FAIL {strategy.failCount}</span>
                        </span>
                      </summary>
                      <ul className="mt-3 flex flex-col gap-1">
                        {strategy.failReasons.length === 0 ? (
                          <li className="text-xs text-muted-foreground">No failures recorded.</li>
                        ) : (
                          strategy.failReasons.map((reason) => (
                            <li
                              key={reason.reason}
                              className="num flex justify-between gap-4 text-xs text-muted-foreground"
                            >
                              <span>{reason.reason}</span>
                              <span>{reason.count}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    </details>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-foreground">
                  Live / actionable ({analysis.live.length}) — PENDING first, then RR
                </h3>
                {analysis.live.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-6 text-center">
                    <p className="text-sm font-medium text-foreground">
                      No live setups as of {analysis.lastRowDatetime || "the last candle"}.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Every candle was still checked — see the historical record below and the
                      results table for exact reasons.
                    </p>
                  </div>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {analysis.live.map((row, i) => (
                      <li
                        key={`${row.strategyId}-${row.index}`}
                        className="num flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary/60 px-4 py-2 text-xs text-foreground"
                      >
                        <span>
                          {i + 1}.{" "}
                          <span
                            className={
                              row.setupStatus === "FILLED"
                                ? "rounded bg-warning/15 px-2 py-0.5 text-warning"
                                : "rounded bg-success/15 px-2 py-0.5 text-success"
                            }
                          >
                            {row.setupStatus}
                          </span>{" "}
                          {row.strategy} @ {row.datetime}
                        </span>
                        <span className="text-muted-foreground">
                          entry {price(row.entry)} · SL {price(row.sl)} · TP {price(row.tp)} ·{" "}
                          <span className="text-success">RR {row.rr?.toFixed(2)}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium text-foreground">
                  Historical record ({analysis.historical.length}) — resolved or expired
                </h3>
                <p className="text-xs text-muted-foreground">
                  Valid setups that are no longer tradeable. Kept for win-rate backtesting, not
                  counted as failures.
                </p>
                {analysis.historical.length === 0 ? (
                  <p className="text-xs text-muted-foreground">none</p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {analysis.historical.slice(0, 50).map((row, i) => (
                      <li
                        key={`${row.strategyId}-${row.index}`}
                        className="num flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary/40 px-4 py-2 text-xs text-muted-foreground"
                      >
                        <span>
                          {i + 1}. [{row.setupStatus}] {row.strategy} @ {row.datetime}
                        </span>
                        <span>
                          RR {row.rr?.toFixed(2)} · {row.statusNote}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {analysis.overlaps.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-foreground">
                    Overlaps ({analysis.overlaps.length})
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {analysis.overlaps.map((overlap) => (
                      <li key={overlap.datetime} className="num text-xs text-muted-foreground">
                        {overlap.datetime}: {overlap.strategies.join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <VerifierPanel key={analysis.lastRowDatetime} scoutData={buildReport(analysis, "LIVE")} />

            <section className="panel flex flex-col gap-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-medium text-foreground">Results</h2>
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label="Filter by strategy"
                    value={strategyFilter}
                    onChange={(event) => setStrategyFilter(event.target.value)}
                    className="rounded-md border border-input bg-secondary px-3 py-2 text-xs text-foreground"
                  >
                    <option value="all">All strategies</option>
                    {analysis.perStrategy.map((strategy) => (
                      <option key={strategy.strategyId} value={strategy.strategyId}>
                        {strategy.strategy}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by result"
                    value={resultFilter}
                    onChange={(event) =>
                      setResultFilter(event.target.value as "all" | "PASS" | "FAIL")
                    }
                    className="rounded-md border border-input bg-secondary px-3 py-2 text-xs text-foreground"
                  >
                    <option value="all">All results</option>
                    <option value="PASS">PASS only</option>
                    <option value="FAIL">FAIL only</option>
                  </select>
                </div>
              </div>

              <p className="num text-xs text-muted-foreground">
                Showing {visible.length} of {rows.length} rows
              </p>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      {["Datetime", "Strategy", "Result", "Trend", "Entry", "SL", "TP", "RR", "Reason"].map(
                        (head) => (
                          <th key={head} className="border-b border-border px-3 py-2 font-medium">
                            {head}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => (
                      <tr key={`${row.strategyId}-${row.index}`} className="align-top">
                        <td className="num border-b border-border/60 px-3 py-2">{row.datetime}</td>
                        <td className="border-b border-border/60 px-3 py-2">{row.strategy}</td>
                        <td className="border-b border-border/60 px-3 py-2">
                          <span
                            className={
                              row.result === "PASS"
                                ? "rounded bg-success/15 px-2 py-0.5 font-medium text-success"
                                : "rounded bg-muted px-2 py-0.5 text-muted-foreground"
                            }
                          >
                            {row.result}
                          </span>
                        </td>
                        <td className="border-b border-border/60 px-3 py-2">{row.trend}</td>
                        <td className="num border-b border-border/60 px-3 py-2">{price(row.entry)}</td>
                        <td className="num border-b border-border/60 px-3 py-2">{price(row.sl)}</td>
                        <td className="num border-b border-border/60 px-3 py-2">{price(row.tp)}</td>
                        <td className="num border-b border-border/60 px-3 py-2">
                          {row.rr === undefined ? "—" : row.rr.toFixed(2)}
                        </td>
                        <td className="border-b border-border/60 px-3 py-2 text-muted-foreground">
                          {row.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {analysis.invalidRowList.length > 0 ? (
                <details className="rounded-md border border-border bg-secondary/40 px-4 py-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    {analysis.invalidRowList.length} INVALID rows excluded from strategy checks
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {analysis.invalidRowList.map((row) => (
                      <li key={row.datetime} className="num text-xs text-muted-foreground">
                        {row.datetime || "(no datetime)"} — {row.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
