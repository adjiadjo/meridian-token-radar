# meridian-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/adjiadjo/meridian-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/adjiadjo/meridian-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

**Meridian** is a deterministic, zero-dependency pre-token launch radar and airdrop farming planner built on DefiLlama snapshots.

- **Full protocol accounting (`classifyUniverse`)**: partitions all 758 snapshot protocols into 11 mutually exclusive buckets (40/40 watchlist + 19 off-list + 134 early = 193 ranked pre-token protocols; 244 already-traded protocols kept apart; 321 set aside across bridges, liquid/restaking, versioned, CEX, wrapped, and traded-kin filters).
- **Blind-validated implied valuation (`fitSizeCurve` + `fitLaunchOdds`)**: ridge-stabilized power-law launch cap (`$12.9M × (TVL/$100M)^0.394`, Walk-Forward miss `×2.12` vs `×4.37` flat, finite-sample LOO conformal P25–P75 / P10–P90 bands with `59% / 75%` WF coverage) multiplied by a 24-month conditional launch hazard (`L2` logistic regression over 437 standalone peers, Walk-Forward Brier `0.207` vs `0.304` base; 5-seed slug-hash placebo negative control). Zero hardcoded protocol names (`0/193`).
- **Concrete costed & timed farm plans (`evaluateFarmScenario` + `buildFarmPlan`)**: selects each protocol's lowest-cost listed chain, scales capital (`≤ min($25K, 0.05% TVL)`), nets gas, bridge fees, and 1.5% capital spread (with 4% T-bill benchmark shown), and outputs 8 chronological, costed, timed steps plus live 2D Drop × Deposit and Horizon sensitivity matrices.
- **Self-contained dark terminal dashboard**: zero frameworks, zero external requests, refits the model live in the browser and verifies exact checksum parity with `board.json`.

## Run it

```sh
node main.ts --input /input/snapshot.json --output /output
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=g120sepc&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
