# token-radar-01-radar3

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Omega4T/token-radar-01-radar3/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Omega4T/token-radar-01-radar3/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Radar v5: every value term kept or dropped on two held-out tests plus walk-forward, token odds beside implied value, category shrinkage. A program that reads one frozen DefiLlama snapshot, ranks the pre-token protocols by what their token launch would be worth, shows how likely each one is to launch (as a proxy, beside the value, never multiplied into it), and gives each protocol a concrete 9-step farm plan.

## Method

- **Value model.** `log(mcap/TVL)` is regressed on the 128 protocols that have both a market cap and TVL. The log-TVL term is the baseline; nine further candidate terms (log-TVL squared, 7-day growth, log age, log chain count, log TVL per chain, two interactions, recency, and a category multiplier) are each tested as an addition on top of it. A term enters the final model only if it improves median log error by at least 0.02 on **both** held-out tests (H1 slug-hash 70/30 and H2 stratified by category), does not drop within-2x by more than 2 points, and does not worsen 2 of 3 walk-forward folds. On this snapshot **no additional term passed**, so the final value model is the one-term log-TVL baseline — stated on the dashboard cover, with the full decision table as proof. See `VALIDATION.md` and `DECISIONS.md`.
- **Token odds.** A separate logistic model, P(records a token), trained on all 758 protocols. Log age and the shrunk category effect passed the same selection machine (AUC gain ≥ 0.02 on both held-out tests); the odds are displayed beside implied value and never change the board order.
- **Category calibration.** Category multipliers are median residuals shrunk toward 1 by `n/(n+K)`, with K chosen from {5, 10, 20, 40} as the smallest K that passes selection; categories with fewer than 3 fit-set members get multiplier exactly 1. The value-model category term did not pass at any K, so no category moves implied value in this build; the odds-model category effect passed at K=5.
- **Board.** 200 rows: all 40 watchlist protocols plus the 160 highest-implied-value rankable pre-token protocols below the floor. A separate 24-row live-token view shows actual market caps, never mixed into the board.
- **Farm plans.** 9 steps per row, each naming concrete dollars, days or minutes derived from that protocol's own TVL, age, category and odds.

Data provenance: DefiLlama https://api.llama.fi/protocols, snapshot frozen 2026-11-14 (as_of 2026-11-14, fetched 2026-11-14T01:18:33Z). The snapshot is not in this repo; the program reads it from `/input/snapshot.json` at grade time. All figures are model estimates from that snapshot — not a promise of a future token, airdrop or price. Protocols are described as "records no token", never as "has no token".

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-kit>/input/snapshot.json
```

Requires Node.js 22.18 or later, standard library only, no network at run time. The program writes `out/board.json`, `out/data.js`, `out/validation.json`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json` (last, via the vendored `vendor/makefun-board.ts`).

Verify determinism (two runs, byte-identical outputs, plus a shuffled-input run):

```sh
mkdir -p outA outB && MAKEFUN_OUTPUT_DIR=outA node main.ts --input <path-to-kit>/input/snapshot.json && MAKEFUN_OUTPUT_DIR=outB node main.ts --input <path-to-kit>/input/snapshot.json && diff -r outA outB
```

Then open `out/dashboard/index.html` in a browser (it reads `../data.js`).

## Model limits

- Data is frozen 14 Nov 2026; nothing newer exists in this radar.
- Implied value is an estimate from historical market-cap/TVL ratios, not a price prediction.
- Token odds is a proxy for similarity to protocols that already record a token, not a true launch probability — the snapshot records no launch dates.
- Small categories barely move implied value because of shrinkage.
- Terms that failed selection were dropped and are named in the decision tables on the dashboard cover.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
