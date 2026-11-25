// radar-3 method constants (SPEC §2.4, §3.2, §3.4).
// ONLY method constants may live here. No fitted coefficient, no snapshot
// number, no slug and no category name is hardcoded anywhere in this repo:
// every fitted number is computed from the snapshot at run time.
export const METHOD = {
  // Selection thresholds (§3.2.4): median log-error improvement, in log units,
  // and the largest tolerated within-2x drop, in percentage points.
  KEEP_MIN_MEDIAN_GAIN: 0.02,
  KEEP_MAX_WITHIN2_DROP_PCT: 2,
  // A walk-forward fold fails a term when the term worsens median log error
  // by more than this on that fold; 2 failed folds drop the term (§3.2.4 K3).
  WF_WORSEN_LIMIT: 0.02,
  WF_FAIL_FOLDS: 2,
  // Walk-forward cutoffs (§3.2.3) and minimum fold sizes.
  WF_CUTOFFS: ['2025-01-01', '2025-06-01', '2025-09-01'],
  WF_MIN_TRAIN: 20,
  WF_MIN_TEST: 10,
  // Held-out H2: every 10th protocol per category, by slug order (§3.2.2).
  H2_EVERY_NTH: 10,
  // Category shrinkage grid (§3.4.3); smallest K that passes is used.
  SHRINKAGE_GRID: [5, 10, 20, 40],
  // A category with fewer than this many fit-set members gets multiplier
  // exactly 1: with 1-2 observations a median residual is an anecdote (§3.4.2).
  CATEGORY_MIN_N: 3,
  // Odds-model selection (§3.3.2): minimum held-out AUC gain on BOTH tests,
  // largest tolerated Brier worsening, walk-forward AUC drop that fails a fold.
  ODDS_MIN_AUC_GAIN: 0.02,
  ODDS_MAX_BRIER_WORSEN: 0.01,
  ODDS_WF_AUC_DROP: 0.02,
  // Odds bands (§3.3.4): Low < 20%, Medium 20-50%, High > 50%.
  ODDS_LOW_MAX: 20,
  ODDS_HIGH_MIN: 50,
  // Feature definitions (§3.1).
  GROWTH_CLAMP_LO: -60,
  GROWTH_CLAMP_HI: 120,
  RECENCY_DAYS: 180,
  // Board shape (§4.1): 40 watchlist rows + 160 early rows; 24 live rows.
  BOARD_ROWS: 200,
  EARLY_ROWS: 160,
  LIVE_ROWS: 24,
  // Farm plan rules (§4.3, retained as rules from radar-2).
  HOLD_YOUNG_DAYS: 60,
  HOLD_MID_DAYS: 45,
  HOLD_OLD_DAYS: 30,
  HOLD_YOUNG_MAX_AGE: 180,
  HOLD_MID_MAX_AGE: 365,
  CAPITAL_HUGE: 250,
  CAPITAL_LARGE: 150,
  CAPITAL_MID: 100,
  CAPITAL_SMALL: 50,
  CAPITAL_HUGE_MIN_TVL: 5_000_000_000,
  CAPITAL_LARGE_MIN_TVL: 1_000_000_000,
  CAPITAL_MID_MIN_TVL: 100_000_000,
  // Implied-value gate (§1.5).
  IMPLIED_MAX_USD: 100_000_000_000_000,
  // Rounding for deterministic output (§5.6): 3 decimals for log-domain
  // numbers, 4 for ratios, 3 for AUC/Brier.
  ROUND_LOG: 3,
  ROUND_RATIO: 4,
  ROUND_SCORE: 3,
} as const;
