import { ANALYSIS_DEFAULTS, analyzeRun, quantile, type RunAnalysis } from "./analyze.js";
import { recentSlice } from "./recency.js";
import type { Ms, Run } from "./types.js";

/**
 * Settings for the practice planner. Exported so the UI and docs can quote the real numbers.
 * The learning prior and rep overhead are first guesses, to be tuned against real split files.
 */
export const PRACTICE_SETTINGS = {
  /** Session length the plan is built for unless the runner picks another. */
  sessionMinutes: 60,
  /**
   * Practice time is handed out in blocks of this many minutes, or the smallest multiple of it
   * that holds one rep, so a 12 minute segment gets 15 minute blocks rather than a fraction of a rep.
   */
  blockMinutes: 5,
  /** Time added to every practice rep for reloading a save or getting back into position. */
  repOverheadMs: 20_000,
  /**
   * Share of the session kept for playing segments in context: full runs when one fits, otherwise
   * a stretch of the route in one go around the top segment, so long categories get it too.
   */
  fullRunShare: 0.25,
  /** Assumed learning rate when history is thin: this fraction of the typical time saved per doubling of reps. */
  priorLearning: 0.02,
  /** Clean times at which your own learning curve counts as much as the assumed rate. */
  priorWeight: 30,
  /** Your own learning curve needs at least this many clean times to be measured. */
  minCurveSamples: 10,
  /** The learning curve is fitted through the medians of this many groups of attempts. */
  curveBins: 8,
} as const;

export interface SegmentRoi {
  index: number;
  name: string;
  /** Typical (median) time minus good-day time: the most a run can expect to gain from practice. */
  gap: Ms;
  variability: number | null;
  /** How long one practice rep takes: the typical time plus the overhead. */
  repTime: Ms;
  /** Clean times so far, which is how many reps the learning curve has already used up. */
  repsSoFar: number;
  /** Seconds a doubling of reps took off your typical time in the past, or null if there's too little history. */
  measuredPerDoubling: Ms | null;
  /** The learning rate used: your own blended with the assumed rate, weighted by how much history there is. */
  perDoubling: Ms;
  /** How much of the learning rate comes from your own curve (0 to 1). */
  ownCurveWeight: number;
  /** Expected time off a typical run from one hour of practice on this segment alone. */
  savePerHour: Ms;
}

export interface PlanItem {
  segmentIndex: number;
  name: string;
  minutes: number;
  reps: number;
  /** Expected time off a typical run from these minutes. */
  expectedSave: Ms;
}

export interface PracticePlan {
  sessionMinutes: number;
  /** Segments ranked by expected time saved per hour of practice, best first. Only segments with room. */
  ranking: SegmentRoi[];
  /** Segment practice blocks, most minutes first. */
  items: PlanItem[];
  fullRuns: { minutes: number; runs: number; runTime: Ms } | null;
  /**
   * When a full run doesn't fit in the in-context share: consecutive segments around the top
   * segment, played in one go from `from` to `to` (inclusive). Null when a full run fits or no
   * stretch of two or more segments does.
   */
  stretch: { minutes: number; from: number; to: number; fromName: string; toName: string; runs: number; runTime: Ms } | null;
  /**
   * Minutes too short for another rep of any segment, when there's no full run or stretch to
   * give them to. Shown so the plan always adds up to the session.
   */
  spareMinutes: number;
  /**
   * The quickest practice rep (typical time plus overhead) among segments that can be planned for.
   * With no plan at all, it says whether that's for lack of data (null) or because every segment
   * takes longer than the session.
   */
  shortestRep: Ms | null;
  /** Expected time off a typical run if the plan's practice pays off as the learning curves suggest. */
  expectedSave: Ms;
  /** Segments left out because they have too few clean times to estimate. */
  segmentsWithoutData: number;
}

/**
 * Ranks segments by expected seconds saved per hour of practice and turns the ranking
 * into a session plan. Gains follow each segment's learning curve (diminishing returns
 * as reps pile up) and never exceed the gap between your typical and good-day time.
 */
export function planPractice(
  run: Run,
  analysis: RunAnalysis = analyzeRun(run),
  options: { sessionMinutes?: number } = {},
): PracticePlan {
  const P = PRACTICE_SETTINGS;
  const sessionMinutes = options.sessionMinutes ?? P.sessionMinutes;

  const models: Array<SegmentRoi & { saveAfter: (reps: number) => Ms }> = [];
  let segmentsWithoutData = 0;
  for (const s of analysis.segments) {
    if (s.median == null || s.p25 == null) {
      segmentsWithoutData++;
      continue;
    }
    const times = cleanTimes(run, s.index);
    // For a luck segment only the spread within each outcome can be practised away, not the luck.
    const gap = Math.max(0, s.luck ? s.luck.executionGap : s.median - s.p25);
    const repTime = s.median + P.repOverheadMs;
    const measuredPerDoubling = learningPerDoubling(times);
    const ownWeight = measuredPerDoubling == null ? 0 : times.length;
    const ownCurveWeight = ownWeight / (ownWeight + P.priorWeight);
    const perDoubling =
      ownCurveWeight * (measuredPerDoubling ?? 0) + (1 - ownCurveWeight) * P.priorLearning * s.median;
    const n = Math.max(1, times.length);
    const saveAfter = (reps: number) => Math.min(gap, perDoubling * Math.log2((n + reps) / n));
    models.push({
      index: s.index,
      name: s.name,
      gap,
      variability: s.variability,
      repTime,
      repsSoFar: times.length,
      measuredPerDoubling,
      perDoubling,
      ownCurveWeight,
      savePerHour: saveAfter(3_600_000 / repTime),
      saveAfter,
    });
  }

  // In-context play first (full runs, or else a stretch of the route), so the blocks fill the rest.
  const runTime = typicalRunTime(run, analysis);
  let fullRuns: PracticePlan["fullRuns"] = null;
  let stretch: PracticePlan["stretch"] = null;
  let blocks = Math.floor((sessionMinutes * (1 - P.fullRunShare)) / P.blockMinutes);
  const contextMinutes = sessionMinutes - blocks * P.blockMinutes;
  if (runTime != null && contextMinutes * 60_000 >= runTime) {
    fullRuns = { minutes: contextMinutes, runs: Math.floor((contextMinutes * 60_000) / runTime), runTime };
  } else {
    stretch = stretchAround(analysis, models, contextMinutes);
    if (!stretch) blocks = Math.floor(sessionMinutes / P.blockMinutes);
  }

  // Hand out blocks one at a time to whichever segment gains most per minute from its next block.
  // A segment's block is the smallest multiple of the block length that holds one rep.
  const blockMs = P.blockMinutes * 60_000;
  const blockOf = (m: (typeof models)[number]) => Math.max(1, Math.ceil(m.repTime / blockMs)) * P.blockMinutes;
  const given = new Map<number, number>();
  let left = blocks * P.blockMinutes;
  for (;;) {
    let best: (typeof models)[number] | null = null;
    let bestRate = 0;
    for (const m of models) {
      const size = blockOf(m);
      if (size > left) continue;
      const reps = ((given.get(m.index) ?? 0) * 60_000) / m.repTime;
      const rate = (m.saveAfter(reps + (size * 60_000) / m.repTime) - m.saveAfter(reps)) / size;
      if (rate > bestRate) {
        best = m;
        bestRate = rate;
      }
    }
    if (!best) break;
    given.set(best.index, (given.get(best.index) ?? 0) + blockOf(best));
    left -= blockOf(best);
  }

  // Minutes no rep fits in go to the in-context play when there is some; otherwise they're spare.
  let spareMinutes = left;
  if (left > 0 && fullRuns) {
    const minutes = fullRuns.minutes + left;
    fullRuns = { ...fullRuns, minutes, runs: Math.floor((minutes * 60_000) / fullRuns.runTime) };
    spareMinutes = 0;
  } else if (left > 0 && stretch) {
    const minutes = stretch.minutes + left;
    stretch = { ...stretch, minutes, runs: Math.floor((minutes * 60_000) / stretch.runTime) };
    spareMinutes = 0;
  }

  const items: PlanItem[] = models
    .filter((m) => given.has(m.index))
    .map((m) => {
      const reps = (given.get(m.index)! * 60_000) / m.repTime;
      return {
        segmentIndex: m.index,
        name: m.name,
        minutes: given.get(m.index)!,
        reps: Math.max(1, Math.round(reps)),
        expectedSave: m.saveAfter(reps),
      };
    })
    .sort((a, b) => b.minutes - a.minutes || b.expectedSave - a.expectedSave);

  return {
    sessionMinutes,
    ranking: models
      .filter((m) => m.savePerHour > 0)
      .sort((a, b) => b.savePerHour - a.savePerHour)
      .map(({ saveAfter: _, ...roi }) => roi),
    items,
    fullRuns,
    stretch,
    spareMinutes,
    shortestRep: models.length ? Math.min(...models.map((m) => m.repTime)) : null,
    expectedSave: items.reduce((a, i) => a + i.expectedSave, 0),
    segmentsWithoutData,
  };
}

/** One line a runner can read: "60 minutes: 25 on Water Temple, 20 on Boss, 15 full runs". */
export function describePlan(plan: PracticePlan): string {
  const parts = plan.items.map((i) => `${i.minutes} on ${i.name}`);
  if (plan.fullRuns) parts.push(`${plan.fullRuns.minutes} full runs`);
  if (plan.stretch) parts.push(`${plan.stretch.minutes} from ${plan.stretch.fromName} to ${plan.stretch.toName} in one go`);
  if (parts.length && plan.spareMinutes) parts.push(`${plan.spareMinutes} to spare`);
  return parts.length ? `${plan.sessionMinutes} minutes: ${parts.join(", ")}` : "";
}

/**
 * How much faster a segment got per doubling of reps: a straight line through
 * (log2 of rep number, segment time), fitted to equal-sized groups of attempts (their
 * average log2 rep number and median time) so a few disasters don't tilt it. Getting
 * slower counts as no learning.
 */
export function learningPerDoubling(times: Ms[]): Ms | null {
  const P = PRACTICE_SETTINGS;
  if (times.length < P.minCurveSamples) return null;
  const bins = Math.min(P.curveBins, Math.floor(times.length / 2));
  const xs: number[] = [];
  const ys: number[] = [];
  for (let b = 0; b < bins; b++) {
    const from = Math.floor((b * times.length) / bins);
    const to = Math.floor(((b + 1) * times.length) / bins);
    let x = 0;
    for (let k = from; k < to; k++) x += Math.log2(k + 1);
    xs.push(x / (to - from));
    ys.push(quantile(times.slice(from, to).sort((x, y) => x - y), 0.5));
  }
  const mx = xs.reduce((a, x) => a + x, 0) / bins;
  const my = ys.reduce((a, y) => a + y, 0) / bins;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < bins; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  if (sxx === 0) return null;
  return Math.max(0, -sxy / sxx);
}

/**
 * A segment's clean times in attempt order, by the same rules as the analysis:
 * no time after a skipped split, nothing under the mis-split cut-off.
 */
function cleanTimes(run: Run, i: number): Ms[] {
  const { segments } = run;
  const clean: Array<[number, Ms]> = [];
  for (const [id, time] of segments[i].history) {
    if (time == null || time <= 0) continue;
    if (i > 0 && segments[i - 1].history.get(id) == null) continue;
    clean.push([id, time]);
  }
  clean.sort((a, b) => a[0] - b[0]);
  const raw = clean.map(([, t]) => t);
  if (raw.length < ANALYSIS_DEFAULTS.minSamples) return raw;
  const floor = ANALYSIS_DEFAULTS.outlierFloor * quantile([...raw].sort((a, b) => a - b), 0.5);
  return raw.filter((t) => t >= floor);
}

/**
 * The longest run of consecutive segments around the top-ranked one whose typical times, plus one
 * rep overhead, fit in `minutes`. It grows towards whichever neighbour gains more per hour. Null
 * when not even two segments fit.
 */
function stretchAround(analysis: RunAnalysis, models: SegmentRoi[], minutes: number): PracticePlan["stretch"] {
  const P = PRACTICE_SETTINGS;
  const top = [...models].filter((m) => m.savePerHour > 0).sort((a, b) => b.savePerHour - a.savePerHour)[0];
  const typical = analysis.segments.map((s) => s.median);
  if (!top || minutes <= 0) return null;
  const budget = minutes * 60_000 - P.repOverheadMs;
  const perHour = new Map(models.map((m) => [m.index, m.savePerHour]));
  let from = top.index;
  let to = top.index;
  let time = typical[top.index]!;
  if (time > budget) return null;
  for (;;) {
    const options = [from - 1, to + 1].filter((i) => i >= 0 && i < typical.length && typical[i] != null && time + typical[i]! <= budget);
    if (options.length === 0) break;
    const next = options.sort((a, b) => (perHour.get(b) ?? 0) - (perHour.get(a) ?? 0))[0];
    time += typical[next]!;
    if (next < from) from = next;
    else to = next;
  }
  if (from === to) return null;
  const runTime = time + P.repOverheadMs;
  return {
    minutes,
    from,
    to,
    fromName: analysis.segments[from].name,
    toName: analysis.segments[to].name,
    runs: Math.floor((minutes * 60_000) / runTime),
    runTime,
  };
}

/** Median of the recent finished runs (the latest half, 10 to 50), or the sum of typical segment times if there are none. */
function typicalRunTime(run: Run, analysis: RunAnalysis): Ms | null {
  const finished = recentSlice(
    run.attempts.filter((a) => a.id > 0 && a.time != null && a.time > 0).map((a) => a.time!),
  ).sort((a, b) => a - b);
  if (finished.length) return quantile(finished, 0.5);
  const medians = analysis.segments.map((s) => s.median);
  return medians.every((m) => m != null) ? medians.reduce<number>((a, m) => a + m!, 0) : null;
}
