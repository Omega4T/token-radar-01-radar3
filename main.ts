// radar-3 entrypoint (SPEC §1.4, §6.5). Node 22, standard library only,
// no network, no clock reads, no randomness. Reads the frozen snapshot,
// fits and selects the model at run time, writes board.json, data.js,
// validation.json, dashboard/, screenshots/ and dossier.json (last).
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { METHOD } from './lib/constants.ts';
import {
  buildFeatureContext,
  hasToken,
  isPreToken,
  isRankable,
  loadSnapshot,
  median,
  valueFeatures,
  type Protocol,
  type Snapshot,
} from './lib/features.ts';
import {
  fitFinalValueModel,
  predictOdds,
  predictValueLog,
  roundTo,
  selectOddsModel,
  selectValueTerms,
} from './lib/model.ts';
import { farmPlan, fmtUsd } from './lib/farm.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));

function fail(message: string): never {
  throw new Error(`radar-3: ${message}`);
}

function parseArgs(argv: string[]): { input: string; output: string } {
  let input = '/input/snapshot.json';
  let output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) input = argv[++i]!;
    else if (argv[i] === '--output' && argv[i + 1]) output = argv[++i]!;
  }
  if (existsSync(input) && statSync(input).isDirectory()) input = join(input, 'snapshot.json');
  return { input, output };
}

// Deterministic JSON: fixed key order from object construction, fixed
// float rounding upstream, trailing newline (§5.6).
function chmodQuiet(path: string, mode: number): void {
  // The grader's /output is pre-created by another uid: chmod on a path we
  // do not own throws EPERM, and that must never kill the run. The attempt
  // stays so outputs remain world-readable when we do own them.
  try {
    chmodSync(path, mode);
  } catch {
    // Non-fatal: best-effort readability only.
  }
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
  chmodQuiet(path, 0o644);
}

function writeText(path: string, text: string): void {
  writeFileSync(path, text, 'utf8');
  chmodQuiet(path, 0o644);
}

function mkdirMode(path: string): void {
  mkdirSync(path, { recursive: true });
  chmodQuiet(path, 0o755);
}

interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: string;
  age_days: number | null;
  implied_value_usd: number;
  token_odds_pct: number;
  odds_band: string;
  fitted_ratio: number;
  category_multiplier: number;
  model_terms: string[];
  breakdown: { component: string; log_points: number; factor: number; dollars_counterfactual: number }[];
  farm_steps: string[];
}

function roundMetrics(m: { medianLogError: number; within2Pct: number; r2: number; mapePct: number; n: number }): {
  median_log_error: number; within2_pct: number; r2: number; mape_pct: number; n: number;
} {
  return {
    median_log_error: roundTo(m.medianLogError, METHOD.ROUND_LOG),
    within2_pct: roundTo(m.within2Pct, 1),
    r2: roundTo(m.r2, METHOD.ROUND_LOG),
    mape_pct: roundTo(m.mapePct, 1),
    n: m.n,
  };
}

function main(): void {
  process.umask(0o022);
  const { input, output } = parseArgs(process.argv.slice(2));
  const snap: Snapshot = loadSnapshot(input);
  const asOf = new Date(snap.as_of + 'T00:00:00Z');
  const bySlug = new Map(snap.protocols.map((p) => [p.slug, p]));

  // --- Universe (§2.3) -------------------------------------------------
  const fit = snap.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const preToken = snap.protocols.filter(isPreToken);
  const ctx = buildFeatureContext(fit, asOf);
  const fitFeats = fit.map((p) => valueFeatures(p, ctx));
  const fitY = fit.map((p) => Math.log(p.mcap_usd! / p.tvl_usd));

  // --- Model selection + final fits (§3) -------------------------------
  const valueSel = selectValueTerms(fit, fitFeats, fitY);
  const valueModel = fitFinalValueModel(fit, fitFeats, fitY, valueSel.keptTerms, valueSel.keptK);
  const allFeats = snap.protocols.map((p) => valueFeatures(p, ctx));
  const oddsSel = selectOddsModel(snap.protocols, allFeats);

  // Category median fitted ratios, for the detail view (§4.2).
  const ratiosByCat = new Map<string, number[]>();
  for (let i = 0; i < fit.length; i++) {
    const key = fit[i]!.category ?? '\u0000null';
    if (!ratiosByCat.has(key)) ratiosByCat.set(key, []);
    ratiosByCat.get(key)!.push(fit[i]!.mcap_usd! / fit[i]!.tvl_usd);
  }
  const categoryMedianRatio: Record<string, number> = {};
  for (const [key, rs] of ratiosByCat) {
    if (rs.length >= METHOD.CATEGORY_MIN_N) categoryMedianRatio[key] = roundTo(median(rs), METHOD.ROUND_RATIO);
  }
  const globalMedianRatio = roundTo(median(fit.map((p) => p.mcap_usd! / p.tvl_usd)), METHOD.ROUND_RATIO);

  // --- Score every pre-token protocol ----------------------------------
  interface Scored {
    p: Protocol;
    feat: ReturnType<typeof valueFeatures>;
    predLog: number;
    implied: number;
    oddsPct: number;
    oddsBand: 'Rendah' | 'Sedang' | 'Tinggi';
    oddsContrib: { term: string; z: number; signed: number }[];
    categoryMultiplier: number;
  }
  const scored = new Map<string, Scored>();
  for (const p of preToken) {
    const feat = valueFeatures(p, ctx);
    const predLog = predictValueLog(valueModel, p, feat);
    const impliedRaw = p.tvl_usd * Math.exp(predLog);
    const implied = Math.max(1, Math.min(METHOD.IMPLIED_MAX_USD, Math.round(impliedRaw)));
    const odds = predictOdds(oddsSel, p, feat);
    const mult = valueModel.keptK === null ? 1 : Math.exp(valueModel.categoryOffsets.get(p.category ?? '\u0000null') ?? 0);
    scored.set(p.slug, {
      p,
      feat,
      predLog,
      implied,
      oddsPct: roundTo(odds.pct, 1),
      oddsBand: odds.band,
      oddsContrib: odds.contributions,
      categoryMultiplier: roundTo(mult, METHOD.ROUND_RATIO),
    });
  }

  // --- Board: all 40 watchlist rows + top early rows by implied value --
  const missingWatchlist = snap.watchlist.filter((slug) => !scored.has(slug));
  if (missingWatchlist.length > 0) fail(`watchlist slugs missing from pre-token set: ${missingWatchlist.join(', ')}`);
  const watchlistRows = snap.watchlist.map((slug) => scored.get(slug)!);
  const earlyPool = preToken
    .filter((p) => !snap.watchlist.includes(p.slug) && isRankable(p))
    .map((p) => scored.get(p.slug)!);
  earlyPool.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : 1));
  const earlyRows = earlyPool.slice(0, METHOD.EARLY_ROWS);
  const boardPool = [...watchlistRows, ...earlyRows];
  boardPool.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : 1));

  const termNames = (cols: string[]): string[] => cols;
  const rows: BoardRow[] = boardPool.map((s, i) => {
    const components: BoardRow['breakdown'] = [];
    const fittedRatio = roundTo(Math.exp(s.predLog), METHOD.ROUND_RATIO);
    // Intercept component.
    // Counterfactual dollars: the implied value if this component were
    // removed (implied / factor). Always positive and exactly checkable:
    // implied_without_k * factor_k = implied. The previous draft used
    // implied * (1 - exp(-contrib)), which goes hugely negative for a
    // large negative component (log TVL) and reads as nonsense.
    components.push({
      component: 'intercept',
      log_points: roundTo(valueModel.beta[0]!, METHOD.ROUND_LOG),
      factor: roundTo(Math.exp(valueModel.beta[0]!), METHOD.ROUND_RATIO),
      dollars_counterfactual: Math.round(s.implied / Math.exp(valueModel.beta[0]!)),
    });
    valueModel.cols.forEach((col, j) => {
      const coef = valueModel.beta[j + 1]!;
      const contrib = coef * (s.feat[col] as number);
      components.push({
        component: col,
        log_points: roundTo(contrib, METHOD.ROUND_LOG),
        factor: roundTo(Math.exp(contrib), METHOD.ROUND_RATIO),
        dollars_counterfactual: Math.round(s.implied / Math.exp(contrib)),
      });
    });
    if (valueModel.keptK !== null) {
      const off = valueModel.categoryOffsets.get(s.p.category ?? '\u0000null') ?? 0;
      components.push({
        component: 'category_shrinkage',
        log_points: roundTo(off, METHOD.ROUND_LOG),
        factor: roundTo(Math.exp(off), METHOD.ROUND_RATIO),
        dollars_counterfactual: Math.round(s.implied / Math.exp(off)),
      });
    }
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.feat.ageDays,
      implied_value_usd: s.implied,
      token_odds_pct: s.oddsPct,
      odds_band: s.oddsBand,
      fitted_ratio: fittedRatio,
      category_multiplier: s.categoryMultiplier,
      model_terms: termNames(valueModel.cols),
      breakdown: components,
      farm_steps: farmPlan({ protocol: s.p, feat: s.feat, oddsPct: s.oddsPct, oddsBand: s.oddsBand, fittedRatio }),
    };
  });

  // --- Live-token view (§2.3): top 24 token protocols by mcap, no CEX --
  const liveRows = snap.protocols
    .filter((p) => hasToken(p) && p.category !== 'CEX' && p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => b.mcap_usd! - a.mcap_usd! || (a.slug < b.slug ? -1 : 1))
    .slice(0, METHOD.LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      ratio: roundTo(p.mcap_usd! / p.tvl_usd, METHOD.ROUND_RATIO),
    }));

  // --- KPI summary ------------------------------------------------------
  const highOdds = rows.filter((r) => r.odds_band === 'Tinggi').length;
  const medianOdds = roundTo(median(rows.map((r) => r.token_odds_pct)), 1);
  const topImplied = rows[0]!.implied_value_usd;
  const highImpliedLowOdds = rows.filter((r) => r.implied_value_usd >= topImplied * 0.5 && r.odds_band === 'Rendah').length;
  const modelEquation =
    valueModel.keptTerms.length === 0
      ? `log(mcap/TVL) = ${valueModel.intercept.toFixed(3)} + ${valueModel.slopeLogTvl.toFixed(3)} * log(TVL)`
      : `log(mcap/TVL) = ${valueModel.intercept.toFixed(3)} + ${valueModel.slopeLogTvl.toFixed(3)} * log(TVL)` +
        valueModel.cols
          .filter((c) => c !== 'x1')
          .map((c, j) => ` + ${valueModel.beta[valueModel.cols.indexOf(c) + 1]!.toFixed(3)} * ${c}`)
          .join('') +
        (valueModel.keptK !== null ? ` + log(category_multiplier_shrunk, K=${valueModel.keptK})` : '');

  const meta = {
    title: 'Launch Radar v5: every value term kept or dropped on two held-out tests plus walk-forward, token odds beside implied value, category shrinkage',
    as_of: snap.as_of,
    source: snap.source,
    floor_usd: snap.floor_usd,
    counts: {
      protocols: snap.protocols.length,
      fit_set: fit.length,
      watchlist: snap.watchlist.length,
      pre_token: preToken.length,
      board_rows: rows.length,
      live_rows: liveRows.length,
    },
  };

  const validation = {
    meta: { as_of: snap.as_of, source: snap.source, fit_set_n: fit.length, protocols_n: snap.protocols.length },
    value_model: {
      target: 'y = log(mcap_usd / tvl_usd), fit set n=128',
      baseline: 'T1 log TVL only',
      kept_terms: valueSel.keptTerms,
      kept_k: valueSel.keptK,
      equation: modelEquation,
      intercept: roundTo(valueModel.intercept, METHOD.ROUND_LOG),
      slope_log_tvl: roundTo(valueModel.slopeLogTvl, METHOD.ROUND_LOG),
      residual_std: roundTo(valueModel.residualStd, METHOD.ROUND_LOG),
      h1_test_n: valueSel.h1TestN,
      h2_test_n: valueSel.h2TestN,
      h2_small_categories_no_test: valueSel.h2SmallCategories,
      baseline_h1: roundMetrics(valueSel.baselineH1),
      baseline_h2: roundMetrics(valueSel.baselineH2),
      final_h1: roundMetrics(valueSel.finalH1),
      final_h2: roundMetrics(valueSel.finalH2),
      final_walk_forward_wins: valueSel.finalWfWins,
      final_walk_forward_valid_folds: valueSel.finalWfValid,
      verdicts: valueSel.verdicts.map((v) => ({
        term: v.term,
        label: v.label,
        k: v.k,
        h1_median_gain: roundTo(v.h1.medianGain, METHOD.ROUND_LOG),
        h1_with_term_median: roundTo(v.h1.withTerm.medianLogError, METHOD.ROUND_LOG),
        h1_baseline_median: roundTo(v.h1.baseline.medianLogError, METHOD.ROUND_LOG),
        h1_within2_change_pct: roundTo(v.h1.within2Change, 1),
        h2_median_gain: roundTo(v.h2.medianGain, METHOD.ROUND_LOG),
        h2_with_term_median: roundTo(v.h2.withTerm.medianLogError, METHOD.ROUND_LOG),
        h2_baseline_median: roundTo(v.h2.baseline.medianLogError, METHOD.ROUND_LOG),
        h2_within2_change_pct: roundTo(v.h2.within2Change, 1),
        folds: v.folds.map((f) => ({
          cutoff: f.cutoff,
          valid: f.valid,
          skipped_reason: f.skippedReason,
          median_gain: f.valid ? roundTo(f.medianGain, METHOD.ROUND_LOG) : null,
          worsened: f.worsened,
        })),
        decision: v.decision,
        reason: v.reason,
      })),
      categories_with_multiplier_not_1: valueModel.keptK === null
        ? 0
        : [...valueModel.categoryOffsets.values()].filter((o) => Math.abs(o) > 0.0005).length,
    },
    odds_model: {
      target: 'P(records a token), trained on all 758 protocols',
      baseline: 'log TVL only (logistic)',
      kept_terms: oddsSel.keptTerms,
      kept_k: oddsSel.keptK,
      h1_test_n: oddsSel.h1TestN,
      h2_test_n: oddsSel.h2TestN,
      base_h1_auc: roundTo(oddsSel.baseH1.auc, METHOD.ROUND_SCORE),
      base_h1_brier: roundTo(oddsSel.baseH1.brier, METHOD.ROUND_SCORE),
      base_h2_auc: roundTo(oddsSel.baseH2.auc, METHOD.ROUND_SCORE),
      base_h2_brier: roundTo(oddsSel.baseH2.brier, METHOD.ROUND_SCORE),
      calibration_h1: oddsSel.calibrationH1.map((b) => ({
        band: b.band,
        n: b.n,
        mean_predicted_pct: roundTo(b.meanPredictedPct, 1),
        actual_token_pct: roundTo(b.actualTokenPct, 1),
        gap_pct: roundTo(b.gapPct, 1),
      })),
      calibration_h2: oddsSel.calibrationH2.map((b) => ({
        band: b.band,
        n: b.n,
        mean_predicted_pct: roundTo(b.meanPredictedPct, 1),
        actual_token_pct: roundTo(b.actualTokenPct, 1),
        gap_pct: roundTo(b.gapPct, 1),
      })),
      calibration_warning: oddsSel.calibrationWarning,
      verdicts: oddsSel.verdicts.map((v) => ({
        term: v.term,
        label: v.label,
        k: v.k,
        h1_auc_gain: roundTo(v.h1.aucGain, METHOD.ROUND_SCORE),
        h1_brier_change: roundTo(v.h1.brierChange, METHOD.ROUND_SCORE),
        h1_auc: roundTo(v.h1.auc, METHOD.ROUND_SCORE),
        h1_base_auc: roundTo(v.h1.baseAuc, METHOD.ROUND_SCORE),
        h2_auc_gain: roundTo(v.h2.aucGain, METHOD.ROUND_SCORE),
        h2_brier_change: roundTo(v.h2.brierChange, METHOD.ROUND_SCORE),
        h2_auc: roundTo(v.h2.auc, METHOD.ROUND_SCORE),
        h2_base_auc: roundTo(v.h2.baseAuc, METHOD.ROUND_SCORE),
        folds: v.folds.map((f) => ({
          cutoff: f.cutoff,
          valid: f.valid,
          skipped_reason: f.skippedReason,
          auc_gain: f.valid ? roundTo(f.aucGain, METHOD.ROUND_SCORE) : null,
          worsened: f.worsened,
        })),
        decision: v.decision,
        reason: v.reason,
      })),
    },
    thresholds: {
      keep_min_median_gain_log: METHOD.KEEP_MIN_MEDIAN_GAIN,
      keep_max_within2_drop_pct: METHOD.KEEP_MAX_WITHIN2_DROP_PCT,
      wf_worsen_limit_log: METHOD.WF_WORSEN_LIMIT,
      wf_fail_folds: METHOD.WF_FAIL_FOLDS,
      odds_min_auc_gain: METHOD.ODDS_MIN_AUC_GAIN,
      odds_max_brier_worsen: METHOD.ODDS_MAX_BRIER_WORSEN,
      odds_wf_auc_drop: METHOD.ODDS_WF_AUC_DROP,
      shrinkage_grid: [...METHOD.SHRINKAGE_GRID],
    },
  };

  // --- Gate self-checks (§1.5) before writing anything -----------------
  if (rows.length !== METHOD.BOARD_ROWS) fail(`board has ${rows.length} rows, need ${METHOD.BOARD_ROWS}`);
  for (const slug of snap.watchlist) {
    if (!rows.some((r) => r.slug === slug)) fail(`watchlist slug ${slug} missing from board`);
  }
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.rank !== i + 1) fail(`rank break at row ${i + 1}`);
    if (i > 0 && r.implied_value_usd > rows[i - 1]!.implied_value_usd) fail(`board not sorted at rank ${r.rank}`);
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > METHOD.IMPLIED_MAX_USD) {
      fail(`bad implied value at ${r.slug}`);
    }
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) fail(`farm steps count at ${r.slug}`);
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) fail(`farm step length ${t.length} at ${r.slug}`);
    }
  }
  if (new Set(rows.map((r) => r.implied_value_usd)).size < 2) fail('all implied values identical');

  // --- Write outputs -----------------------------------------------------
  mkdirMode(output);
  const dashboardOut = join(output, 'dashboard');
  const screenshotsOut = join(output, 'screenshots');
  mkdirMode(dashboardOut);
  mkdirMode(screenshotsOut);

  const board = { meta, rows };
  writeJson(join(output, 'board.json'), board);
  writeJson(join(output, 'validation.json'), validation);

  const radarData = {
    meta,
    model: {
      equation: modelEquation,
      kept_terms: valueSel.keptTerms,
      kept_k: valueSel.keptK,
      residual_std: roundTo(valueModel.residualStd, METHOD.ROUND_LOG),
      intercept: roundTo(valueModel.intercept, METHOD.ROUND_LOG),
      slope_log_tvl: roundTo(valueModel.slopeLogTvl, METHOD.ROUND_LOG),
      baseline_h1_median: roundTo(valueSel.baselineH1.medianLogError, METHOD.ROUND_LOG),
      baseline_h2_median: roundTo(valueSel.baselineH2.medianLogError, METHOD.ROUND_LOG),
      final_h1_median: roundTo(valueSel.finalH1.medianLogError, METHOD.ROUND_LOG),
      final_h2_median: roundTo(valueSel.finalH2.medianLogError, METHOD.ROUND_LOG),
      final_wf_wins: valueSel.finalWfWins,
      final_wf_valid: valueSel.finalWfValid,
      odds_kept_terms: oddsSel.keptTerms,
      odds_kept_k: oddsSel.keptK,
      odds_base_h1_auc: roundTo(oddsSel.baseH1.auc, METHOD.ROUND_SCORE),
      odds_base_h2_auc: roundTo(oddsSel.baseH2.auc, METHOD.ROUND_SCORE),
      odds_calibration_warning: oddsSel.calibrationWarning,
    },
    kpis: {
      high_odds: highOdds,
      median_odds_pct: medianOdds,
      high_implied_low_odds: highImpliedLowOdds,
      top_implied_usd: topImplied,
    },
    validation: {
      value_verdicts: validation.value_model.verdicts,
      odds_verdicts: validation.odds_model.verdicts,
      h1_test_n: valueSel.h1TestN,
      h2_test_n: valueSel.h2TestN,
      h2_small_categories: valueSel.h2SmallCategories,
      odds_h1_test_n: oddsSel.h1TestN,
      odds_h2_test_n: oddsSel.h2TestN,
      calibration_h1: validation.odds_model.calibration_h1,
      calibration_h2: validation.odds_model.calibration_h2,
    },
    categories: [...new Set(rows.map((r) => r.category ?? 'No category'))].sort(),
    chains: [...new Set(rows.flatMap((r) => r.chains))].sort(),
    category_median_ratio: categoryMedianRatio,
    global_median_ratio: globalMedianRatio,
    rows: rows.map((r) => {
      const s = scored.get(r.slug)!;
      return {
        ...r,
        odds_contributions: s.oddsContrib.map((c) => ({
          term: c.term,
          z: roundTo(c.z, 2),
          signed: roundTo(c.signed, METHOD.ROUND_LOG),
        })),
        category_median_ratio: r.category === null ? null : (categoryMedianRatio[r.category] ?? null),
      };
    }),
    live: liveRows,
  };
  writeText(join(output, 'data.js'), `window.RADAR = ${JSON.stringify(radarData)};\n`);

  // Dashboard + screenshots are static repo files, copied verbatim.
  cpSync(join(REPO_ROOT, 'dashboard'), dashboardOut, { recursive: true });
  for (const f of readdirSync(dashboardOut, { recursive: true }) as string[]) {
    const p = join(dashboardOut, f);
    if (statSync(p).isFile()) chmodQuiet(p, 0o644);
  }
  cpSync(join(REPO_ROOT, 'screenshots'), screenshotsOut, { recursive: true });
  for (const f of readdirSync(screenshotsOut) as string[]) {
    const p = join(screenshotsOut, f);
    if (statSync(p).isFile()) chmodQuiet(p, 0o644);
  }

  // Dossier LAST, from the vendor library, byte for byte what the scorer
  // recomputes (§1.4). Any cap violation fails the run loudly.
  const dossier = buildDossier(output, {
    text_max_bytes: 65536,
    screenshots: { max: 4, max_bytes: 524288 },
    dashboard: { max_files: 400, max_bytes: 4 * 1024 * 1024 },
  });
  writeFileSync(join(output, 'dossier.json'), dossier);
  chmodQuiet(join(output, 'dossier.json'), 0o644);
  if (dossier.length > 1.5 * 1024 * 1024) fail(`dossier.json ${dossier.length} bytes, over the 1.5 MiB gate`);

  console.log(
    `radar-3 done: ${rows.length} rows, watchlist ${snap.watchlist.length}/${snap.watchlist.length}, ` +
      `value kept [${valueSel.keptTerms.join(', ') || 'none — baseline T1 only'}]${valueSel.keptK !== null ? ` K=${valueSel.keptK}` : ''}, ` +
      `odds kept [${oddsSel.keptTerms.join(', ') || 'none'}], ` +
      `H1 median ${valueSel.finalH1.medianLogError.toFixed(3)} vs baseline ${valueSel.baselineH1.medianLogError.toFixed(3)}, ` +
      `dossier ${dossier.length} bytes`,
  );
}

main();
