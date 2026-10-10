/**
 * How much of a runner's history counts as "current form". Counted in their own attempts, never in
 * days or seconds, so the same rule fits a 10 minute category with thousands of attempts and a
 * 6 hour one with a few dozen. Every feature that looks at recent times uses these helpers.
 */
export const RECENCY_SETTINGS = {
  /** A time's weight halves every this fraction of the history (a quarter of the times)... */
  halfLifeShare: 1 / 4,
  /** ...but never faster than every this many times, so a short history isn't judged on two or three... */
  minHalfLife: 5,
  /** ...and never slower than every this many, so a long history still follows recent form. */
  maxHalfLife: 25,
} as const;

/** Half-life, in samples, for a history of `n` times: a quarter of them, between 5 and 25. */
export function halfLife(n: number): number {
  const R = RECENCY_SETTINGS;
  return Math.min(R.maxHalfLife, Math.max(R.minHalfLife, n * R.halfLifeShare));
}

/**
 * How many of the latest times make up "recent" when a feature needs a plain window rather than
 * weights: the times that still carry at least a quarter of the weight of the newest one, which
 * works out to the latest half of the history, at least 10 (or all of them) and at most 50.
 */
export function recentCount(n: number): number {
  return Math.min(n, Math.ceil(2 * halfLife(n)));
}

/** The latest `recentCount` items of a list ordered oldest first. */
export function recentSlice<T>(items: T[]): T[] {
  return items.slice(items.length - recentCount(items.length));
}

/** Weights for `n` samples ordered oldest first: the newest weighs 1 and each older one fades by the half-life. */
export function recencyWeights(n: number): number[] {
  const h = halfLife(n);
  return Array.from({ length: n }, (_, k) => Math.pow(0.5, (n - 1 - k) / h));
}

/** Weighted quantile (q from 0 to 1) of `values` with matching `weights`: the smallest value whose cumulative weight reaches q. */
export function weightedQuantile(values: number[], weights: number[], q: number): number {
  if (values.length === 0) throw new Error("quantile of empty array");
  const order = values.map((v, i) => [v, weights[i]] as const).sort((a, b) => a[0] - b[0]);
  const total = order.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [v, w] of order) {
    acc += w;
    if (acc >= q * total) return v;
  }
  return order[order.length - 1][0];
}
