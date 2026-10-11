import { cleanSegmentTimes } from "./segment-model.js";
import type { Ms, Run } from "./types.js";

/**
 * Settings for luck-based segments: ones whose times split into a good and a bad outcome the runner
 * doesn't control (a boss pattern, a minigame, a cycle). Every rule is a share or a ratio of the
 * runner's own times, or a count of their attempts, so it fits a 5 minute and a 6 hour category alike.
 */
export const LUCK_SETTINGS = {
  /** Fewer clean times than this and a marked segment is treated like any other. */
  minOutcomeSamples: 10,
  /** Each outcome must hold at least this share of the times, so one odd attempt isn't an outcome. */
  minOutcomeShare: 0.1,
  /** A suggestion needs at least this many clean times. */
  minSuggestSamples: 20,
  /** Suggested when the two outcomes are this far apart: Ashman's D on log times. */
  minSeparation: 2,
  /** ...the bad outcome's typical time is at least this much slower than the good one's (10%)... */
  minCostRatio: 1.1,
  /** ...both outcomes are common: the good one happens in this share of attempts. A rare slow tail looks like mistakes. */
  goodShareRange: [0.2, 0.8] as const,
  /**
   * ...and which outcome you get doesn't streak or improve: a runs test on the attempt order stays within
   * this many standard deviations, and the good share moves less than this between the older and newer
   * half of your times. A strat change does both (old attempts slow, new ones fast); luck does neither.
   */
  maxStreakZ: 3,
  maxDrift: 0.2,
} as const;

export interface Outcomes {
  /** Times at or under this are the good outcome. */
  cut: Ms;
  /** Share of the times in the good outcome. */
  goodShare: number;
  /** How far apart the two outcomes are (Ashman's D on log times): 2 or more is clearly two groups. */
  separation: number;
  /** The bad outcome's typical time over the good one's (geometric means). */
  costRatio: number;
}

/**
 * Splits a segment's times into a good and a bad outcome: the cut that best separates the log
 * times into two groups (Otsu's method). Null with too few times or no split that leaves at least
 * a tenth of the times on each side.
 */
export function splitOutcomes(times: Ms[]): Outcomes | null {
  const S = LUCK_SETTINGS;
  const sorted = times.filter((t) => t > 0).sort((a, b) => a - b);
  const x = sorted.map(Math.log);
  const n = x.length;
  if (n < S.minOutcomeSamples) return null;
  const sum = [0];
  const sumSq = [0];
  for (const v of x) {
    sum.push(sum[sum.length - 1] + v);
    sumSq.push(sumSq[sumSq.length - 1] + v * v);
  }
  const minGroup = Math.max(2, Math.ceil(n * S.minOutcomeShare));
  let best = -1;
  let bestK = -1;
  for (let k = minGroup; k <= n - minGroup; k++) {
    if (x[k] === x[k - 1]) continue;
    const m1 = sum[k] / k;
    const m2 = (sum[n] - sum[k]) / (n - k);
    const between = k * (n - k) * (m2 - m1) ** 2;
    if (between > best) {
      best = between;
      bestK = k;
    }
  }
  if (bestK < 0) return null;
  const k = bestK;
  const m1 = sum[k] / k;
  const m2 = (sum[n] - sum[k]) / (n - k);
  const v1 = Math.max(0, sumSq[k] / k - m1 * m1);
  const v2 = Math.max(0, (sumSq[n] - sumSq[k]) / (n - k) - m2 * m2);
  const spread = Math.sqrt((v1 + v2) / 2);
  return {
    // The slowest good time, so `t <= cut` sorts every time the same way the split did.
    cut: sorted[k - 1],
    goodShare: k / n,
    separation: spread > 0 ? (m2 - m1) / spread : Infinity,
    costRatio: Math.exp(m2 - m1),
  };
}

export interface LuckSuggestion {
  index: number;
  name: string;
  /** "pattern": the times look luck-shaped. "name": the segment's name says RNG. */
  reason: "pattern" | "name";
  /** Share of your times with good luck, when the times split into two outcomes. */
  goodShare: number | null;
  /** Typical extra time bad luck costs, when the times split into two outcomes. */
  cost: Ms | null;
}

const NAMED_RNG = /\brng\b/i;

/**
 * Segments that look luck-based, for the runner to confirm. Times alone can't prove luck (a trick
 * that fails a third of the time looks the same), so the app only ever suggests; the runner marks.
 */
export function suggestLuckSegments(run: Run): LuckSuggestion[] {
  const S = LUCK_SETTINGS;
  const out: LuckSuggestion[] = [];
  run.segments.forEach((segment, index) => {
    const times = cleanSegmentTimes(run, index).times.map(([, t]) => t);
    const outcomes = times.length >= S.minSuggestSamples ? splitOutcomes(times) : null;
    const describe = (o: Outcomes | null) => {
      if (!o) return { goodShare: null, cost: null };
      const good = times.filter((t) => t <= o.cut).sort((a, b) => a - b);
      const bad = times.filter((t) => t > o.cut).sort((a, b) => a - b);
      return { goodShare: o.goodShare, cost: middle(bad) - middle(good) };
    };
    if (outcomes && looksLikeLuck(times, outcomes)) {
      out.push({ index, name: segment.name, reason: "pattern", ...describe(outcomes) });
    } else if (NAMED_RNG.test(segment.name)) {
      out.push({ index, name: segment.name, reason: "name", ...describe(outcomes) });
    }
  });
  return out;
}

function looksLikeLuck(times: Ms[], o: Outcomes): boolean {
  const S = LUCK_SETTINGS;
  if (o.separation < S.minSeparation || o.costRatio < S.minCostRatio) return false;
  if (o.goodShare < S.goodShareRange[0] || o.goodShare > S.goodShareRange[1]) return false;
  const good = times.map((t) => t <= o.cut);
  const half = Math.floor(good.length / 2);
  const share = (xs: boolean[]) => xs.filter(Boolean).length / xs.length;
  if (Math.abs(share(good.slice(half)) - share(good.slice(0, half))) >= S.maxDrift) return false;
  return Math.abs(runsTestZ(good)) < S.maxStreakZ;
}

/**
 * Wald-Wolfowitz runs test: how far the number of good/bad streaks in attempt order is from what
 * independent attempts would give, in standard deviations. Strongly negative means outcomes come in
 * long streaks (a strat change), not independently like luck.
 */
export function runsTestZ(labels: boolean[]): number {
  const n = labels.length;
  const n1 = labels.filter(Boolean).length;
  const n2 = n - n1;
  if (n1 < 2 || n2 < 2) return 0;
  let runs = 1;
  for (let i = 1; i < n; i++) if (labels[i] !== labels[i - 1]) runs++;
  const mean = (2 * n1 * n2) / n + 1;
  const variance = (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n * n * (n - 1));
  return variance > 0 ? (runs - mean) / Math.sqrt(variance) : 0;
}

/** A copy of the run with the segments named in `names` marked as luck-based (and no others). */
export function markLuck(run: Run, names: Iterable<string>): Run {
  const marked = new Set([...names].map(luckKey));
  return { ...run, segments: run.segments.map((s) => ({ ...s, luck: marked.has(luckKey(s.name)) })) };
}

/** How a segment's name is matched against saved luck marks: trimmed and case-insensitive. */
export function luckKey(name: string): string {
  return name.trim().toLowerCase();
}

function middle(sorted: Ms[]): Ms {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}
