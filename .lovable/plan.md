# Trading Strategy Analyzer

A standalone, fully client-side tool: upload a finished CSV (metadata header line + OHLC rows with precomputed columns), and it validates, computes market structure, runs 13 strategy checks per row, and reports results. Nothing is generated or estimated — every price traces back to a real row. No backend, no persistence (session only).

## Screens

Single page at `/`:

1. **Upload panel** — drag/drop or file picker for the CSV. Shows parse status.
2. **Validation gate** — blocks analysis and shows `INVALID FILE: missing metadata field [name]` if any of `data_age`, `spread_convention`, `atr_method`, `similar_swing_selection_rule` is missing/empty. Also shows the parsed metadata once valid.
3. **Summary panel** — total candles analyzed, total INVALID rows, per-strategy pass count, per-strategy fail counts grouped by reason, and a ranked list of all PASSing setups sorted by RR descending.
4. **Results table** — every strategy × relevant candle: datetime, strategy, PASS/FAIL, reason, trend context, entry, SL, TP, RR. Filter by strategy name and by result. Virtualized/paginated for up to ~5,000 rows.
5. **Export button** — downloads the final PASSing setups as CSV.

## Analysis pipeline

**Parse.** First non-empty line is JSON metadata; remaining lines are the header + data rows. `similar_swing_refs` is a JSON array of datetime strings (e.g. `["2026-08-06 08:30:00", ...]`) which are resolved back to rows in the file to get their high/low prices.

**Row validation.** Any row missing `open`, `high`, `low`, `close`, or `is_reliable` is marked `INVALID: missing core fields`, excluded from every strategy check, but still counted in the summary.

**Market structure (once, feeds all strategies).** For each row, take the last 5 swing highs/lows resolved from `similar_swing_refs`: rising highs + rising lows → `bullish`; falling highs + falling lows → `bearish`; otherwise `ranging`. Stored on every row.

**13 strategy checks**, each returning PASS/FAIL plus a specific reason string per row, implemented exactly as specified: BOS + Retest, Liquidity Sweep + Reclaim, Horizontal Range + Boundary Rejection, Order Block Return, FVG Fill, Pin Bar at Key Level, Engulfing at S/R, Pin Bar/Engulfing at 61.8% Fib, Pivot Point Rejection, Asian Sweep + London Reclaim, Opening Range Breakout + Retest, EMA 50/200 Pullback, Swing Failure Pattern. No row is skipped silently; when a needed field is absent the reason names that exact field (e.g. `missing field: displacement`).

**Math (PASS results only).** Entry/SL/TP are exact values pulled from actual OHLC rows. `spread_convention` from metadata is applied only at this final step. `RR = (TP − Entry) / (Entry − SL)`, spread-adjusted. RR ≤ 1:2 flips the result to FAIL with reason `RR below 1:2 threshold` and removes it from the passing list.

## Technical notes

- Route: rewrite `src/routes/index.tsx` with its own `head()` metadata (title/description/og/twitter).
- Pure TypeScript analysis modules under `src/lib/analyzer/`: `parse.ts` (CSV + metadata), `types.ts`, `structure.ts` (trend + swing resolution), `indicators.ts` (EMA 50/200, pivots, fib, session grouping), `strategies/` (one file per strategy exporting a common `StrategyCheck` signature), `run.ts` (orchestrates steps 1–4), `export.ts` (CSV download).
- Runs synchronously in the browser on upload (under 5,000 rows), with a progress state while computing.
- UI from existing shadcn primitives + semantic design tokens in `src/styles.css`; a distinct dark "terminal/trading desk" palette and typography added as tokens rather than hardcoded colors.
- Unit tests for the parser, structure detection, and a few strategy checks using synthetic rows.
