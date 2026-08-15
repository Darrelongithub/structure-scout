import { blockContaining, pivotLevels, previousBlock, sessionBlocks, type SessionBlock } from "../indicators";
import { fail, pass, requireFields, valid } from "./util";
import type { StrategyCheck } from "../types";

const cache = new WeakMap<object, SessionBlock[]>();

function blocks(ctx: { candles: unknown[] }): SessionBlock[] {
  const key = ctx as object;
  const existing = cache.get(key);
  if (existing) return existing;
  const computed = sessionBlocks((ctx as { candles: never[] }).candles);
  cache.set(key, computed);
  return computed;
}

export const pivotRejection: StrategyCheck = {
  id: "pivot_rejection",
  name: "Pivot Point Rejection",
  run: (ctx, i) => {
    const c = ctx.candles[i];
    if (!valid(c)) return fail("INVALID: missing core fields");
    const missing = requireFields(c, ["isReliable", "session", "upperWickPct", "lowerWickPct"]);
    if (missing) return missing;
    if (!c.isReliable) return fail("is_reliable = false");
    const all = blocks(ctx);
    const own = blockContaining(all, i);
    if (!own) return fail("candle is not inside a resolvable session block");
    const prior = previousBlock(all, own.start);
    if (!prior) return fail("no prior session available to compute pivot levels");
    const { pivot, r1, s1 } = pivotLevels(prior);
    const levels: { name: string; value: number }[] = [
      { name: "S1", value: s1 },
      { name: "Pivot", value: pivot },
      { name: "R1", value: r1 },
    ];
    const tolerance = (prior.high - prior.low) * 0.1;
    for (const level of levels) {
      const touchedHigh = c.high! >= level.value && c.close! < level.value;
      const touchedLow = c.low! <= level.value && c.close! > level.value;
      if (touchedHigh && Math.abs(c.high! - level.value) <= tolerance + (prior.high - prior.low)) {
        if (c.upperWickPct! < 50) return fail(`upper_wick_pct ${c.upperWickPct}% below 50% at ${level.name}`);
        const below = levels.filter((l) => l.value < c.close!).sort((a, b) => b.value - a.value)[0];
        if (!below) return fail(`no lower pivot level below close to target from ${level.name}`);
        return pass(`rejected ${level.name} at ${level.value.toFixed(5)}`, "short", c.close!, c.high!, below.value);
      }
      if (touchedLow && Math.abs(level.value - c.low!) <= tolerance + (prior.high - prior.low)) {
        if (c.lowerWickPct! < 50) return fail(`lower_wick_pct ${c.lowerWickPct}% below 50% at ${level.name}`);
        const above = levels.filter((l) => l.value > c.close!).sort((a, b) => a.value - b.value)[0];
        if (!above) return fail(`no higher pivot level above close to target from ${level.name}`);
        return pass(`rejected ${level.name} at ${level.value.toFixed(5)}`, "long", c.close!, c.low!, above.value);
      }
    }
    return fail("no rejection at Pivot, R1 or S1");
  },
};