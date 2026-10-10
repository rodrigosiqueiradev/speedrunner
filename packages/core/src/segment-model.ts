import { ANALYSIS_DEFAULTS, quantile } from "./analyze.js";
import type { Ms, Run } from "./types.js";

/**
 * A per-segment model of how long each segment takes you right now and how often runs end in it,
 * built from your own recent clean times. Reusable by anything that simulates runs: PB odds,
 * practice planning, goal planning.
 */
export interface SegmentModel {
  index: number;
  name: string;
  /** Recent clean times, oldest first, that the model samples from. */
  times: Ms[];
  /** Fewer than `minSamples` recent clean times: the model leans on the PB segment and few attempts. */
  thin: boolean;
  /** Share of recent attempts that reached this segment and reset in it. */
  resetRate: number;
  /**
   * The same, among only the faster half of attempts at the previous split. Those runs were still
   * going well, so their resets are mostly mistakes rather than pace resets. Falls back to
   * `resetRate` for the first segment or when too few attempts are known.
   */
  mistakeRate: number;
}

export interface SegmentModelOptions {
  /** How many of the most recent clean times per segment to sample from. */
  recentWindow?: number;
  /** Below this many clean times, a segment is marked thin. */
  minSamples?: number;
  /** Mis-split cut-off as a fraction of the segment's median (see analyzeRun). */
  outlierFloor?: number;
}

/**
 * Clean times for one segment, ordered by attempt id: skipped splits, imported history and
 * mis-splits removed. This is the same cleaning analyzeRun uses for every per-segment stat.
 */
export function cleanSegmentTimes(
  run: Run,
  index: number,
  options: Pick<SegmentModelOptions, "minSamples" | "outlierFloor"> = {},
): { times: Array<[id: number, time: Ms]>; floor: Ms; discarded: number } {
  const minSamples = options.minSamples ?? ANALYSIS_DEFAULTS.minSamples;
  const outlierFloor = options.outlierFloor ?? ANALYSIS_DEFAULTS.outlierFloor;
  const { segments } = run;
  const segment = segments[index];
  // A history time is only this segment's own time if the previous split was not skipped
  // in the same attempt; otherwise LiveSplit recorded the combined time of both segments.
  const clean: Array<[number, Ms]> = [];
  for (const [id, time] of segment.history) {
    if (time == null || time <= 0) continue;
    if (index > 0 && segments[index - 1].history.get(id) == null) continue;
    clean.push([id, time]);
  }
  clean.sort((a, b) => a[0] - b[0]);
  const raw = clean.map(([, t]) => t);
  const floor = raw.length >= minSamples ? outlierFloor * quantile([...raw].sort((a, b) => a - b), 0.5) : 0;
  const times = clean.filter(([, t]) => t >= floor);
  return { times, floor, discarded: clean.length - times.length };
}

/** Builds the segment model for every segment of a run. */
export function buildSegmentModel(run: Run, options: SegmentModelOptions = {}): SegmentModel[] {
  const recentWindow = options.recentWindow ?? ANALYSIS_DEFAULTS.recentWindow;
  const minSamples = options.minSamples ?? ANALYSIS_DEFAULTS.minSamples;
  const { segments } = run;
  const attemptIds = run.attempts
    .map((a) => a.id)
    .filter((id) => id > 0)
    .sort((a, b) => a - b);

  return segments.map((segment, i) => {
    let times = cleanSegmentTimes(run, i, options)
      .times.map(([, t]) => t)
      .slice(-recentWindow);
    // With no history at all (an imported PB), the PB segment is the only evidence we have.
    if (times.length === 0) {
      const pb = pbSegmentTime(run, i);
      if (pb != null) times = [pb];
    }
    const reached = (i === 0 ? attemptIds : attemptIds.filter((id) => segments[i - 1].history.has(id))).slice(
      -recentWindow,
    );
    const resets = reached.filter((id) => !segment.history.has(id)).length;
    const resetRate = reached.length ? resets / reached.length : 0;
    return {
      index: i,
      name: segment.name,
      times,
      thin: times.length < minSamples,
      resetRate,
      mistakeRate: i === 0 ? resetRate : fasterHalfResetRate(run, i, reached, minSamples) ?? resetRate,
    };
  });
}

/** Reset rate in segment i among the attempts that were in the faster half at split i - 1. */
function fasterHalfResetRate(run: Run, i: number, reached: number[], minSamples: number): number | null {
  const atSplit: Array<[id: number, time: Ms]> = [];
  for (const id of reached) {
    const times = run.segments.slice(0, i).map((s) => s.history.get(id));
    if (times.every((t) => t != null)) atSplit.push([id, times.reduce<number>((a, t) => a + t!, 0)]);
  }
  if (atSplit.length < 2 * minSamples) return null;
  const median = quantile(atSplit.map(([, t]) => t).sort((a, b) => a - b), 0.5);
  const faster = atSplit.filter(([, t]) => t <= median);
  return faster.filter(([id]) => !run.segments[i].history.has(id)).length / faster.length;
}

/** This segment's duration in the PB, or null if the PB skipped a split around it. */
export function pbSegmentTime(run: Run, index: number): Ms | null {
  const split = run.segments[index].pbSplit;
  if (split == null) return null;
  if (index === 0) return split;
  const prev = run.segments[index - 1].pbSplit;
  return prev == null ? null : split - prev;
}

/** A small seeded random number generator (mulberry32), so simulations give the same answer every time. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws one segment time by picking one of the model's recent times at random. */
export function sampleSegment(model: SegmentModel, random: () => number): Ms {
  return model.times[Math.floor(random() * model.times.length)];
}
