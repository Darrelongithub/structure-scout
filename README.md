# Structure Scout

Here's the full build prompt for the new, separate Lovable project — the analyzer. Paste this in fresh.

---

**Build a trading strategy analyzer app. This is a standalone tool — it does NOT generate OHLC data. It only receives a finished CSV (already containing OHLC + precomputed columns) and analyzes it.**

**Input:**

A CSV upload containing a metadata header line (JSON with `data_age`, `spread_convention`, `atr_method`, `similar_swing_selection_rule`) followed by rows with columns: `datetime, open, high, low, close, direction, body, upper_wick, lower_wick, range, body_percent_of_range, upper_wick_pct, lower_wick_pct, displacement, is_reliable, local_avg_range, session, atr_30m, similar_swing_retrace_pct, similar_swing_continued_pct, similar_swing_refs, swing_invalidated, reliable_streak_length`.

**Step 1 — Validation gate (run before any analysis):**

- Confirm all 4 metadata fields are present and non-empty. If any is missing, stop and output: "INVALID FILE: missing metadata field [name]" — do not proceed to analysis.

- For every row, confirm `open, high, low, close, is_reliable` are present. If any row is missing these, label it `"INVALID: missing core fields"` and exclude it from all strategy checks (but still count it in the summary).

**Step 2 — Compute Market Structure (foundation layer, runs once, feeds every strategy below):**

For every row, using the last 5 swing highs/lows derived from `similar_swing_refs`:

- Rising highs + rising lows → `trend = bullish`

- Falling highs + falling lows → `trend = bearish`

- Neither → `trend = ranging`

Store this trend value against every row.

**Step 3 — Run these 13 strategy checks against every row. Every row gets a PASS or FAIL result for each strategy, with a specific reason string. Never skip a row silently, never estimate a missing value — if data needed for a check is missing, the reason must say exactly which field was missing.**

1. **Break of Structure + Retest** — `displacement = Yes` candle breaks a prior swing in `trend` direction; retest within 1-4 candles; retest `is_reliable = true`; retrace within `similar_swing_retrace_pct` range; `swing_invalidated = false`. Entry: retest high/low. SL: beyond retest candle. TP: next structure level.

2. **Liquidity Sweep + Reclaim** — wick exceeds a swing level from `similar_swing_refs`, close moves back inside; `upper_wick_pct`/`lower_wick_pct` ≥ 55%; `is_reliable = true`; `swing_invalidated = false`. Entry: reclaim close. SL: beyond wick extreme. TP: opposing swing.

3. **Horizontal Range + Boundary Rejection** — 3+ swing highs within 0.3% of each other AND 3+ swing lows within 0.3% of each other define a range; rejection at boundary with wick ≥ 50%; `is_reliable = true`. Entry: rejection close. SL: beyond boundary. TP: opposite boundary.

4. **Order Block Return** — last opposing candle before a `displacement = Yes` impulse; price returns to that range; order block candle `is_reliable = true`; `swing_invalidated = false` at that level. Entry: touch of order block. SL: beyond order block extreme. TP: measured move from impulse.

5. **Fair Value Gap Fill** — 3-candle sequence with non-overlapping high/low gap; price returns to fill it; gap candles `is_reliable = true`; gap in `trend` direction. Entry: gap edge touch. SL: beyond gap origin. TP: next structure level.

6. **Pin Bar at Key Level** — `upper_wick_pct`/`lower_wick_pct` ≥ 60%, `body_percent_of_range` ≤ 35%, at a level from `similar_swing_refs`, `is_reliable = true`, aligned with `trend`. Entry: pin bar close. SL: beyond wick. TP: opposing swing.

7. **Engulfing at Support/Resistance** — candle body fully engulfs prior candle body, at a level from `similar_swing_refs`, both candles `is_reliable = true`, aligned with `trend`. Entry: engulfing close. SL: beyond engulfing extreme. TP: opposing swing.

8. **Pin Bar/Engulfing at 61.8% Fib** — compute 61.8% retracement of a prior swing; price within 0.5% of that level with pattern from rule 6 or 7; `is_reliable = true`; aligned with `trend`. Entry: pattern close. SL: beyond pattern extreme. TP: swing origin.

9. **Pivot Point Rejection** — compute Pivot = (prior session H+L+C)/3, R1/S1 = pivot ± (prior session range); rejection at these levels, wick ≥ 50%; `is_reliable = true`. Entry: rejection close. SL: beyond pivot level. TP: next pivot level.

10. **Asian Sweep + London Reclaim** — sweep beyond Asian session's own high/low during `session = asian`; reclaim during `session = london` within first few candles; sweep candle `is_reliable = true`. Entry: reclaim close. SL: beyond sweep extreme. TP: opposing session boundary.

11. **Opening Range Breakout + Retest** — opening range = first 2 candles of `session = london` or `session = ny`; breakout with `displacement = Yes`; retest with `is_reliable = true`. Entry: retest close. SL: beyond opening range boundary. TP: measured move.

12. **EMA 50/200 Pullback** — compute EMA-50 and EMA-200 from `close`; trend-aligned EMA order; pullback to EMA-50 with rejection wick ≥ 45%; `is_reliable = true`. Entry: rejection close. SL: beyond EMA-50 touch. TP: next structure level.

13. **Swing Failure Pattern** — price breaks a swing but fails, closes back within 1-2 candles, wick ≥ 50%; `is_reliable = true`; `swing_invalidated = false`. Entry: failure close. SL: beyond failed break extreme. TP: opposing swing.

**Step 4 — Math (apply only to PASS results, never estimate):**

- All entry/SL/TP prices must be exact values pulled from actual OHLC rows — no invented numbers.

- Apply `spread_convention` from metadata only at this final step.

- RR = (TP − Entry) / (Entry − SL), spread-adjusted.

- If RR ≤ 1:2, change result to FAIL with reason "RR below 1:2 threshold" — do not include in final passing list.

**Step 5 — Output, displayed in the app:**

- A results table: every strategy × relevant candles, showing PASS/FAIL, reason, trend context, entry, SL, TP, RR.

- A summary panel: total candles analyzed, total INVALID rows, pass count per strategy, fail count per strategy (grouped by reason), and a final ranked list of all PASSing setups sorted by RR descending.

- Allow filtering the table by strategy name and by result (PASS/FAIL).

- Add a button to export the final PASSing setups list as CSV.

**No estimating, no filling in missing values, no invented prices. Every result must trace back to real data in the uploaded file.**

---

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1e91eb61-2c0e-4f00-9a20-c801846504f5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
