import type { Outcome } from "./types";

export const RR_THRESHOLD = 2;
export const RR_FAIL_REASON = "RR below 1:2 threshold";

export interface SpreadAdjusted {
  entry: number;
  sl: number;
  tp: number;
  rr: number;
}

/**
 * Step 4: spread is applied only here. A long pays the spread on entry and gives
 * it back on the target; a short is the mirror image. Prices themselves come
 * from real OHLC rows before this adjustment.
 */
export function applySpreadAndRR(outcome: Outcome, spread: number): SpreadAdjusted | undefined {
  if (outcome.entry === undefined || outcome.sl === undefined || outcome.tp === undefined) {
    return undefined;
  }
  const long = outcome.side !== "short";
  const entry = long ? outcome.entry + spread : outcome.entry - spread;
  const sl = outcome.sl;
  const tp = outcome.tp;
  const risk = Math.abs(entry - sl);
  if (risk === 0) return { entry, sl, tp, rr: 0 };
  const rr = Math.abs(tp - entry) / risk;
  return { entry, sl, tp, rr };
}