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
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  direction?: string;
  body?: number;
  upperWick?: number;
  lowerWick?: number;
  range?: number;
  bodyPercentOfRange?: number;
  upperWickPct?: number;
  lowerWickPct?: number;
  displacement?: string;
  isReliable?: boolean;
  localAvgRange?: number;
  session?: string;
  atr30m?: number;
  similarSwingRetracePct?: number;
  similarSwingContinuedPct?: number;
  similarSwingRefs: string[];
  unresolvedRefs: string[];
  swingInvalidated?: boolean;
  reliableStreakLength?: number;
  trend: Trend;
  invalid?: string;
  raw: Record<string, string>;
}

export interface Outcome {
  result: ResultStatus;
  reason: string;
  entry?: number;
  sl?: number;
  tp?: number;
  side?: "long" | "short";
}

export interface AnalysisContext {
  meta: Metadata;
  candles: Candle[];
  byDatetime: Map<string, Candle>;
  ema50: (number | undefined)[];
  ema200: (number | undefined)[];
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
  entry?: number;
  sl?: number;
  tp?: number;
  rr?: number;
  side?: "long" | "short";
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