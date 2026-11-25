// Snapshot loading, feature computation and universe definitions.
// Everything here follows SPEC §2: the ten snapshot fields, the fit set,
// the pre-token definition, the rankable definition, and the two held-out
// splits (H1 slug-hash, H2 stratified systematic). No fitted numbers here.
import { readFileSync } from 'node:fs';
import { METHOD } from './constants.ts';

export interface Protocol {
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
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export function loadSnapshot(path: string): Snapshot {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
  // Deterministic order regardless of input file order (§2.5, §5.3):
  // every later step sorts by slug, so a shuffled snapshot gives the
  // same output.
  raw.protocols = [...raw.protocols].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  raw.watchlist = [...raw.watchlist].sort();
  return raw;
}

export const isPreToken = (p: Protocol): boolean =>
  p.mcap_usd === null && p.gecko_id === null && p.symbol === null;

export const hasToken = (p: Protocol): boolean => !isPreToken(p);

// Version marker: a space followed by V2, v2, 2.0 or the like, at the end
// of the name (§2.2 watchlist rule, reused for rankable rows).
const VERSION_MARKER = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
export const hasVersionMarker = (p: Protocol): boolean => VERSION_MARKER.test(p.name);

// Rankable early row (§2.3): pre-token, category not CEX, no version
// marker. DECISIONS.md records the extra filter this build adds, all of
// it taken from the house watchlist rule itself (input/README.md), never
// from a list of slugs: category Bridge / Canonical Bridge (a bridged
// token is another asset moved across chains, not a protocol waiting for
// its own launch — WBTC and USDT0 are the house's own examples), names
// carrying a whole word wrapped / staked / staking, and names starting
// with an exchange name (Binance, Coinbase, Bybit, Kraken, Bitget, OKX,
// Bitfinex, Gemini). Liquid Staking / Restaking rows are KEPT: the spec's
// rankable definition retains them, and the filter stops where the
// product is unambiguously another token, not a staking protocol that
// may yet launch its own governance token.
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const BRIDGE_CATEGORIES = new Set(['Bridge', 'Canonical Bridge']);
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
export const isRankable = (p: Protocol): boolean =>
  isPreToken(p) &&
  p.category !== 'CEX' &&
  !BRIDGE_CATEGORIES.has(p.category ?? '') &&
  !hasVersionMarker(p) &&
  !WRAPPED_WORD.test(p.name) &&
  !EXCHANGE_PREFIXES.some((e) => p.name.startsWith(e));

export const ageDays = (p: Protocol, asOf: Date): number | null => {
  if (!p.listed_at) return null;
  const listed = new Date(p.listed_at + 'T00:00:00Z').getTime();
  return Math.max(0, Math.floor((asOf.getTime() - listed) / 86_400_000));
};

// ------------------------------------------------------------------
// Feature context: run-time aggregates of the fit set that feature
// definitions need (means for centred interactions, median log-age for
// the null-listed_at fallback). Computed at run time, never hardcoded.
// ------------------------------------------------------------------
export interface FeatureContext {
  asOf: Date;
  meanLogTvl: number;
  meanLogAge: number;
  medianLogAge: number;
}

export function buildFeatureContext(fit: Protocol[], asOf: Date): FeatureContext {
  const logTvls = fit.map((p) => Math.log(p.tvl_usd));
  const logAges = fit
    .map((p) => ageDays(p, asOf))
    .filter((a): a is number => a !== null)
    .map((a) => Math.log(1 + a));
  return {
    asOf,
    meanLogTvl: mean(logTvls),
    meanLogAge: mean(logAges),
    medianLogAge: median(logAges),
  };
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function std(xs: number[]): number {
  if (xs.length === 0) return 1;
  const m = mean(xs);
  const v = mean(xs.map((x) => (x - m) * (x - m)));
  return Math.sqrt(v) || 1;
}

// ------------------------------------------------------------------
// Value-model candidate terms (§3.1). x1 is the baseline; every other
// term is tested as an addition on top of it. All logs are natural.
// ------------------------------------------------------------------
export interface ValueFeatures {
  x1: number; // log TVL
  x2: number; // log TVL squared
  x3: number; // 7d growth, clamped to [-60,+120]%, as a proportion
  x4: number; // log(1 + age_days); median fallback when listed_at is null
  x5: number; // log(1 + chain count)
  x6: number; // log(TVL per chain)
  x7: number; // growth x centred log TVL
  x8: number; // centred log age x growth
  x10: number; // 1 when age < 180 days, else 0
  ageDays: number | null;
}

export function valueFeatures(p: Protocol, ctx: FeatureContext): ValueFeatures {
  const x1 = Math.log(p.tvl_usd);
  const x3 = Math.min(METHOD.GROWTH_CLAMP_HI, Math.max(METHOD.GROWTH_CLAMP_LO, p.change_7d ?? 0)) / 100;
  const age = ageDays(p, ctx.asOf);
  const x4 = age === null ? ctx.medianLogAge : Math.log(1 + age);
  const nChains = Math.max(1, p.chains.length);
  const x5 = Math.log(1 + nChains);
  const x6 = Math.log(p.tvl_usd / nChains);
  return {
    x1,
    x2: x1 * x1,
    x3,
    x4,
    x5,
    x6,
    x7: x3 * (x1 - ctx.meanLogTvl),
    x8: (x4 - ctx.meanLogAge) * x3,
    x10: age !== null && age < METHOD.RECENCY_DAYS ? 1 : 0,
    ageDays: age,
  };
}

// The odds model reuses the same value features (§3.3.2).
export type OddsFeatures = Pick<ValueFeatures, 'x1' | 'x2' | 'x3' | 'x4' | 'x5' | 'x6'>;

// ------------------------------------------------------------------
// Splits (§3.2.2, §3.2.3). All deterministic, no seed, no file order.
// ------------------------------------------------------------------
export function slugHashBucket(slug: string): number {
  let s = 0;
  for (const c of slug) s += c.charCodeAt(0);
  return s % 10;
}

// H1: slug-hash buckets 7-9 are test, 0-6 train.
export const inH1Test = (p: Protocol): boolean => slugHashBucket(p.slug) >= 7;

// H2: within each category, protocols sorted by slug; every 10th
// (positions 10, 20, 30, ...) is test. Categories with fewer than 10
// members contribute no test protocol. Null category is one category.
export function h2TestSlugs(protocols: Protocol[]): Set<string> {
  const byCategory = new Map<string, Protocol[]>();
  for (const p of protocols) {
    const key = p.category ?? '\u0000null';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(p);
  }
  const test = new Set<string>();
  for (const members of byCategory.values()) {
    const sorted = [...members].sort((a, b) => (a.slug < b.slug ? -1 : 1));
    if (sorted.length >= METHOD.H2_EVERY_NTH) {
      for (let j = METHOD.H2_EVERY_NTH - 1; j < sorted.length; j += METHOD.H2_EVERY_NTH) {
        test.add(sorted[j]!.slug);
      }
    }
  }
  return test;
}

export interface WalkForwardFold {
  cutoff: string;
  train: number[];
  test: number[];
  valid: boolean;
  skippedReason: string | null;
}

// Walk-forward over a protocol list given as indices: train is
// listed_at < cutoff, test is listed_at >= cutoff; listed_at null is in
// neither. A fold counts only when train >= 20 and test >= 10 (§3.2.3).
export function walkForwardFolds(list: Protocol[]): WalkForwardFold[] {
  return METHOD.WF_CUTOFFS.map((cutoff) => {
    const train: number[] = [];
    const test: number[] = [];
    list.forEach((p, i) => {
      if (!p.listed_at) return;
      if (p.listed_at < cutoff) train.push(i);
      else test.push(i);
    });
    const valid = train.length >= METHOD.WF_MIN_TRAIN && test.length >= METHOD.WF_MIN_TEST;
    return {
      cutoff,
      train,
      test,
      valid,
      skippedReason: valid
        ? null
        : `train ${train.length} (need ${METHOD.WF_MIN_TRAIN}), test ${test.length} (need ${METHOD.WF_MIN_TEST})`,
    };
  });
}
