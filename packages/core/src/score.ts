import { analyzeRun, quantile, type RunAnalysis } from "./analyze.js";
import type { Ms, Run, TimingMethod } from "./types.js";

/**
 * Settings for the category score. Exported so the UI and docs can quote the real numbers.
 * The cut-offs are first guesses, to be tuned against real split files.
 */
export const SCORE_SETTINGS = {
  /** A PB this much slower than the sum of best (as a fraction of it) scores 0 for efficiency. */
  efficiencyZeroGap: 0.1,
  /** A run-wide variability this high scores 0 for consistency. */
  consistencyZeroVariability: 0.2,
  /** Recent finishes this much faster than the ones before score 100 for improvement (this much slower scores 0). */
  improvementFullChange: 0.03,
  /** How many finished runs make up each of the two groups improvement compares. */
  improvementWindow: 10,
  weights: { efficiency: 0.4, consistency: 0.25, completion: 0.2, improvement: 0.15 },
  /** Below any of these, a category score is marked provisional and left out of the overall score. */
  provisional: { minFinished: 20, minComponents: 3, minSegments: 5 },
  /** The overall score averages this many of the runner's best category scores. */
  overallTop: 5,
} as const;

export type ComponentKey = keyof typeof SCORE_SETTINGS.weights;
export const COMPONENT_KEYS: ComponentKey[] = ["efficiency", "consistency", "completion", "improvement"];

export type ProvisionalReason = "few-finished" | "few-components" | "few-segments";

export interface CategoryScore {
  game: string;
  category: string;
  timingMethod: TimingMethod;
  /** Weighted average of the components that could be computed, 0-100, or null if none could. */
  score: number | null;
  provisional: boolean;
  provisionalReasons: ProvisionalReason[];
  /** The weights actually used, scaled up to sum to 1 over the components that were computed. */
  weights: Record<ComponentKey, number>;
  efficiency: {
    score: number | null;
    personalBest: Ms | null;
    sumOfBest: Ms | null;
    /** (PB - sum of best) / sum of best. */
    gap: number | null;
  };
  consistency: {
    score: number | null;
    /** Segment variabilities averaged with each segment's median as its weight. */
    variability: number | null;
    segmentsUsed: number;
  };
  completion: {
    score: number | null;
    /** The segment an attempt has to reach to count; the middle one. */
    middleSegment: number;
    middleSegmentName: string | null;
    reachedMiddle: number;
    finished: number;
    rate: number | null;
  };
  improvement: {
    score: number | null;
    finishedRuns: number;
    previousMedian: Ms | null;
    recentMedian: Ms | null;
    /** (previous median - recent median) / previous median: positive means getting faster. */
    change: number | null;
  };
  /** Other numbers the reference pace needs. */
  personalBest: Ms | null;
  realisticTarget: Ms | null;
  finishedAttempts: number;
  segmentCount: number;
  /** A "World Record" or "WR" comparison saved in the split file, if there is one. */
  fileReference: { name: string; time: Ms } | null;
}

/** Scores how well a runner runs this category, from their own split file alone. */
export function scoreRun(run: Run, analysis: RunAnalysis = analyzeRun(run)): CategoryScore {
  const S = SCORE_SETTINGS;
  const a = analysis;

  const gap =
    a.personalBest != null && a.sumOfBest != null && a.sumOfBest > 0
      ? Math.max(0, (a.personalBest - a.sumOfBest) / a.sumOfBest)
      : null;
  const efficiency = { score: gap == null ? null : scale(1 - gap / S.efficiencyZeroGap), personalBest: a.personalBest, sumOfBest: a.sumOfBest, gap };

  let weightSum = 0;
  let weighted = 0;
  let segmentsUsed = 0;
  for (const s of a.segments) {
    if (s.variability == null || !s.median) continue;
    weightSum += s.median;
    weighted += s.variability * s.median;
    segmentsUsed++;
  }
  const variability = weightSum > 0 ? weighted / weightSum : null;
  const consistency = {
    score: variability == null ? null : scale(1 - variability / S.consistencyZeroVariability),
    variability,
    segmentsUsed,
  };

  const middleSegment = Math.floor(a.segments.length / 2);
  const middle = a.segments[middleSegment];
  // A file with no segment history can't tell us how many attempts reached anywhere.
  const hasHistory = run.segments.some((s) => s.history.size > 0);
  const reachedMiddle = hasHistory && middle ? middle.reached : 0;
  const rate = reachedMiddle > 0 ? Math.min(1, a.finishedAttempts / reachedMiddle) : null;
  const completion = {
    score: rate == null ? null : scale(rate),
    middleSegment,
    middleSegmentName: middle?.name ?? null,
    reachedMiddle,
    finished: a.finishedAttempts,
    rate,
  };

  const finishes = run.attempts
    .filter((x) => x.id > 0 && x.time != null && x.time > 0)
    .sort((x, y) => x.id - y.id)
    .map((x) => x.time!);
  const w = S.improvementWindow;
  let previousMedian: Ms | null = null;
  let recentMedian: Ms | null = null;
  let change: number | null = null;
  if (finishes.length >= 2 * w) {
    previousMedian = median(finishes.slice(-2 * w, -w));
    recentMedian = median(finishes.slice(-w));
    change = (previousMedian - recentMedian) / previousMedian;
  }
  const improvement = {
    score: change == null ? null : scale(0.5 + (0.5 * change) / S.improvementFullChange),
    finishedRuns: finishes.length,
    previousMedian,
    recentMedian,
    change,
  };

  const components = { efficiency, consistency, completion, improvement };
  const available = COMPONENT_KEYS.filter((k) => components[k].score != null);
  const totalWeight = available.reduce((t, k) => t + S.weights[k], 0);
  const weights = Object.fromEntries(
    COMPONENT_KEYS.map((k) => [k, available.includes(k) ? S.weights[k] / totalWeight : 0]),
  ) as Record<ComponentKey, number>;
  const score = available.length
    ? Math.round(available.reduce((t, k) => t + components[k].score! * weights[k], 0))
    : null;

  const provisionalReasons: ProvisionalReason[] = [];
  if (a.finishedAttempts < S.provisional.minFinished) provisionalReasons.push("few-finished");
  if (available.length < S.provisional.minComponents) provisionalReasons.push("few-components");
  if (a.segments.length < S.provisional.minSegments) provisionalReasons.push("few-segments");

  return {
    game: a.game,
    category: a.category,
    timingMethod: a.timingMethod,
    score,
    provisional: provisionalReasons.length > 0,
    provisionalReasons,
    weights,
    ...components,
    personalBest: a.personalBest,
    realisticTarget: a.realisticTarget,
    finishedAttempts: a.finishedAttempts,
    segmentCount: a.segments.length,
    fileReference: findReference(run),
  };
}

const REFERENCE_NAME = /^(wr|world record)\b/i;

/** Finds a comparison the runner saved for the world record, such as "WR" or "World Record". */
export function findReference(run: Run): { name: string; time: Ms } | null {
  const c = run.comparisons.find((x) => REFERENCE_NAME.test(x.name.trim()) && x.time != null && x.time > 0);
  return c ? { name: c.name, time: c.time! } : null;
}

export interface ReferencePace {
  reference: Ms;
  /** reference / PB: 1 means the PB equals the reference time. */
  pbPace: number | null;
  /** reference / realistic target. */
  targetPace: number | null;
}

/** How a PB (and the realistic target) compare with a reference time such as the world record. */
export function referencePace(score: Pick<CategoryScore, "personalBest" | "realisticTarget">, reference: Ms): ReferencePace {
  const pace = (t: Ms | null) => (t != null && t > 0 ? reference / t : null);
  return { reference, pbPace: pace(score.personalBest), targetPace: pace(score.realisticTarget) };
}

export interface OverallScore {
  /** Average of the counted category scores, or null when none can be counted. */
  score: number | null;
  /** The categories that make up the score, best first. */
  counted: CategoryScore[];
  /** Categories left out because they're provisional. */
  provisional: CategoryScore[];
}

/** The runner's overall score: the average of their best non-provisional category scores. */
export function overallScore(scores: CategoryScore[]): OverallScore {
  const scored = scores.filter((s) => s.score != null);
  const firm = scored.filter((s) => !s.provisional).sort((x, y) => y.score! - x.score!);
  const counted = firm.slice(0, SCORE_SETTINGS.overallTop);
  return {
    score: counted.length ? Math.round(counted.reduce((t, s) => t + s.score!, 0) / counted.length) : null,
    counted,
    provisional: scored.filter((s) => s.provisional),
  };
}

/** The component dragging a category's score down the most: lowest score among those computed. */
export function weakestComponent(score: CategoryScore): ComponentKey | null {
  let weakest: ComponentKey | null = null;
  for (const k of COMPONENT_KEYS) {
    const v = score[k].score;
    if (v != null && (weakest == null || v < score[weakest].score!)) weakest = k;
  }
  return weakest;
}

function scale(x: number): number {
  return Math.max(0, Math.min(100, x * 100));
}

function median(xs: Ms[]): Ms {
  return quantile([...xs].sort((a, b) => a - b), 0.5);
}
