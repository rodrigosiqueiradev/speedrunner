import { analyzeRun, quantile, type RunAnalysis } from "./analyze.js";
import { attemptSplitTimes, fasterHalf } from "./segment-model.js";
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
  /**
   * Improvement compares your latest finishes with the same number just before them: half of your
   * finished runs each, at most this many. Counted in finishes, so a 6 hour category with a dozen
   * finishes gets a score as well as a 10 minute one with hundreds.
   */
  improvementWindow: 10,
  /** Finished runs needed in each of the two groups. */
  minImprovementWindow: 4,
  weights: { efficiency: 0.4, consistency: 0.25, completion: 0.2, improvement: 0.15 },
  /**
   * Below any of these, a category score is marked provisional and left out of the overall score.
   * Counted in your own runs and times, set low enough that a long category with few attempts can
   * reach them: finished runs, and clean times in the typical (median) segment.
   */
  provisional: { minFinished: 8, minSegmentSamples: 10, minComponents: 3, minSegments: 5 },
  /** The overall score averages this many of the runner's best category scores. */
  overallTop: 5,
} as const;

export type ComponentKey = keyof typeof SCORE_SETTINGS.weights;
export const COMPONENT_KEYS: ComponentKey[] = ["efficiency", "consistency", "completion", "improvement"];

export type ProvisionalReason = "few-finished" | "few-samples" | "few-components" | "few-segments";

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
    /** The sum of best compared with, at the PB's luck in segments marked as luck (see RunAnalysis.sumOfBestWithPbLuck). */
    sumOfBest: Ms | null;
    /** True when the PB had bad luck in a marked segment, so `sumOfBest` is slower than the plain sum of best. Missing in older saved scores. */
    luckAdjusted?: boolean;
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
    /** Attempts that started the middle segment. */
    reachedMiddle: number;
    /**
     * Of those, the ones going well: in the faster half of times at the split before the middle
     * segment. Runs reset for being behind pace aren't held against you.
     */
    goodRuns: number;
    /** Good runs that went on to finish. */
    finished: number;
    rate: number | null;
  };
  improvement: {
    score: number | null;
    finishedRuns: number;
    /** Finished runs in each of the two groups compared, or 0 when there are too few. */
    window: number;
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
  /** Clean times in a typical (median) segment: how much history each segment's stats rest on. */
  segmentSamples: number | null;
  /** A "World Record" or "WR" comparison saved in the split file, if there is one. */
  fileReference: { name: string; time: Ms } | null;
}

/** Scores how well a runner runs this category, from their own split file alone. */
export function scoreRun(run: Run, analysis: RunAnalysis = analyzeRun(run)): CategoryScore {
  const S = SCORE_SETTINGS;
  const a = analysis;

  // Luck-based segments count at their best with the luck the PB had, so a PB isn't marked down for bad luck or up for good luck.
  const best = a.sumOfBestWithPbLuck ?? a.sumOfBest;
  const gap = a.personalBest != null && best != null && best > 0 ? Math.max(0, (a.personalBest - best) / best) : null;
  const efficiency = {
    score: gap == null ? null : scale(1 - gap / S.efficiencyZeroGap),
    personalBest: a.personalBest,
    sumOfBest: best,
    luckAdjusted: a.sumOfBestWithPbLuck != null && a.sumOfBestWithPbLuck !== a.sumOfBest,
    gap,
  };

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
  // Only runs still going well at the middle count, so resetting a run that's behind pace (which the
  // reset coach recommends, and short categories do far more often) doesn't cost completion.
  const ids = run.attempts.map((x) => x.id).filter((id) => id > 0);
  const atMiddle = middleSegment === 0 ? ids : ids.filter((id) => run.segments[middleSegment - 1].history.has(id));
  const goodRuns = !hasHistory || !middle ? [] : middleSegment === 0 ? atMiddle : fasterHalf(attemptSplitTimes(run)[middleSegment - 1], atMiddle).ids;
  const lastSegment = run.segments.at(-1);
  const finishedGood = goodRuns.filter((id) => lastSegment?.history.get(id) != null).length;
  const rate = goodRuns.length > 0 ? finishedGood / goodRuns.length : null;
  const completion = {
    score: rate == null ? null : scale(rate),
    middleSegment,
    middleSegmentName: middle?.name ?? null,
    reachedMiddle,
    goodRuns: goodRuns.length,
    finished: finishedGood,
    rate,
  };

  const finishes = run.attempts
    .filter((x) => x.id > 0 && x.time != null && x.time > 0)
    .sort((x, y) => x.id - y.id)
    .map((x) => x.time!);
  const w = improvementWindow(finishes.length);
  let previousMedian: Ms | null = null;
  let recentMedian: Ms | null = null;
  let change: number | null = null;
  if (w > 0) {
    previousMedian = median(finishes.slice(-2 * w, -w));
    recentMedian = median(finishes.slice(-w));
    change = (previousMedian - recentMedian) / previousMedian;
  }
  const improvement = {
    score: change == null ? null : scale(0.5 + (0.5 * change) / S.improvementFullChange),
    finishedRuns: finishes.length,
    window: w,
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
  const segmentSamples = typicalSegmentSamples(a);
  if ((segmentSamples ?? 0) < S.provisional.minSegmentSamples) provisionalReasons.push("few-samples");
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
    segmentSamples,
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

/** Finished runs in each group improvement compares: half of them, up to 10, or 0 below 4 a side. */
export function improvementWindow(finished: number): number {
  const w = Math.min(SCORE_SETTINGS.improvementWindow, Math.floor(finished / 2));
  return w >= SCORE_SETTINGS.minImprovementWindow ? w : 0;
}

/** Clean times in the middle segment when segments are ordered by how many they have. */
export function typicalSegmentSamples(a: Pick<RunAnalysis, "segments">): number | null {
  if (a.segments.length === 0) return null;
  return median(a.segments.map((s) => s.samples));
}

function scale(x: number): number {
  return Math.max(0, Math.min(100, x * 100));
}

function median(xs: Ms[]): Ms {
  return quantile([...xs].sort((a, b) => a - b), 0.5);
}
