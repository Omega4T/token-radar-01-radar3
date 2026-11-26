// Model v3 (§3): OLS value model, logistic token-odds model, category
// shrinkage, and the selection machine (two held-out tests + walk-forward).
// All fits happen at run time from the snapshot. No fitted number is a
// constant anywhere in this file.
import { METHOD } from './constants.ts';
import {
  ageDays,
  h2TestSlugs,
  mean,
  median,
  std,
  valueFeatures,
  walkForwardFolds,
  type OddsFeatures,
  type Protocol,
  type ValueFeatures,
} from './features.ts';

// ------------------------------------------------------------------
// Small numeric helpers (written from the textbook definitions).
// ------------------------------------------------------------------
export function roundTo(x: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}

// OLS by normal equations + Gaussian elimination with partial pivoting.
// A tiny ridge on non-intercept diagonals keeps the solve stable when a
// term is nearly collinear with log TVL (notably x2).
export function ols(design: number[][], y: number[]): number[] {
  const k = design[0]!.length;
  const a: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const b: number[] = new Array<number>(k).fill(0);
  for (let i = 0; i < design.length; i++) {
    const row = design[i]!;
    for (let j = 0; j < k; j++) {
      b[j]! += row[j]! * y[i]!;
      for (let l = 0; l < k; l++) a[j]![l]! += row[j]! * row[l]!;
    }
  }
  for (let j = 1; j < k; j++) a[j]![j]! += 1e-9;
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[piv]![c]!)) piv = r;
    [a[c], a[piv]] = [a[piv]!, a[c]!];
    [b[c], b[piv]] = [b[piv]!, b[c]!];
    const d = a[c]![c]!;
    for (let r = c + 1; r < k; r++) {
      const f = a[r]![c]! / d;
      for (let l = c; l < k; l++) a[r]![l]! -= f * a[c]![l]!;
      b[r]! -= f * b[c]!;
    }
  }
  const beta = new Array<number>(k).fill(0);
  for (let r = k - 1; r >= 0; r--) {
    let s = b[r]!;
    for (let l = r + 1; l < k; l++) s -= a[r]![l]! * beta[l]!;
    beta[r] = s / a[r]![r]!;
  }
  return beta;
}

export const dot = (beta: number[], row: number[]): number =>
  row.reduce((s, x, j) => s + x * beta[j]!, 0);

// Logistic regression by batch gradient descent on standardised features.
// Deterministic: fixed step, zero start, at most `iters` iterations.
// Early stop: once the largest gradient component drops below 1e-6 the
// remaining updates move beta by < 1e-9 per step, so the fit has
// converged and further iterations only burn CPU. The stop depends only
// on the data, never on wall time, so runs stay deterministic. Fits that
// have not converged by the cap still run the full 800 iterations.
export function logisticFit(design: number[][], y: number[], iters = 800, lr = 0.5): number[] {
  const k = design[0]!.length;
  const beta = new Array<number>(k).fill(0);
  for (let it = 0; it < iters; it++) {
    const grad = new Array<number>(k).fill(0);
    for (let i = 0; i < design.length; i++) {
      const z = Math.max(-30, Math.min(30, dot(beta, design[i]!)));
      const err = 1 / (1 + Math.exp(-z)) - y[i]!;
      for (let j = 0; j < k; j++) grad[j]! += err * design[i]![j]!;
    }
    let maxGrad = 0;
    for (let j = 0; j < k; j++) maxGrad = Math.max(maxGrad, Math.abs(grad[j]!));
    if (maxGrad < 1e-6) break;
    for (let j = 0; j < k; j++) beta[j]! -= (lr * grad[j]!) / design.length;
  }
  return beta;
}

export const sigmoid = (z: number): number => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

export function auc(y: number[], score: number[]): number {
  const pos: number[] = [];
  const neg: number[] = [];
  y.forEach((v, i) => (v === 1 ? pos : neg).push(score[i]!));
  if (pos.length === 0 || neg.length === 0) return 0.5;
  // Rank-based Mann-Whitney U: exactly the pairwise concordance (a tie
  // contributes 0.5 via the average rank), but O(n log n) instead of
  // O(pos x neg) — the pairwise loop is the only superlinear piece.
  const order = score.map((_, i) => i).sort((a, b) => score[a]! - score[b]!);
  let rankSumPos = 0;
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && score[order[j + 1]!] === score[order[i]!]) j++;
    const avgRank = (i + 1 + j + 1) / 2; // 1-based average rank of the tie group
    for (let k = i; k <= j; k++) if (y[order[k]!] === 1) rankSumPos += avgRank;
    i = j + 1;
  }
  const nPos = pos.length;
  const nNeg = neg.length;
  return (rankSumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

export const brier = (y: number[], p: number[]): number =>
  mean(y.map((v, i) => (p[i]! - v) ** 2));

// ------------------------------------------------------------------
// Value-model metrics (§3.2.1). Median absolute log error is primary;
// within-2x percentage is the guard; R2 over y and MAPE over mcap are
// reported alongside.
// ------------------------------------------------------------------
export interface ValueMetrics {
  medianLogError: number;
  within2Pct: number;
  r2: number;
  mapePct: number;
  n: number;
}

export function valueMetrics(yTrue: number[], yPred: number[]): ValueMetrics {
  const errs = yTrue.map((y, i) => Math.abs(yPred[i]! - y));
  const within2 = (errs.filter((e) => e <= Math.log(2)).length / errs.length) * 100;
  const ym = mean(yTrue);
  const ssTot = yTrue.reduce((s, y) => s + (y - ym) ** 2, 0);
  const ssRes = yTrue.reduce((s, y, i) => s + (y - yPred[i]!) ** 2, 0);
  const mape =
    mean(yTrue.map((y, i) => Math.abs(Math.exp(yPred[i]!) - Math.exp(y)) / Math.exp(y))) * 100;
  return { medianLogError: median(errs), within2Pct: within2, r2: 1 - ssRes / ssTot, mapePct: mape, n: yTrue.length };
}

// ------------------------------------------------------------------
// Category shrinkage (§3.4.2). Raw multiplier m_k = exp(median residual
// of the category) in ratio scale; shrunk toward 1 by n_k / (n_k + K);
// categories with n_k < 3 get exactly 1 (log offset 0).
// ------------------------------------------------------------------
export function categoryLogOffsets(
  fit: Protocol[],
  trainIdx: number[],
  predict: (i: number) => number,
  y: number[],
  k: number,
): Map<string, number> {
  const residuals = new Map<string, number[]>();
  for (const i of trainIdx) {
    const key = fit[i]!.category ?? '\u0000null';
    if (!residuals.has(key)) residuals.set(key, []);
    residuals.get(key)!.push(y[i]! - predict(i));
  }
  const out = new Map<string, number>();
  for (const [key, rs] of residuals) {
    if (rs.length < METHOD.CATEGORY_MIN_N) {
      out.set(key, 0);
      continue;
    }
    const m = Math.exp(median(rs));
    const shrunk = 1 + (rs.length / (rs.length + k)) * (m - 1);
    out.set(key, Math.log(shrunk));
  }
  return out;
}

// ------------------------------------------------------------------
// Value-term selection (§3.2). One forward-selection pass: each candidate
// term is tested as an addition on top of the T1 baseline, on H1, on H2
// and on each valid walk-forward fold. KEEP needs K1 and K2 (median
// log-error gain >= 0.02 on both held-out tests, within-2x not down more
// than 2 points on either) and K3 (no worsening > 0.02 on 2+ valid folds).
// ------------------------------------------------------------------
export type TermId = 'x2' | 'x3' | 'x4' | 'x5' | 'x6' | 'x7' | 'x8' | 'x10' | 'T9';
export const VALUE_TERM_LABELS: Record<TermId, string> = {
  x2: 'log TVL squared (scale curvature)',
  x3: '7d TVL growth, clamped [-60,+120]%',
  x4: 'log age (log(1+age_days))',
  x5: 'log chain count',
  x6: 'log TVL per chain',
  x7: 'growth x centred log TVL',
  x8: 'centred log age x growth',
  x10: 'recency: age < 180 days',
  T9: 'category multiplier with shrinkage',
};

export interface SplitResult {
  withTerm: ValueMetrics;
  baseline: ValueMetrics;
  medianGain: number; // baseline median error minus with-term median error
  within2Change: number; // with-term within-2x minus baseline within-2x
}

export interface FoldResult extends SplitResult {
  cutoff: string;
  valid: boolean;
  skippedReason: string | null;
  worsened: boolean; // with-term median error worse than baseline by > 0.02
}

export interface TermVerdict {
  term: TermId;
  label: string;
  k: number | null; // shrinkage K, only for T9
  h1: SplitResult;
  h2: SplitResult;
  folds: FoldResult[];
  decision: 'KEEP' | 'DROP';
  reason: string;
}

function splitResult(
  fitIdx: number[],
  trainIdx: number[],
  testIdx: number[],
  cols: (keyof ValueFeatures)[],
  feats: ValueFeatures[],
  y: number[],
): SplitResult {
  const design = (idx: number[]): number[][] => idx.map((i) => [1, ...cols.map((c) => feats[i]![c] as number)]);
  const beta = ols(design(trainIdx), trainIdx.map((i) => y[i]!));
  const pred = design(testIdx).map((row) => dot(beta, row));
  const baseBeta = ols(trainIdx.map((i) => [1, feats[i]!.x1]), trainIdx.map((i) => y[i]!));
  const basePred = testIdx.map((i) => baseBeta[0]! + baseBeta[1]! * feats[i]!.x1);
  const truth = testIdx.map((i) => y[i]!);
  const withTerm = valueMetrics(truth, pred);
  const baseline = valueMetrics(truth, basePred);
  return {
    withTerm,
    baseline,
    medianGain: baseline.medianLogError - withTerm.medianLogError,
    within2Change: withTerm.within2Pct - baseline.within2Pct,
  };
}

function t9SplitResult(
  fit: Protocol[],
  trainIdx: number[],
  testIdx: number[],
  feats: ValueFeatures[],
  y: number[],
  k: number,
): SplitResult {
  const baseBeta = ols(trainIdx.map((i) => [1, feats[i]!.x1]), trainIdx.map((i) => y[i]!));
  const offsets = categoryLogOffsets(fit, trainIdx, (i) => baseBeta[0]! + baseBeta[1]! * feats[i]!.x1, y, k);
  const pred = testIdx.map(
    (i) => baseBeta[0]! + baseBeta[1]! * feats[i]!.x1 + (offsets.get(fit[i]!.category ?? '\u0000null') ?? 0),
  );
  const basePred = testIdx.map((i) => baseBeta[0]! + baseBeta[1]! * feats[i]!.x1);
  const truth = testIdx.map((i) => y[i]!);
  const withTerm = valueMetrics(truth, pred);
  const baseline = valueMetrics(truth, basePred);
  return {
    withTerm,
    baseline,
    medianGain: baseline.medianLogError - withTerm.medianLogError,
    within2Change: withTerm.within2Pct - baseline.within2Pct,
  };
}

function decideValue(h1: SplitResult, h2: SplitResult, folds: FoldResult[]): { decision: 'KEEP' | 'DROP'; reason: string } {
  const g = METHOD.KEEP_MIN_MEDIAN_GAIN;
  const w = METHOD.KEEP_MAX_WITHIN2_DROP_PCT;
  if (h1.medianGain < g) return { decision: 'DROP', reason: `gagal K1: H1 membaik ${h1.medianGain.toFixed(3)} < ${g}` };
  if (h1.within2Change < -w) return { decision: 'DROP', reason: `gagal K1: H1 within-2x turun ${(-h1.within2Change).toFixed(1)} poin > ${w}` };
  if (h2.medianGain < g) return { decision: 'DROP', reason: `gagal K2: H2 membaik ${h2.medianGain.toFixed(3)} < ${g}` };
  if (h2.within2Change < -w) return { decision: 'DROP', reason: `gagal K2: H2 within-2x turun ${(-h2.within2Change).toFixed(1)} poin > ${w}` };
  const badFolds = folds.filter((f) => f.valid && f.worsened);
  if (badFolds.length >= METHOD.WF_FAIL_FOLDS) {
    return { decision: 'DROP', reason: `gagal K3: walk-forward memburuk > ${METHOD.WF_WORSEN_LIMIT} pada ${badFolds.length} fold (${badFolds.map((f) => f.cutoff).join(', ')})` };
  }
  return { decision: 'KEEP', reason: `lolos K1+K2+K3: H1 +${h1.medianGain.toFixed(3)}, H2 +${h2.medianGain.toFixed(3)}, ${badFolds.length} fold memburuk` };
}

export interface ValueSelection {
  verdicts: TermVerdict[];
  keptTerms: TermId[];
  keptK: number | null;
  h1TestN: number;
  h2TestN: number;
  h2SmallCategories: number; // fit-set categories with <10 members (no H2 test)
  baselineH1: ValueMetrics;
  baselineH2: ValueMetrics;
  finalH1: ValueMetrics;
  finalH2: ValueMetrics;
  finalWfWins: number; // valid folds where final beats baseline on median error
  finalWfValid: number;
}

export function selectValueTerms(
  fit: Protocol[],
  feats: ValueFeatures[],
  y: number[],
): ValueSelection {
  const all = fit.map((_, i) => i);
  const h1Test = all.filter((i) => {
    let s = 0;
    for (const c of fit[i]!.slug) s += c.charCodeAt(0);
    return s % 10 >= 7;
  });
  const h1Train = all.filter((i) => !h1Test.includes(i));
  const h2Set = h2TestSlugs(fit);
  const h2Test = all.filter((i) => h2Set.has(fit[i]!.slug));
  const h2Train = all.filter((i) => !h2Set.has(fit[i]!.slug));
  const folds = walkForwardFolds(fit);
  const foldIdx = folds.map((f) => ({ cutoff: f.cutoff, train: f.train, test: f.test, valid: f.valid, skippedReason: f.skippedReason }));

  const h2SmallCategories = new Set(fit.map((p) => p.category ?? '\u0000null')).size -
    (() => { const counts = new Map<string, number>(); for (const p of fit) counts.set(p.category ?? '\u0000null', (counts.get(p.category ?? '\u0000null') ?? 0) + 1); return [...counts.values()].filter((n) => n >= METHOD.H2_EVERY_NTH).length; })();

  const verdicts: TermVerdict[] = [];
  const plainTerms: TermId[] = ['x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x10'];
  for (const term of plainTerms) {
    const h1 = splitResult(fit, h1Train, h1Test, ['x1', term], feats, y);
    const h2 = splitResult(fit, h2Train, h2Test, ['x1', term], feats, y);
    const foldResults: FoldResult[] = foldIdx.map((f) => {
      if (!f.valid) return { ...splitResult(fit, f.train, f.test, ['x1', term], feats, y), cutoff: f.cutoff, valid: false, skippedReason: f.skippedReason, worsened: false };
      const r = splitResult(fit, f.train, f.test, ['x1', term], feats, y);
      return { ...r, cutoff: f.cutoff, valid: true, skippedReason: null, worsened: r.medianGain < -METHOD.WF_WORSEN_LIMIT };
    });
    const { decision, reason } = decideValue(h1, h2, foldResults);
    verdicts.push({ term, label: VALUE_TERM_LABELS[term], k: null, h1, h2, folds: foldResults, decision, reason });
  }
  // T9: try each K in the grid, smallest passing K wins (§3.4.3).
  const t9ByK: TermVerdict[] = METHOD.SHRINKAGE_GRID.map((k) => {
    const h1 = t9SplitResult(fit, h1Train, h1Test, feats, y, k);
    const h2 = t9SplitResult(fit, h2Train, h2Test, feats, y, k);
    const foldResults: FoldResult[] = foldIdx.map((f) => {
      if (!f.valid) return { ...t9SplitResult(fit, f.train, f.test, feats, y, k), cutoff: f.cutoff, valid: false, skippedReason: f.skippedReason, worsened: false };
      const r = t9SplitResult(fit, f.train, f.test, feats, y, k);
      return { ...r, cutoff: f.cutoff, valid: true, skippedReason: null, worsened: r.medianGain < -METHOD.WF_WORSEN_LIMIT };
    });
    const { decision, reason } = decideValue(h1, h2, foldResults);
    return { term: 'T9' as TermId, label: `${VALUE_TERM_LABELS.T9} (K=${k})`, k, h1, h2, folds: foldResults, decision, reason };
  });
  verdicts.push(...t9ByK);
  const keptK = t9ByK.find((v) => v.decision === 'KEEP')?.k ?? null;
  const keptTerms: TermId[] = plainTerms.filter((t) => verdicts.find((v) => v.term === t)!.decision === 'KEEP');
  if (keptK !== null) keptTerms.push('T9');

  // Final model vs baseline on the same held-out tests (§3.2.1, §3.5).
  const finalCols = ['x1', ...keptTerms.filter((t) => t !== 'T9')] as (keyof ValueFeatures)[];
  const finalH1 = (() => {
    if (keptTerms.length === 0) return splitResult(fit, h1Train, h1Test, [], feats, y).baseline;
    const r = splitResult(fit, h1Train, h1Test, finalCols, feats, y);
    if (keptK === null) return r.withTerm;
    // Final with T9: baseline+kept terms OLS, then category offsets on top.
    const beta = ols(h1Train.map((i) => [1, ...finalCols.map((c) => feats[i]![c] as number)]), h1Train.map((i) => y[i]!));
    const off = categoryLogOffsets(fit, h1Train, (i) => dot(beta, [1, ...finalCols.map((c) => feats[i]![c] as number)]), y, keptK);
    const pred = h1Test.map((i) => dot(beta, [1, ...finalCols.map((c) => feats[i]![c] as number)]) + (off.get(fit[i]!.category ?? '\u0000null') ?? 0));
    return valueMetrics(h1Test.map((i) => y[i]!), pred);
  })();
  const finalH2 = (() => {
    if (keptTerms.length === 0) return splitResult(fit, h2Train, h2Test, [], feats, y).baseline;
    const r = splitResult(fit, h2Train, h2Test, finalCols, feats, y);
    if (keptK === null) return r.withTerm;
    const beta = ols(h2Train.map((i) => [1, ...finalCols.map((c) => feats[i]![c] as number)]), h2Train.map((i) => y[i]!));
    const off = categoryLogOffsets(fit, h2Train, (i) => dot(beta, [1, ...finalCols.map((c) => feats[i]![c] as number)]), y, keptK);
    const pred = h2Test.map((i) => dot(beta, [1, ...finalCols.map((c) => feats[i]![c] as number)]) + (off.get(fit[i]!.category ?? '\u0000null') ?? 0));
    return valueMetrics(h2Test.map((i) => y[i]!), pred);
  })();
  let finalWfWins = 0;
  let finalWfValid = 0;
  for (const f of foldIdx) {
    if (!f.valid) continue;
    finalWfValid++;
    if (keptTerms.length === 0) {
      if (splitResult(fit, f.train, f.test, [], feats, y).medianGain > 0) finalWfWins++;
      continue;
    }
    const r = splitResult(fit, f.train, f.test, finalCols, feats, y);
    if (keptK === null) {
      if (r.medianGain > 0) finalWfWins++;
      continue;
    }
    const beta = ols(f.train.map((i) => [1, ...finalCols.map((c) => feats[i]![c] as number)]), f.train.map((i) => y[i]!));
    const off = categoryLogOffsets(fit, f.train, (i) => dot(beta, [1, ...finalCols.map((c) => feats[i]![c] as number)]), y, keptK);
    const pred = f.test.map((i) => dot(beta, [1, ...finalCols.map((c) => feats[i]![c] as number)]) + (off.get(fit[i]!.category ?? '\u0000null') ?? 0));
    const withTerm = valueMetrics(f.test.map((i) => y[i]!), pred);
    if (r.baseline.medianLogError - withTerm.medianLogError > 0) finalWfWins++;
  }
  return {
    verdicts,
    keptTerms,
    keptK,
    h1TestN: h1Test.length,
    h2TestN: h2Test.length,
    h2SmallCategories,
    baselineH1: splitResult(fit, h1Train, h1Test, [], feats, y).baseline,
    baselineH2: splitResult(fit, h2Train, h2Test, [], feats, y).baseline,
    finalH1,
    finalH2,
    finalWfWins,
    finalWfValid,
  };
}

// Fit the final value model on the whole fit set: OLS on kept terms
// (always at least x1) plus, when T9 kept, shrunk category offsets from
// the full-fit residuals. Returns the predictor and its audit trail.
export interface FittedValueModel {
  beta: number[];
  cols: (keyof ValueFeatures)[];
  keptTerms: TermId[];
  keptK: number | null;
  categoryOffsets: Map<string, number>;
  categoryN: Map<string, number>;
  residualStd: number;
  intercept: number;
  slopeLogTvl: number;
}

export function fitFinalValueModel(
  fit: Protocol[],
  feats: ValueFeatures[],
  y: number[],
  keptTerms: TermId[],
  keptK: number | null,
): FittedValueModel {
  const all = fit.map((_, i) => i);
  const cols = ['x1', ...keptTerms.filter((t) => t !== 'T9')] as (keyof ValueFeatures)[];
  const beta = ols(all.map((i) => [1, ...cols.map((c) => feats[i]![c] as number)]), y);
  let categoryOffsets = new Map<string, number>();
  if (keptK !== null) {
    categoryOffsets = categoryLogOffsets(fit, all, (i) => dot(beta, [1, ...cols.map((c) => feats[i]![c] as number)]), y, keptK);
  }
  const categoryN = new Map<string, number>();
  for (const p of fit) {
    const key = p.category ?? '\u0000null';
    categoryN.set(key, (categoryN.get(key) ?? 0) + 1);
  }
  const preds = all.map((i) => {
    let v = dot(beta, [1, ...cols.map((c) => feats[i]![c] as number)]);
    if (keptK !== null) v += categoryOffsets.get(fit[i]!.category ?? '\u0000null') ?? 0;
    return v;
  });
  const residuals = y.map((v, i) => v - preds[i]!);
  return {
    beta,
    cols,
    keptTerms,
    keptK,
    categoryOffsets,
    categoryN,
    residualStd: std(residuals),
    intercept: beta[0]!,
    slopeLogTvl: beta[1]!,
  };
}

export function predictValueLog(model: FittedValueModel, p: Protocol, feat: ValueFeatures): number {
  let v = dot(model.beta, [1, ...model.cols.map((c) => feat[c] as number)]);
  if (model.keptK !== null) v += model.categoryOffsets.get(p.category ?? '\u0000null') ?? 0;
  return v;
}

// ------------------------------------------------------------------
// Token-odds model (§3.3). Logistic regression on standardised
// features, trained on all 758 protocols (label = records a token).
// Selection mirrors §3.2 with AUC/Brier instead of median log error.
// The category feature is a shrunk log-odds offset per category (§3.4.4),
// refit on the logistic target with its own K grid.
// ------------------------------------------------------------------
export type OddsTermId = 'x2' | 'x3' | 'x4' | 'x5' | 'x6' | 'T9';
export const ODDS_TERM_LABELS: Record<OddsTermId, string> = {
  x2: 'log TVL squared',
  x3: '7d TVL growth, clamped',
  x4: 'log age (log(1+age_days))',
  x5: 'log chain count',
  x6: 'log TVL per chain',
  T9: 'category effect with shrinkage',
};

export interface OddsSplitResult {
  auc: number;
  brier: number;
  baseAuc: number;
  baseBrier: number;
  aucGain: number;
  brierChange: number;
}

export interface OddsFoldResult extends OddsSplitResult {
  cutoff: string;
  valid: boolean;
  skippedReason: string | null;
  worsened: boolean; // AUC down more than 0.02 vs baseline on this fold
}

export interface OddsVerdict {
  term: OddsTermId;
  label: string;
  k: number | null;
  h1: OddsSplitResult;
  h2: OddsSplitResult;
  folds: OddsFoldResult[];
  decision: 'KEEP' | 'DROP';
  reason: string;
}

export interface OddsCalibrationBand {
  band: string;
  n: number;
  meanPredictedPct: number;
  actualTokenPct: number;
  gapPct: number;
}

export interface OddsSelection {
  verdicts: OddsVerdict[];
  keptTerms: OddsTermId[];
  keptK: number | null;
  h1TestN: number;
  h2TestN: number;
  baseH1: OddsSplitResult;
  baseH2: OddsSplitResult;
  calibrationH1: OddsCalibrationBand[];
  calibrationH2: OddsCalibrationBand[];
  calibrationWarning: string | null;
  finalBeta: number[];
  finalCols: OddsTermId[];
  finalMeans: Record<string, number>;
  finalSds: Record<string, number>;
  finalCategoryOffsets: Map<string, number>;
  finalCategoryK: number | null;
}

// Standardisation stats for a set of feature columns, from a train set.
function standardiseStats(
  list: Protocol[],
  trainIdx: number[],
  feats: OddsFeatures[],
  cols: string[],
): { means: Record<string, number>; sds: Record<string, number> } {
  const means: Record<string, number> = {};
  const sds: Record<string, number> = {};
  for (const c of cols) {
    const vals = trainIdx.map((i) => feats[i]![c as keyof OddsFeatures] as number);
    means[c] = mean(vals);
    sds[c] = std(vals);
  }
  return { means, sds };
}

function categoryLogOddsOffsets(
  list: Protocol[],
  trainIdx: number[],
  labels: number[],
  k: number,
): Map<string, number> {
  const global = mean(trainIdx.map((i) => labels[i]!));
  const g = Math.min(0.98, Math.max(0.02, global));
  const logitG = Math.log(g / (1 - g));
  const byCat = new Map<string, number[]>();
  for (const i of trainIdx) {
    const key = list[i]!.category ?? '\u0000null';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(labels[i]!);
  }
  const out = new Map<string, number>();
  for (const [key, ys] of byCat) {
    if (ys.length < METHOD.CATEGORY_MIN_N) {
      out.set(key, 0);
      continue;
    }
    const r = Math.min(0.98, Math.max(0.02, mean(ys)));
    const raw = Math.log(r / (1 - r)) - logitG;
    out.set(key, (ys.length / (ys.length + k)) * raw);
  }
  return out;
}

export function selectOddsModel(
  all: Protocol[],
  feats: OddsFeatures[],
): OddsSelection {
  const labels = all.map((p) => (p.mcap_usd !== null && p.mcap_usd > 0) || p.gecko_id !== null || p.symbol !== null ? 1 : 0);
  const idx = all.map((_, i) => i);
  const h1Test = idx.filter((i) => {
    let s = 0;
    for (const c of all[i]!.slug) s += c.charCodeAt(0);
    return s % 10 >= 7;
  });
  const h1Train = idx.filter((i) => !h1Test.includes(i));
  const h2Set = h2TestSlugs(all);
  const h2Test = idx.filter((i) => h2Set.has(all[i]!.slug));
  const h2Train = idx.filter((i) => !h2Set.has(all[i]!.slug));
  const folds = walkForwardFolds(all);

  // Baseline (log-TVL-only) logistic fit depends only on the train set,
  // but evalOdds re-fits it on every call — the same train set recurs
  // for every term and every K (~47 redundant refits). Cache it per
  // train set; the fit is a pure function of (trainIdx, labels, feats).
  const baseFitCache = new Map<string, { x1m: number; x1s: number; beta: number[] }>();

  const evalOdds = (
    trainIdx: number[],
    testIdx: number[],
    cols: OddsTermId[],
    catK: number | null,
  ): OddsSplitResult => {
    const plainCols = cols.filter((c) => c !== 'T9');
    const stats = standardiseStats(all, trainIdx, feats, plainCols);
    let catOffsets: Map<string, number> | null = null;
    let catMean = 0;
    let catSd = 1;
    if (catK !== null) {
      catOffsets = categoryLogOddsOffsets(all, trainIdx, labels, catK);
      const vals = trainIdx.map((i) => catOffsets!.get(all[i]!.category ?? '\u0000null') ?? 0);
      catMean = mean(vals);
      catSd = std(vals);
    }
    const row = (i: number): number[] => {
      const r: number[] = [1];
      for (const c of plainCols) r.push(((feats[i]![c] as number) - stats.means[c]!) / stats.sds[c]!);
      if (catK !== null) r.push(((catOffsets!.get(all[i]!.category ?? '\u0000null') ?? 0) - catMean) / catSd);
      return r;
    };
    const beta = logisticFit(trainIdx.map(row), trainIdx.map((i) => labels[i]!));
    const pred = testIdx.map((i) => sigmoid(dot(beta, row(i))));
    const truth = testIdx.map((i) => labels[i]!);
    // Baseline: logistic on log TVL only, standardised on the same train set.
    // Cached per train set (see baseFitCache above).
    const cacheKey = trainIdx.join(',');
    let base = baseFitCache.get(cacheKey);
    if (base === undefined) {
      const x1vals = trainIdx.map((i) => feats[i]!.x1);
      const x1m = mean(x1vals);
      const x1s = std(x1vals);
      const beta = logisticFit(
        trainIdx.map((i) => [1, (feats[i]!.x1 - x1m) / x1s]),
        trainIdx.map((i) => labels[i]!),
      );
      base = { x1m, x1s, beta };
      baseFitCache.set(cacheKey, base);
    }
    const { x1m, x1s, beta: baseBeta2 } = base;
    const basePred = testIdx.map((i) => sigmoid(dot(baseBeta2, [1, (feats[i]!.x1 - x1m) / x1s])));
    return {
      auc: auc(truth, pred),
      brier: brier(truth, pred),
      baseAuc: auc(truth, basePred),
      baseBrier: brier(truth, basePred),
      aucGain: auc(truth, pred) - auc(truth, basePred),
      brierChange: brier(truth, pred) - brier(truth, basePred),
    };
  };

  const decideOdds = (h1: OddsSplitResult, h2: OddsSplitResult, folds: OddsFoldResult[]): { decision: 'KEEP' | 'DROP'; reason: string } => {
    const a = METHOD.ODDS_MIN_AUC_GAIN;
    const b = METHOD.ODDS_MAX_BRIER_WORSEN;
    if (h1.aucGain < a) return { decision: 'DROP', reason: `gagal AUC H1: +${h1.aucGain.toFixed(3)} < ${a}` };
    if (h1.brierChange > b) return { decision: 'DROP', reason: `gagal Brier H1: +${h1.brierChange.toFixed(3)} > ${b}` };
    if (h2.aucGain < a) return { decision: 'DROP', reason: `gagal AUC H2: +${h2.aucGain.toFixed(3)} < ${a}` };
    if (h2.brierChange > b) return { decision: 'DROP', reason: `gagal Brier H2: +${h2.brierChange.toFixed(3)} > ${b}` };
    const bad = folds.filter((f) => f.valid && f.worsened);
    if (bad.length >= METHOD.WF_FAIL_FOLDS) {
      return { decision: 'DROP', reason: `gagal walk-forward: AUC turun > ${METHOD.ODDS_WF_AUC_DROP} pada ${bad.length} fold` };
    }
    return { decision: 'KEEP', reason: `lolos: AUC H1 +${h1.aucGain.toFixed(3)}, H2 +${h2.aucGain.toFixed(3)}, ${bad.length} fold memburuk` };
  };

  const verdicts: OddsVerdict[] = [];
  const plainTerms: OddsTermId[] = ['x2', 'x3', 'x4', 'x5', 'x6'];
  for (const term of plainTerms) {
    const h1 = evalOdds(h1Train, h1Test, ['x1', term], null);
    const h2 = evalOdds(h2Train, h2Test, ['x1', term], null);
    const foldResults: OddsFoldResult[] = folds.map((f) => {
      if (!f.valid) return { ...evalOdds(f.train, f.test, ['x1', term], null), cutoff: f.cutoff, valid: false, skippedReason: f.skippedReason, worsened: false };
      const r = evalOdds(f.train, f.test, ['x1', term], null);
      return { ...r, cutoff: f.cutoff, valid: true, skippedReason: null, worsened: r.aucGain < -METHOD.ODDS_WF_AUC_DROP };
    });
    const { decision, reason } = decideOdds(h1, h2, foldResults);
    verdicts.push({ term, label: ODDS_TERM_LABELS[term], k: null, h1, h2, folds: foldResults, decision, reason });
  }
  const t9ByK: OddsVerdict[] = METHOD.SHRINKAGE_GRID.map((k) => {
    const h1 = evalOdds(h1Train, h1Test, ['x1', 'T9'], k);
    const h2 = evalOdds(h2Train, h2Test, ['x1', 'T9'], k);
    const foldResults: OddsFoldResult[] = folds.map((f) => {
      if (!f.valid) return { ...evalOdds(f.train, f.test, ['x1', 'T9'], k), cutoff: f.cutoff, valid: false, skippedReason: f.skippedReason, worsened: false };
      const r = evalOdds(f.train, f.test, ['x1', 'T9'], k);
      return { ...r, cutoff: f.cutoff, valid: true, skippedReason: null, worsened: r.aucGain < -METHOD.ODDS_WF_AUC_DROP };
    });
    const { decision, reason } = decideOdds(h1, h2, foldResults);
    return { term: 'T9' as OddsTermId, label: `${ODDS_TERM_LABELS.T9} (K=${k})`, k, h1, h2, folds: foldResults, decision, reason };
  });
  verdicts.push(...t9ByK);
  const keptK = t9ByK.find((v) => v.decision === 'KEEP')?.k ?? null;
  const keptTerms: OddsTermId[] = plainTerms.filter((t) => verdicts.find((v) => v.term === t)!.decision === 'KEEP');
  if (keptK !== null) keptTerms.push('T9');

  // Final odds fit on all 758 protocols with the kept features.
  const finalCols: OddsTermId[] = ['x1', ...keptTerms];
  const plainFinal = finalCols.filter((c) => c !== 'T9');
  const stats = standardiseStats(all, idx, feats, plainFinal);
  let finalCategoryOffsets = new Map<string, number>();
  let catMean = 0;
  let catSd = 1;
  if (keptK !== null) {
    finalCategoryOffsets = categoryLogOddsOffsets(all, idx, labels, keptK);
    const vals = idx.map((i) => finalCategoryOffsets.get(all[i]!.category ?? '\u0000null') ?? 0);
    catMean = mean(vals);
    catSd = std(vals);
  }
  const finalMeans: Record<string, number> = { ...stats.means };
  const finalSds: Record<string, number> = { ...stats.sds };
  if (keptK !== null) {
    finalMeans.T9 = catMean;
    finalSds.T9 = catSd;
  }
  const rowFinal = (i: number): number[] => {
    const r: number[] = [1];
    for (const c of plainFinal) r.push(((feats[i]![c] as number) - stats.means[c]!) / stats.sds[c]!);
    if (keptK !== null) r.push(((finalCategoryOffsets.get(all[i]!.category ?? '\u0000null') ?? 0) - catMean) / catSd);
    return r;
  };
  const finalBeta = logisticFit(idx.map(rowFinal), labels);

  // Calibration from HELD-OUT predictions (models fit on train only, so
  // no leakage): 5 probability bands on H1 and H2 test sets.
  const calibrate = (trainIdx: number[], testIdx: number[]): OddsCalibrationBand[] => {
    const plainCols = finalCols.filter((c) => c !== 'T9');
    const st = standardiseStats(all, trainIdx, feats, plainCols);
    let offs: Map<string, number> | null = null;
    let cm = 0;
    let cs = 1;
    if (keptK !== null) {
      offs = categoryLogOddsOffsets(all, trainIdx, labels, keptK);
      const vals = trainIdx.map((i) => offs!.get(all[i]!.category ?? '\u0000null') ?? 0);
      cm = mean(vals);
      cs = std(vals);
    }
    const row = (i: number): number[] => {
      const r: number[] = [1];
      for (const c of plainCols) r.push(((feats[i]![c] as number) - st.means[c]!) / st.sds[c]!);
      if (keptK !== null) r.push(((offs!.get(all[i]!.category ?? '\u0000null') ?? 0) - cm) / cs);
      return r;
    };
    const beta = logisticFit(trainIdx.map(row), trainIdx.map((i) => labels[i]!));
    const preds = testIdx.map((i) => ({ p: sigmoid(dot(beta, row(i))), y: labels[i]! }));
    const bands: OddsCalibrationBand[] = [];
    for (let b = 0; b < 5; b++) {
      const lo = b * 0.2;
      const hi = (b + 1) * 0.2;
      const inBand = preds.filter((q) => q.p >= lo && (b === 4 ? q.p <= hi : q.p < hi));
      bands.push({
        band: `${Math.round(lo * 100)}-${Math.round(hi * 100)}%`,
        n: inBand.length,
        meanPredictedPct: inBand.length === 0 ? 0 : mean(inBand.map((q) => q.p)) * 100,
        actualTokenPct: inBand.length === 0 ? 0 : mean(inBand.map((q) => q.y)) * 100,
        gapPct: 0,
      });
      bands[b]!.gapPct = bands[b]!.meanPredictedPct - bands[b]!.actualTokenPct;
    }
    return bands;
  };
  const calibrationH1 = calibrate(h1Train, h1Test);
  const calibrationH2 = calibrate(h2Train, h2Test);
  const badBand = (bands: OddsCalibrationBand[]): string | null => {
    const bad = bands.filter((b) => b.n > 0 && Math.abs(b.gapPct) > 15);
    return bad.length === 0 ? null : bad.map((b) => b.band).join(', ');
  };
  const badH1 = badBand(calibrationH1);
  const badH2 = badBand(calibrationH2);
  const calibrationWarning =
    badH1 !== null && badH2 !== null
      ? `Odds pada band ${badH1} tidak terkalibrasi dengan baik (selisih prediksi vs aktual > 15 poin pada H1 dan H2).`
      : null;

  const baseH1 = evalOdds(h1Train, h1Test, ['x1'], null);
  const baseH2 = evalOdds(h2Train, h2Test, ['x1'], null);
  return {
    verdicts,
    keptTerms,
    keptK,
    h1TestN: h1Test.length,
    h2TestN: h2Test.length,
    baseH1,
    baseH2,
    calibrationH1,
    calibrationH2,
    calibrationWarning,
    finalBeta,
    finalCols,
    finalMeans,
    finalSds,
    finalCategoryOffsets,
    finalCategoryK: keptK,
  };
}

export function predictOdds(
  sel: OddsSelection,
  p: Protocol,
  feat: OddsFeatures,
): { pct: number; band: 'Rendah' | 'Sedang' | 'Tinggi'; contributions: { term: string; z: number; signed: number }[] } {
  const plain = sel.finalCols.filter((c) => c !== 'T9');
  const row: number[] = [1];
  const contributions: { term: string; z: number; signed: number }[] = [];
  plain.forEach((c, j) => {
    const z = ((feat[c] as number) - sel.finalMeans[c]!) / sel.finalSds[c]!;
    row.push(z);
    contributions.push({ term: c, z, signed: sel.finalBeta[j + 1]! * z });
  });
  if (sel.finalCategoryK !== null) {
    const raw = sel.finalCategoryOffsets.get(p.category ?? '\u0000null') ?? 0;
    const z = (raw - sel.finalMeans.T9!) / sel.finalSds.T9!;
    row.push(z);
    contributions.push({ term: 'T9', z, signed: sel.finalBeta[row.length - 1]! * z });
  }
  const prob = sigmoid(dot(sel.finalBeta, row));
  const pct = prob * 100;
  const band = pct < METHOD.ODDS_LOW_MAX ? 'Rendah' : pct <= METHOD.ODDS_HIGH_MIN ? 'Sedang' : 'Tinggi';
  return { pct, band, contributions };
}
