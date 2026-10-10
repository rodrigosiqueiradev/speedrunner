import { ANALYSIS_DEFAULTS, analyzeRun, type AnalyzeOptions, type RunAnalysis } from "./analyze.js";
import { recentSlice } from "./recency.js";
import type { Ms, Run } from "./types.js";

export type GoalStatus =
  /** The PB already beats the goal. */
  | "already"
  /** Reachable at a pace you have hit in recent attempts. */
  | "reachable"
  /** Only reachable by matching golds older than your recent attempts. */
  | "needs-golds"
  /** Faster than every segment at its gold. */
  | "out-of-reach"
  /** No PB, a PB that skips a split, or no segment with enough attempts to plan from. */
  | "no-data";

export interface GoalSegment {
  index: number;
  name: string;
  pbTime: Ms | null;
  /** This segment's time in the plan. */
  target: Ms | null;
  /** PB time minus target: what the plan asks this segment to give back. */
  cut: Ms;
  /** Your typical (median) time, if there are enough samples. */
  median: Ms | null;
  /**
   * "consistency": the target is no faster than your typical time, so an ordinary attempt gets it.
   * "faster": the target needs a better than usual attempt. "none": the segment keeps its PB time.
   */
  kind: "consistency" | "faster" | "none";
  /** Share of recent clean times at or under the target, or null without samples. */
  hitRate: number | null;
  /** Recent clean times the plan was worked out from. */
  samples: number;
}

export interface GoalPlan {
  goal: Ms;
  personalBest: Ms | null;
  status: GoalStatus;
  /** PB minus goal. Below zero means the PB already beats it. */
  timeToCut: Ms | null;
  /**
   * The pace the plan asks for in every segment it cuts: the share of your recent attempts
   * that are at least that fast. 0.25 is the realistic target's good-day pace. Null unless reachable.
   */
  pace: number | null;
  /** Total the plan adds up to: under the goal when reachable or needs-golds. */
  plannedTime: Ms | null;
  /** How far the goal is beyond every segment at its gold, when out of reach. */
  shortfall: Ms | null;
  segments: GoalSegment[];
  /** Cumulative split times of the plan, or null when there is no plan. */
  splits: Ms[] | null;
}

/**
 * Recent clean segment times, oldest first, with the same filters the analysis uses:
 * skipped splits, merged segments and mis-splits are left out, and only the latest half of
 * each segment's times (10 to 50, see recency.ts) are kept, or `recentWindow` if given.
 */
export function recentSegmentTimes(run: Run, options: AnalyzeOptions = {}): Ms[][] {
  const minSamples = options.minSamples ?? ANALYSIS_DEFAULTS.minSamples;
  const outlierFloor = options.outlierFloor ?? ANALYSIS_DEFAULTS.outlierFloor;
  return run.segments.map((segment, i) => {
    const clean: Array<[number, Ms]> = [];
    for (const [id, time] of segment.history) {
      if (id <= 0 || time == null || time <= 0) continue;
      if (i > 0 && run.segments[i - 1].history.get(id) == null) continue;
      clean.push([id, time]);
    }
    clean.sort((a, b) => a[0] - b[0]);
    const raw = clean.map(([, t]) => t);
    const sorted = [...raw].sort((a, b) => a - b);
    const floor = raw.length >= minSamples ? outlierFloor * interpolate(sorted, 0.5) : 0;
    const kept = raw.filter((t) => t >= floor);
    return options.recentWindow != null ? kept.slice(-options.recentWindow) : recentSlice(kept);
  });
}

/**
 * Works out the least demanding way to beat a goal time, starting from the PB.
 *
 * Your own spread of times is the difficulty of each segment: cutting a second from a
 * segment you play within a second of your best is harder than cutting it from one that
 * swings by ten. So the plan asks for the same pace in every segment, as a share of your
 * recent attempts ("a time you hit in 1 of every 8 attempts"), and finds the most relaxed
 * pace whose segment times add up to the goal. Segments already faster than that pace in
 * the PB keep their PB time. When even your recent best everywhere isn't enough, the plan
 * moves each segment from its recent best towards its gold by the same fraction.
 */
export function planGoal(run: Run, goal: Ms, options: AnalyzeOptions = {}, analysis?: RunAnalysis): GoalPlan {
  const a = analysis ?? analyzeRun(run, options);
  const minSamples = options.minSamples ?? ANALYSIS_DEFAULTS.minSamples;
  const recent = recentSegmentTimes(run, options).map((times) => [...times].sort((x, y) => x - y));
  const pb = a.personalBest;
  const base = {
    goal,
    personalBest: pb,
    timeToCut: pb != null ? pb - goal : null,
    pace: null,
    plannedTime: null,
    shortfall: null,
    splits: null,
  };

  const segmentsFor = (targets: Array<Ms | null>): GoalSegment[] =>
    a.segments.map((s, i) => {
      const target = targets[i];
      const cut = s.pbTime != null && target != null ? s.pbTime - target : 0;
      const times = recent[i];
      return {
        index: i,
        name: s.name,
        pbTime: s.pbTime,
        target,
        cut,
        median: s.median,
        kind: cut <= 0 ? "none" : s.median != null && target! >= s.median ? "consistency" : "faster",
        hitRate: times.length && target != null ? times.filter((t) => t <= target).length / times.length : null,
        samples: times.length,
      };
    });

  const pbTimes = a.segments.map((s) => s.pbTime);
  if (pb == null || pbTimes.some((t) => t == null)) {
    return { ...base, status: "no-data", segments: segmentsFor(pbTimes) };
  }
  const pbs = pbTimes as Ms[];
  // "Sub X" means strictly under X as LiveSplit shows it, so plan for a hundredth under.
  const limit = goal - 10;
  if (pb <= limit) {
    return { ...base, status: "already", plannedTime: pb, segments: segmentsFor(pbs), splits: cumulative(pbs) };
  }

  // Only segments with enough recent times can be planned; the rest keep their PB time.
  const plannable = recent.map((times) => times.length >= minSamples);
  if (!plannable.some(Boolean)) return { ...base, status: "no-data", segments: segmentsFor(pbs) };
  const atPace = (q: number) => pbs.map((p, i) => (plannable[i] ? Math.min(p, interpolate(recent[i], q)) : p));
  const total = (times: number[]) => times.reduce((x, y) => x + y, 0);

  const finish = (status: GoalStatus, raw: number[], pace: number | null): GoalPlan => {
    // Rounding every target down keeps the total at or under the goal.
    const targets = raw.map(Math.floor);
    return {
      ...base,
      status,
      pace,
      plannedTime: total(targets),
      segments: segmentsFor(targets),
      splits: cumulative(targets),
    };
  };

  if (total(atPace(0)) <= limit) {
    // The total only grows as the pace relaxes, so bisect for the most relaxed pace that fits.
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (total(atPace(mid)) <= limit) lo = mid;
      else hi = mid;
    }
    return finish("reachable", atPace(lo), lo);
  }

  // Past your recent bests: move each plannable segment towards its gold by the same fraction.
  const recentBest = atPace(0);
  const golds = a.segments.map((s, i) => (plannable[i] && s.gold != null ? Math.min(s.gold, recentBest[i]) : recentBest[i]));
  const towardsGold = (f: number) => recentBest.map((r, i) => r - f * (r - golds[i]));
  if (total(golds) > limit) {
    return { ...base, status: "out-of-reach", shortfall: total(golds) - limit, segments: segmentsFor(pbs) };
  }
  let lo = 1;
  let hi = 0;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (total(towardsGold(mid)) <= limit) lo = mid;
    else hi = mid;
  }
  return finish("needs-golds", towardsGold(lo), null);
}

/** Round steps a goal can sit on, smallest first. */
const GOAL_STEPS = [1_000, 5_000, 10_000, 15_000, 30_000, 60_000, 5 * 60_000, 10 * 60_000, 15 * 60_000, 30 * 60_000];

/**
 * A round goal just under the PB. The step is the largest round one (1 s up to 30 min) that is
 * at most 1% of the PB, so the goal asks for about the same share of the run at any length:
 * 40:01.52 gives 40:00, 1:33.4 gives 1:33, and 5:42:54 gives 5:42:00.
 */
export function suggestGoal(personalBest: Ms): Ms {
  const step = [...GOAL_STEPS].reverse().find((s) => s <= personalBest * GOAL_STEP_SHARE) ?? GOAL_STEPS[0];
  const below = Math.floor((personalBest - 1) / step) * step;
  return below > 0 ? below : personalBest;
}

/** The goal step is the largest round step at most this share of the PB. */
export const GOAL_STEP_SHARE = 0.01;

function cumulative(times: Ms[]): Ms[] {
  let acc = 0;
  return times.map((t) => (acc += t));
}

/** Linear-interpolated quantile of an ascending-sorted array, without rounding. */
function interpolate(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
