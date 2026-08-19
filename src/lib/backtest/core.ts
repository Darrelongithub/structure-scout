import type { Analysis, ResultRow } from "@/lib/analyzer/types";

export interface DayWindow {
  /** The backtest day, YYYY-MM-DD. */
  day: string;
  /** Inclusive lower bound datetime string of the one-month lookback window. */
  from: string;
  /** Inclusive upper bound (the day + the time checkpoint). */
  to: string;
}

export interface StrategyStat {
  strategyId: string;
  strategy: string;
  triggers: number;
  tpHits: number;
  slHits: number;
}

export type CumulativeStats = Map<string, StrategyStat>;

const DAY_MS = 86_400_000;

export function isWeekend(day: string): boolean {
  const date = new Date(`${day}T00:00:00Z`);
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6;
}

export function addDaysIso(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Every calendar day from `from` to `to`, inclusive. */
export function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard++ < 4000) {
    days.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return days;
}

/** One month of lookback ending at the day's time checkpoint. */
export function windowFor(day: string, checkpoint: string, lookbackDays = 30): DayWindow {
  return {
    day,
    from: `${addDaysIso(day, -lookbackDays)} 00:00:00`,
    to: `${day} ${checkpoint.length === 5 ? `${checkpoint}:00` : checkpoint}`,
  };
}

export interface SliceResult {
  csv: string | null;
  rowCount: number;
  /** Rows that belong to the backtest day itself. */
  dayRowCount: number;
}

/**
 * Slices the already-generated OHLC CSV down to one window. The metadata header and
 * the column header line are always preserved so the analyzer accepts the slice.
 */
export function sliceCsvWindow(csv: string, window: DayWindow): SliceResult {
  const lines = csv.split(/\r?\n/);
  const meta = lines[0];
  const header = lines[1];
  if (!meta || !header) return { csv: null, rowCount: 0, dayRowCount: 0 };

  const dtIndex = header.split(",").findIndex((h) => h.trim().toLowerCase() === "datetime");
  if (dtIndex === -1) return { csv: null, rowCount: 0, dayRowCount: 0 };

  const kept: string[] = [];
  let dayRowCount = 0;
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;
    const datetime = (line.split(",")[dtIndex] ?? "").trim().replace("T", " ");
    // Section markers / day dividers carry no timestamp — drop them from slices.
    if (!/^\d{4}-\d{2}-\d{2}/.test(datetime)) continue;
    if (datetime < window.from || datetime > window.to) continue;
    kept.push(line);
    if (datetime.slice(0, 10) === window.day) dayRowCount++;
  }

  if (kept.length === 0) return { csv: null, rowCount: 0, dayRowCount: 0 };
  return { csv: [meta, header, ...kept].join("\n"), rowCount: kept.length, dayRowCount };
}

/** Triggers whose candle falls on the backtest day itself — the day's new setups. */
export function dayTriggers(analysis: Analysis, day: string): ResultRow[] {
  return analysis.passing
    .filter((row) => row.datetime.slice(0, 10) === day)
    .sort((a, b) => a.datetime.localeCompare(b.datetime) || a.strategy.localeCompare(b.strategy));
}

export function updateStats(stats: CumulativeStats, rows: ResultRow[]): CumulativeStats {
  for (const row of rows) {
    const entry =
      stats.get(row.strategyId) ??
      { strategyId: row.strategyId, strategy: row.strategy, triggers: 0, tpHits: 0, slHits: 0 };
    entry.triggers++;
    const note = row.statusNote ?? "";
    if (/TP hit/i.test(note)) entry.tpHits++;
    else if (/SL hit/i.test(note) || /SL broken/i.test(note)) entry.slHits++;
    stats.set(row.strategyId, entry);
  }
  return stats;
}

export function winRate(stat: StrategyStat): string {
  const resolved = stat.tpHits + stat.slHits;
  if (resolved === 0) return "n/a (no resolved trades yet)";
  return `${((stat.tpHits / resolved) * 100).toFixed(1)}% (${stat.tpHits}/${resolved})`;
}

function n(value: number | undefined): string {
  return value === undefined ? "—" : Number(value.toFixed(5)).toString();
}

export interface DayReportInput {
  day: string;
  window: DayWindow;
  symbol: string;
  checkpoint: string;
  skipped?: string | undefined;
  analysis?: Analysis | undefined;
  triggers: ResultRow[];
  stats: CumulativeStats;
  firstDay: string;
  daysCompleted: number;
}

/** The per-day .txt payload: that day's new triggers plus rolling cumulative stats. */
export function buildDayReport(input: DayReportInput): string {
  const out: string[] = [];
  out.push("=== AUTO-BACKTEST DAY REPORT ===");
  out.push(`day: ${input.day}`);
  out.push(`symbol: ${input.symbol}`);
  out.push(`time checkpoint: ${input.checkpoint}`);
  out.push(`analysis window: ${input.window.from} → ${input.window.to}`);
  out.push("");

  if (input.skipped) {
    out.push(`STATUS: SKIPPED — ${input.skipped}`);
    out.push("No triggers evaluated for this day. The run continued to the next day.");
  } else {
    out.push(`STATUS: ANALYSED (${input.analysis?.totalRows ?? 0} candles in window)`);
    out.push("");
    out.push(`--- NEW TRIGGERS ON ${input.day} (${input.triggers.length}) ---`);
    if (input.triggers.length === 0) {
      out.push("none");
    } else {
      input.triggers.forEach((row, i) => {
        out.push(
          `${i + 1}. ${row.datetime} · ${row.strategy} · ${row.side ?? "—"} · ${row.setupStatus ?? "—"}`,
        );
        out.push(
          `   entry ${n(row.entry)} | SL ${n(row.sl)} | TP ${n(row.tp)} | RR ${row.rr === undefined ? "—" : row.rr.toFixed(2)}`,
        );
        out.push(`   reason: ${row.reason}`);
        out.push(`   outcome: ${row.statusNote ?? "—"}`);
      });
    }
  }

  out.push("");
  out.push(`--- ROLLING CUMULATIVE STATS (since ${input.firstDay}, ${input.daysCompleted} day(s)) ---`);
  const stats = [...input.stats.values()].sort((a, b) => b.triggers - a.triggers);
  if (stats.length === 0) {
    out.push("no triggers recorded yet");
  } else {
    for (const stat of stats) {
      out.push(
        `${stat.strategy}: triggers ${stat.triggers} · TP ${stat.tpHits} · SL ${stat.slHits} · win rate ${winRate(stat)}`,
      );
    }
    const total = stats.reduce(
      (acc, s) => ({
        strategyId: "all",
        strategy: "ALL STRATEGIES",
        triggers: acc.triggers + s.triggers,
        tpHits: acc.tpHits + s.tpHits,
        slHits: acc.slHits + s.slHits,
      }),
      { strategyId: "all", strategy: "ALL STRATEGIES", triggers: 0, tpHits: 0, slHits: 0 },
    );
    out.push(
      `TOTAL: triggers ${total.triggers} · TP ${total.tpHits} · SL ${total.slHits} · win rate ${winRate(total)}`,
    );
  }
  out.push("");
  return out.join("\n");
}

export function dayFileName(day: string): string {
  return `backtest_${day}.txt`;
}
