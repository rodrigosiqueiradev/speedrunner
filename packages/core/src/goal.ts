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
  /** No PB, or no segment with enough attempts to plan from. */
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
  /** A segment marked as luck whose target is faster than any of your bad-luck times there. */
  needsLuck: boolean;
  /**
   * The PB skipped a split next to this segment, so its PB time is blank and its cut is its share
   * of the cut from the whole stretch (see RunAnalysis.skippedPbStretches).
   */
  inSkippedStretch: boolean;
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
 * moves each segment from its recent best towards its gold by the same fraction. A stretch
 * where the PB skipped a split is planned as one piece against its PB time, like the realistic target.
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
  const n = a.segments.length;
  const plannable = recent.map((times) => times.length >= minSamples);

  // A stretch the PB skipped a split in has one PB time for all its segments, so it is planned
  // as one piece: every other segment is a piece of its own.
  const pieces: Array<{ idx: number[]; pb: Ms }> = [];
  if (pb != null) {
    const stretchAt = new Map(a.skippedPbStretches.map((st) => [st.from, st]));
    for (let i = 0; i < n; ) {
      const st = stretchAt.get(i);
      const idx = st ? Array.from({ length: st.to - st.from + 1 }, (_, k) => st.from + k) : [i];
      pieces.push({ idx, pb: st ? st.pbTime : a.segments[i].pbTime! });
      i = idx.at(-1)! + 1;
    }
  }
  const stretched = new Set(pieces.filter((p) => p.idx.length > 1).flatMap((p) => p.idx));

  /**
   * Segment targets from one time per piece, shared out within a stretch in proportion to `weights`
   * (or the fallback weights when a segment has none). `whole` shares in whole milliseconds that
   * add up to the piece's time; otherwise the shares are exact and the plan rounds them down.
   */
  const fromPieces = (pieceTime: (idx: number[], p: Ms) => number, weights: Array<number | null>, whole = false): number[] => {
    const out = new Array<number>(n).fill(0);
    for (const { idx, pb: p } of pieces) {
      const t = pieceTime(idx, p);
      if (idx.length === 1) {
        out[idx[0]] = t;
        continue;
      }
      const ws = idx.map((i) => weights[i]);
      const w = ws.every((x) => x != null && x > 0) ? (ws as number[]) : fallbackWeights(idx);
      const sum = w.reduce((x, y) => x + y, 0);
      let acc = 0;
      let given = 0;
      idx.forEach((i, k) => {
        acc += w[k];
        const upTo = k === idx.length - 1 ? t : (t * acc) / sum;
        const end = whole ? Math.floor(upTo) : upTo;
        out[i] = end - given;
        given = end;
      });
    }
    return out;
  };
  const sumOf = (idx: number[], values: Array<number | null>) =>
    idx.every((i) => values[i] != null) ? idx.reduce((x, i) => x + values[i]!, 0) : null;
  /** Each piece at the faster of its PB time and its segments' values added up. */
  const fromValues = (values: Array<number | null>): number[] =>
    fromPieces((idx, p) => Math.min(p, sumOf(idx, values) ?? p), values);
  // Without values, a stretch's PB time is shared out by typical time, then gold, then evenly.
  const fallbackWeights = (idx: number[]): number[] => {
    const pick = (w: Array<number | null>) => (w.every((x) => x != null && x > 0) ? (w as number[]) : null);
    return pick(idx.map((i) => a.segments[i].median)) ?? pick(idx.map((i) => a.segments[i].gold)) ?? idx.map(() => 1);
  };
  const pbTargets = () => fromPieces((_, p) => p, new Array(n).fill(null), true);

  const segmentsFor = (targets: Array<Ms | null>): GoalSegment[] =>
    a.segments.map((s, i) => {
      const target = targets[i];
      // Inside a skipped stretch the PB has no time per segment, so its cut is shared out like its target.
      const piece = stretched.has(i) ? pieces.find((p) => p.idx.includes(i))! : null;
      const pieceTarget = piece && target != null ? piece.idx.reduce((x, j) => x + (targets[j] ?? 0), 0) : null;
      const cut = piece
        ? pieceTarget ? Math.round(((piece.pb - pieceTarget) * target!) / pieceTarget) : 0
        : s.pbTime != null && target != null ? s.pbTime - target : 0;
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
        // Faster than any time you've had with bad luck there: only good luck gets it.
        needsLuck: s.luck?.badBest != null && target != null && cut > 0 && target < s.luck.badBest,
        inSkippedStretch: piece != null,
      };
    });

  if (pb == null) {
    return { ...base, status: "no-data", segments: segmentsFor(a.segments.map((s) => s.pbTime)) };
  }
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
  // "Sub X" means strictly under X as LiveSplit shows it, so plan for a hundredth under.
  const limit = goal - 10;
  if (pb <= limit) return { ...finish("already", pbTargets(), null), plannedTime: pb };

  // Only segments with enough recent times can be planned; the rest keep their PB time.
  if (!plannable.some(Boolean)) return { ...base, status: "no-data", segments: segmentsFor(pbTargets()) };
  const valuesAt = (q: number) => recent.map((times, i) => (plannable[i] ? interpolate(times, q) : null));
  const atPace = (q: number) => fromValues(valuesAt(q));

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
  // A piece's recent best is the faster of its PB time and its recent bests added up, its gold
  // the faster of that and its golds added up. Unplannable pieces keep their PB time.
  const recentBest = valuesAt(0);
  const golds = recentBest.map((r, i) => (r != null && a.segments[i].gold != null ? Math.min(a.segments[i].gold!, r) : r));
  const towardsGold = (f: number) =>
    fromPieces(
      (idx, p) => {
        const r = Math.min(p, sumOf(idx, recentBest) ?? p);
        const g = Math.min(r, sumOf(idx, golds) ?? r);
        return r - f * (r - g);
      },
      recentBest.map((r, i) => (r == null ? null : r - f * (r - golds[i]!))),
    );
  if (total(towardsGold(1)) > limit) {
    return { ...base, status: "out-of-reach", shortfall: total(towardsGold(1)) - limit, segments: segmentsFor(pbTargets()) };
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
