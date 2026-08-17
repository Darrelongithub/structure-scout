# Trend Scout

https://github.com/Darrelongithub/structure-scout.git





I've built the analysis core, but the app isn't wired up yet. Here's where things stand.




Done

- `src/lib/analyzer/types.ts` — candle, outcome, result and analysis types

- `src/lib/analyzer/parse.ts` — JSON metadata header gate (`INVALID FILE: missing metadata field [name]`), quoted-CSV row parsing, core-field validation (`INVALID: missing core fields`), spread extraction from `spread_convention`

- `src/lib/analyzer/structure.ts` — swing-ref resolution (tracking unresolved refs separately) and the once-per-file trend computation

- `src/lib/analyzer/indicators.ts` — EMA 50/200, session blocks, pivot levels, 61.8% fib, tolerance helpers

- `src/lib/analyzer/strategies/` — all 13 strategy checks plus shared helpers that emit exact `missing field: <name>` and `INVALID: unresolved swing reference [datetime]` reasons, and a registry in `index.ts`

- `src/lib/analyzer/math.ts` — spread application and RR with the 1:2 threshold reason

- vitest installed as a dev dependency




Remaining

- `src/lib/analyzer/run.ts` — orchestrate all steps, build per-strategy pass/fail counts grouped by reason, overlap detection, ranked passing list

- `src/lib/analyzer/export.ts` — auto-download `.txt` (`=== SUMMARY ===` / `=== RESULTS ===`) named from the last row's datetime

- UI: rewrite `src/routes/index.tsx` with upload panel, status dot, summary panel (prominent `data_age`), filterable results table, zero-PASS state, plus the blue dark tokens in `src/styles.css`

- Unit tests: parser, structure, RR math, unresolved-ref path, and one PASS/FAIL file per strategy




Nothing is user-visible yet — `/` still shows the template placeholder until the route and `run.ts` land.




I want you to finish building it

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6964e3c5-0089-40d0-8c19-6a48917665dc).

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
