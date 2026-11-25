# meridian-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/adjiadjo/meridian-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/adjiadjo/meridian-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

**Meridian (`meridian-4`)** is a deterministic, zero-dependency pre-token launch radar and airdrop farming planner built on DefiLlama snapshots. Every valuation curve, blind ablation ladder, finite-sample conformal band, out-of-fold calibration check, and 200-refit bootstrap (for both value and odds coefficients) lives inside `dashboard/model.js` and refits live in the browser with zero truncation in `dossier.json`.

- **Full protocol accounting (`classifyUniverse`)**: partitions all 758 snapshot protocols into 11 mutually exclusive buckets (40/40 watchlist + 19 off-list + 134 early = 193 ranked pre-token protocols; 244 already-traded protocols kept strictly apart; 321 set aside across bridges, liquid/restaking, versioned, CEX, wrapped, and traded-kin filters).
- **Blind-validated implied valuation (`fitSizeCurve`, `fitLaunchOdds`, `runValueValidation`, `runOddsValidation`, `runBootstrap`)**: ridge power-law launch cap with 7-day TVL carry (`$12.8M × (TVL × carry / $100M)^0.39`, Walk-Forward miss `×2.09` vs `×4.52` flat, LOO `×3.22`, finite-sample LOO conformal P25–P75 / P10–P90 bands with `60% / 71%` WF coverage) multiplied by a strictly decaying 24-month remaining launch hazard (`L2` logistic regression with `ln(1 + age)` and `λ = 2.0` over 437 standalone peers, Walk-Forward Brier `0.2077` vs `0.3045` base, 10-Fold `0.1909`, 10-Fold OOF `ECE 2.8%`; 3-hash slug-noise placebo control `0.1936 / 0.2153`). Full 200-refit bootstrap SEs reported for value and odds parameters. Zero hardcoded protocol names (`0/193`).
- **Proportional costed & timed farm plans (`evaluateFarmScenario`, `optimalFarmScenario`, `buildFarmPlan`)**: sizes each plan to `0.02%` of TVL (`$1K–$100K`) on the protocol's lowest-cost listed chain, nets cash gas and bridge fees (with 4% T-bill opportunity benchmark shown alongside), enforces strict positive-net verdicts (`62 FARM` at net > `$0` & `$25+/h`, `107 MARGINAL` at net > `$0`, `24 SKIP` at net ≤ `$0`), and outputs 8 chronological, costed, timed steps plus live 2D Drop × Deposit and Horizon sensitivity matrices.
- **Self-contained dark terminal dashboard**: zero frameworks, zero external requests, refits live in the browser, and verifies exact checksum parity (`f3855603`) with `board.json`.

## Run it

```sh
node main.ts --input /input/snapshot.json --output /output
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=g120sepc&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
