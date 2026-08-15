export type Trend = "bullish" | "bearish" | "ranging";

export type ResultStatus = "PASS" | "FAIL";

export interface Metadata {
  data_age: string;
  spread_convention: string;
  atr_method: string;
  similar_swing_selection_rule: string;
}

export const METADATA_FIELDS = [
  "data_age",
  "spread_convention",
  "atr_method",
  "similar_swing_selection_rule",
] as const;

export interface Candle {
  index: number;
  datetime: string;
  open?: number | undefined;
  high?: number | undefined;
  low?: number | undefined;
  close?: number | undefined;
  direction?: string | undefined;
  body?: number | undefined;
  upperWick?: number | undefined;
  lowerWick?: number | undefined;
  range?: number | undefined;
  bodyPercentOfRange?: number | undefined;
  upperWickPct?: number | undefined;
  lowerWickPct?: number | undefined;
  displacement?: string | undefined;
  isReliable?: boolean | undefined;
  localAvgRange?: number | undefined;
  session?: string | undefined;
  atr30m?: number | undefined;
  similarSwingRetracePct?: number | undefined;
  similarSwingContinuedPct?: number | undefined;
  similarSwingRefs: string[];
  unresolvedRefs: string[];
  swingInvalidated?: boolean | undefined;
  reliableStreakLength?: number | undefined;
  trend: Trend;
  invalid?: string | undefined;
  raw: Record<string, string>;
}

export interface Outcome {
  result: ResultStatus;
  reason: string;
  entry?: number | undefined;
  sl?: number | undefined;
  tp?: number | undefined;
  side?: "long" | "short" | undefined;
}

export interface AnalysisContext {
  meta: Metadata;
  candles: Candle[];
  byDatetime: Map<string, Candle>;
  ema50: (number | undefined)[];
  ema200: (number | undefined)[];
  blocks: import("./indicators").SessionBlock[];
  spread: number;
}

export interface StrategyCheck {
  id: string;
  name: string;
  run: (ctx: AnalysisContext, i: number) => Outcome;
}

export interface ResultRow {
  strategyId: string;
  strategy: string;
  index: number;
  datetime: string;
  result: ResultStatus;
  reason: string;
  trend: Trend;
  entry?: number | undefined;
  sl?: number | undefined;
  tp?: number | undefined;
  rr?: number | undefined;
  side?: "long" | "short" | undefined;
}

export interface OverlapEntry {
  datetime: string;
  strategies: string[];
}

export interface Analysis {
  meta: Metadata;
  spread: number;
  totalRows: number;
  analyzedRows: number;
  invalidRows: number;
  invalidRowList: { datetime: string; reason: string }[];
  results: ResultRow[];
  passing: ResultRow[];
  perStrategy: {
    strategyId: string;
    strategy: string;
    passCount: number;
    failCount: number;
    failReasons: { reason: string; count: number }[];
  }[];
  overlaps: OverlapEntry[];
  lastRowDatetime: string;
}