import { ANALYSIS_DEFAULTS, quantile } from "./analyze.js";
import { recencyWeights } from "./recency.js";
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
   * `resetRate` for the first segment or when too few attempts are known, and is never above it.
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
  const splitTimes = attemptSplitTimes(run);

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
    const good = i === 0 ? null : fasterHalf(splitTimes[i - 1], reached);
    return {
      index: i,
      name: segment.name,
      times,
      thin: times.length < minSamples,
      resetRate,
      // Mistakes end slow and fast runs alike, so every run's reset rate already counts them: a higher
      // rate among a handful of good runs (one reset in five, late in a long run) is chance, not a deadlier segment.
      mistakeRate:
        good && good.compared >= 2 * minSamples
          ? Math.min(resetRate, good.ids.filter((id) => !segment.history.has(id)).length / good.ids.length)
          : resetRate,
    };
  });
}

/**
 * Each attempt's time at every split it reached with every split before it recorded:
 * `splitTimes[j].get(id)` is attempt `id`'s time at split j. A skipped split leaves the attempt out from there on.
 */
export function attemptSplitTimes(run: Run): Array<Map<number, Ms>> {
  const out: Array<Map<number, Ms>> = [];
  let previous = new Map<number, Ms>();
  run.segments.forEach((segment, j) => {
    const current = new Map<number, Ms>();
    for (const [id, t] of segment.history) {
      if (t == null) continue;
      const before = j === 0 ? 0 : previous.get(id);
      if (before != null) current.set(id, before + t);
    }
    out.push(current);
    previous = current;
  });
  return out;
}

/**
 * The attempts among `ids` that were going well at a split: in the faster half of their times there
 * (`atSplit` is one entry of attemptSplitTimes). Their resets after it are mostly mistakes rather than
 * resets for being behind pace. `compared` is how many of `ids` had a time at the split.
 */
export function fasterHalf(atSplit: Map<number, Ms>, ids: number[]): { compared: number; ids: number[] } {
  const timed: Array<[id: number, time: Ms]> = [];
  for (const id of ids) {
    const t = atSplit.get(id);
    if (t != null) timed.push([id, t]);
  }
  if (timed.length === 0) return { compared: 0, ids: [] };
  const median = quantile(timed.map(([, t]) => t).sort((a, b) => a - b), 0.5);
  return { compared: timed.length, ids: timed.filter(([, t]) => t <= median).map(([id]) => id) };
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

/**
 * Settings for the form model. Everything is a share of your own samples or a ratio of your own
 * times, never a fixed number of seconds, so the same settings fit a 5 minute and a 6 hour category.
 * Recent samples count more, by the shared recency rule (see recencyWeights).
 */
export const FORM_MODEL_SETTINGS = {
  /** Segment times from finished runs are used once a segment has at least this many; otherwise all clean times. */
  minFinishedSamples: 5,
  /** An attempt's form only counts if it has clean times for at least this share of the segments. */
  formCoverage: 0.25,
  /** Share of your recent improvement trend projected onto the next attempt. Slowdowns are never projected. */
  trendShare: 0.5,
  /** Fewer attempts with a form than this and the model uses every attempt's form and no trend. */
  minFormAttempts: 5,
} as const;

export interface FormSegment {
  index: number;
  name: string;
  /** Your recency-weighted median time for the segment. */
  typical: Ms;
  /** Each sample's log ratio to `typical`, after taking out its attempt's form. Oldest first. */
  residuals: Float64Array;
  /** Cumulative recency weights for `residuals`, ending at 1. */
  weights: Float64Array;
  /** True when the samples come only from runs that reached the end. */
  fromFinishedRuns: boolean;
  /**
   * Marked as luck-based: left out of each attempt's form (a lucky segment isn't a good day) and
   * sampled as it is, without the form of the day.
   */
  luck: boolean;
  samples: number;
}

/**
 * How you run right now, as a model you can sample whole runs from. Each simulated run draws one
 * "form of the day" (a log ratio to your typical pace, from your recent attempts) that applies to
 * every segment, plus each segment's own variation. Good days are good across the whole run, as
 * they are for real, instead of averaging out over many segments.
 */
export interface FormModel {
  segments: FormSegment[];
  /** Recent attempts' forms (mean log ratio to typical), oldest first. */
  forms: Float64Array;
  formWeights: Float64Array;
  /** Log ratio added to every simulated run to follow your improvement. Zero or negative. */
  trend: number;
}

/** Builds the form model for a run, or null when a segment has no time at all. */
export function buildFormModel(run: Run, options: Pick<SegmentModelOptions, "minSamples" | "outlierFloor"> = {}): FormModel | null {
  const S = FORM_MODEL_SETTINGS;
  const n = run.segments.length;
  if (n === 0) return null;
  // How far each attempt got: the number of segments it has any history for.
  const reached = new Map<number, number>();
  run.segments.forEach((segment, i) => {
    for (const id of segment.history.keys()) reached.set(id, Math.max(reached.get(id) ?? 0, i + 1));
  });

  const samples: Array<{ times: Array<[number, Ms]>; finished: boolean }> = [];
  for (let i = 0; i < n; i++) {
    const all = cleanSegmentTimes(run, i, options).times;
    const finished = all.filter(([id]) => reached.get(id) === n);
    if (finished.length >= S.minFinishedSamples) samples.push({ times: finished, finished: true });
    else if (all.length > 0) samples.push({ times: all, finished: false });
    else {
      const pb = pbSegmentTime(run, i);
      if (pb == null) return null;
      samples.push({ times: [[0, pb]], finished: false });
    }
  }

  const typical = samples.map(({ times }) => weightedMedian(times.map(([, t]) => t), recencyWeights(times.length)));

  // Each attempt's form: the mean log ratio of its segment times to typical. Luck isn't form, so
  // luck-based segments are left out (unless every segment is one).
  const luck = run.segments.map((s) => !!s.luck && !run.segments.every((x) => x.luck));
  const ratios = new Map<number, number[]>();
  samples.forEach(({ times }, i) => {
    if (luck[i]) return;
    for (const [id, t] of times) {
      if (id <= 0) continue;
      const list = ratios.get(id) ?? [];
      list.push(Math.log(t / typical[i]));
      ratios.set(id, list);
    }
  });
  const minSegments = Math.max(1, Math.ceil(luck.filter((x) => !x).length * S.formCoverage));
  const byId = [...ratios].sort((a, b) => a[0] - b[0]);
  let formAttempts = byId.filter(([, r]) => r.length >= minSegments);
  if (formAttempts.length < S.minFormAttempts) formAttempts = byId;
  const formOf = new Map(formAttempts.map(([id, r]) => [id, r.reduce((a, x) => a + x, 0) / r.length]));
  const forms = Float64Array.from(formAttempts.map(([id]) => formOf.get(id)!));
  const formWeights = cumulativeRecency(forms.length);

  const segments: FormSegment[] = samples.map(({ times, finished }, i) => ({
    index: i,
    name: run.segments[i].name,
    typical: typical[i],
    residuals: Float64Array.from(times.map(([id, t]) => Math.log(t / typical[i]) - (luck[i] ? 0 : formOf.get(id) ?? 0))),
    weights: cumulativeRecency(times.length),
    fromFinishedRuns: finished,
    luck: luck[i],
    samples: times.length,
  }));

  return {
    segments,
    forms: forms.length ? forms : Float64Array.of(0),
    formWeights: forms.length ? formWeights : Float64Array.of(1),
    trend: formAttempts.length >= S.minFormAttempts ? improvementTrend(formAttempts.map(([id]) => id), forms, formWeights, run) : 0,
  };
}

/**
 * Draws one simulated run into `out` (one time per segment) and returns its total.
 * `random` should be a seeded generator such as seededRandom.
 */
export function sampleRun(model: FormModel, random: () => number, out: Float64Array): Ms {
  const form = model.forms[pickWeighted(model.formWeights, random())] + model.trend;
  let total = 0;
  for (const s of model.segments) {
    const t = s.typical * Math.exp((s.luck ? 0 : form) + s.residuals[pickWeighted(s.weights, random())]);
    out[s.index] = t;
    total += t;
  }
  return total;
}

/** recencyWeights as a running total scaled to end at 1, for picking a sample with one random number. */
function cumulativeRecency(count: number): Float64Array {
  const weights = recencyWeights(count);
  const total = weights.reduce((a, b) => a + b, 0);
  const out = new Float64Array(count);
  let acc = 0;
  weights.forEach((w, k) => (out[k] = acc += w / total));
  if (count) out[count - 1] = 1;
  return out;
}

/** Index of the first cumulative weight at or above u. */
function pickWeighted(cumulative: Float64Array, u: number): number {
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function weightedMedian(values: number[], weights: number[]): number {
  const items = values.map((v, i) => [v, weights[i]] as const).sort((a, b) => a[0] - b[0]);
  const half = weights.reduce((a, b) => a + b, 0) / 2;
  let acc = 0;
  for (const [v, w] of items) if ((acc += w) >= half) return v;
  return items[items.length - 1][0];
}

/** Weighted straight-line fit of form against attempt number, projected to the next attempt. */
function improvementTrend(ids: number[], forms: Float64Array, cumulative: Float64Array, run: Run): number {
  const w = Array.from(cumulative, (c, i) => c - (i ? cumulative[i - 1] : 0));
  const mx = ids.reduce((a, x, i) => a + w[i] * x, 0);
  const my = forms.reduce((a, y, i) => a + w[i] * y, 0);
  let sxy = 0;
  let sxx = 0;
  ids.forEach((x, i) => {
    sxy += w[i] * (x - mx) * (forms[i] - my);
    sxx += w[i] * (x - mx) ** 2;
  });
  if (sxx === 0) return 0;
  const next = Math.max(...run.attempts.map((a) => a.id), ...ids) + 1;
  return Math.min(0, (sxy / sxx) * (next - mx)) * FORM_MODEL_SETTINGS.trendShare;
}
