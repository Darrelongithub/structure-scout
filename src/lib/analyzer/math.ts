import type { Outcome } from "./types";

export const RR_THRESHOLD = 2;
export const RR_FAIL_REASON = "RR below 1:2 threshold";
export const SL_SIDE_REASON = "INVALID: SL on wrong side of entry";
export const TP_IMPLAUSIBLE_REASON = "INVALID: TP distance implausible";
/** TP further than this multiple of atr_30m from entry is treated as broken math. */
export const TP_ATR_MULTIPLE = 10;
export const NON_POSITIVE_RISK_REASON = "INVALID: non-positive risk — SL invalid for direction";

export interface SpreadAdjusted {
  entry: number;
  sl: number;
  tp: number;
  /** Signed RR. Undefined when risk is non-positive (never faked with abs()). */
  rr?: number | undefined;
  invalidReason?: string | undefined;
}

/**
 * Step 4: spread is applied only here. A long pays the spread on entry and gives
 * it back on the target; a short is the mirror image. Prices themselves come
 * from real OHLC rows before this adjustment.
 */
export function applySpreadAndRR(
  outcome: Outcome,
  spread: number,
  atr30m?: number | undefined,
): SpreadAdjusted | undefined {
  if (outcome.entry === undefined || outcome.sl === undefined || outcome.tp === undefined) {
    return undefined;
  }
  const long = outcome.side !== "short";
  const entry = long ? outcome.entry + spread : outcome.entry - spread;
  const sl = outcome.sl;
  const tp = outcome.tp;
  // Safety net: the stop must sit on the losing side of the entry.
  if (long ? sl >= entry : sl <= entry) {
    return { entry, sl, tp, invalidReason: SL_SIDE_REASON };
  }
  // Safety net: an implausibly distant target means the TP level was picked
  // from the wrong place, regardless of which strategy produced it.
  if (atr30m !== undefined && atr30m > 0 && Math.abs(tp - entry) > TP_ATR_MULTIPLE * atr30m) {
    return { entry, sl, tp, invalidReason: TP_IMPLAUSIBLE_REASON };
  }
  const risk = long ? entry - sl : sl - entry;
  if (risk <= 0) {
    return { entry, sl, tp, invalidReason: NON_POSITIVE_RISK_REASON };
  }
  // Signed reward: a target on the wrong side yields a negative RR, never abs().
  const reward = long ? tp - entry : entry - tp;
  return { entry, sl, tp, rr: reward / risk };
}