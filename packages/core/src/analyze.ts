import { splitOutcomes } from "./luck.js";
import { recentSlice } from "./recency.js";
import { attemptSplitTimes, cleanSegmentTimes, fasterHalf } from "./segment-model.js";
import { formatTime } from "./time.js";
import type { Ms, Run } from "./types.js";

export interface AnalyzeOptions {
  /**
   * A fixed number of the most recent clean times per segment for "current form" stats. Leave it
   * out to scale with the history instead: the latest half of the times, 10 to 50 (see recency.ts).
   */
  recentWindow?: number;
  /** Segments with fewer samples than this get no realistic target or form-based advice. */
  minSamples?: number;
  /**
   * Segment times below this fraction of the segment's median are treated as mis-splits
   * (double presses, splitting at the wrong moment) and ignored. Golds included.
   */
  outlierFloor?: number;
}

export interface SegmentStats {
  index: number;
  name: string;
  /** The name with subsplit markers, as the split file has it (see Segment). */
  rawName: string;
  /** This segment's time in the PB, or null if the PB skipped a split around it. */
  pbTime: Ms | null;
  /** Best segment ever, from LiveSplit's stored gold and the history. */
  gold: Ms | null;
  /** Number of clean segment times in the history (skipped splits and mis-splits excluded). */
  samples: number;
  /** History times dropped because they were implausibly fast for this segment. */
  discardedSamples: number;
  /** True when LiveSplit's stored gold looks like a mis-split and was replaced from history. */
  suspiciousGold: boolean;
  /** Clean times the form stats below are taken from: the latest half of the history, 10 to 50. */
  recentSamples: number;
  /** Stats over the most recent clean samples. */
  median: Ms | null;
  p25: Ms | null;
  p75: Ms | null;
  /** Interquartile range divided by the median: 0 is perfectly consistent, higher is shakier. */
  variability: number | null;
  /** PB segment minus gold: the most this segment could ever give back. */
  timeSaveVsGold: Ms | null;
  /** PB segment minus your good-day (25th percentile) time, floored at 0. */
  realisticTimeSave: Ms | null;
  /** Attempts that started this segment, and how many of those reset during it. */
  reached: number;
  resets: number;
  resetRate: number | null;
  /**
   * The same for runs that started this segment going well: in the faster half of times at the split
   * before. Their resets are mostly mistakes here rather than resets for being behind pace. Null for
   * the first segment, which has no split before it (its resets are mostly bad starts).
   */
  goodRunsReached: number | null;
  goodRunResets: number | null;
  goodRunResetRate: number | null;
  /** The runner marked this segment as luck-based (see luck.ts). */
  luckMarked: boolean;
  /**
   * For a marked segment with enough times: its good and bad outcomes. Variability, the realistic
   * save and the advice then only count what the runner controls. Null otherwise.
   */
  luck: LuckStats | null;
}

/** A luck-based segment's two outcomes, from its clean times. */
export interface LuckStats {
  /** Times at or under this are the good outcome. */
  cut: Ms;
  /** Share of recent clean times with good luck. */
  goodShare: number;
  /** Typical and good-day time with good luck. */
  goodMedian: Ms;
  goodP25: Ms;
  /** Typical and good-day time with bad luck, null if bad luck never shows up. */
  badMedian: Ms | null;
  badP25: Ms | null;
  /** Fastest time with bad luck in the whole history. */
  badBest: Ms | null;
  /** Typical extra time bad luck costs. */
  cost: Ms | null;
  /** The luck the PB had here, or null without a PB time for the segment. */
  pbOutcome: "good" | "bad" | null;
  /**
   * The gap practice can close: typical minus good-day time within each outcome, weighted by how
   * often each happens. The luck gap between outcomes is left out.
   */
  executionGap: Ms;
}

export type AdviceKind = "weak-in-pb" | "inconsistent" | "gold-is-rare" | "run-killer";

export interface Advice {
  segmentIndex: number;
  segmentName: string;
  kind: AdviceKind;
  /** Estimated time this advice is worth against the PB, used for ranking. */
  estimatedSave: Ms;
  message: string;
}

export interface RunAnalysis {
  game: string;
  category: string;
  timingMethod: Run["timingMethod"];
  attemptCount: number;
  finishedAttempts: number;
  personalBest: Ms | null;
  sumOfBest: Ms | null;
  /** PB minus sum of best: the theoretical ceiling for improvement. */
  possibleTimeSave: Ms | null;
  /**
   * Sum of best with each luck-based segment at its best time with the luck the PB had there, so
   * comparing it with the PB leaves luck out on both sides. Equal to the sum of best when no segment
   * is marked or the PB had good luck in every marked one.
   */
  sumOfBestWithPbLuck: Ms | null;
  /**
   * How much luck the sum of best needs: how many marked segments it takes at good luck and the
   * chance of getting good luck in all of them in one run. Null when no segment is marked.
   */
  luckNeeded: { segments: number; chance: number } | null;
  /** PB with each segment replaced by your good-day time where that is faster. */
  realisticTarget: Ms | null;
  segments: SegmentStats[];
  /** Segments ordered by how much time they could realistically give back, biggest first. */
  biggestOpportunities: SegmentStats[];
  advice: Advice[];
}

/** Default analysis settings. Exported so the UI and docs can quote the real numbers. */
export const ANALYSIS_DEFAULTS = {
  /**
   * The most recent clean times the segment model samples from. Every other feature takes the
   * latest half of each segment's history instead (recentCount in recency.ts), which is at most this.
   */
  recentWindow: 50,
  minSamples: 5,
  outlierFloor: 0.6,
  goodDayPercentile: 0.25,
} as const;

export function analyzeRun(run: Run, options: AnalyzeOptions = {}): RunAnalysis {
  const minSamples = options.minSamples ?? ANALYSIS_DEFAULTS.minSamples;
  const outlierFloor = options.outlierFloor ?? ANALYSIS_DEFAULTS.outlierFloor;
  const { segments } = run;
  const realAttemptIds = run.attempts.map((a) => a.id).filter((id) => id > 0);

  const pbTimes = segmentTimesOfPb(run);
  const splitTimes = attemptSplitTimes(run);

  const stats: SegmentStats[] = segments.map((segment, i) => {
    const { times: clean, floor, discarded } = cleanSegmentTimes(run, i, { minSamples, outlierFloor });
    const all = clean.map(([, t]) => t);
    const recent = (options.recentWindow != null ? all.slice(-options.recentWindow) : recentSlice(all)).sort((a, b) => a - b);

    const historyGold = all.length ? Math.min(...all) : null;
    const suspiciousGold = segment.gold != null && segment.gold < floor;
    const pbTime = pbTimes[i];
    // The PB attempt's own history can be missing (e.g. imported splits), so it counts as a gold too.
    const gold = minOrNull(minOrNull(suspiciousGold ? null : segment.gold, historyGold), pbTime);
    const enough = recent.length >= minSamples;
    const median = enough ? quantile(recent, 0.5) : null;
    const p25 = enough ? quantile(recent, ANALYSIS_DEFAULTS.goodDayPercentile) : null;
    const p75 = enough ? quantile(recent, 0.75) : null;

    const reachedIds = i === 0 ? realAttemptIds : realAttemptIds.filter((id) => segments[i - 1].history.has(id));
    const reached = reachedIds.length;
    const resets = reachedIds.filter((id) => !segment.history.has(id)).length;
    const good = i === 0 ? null : fasterHalf(splitTimes[i - 1], reachedIds).ids;
    const goodResets = good ? good.filter((id) => !segment.history.has(id)).length : null;
    const luck = segment.luck ? luckStats(all, recent, pbTime, minSamples) : null;
    const variability = luck ? luckVariability(all, recent, luck.cut, minSamples) : median && p25 != null && p75 != null ? (p75 - p25) / median : null;

    return {
      index: i,
      name: segment.name,
      rawName: segment.rawName,
      pbTime,
      gold,
      samples: all.length,
      recentSamples: recent.length,
      discardedSamples: discarded,
      suspiciousGold,
      median,
      p25,
      p75,
      variability,
      timeSaveVsGold: pbTime != null && gold != null ? Math.max(0, pbTime - gold) : null,
      // A luck segment's good day is a good day with the luck the PB had: better luck isn't a save you can earn.
      realisticTimeSave:
        pbTime == null || p25 == null
          ? null
          : Math.max(0, pbTime - (luck?.pbOutcome === "bad" && luck.badP25 != null ? luck.badP25 : luck?.pbOutcome === "good" ? luck.goodP25 : p25)),
      reached,
      resets,
      resetRate: reached > 0 ? resets / reached : null,
      goodRunsReached: good ? good.length : null,
      goodRunResets: goodResets,
      goodRunResetRate: good && good.length > 0 ? goodResets! / good.length : null,
      luckMarked: !!segment.luck,
      luck,
    };
  });

  const personalBest = [...segments].reverse().find((s) => s.pbSplit != null)?.pbSplit ?? null;
  const golds = stats.map((s) => s.gold);
  const sumOfBest = golds.every((g) => g != null) ? golds.reduce<number>((a, g) => a + g!, 0) : null;
  const lucky = stats.filter((s) => s.luck);
  const sumOfBestWithPbLuck =
    sumOfBest == null
      ? null
      : stats.reduce((sum, s) => {
          const l = s.luck;
          return sum + (l?.pbOutcome === "bad" && l.badBest != null ? Math.max(s.gold!, l.badBest) : s.gold!);
        }, 0);
  const realisticTarget =
    personalBest != null && stats.every((s) => s.pbTime != null)
      ? personalBest - stats.reduce((a, s) => a + (s.realisticTimeSave ?? 0), 0)
      : null;

  const lastSegment = segments.at(-1);
  const finishedAttempts = lastSegment
    ? realAttemptIds.filter((id) => lastSegment.history.get(id) != null).length
    : 0;

  return {
    game: run.game,
    category: run.category,
    timingMethod: run.timingMethod,
    attemptCount: run.attemptCount,
    finishedAttempts,
    personalBest,
    sumOfBest,
    possibleTimeSave: personalBest != null && sumOfBest != null ? personalBest - sumOfBest : null,
    sumOfBestWithPbLuck,
    luckNeeded: lucky.length ? { segments: lucky.length, chance: lucky.reduce((p, s) => p * s.luck!.goodShare, 1) } : null,
    realisticTarget,
    segments: stats,
    biggestOpportunities: [...stats]
      .filter((s) => (s.realisticTimeSave ?? s.timeSaveVsGold ?? 0) > 0)
      .sort((a, b) => opportunity(b) - opportunity(a)),
    advice: buildAdvice(stats),
  };
}

/** Thresholds for advice. Exported so the UI can explain them. */
export const ADVICE_THRESHOLDS = {
  /** Variability (IQR / median) above this is called inconsistent. */
  inconsistent: 0.1,
  /** Median slower than gold by more than this fraction means gold-level execution is rare. */
  goldGap: 0.08,
  /**
   * A segment is a run killer when runs that were going well die in it at least this many times as
   * fast, per minute played, as in the rest of the run. Compared per minute so a long segment isn't
   * flagged for being long, and against your own run so the rule is the same for 5 segments or 60.
   * Only runs in the faster half at the split before count, so resetting a run that was already
   * behind doesn't make a segment look deadly.
   */
  resetHazardRatio: 1.5,
  /** Evidence needed before calling a segment a run killer: good runs that reached it, and their resets. */
  minReachedForResets: 10,
  minResets: 3,
};

/**
 * How fast runs that were going well die in a segment per millisecond played, assuming resets are
 * spread evenly through it: -ln(1 - good-run reset rate) / typical time. Null without that rate
 * (as for the first segment) or a typical time.
 */
export function resetHazard(s: Pick<SegmentStats, "goodRunResetRate" | "median">): number | null {
  if (s.goodRunResetRate == null || !s.median) return null;
  return -Math.log(1 - Math.min(s.goodRunResetRate, 0.999)) / s.median;
}

/**
 * Each segment's reset hazard divided by the hazard of the rest of the run (every other segment
 * after the first). Infinity when good runs reset here but nowhere else; null when either side is
 * unknown.
 */
export function resetHazardRatios(stats: SegmentStats[]): Array<number | null> {
  return stats.map((s) => {
    const own = resetHazard(s);
    if (own == null) return null;
    let deaths = 0;
    let time = 0;
    for (const o of stats) {
      if (o.index === 0 || o.index === s.index || resetHazard(o) == null) continue;
      deaths += resetHazard(o)! * o.median!;
      time += o.median!;
    }
    if (time <= 0) return null;
    if (deaths > 0) return own / (deaths / time);
    return own > 0 ? Infinity : 0;
  });
}

function buildAdvice(stats: SegmentStats[]): Advice[] {
  const advice: Advice[] = [];
  const t = ADVICE_THRESHOLDS;
  const hazardRatios = resetHazardRatios(stats);
  for (const s of stats) {
    const base = { segmentIndex: s.index, segmentName: s.name };
    const l = s.luck;
    // A luck segment's PB is compared with your usual time with the same luck it had.
    const pbUsual = l?.pbOutcome === "bad" ? l.badMedian : l?.pbOutcome === "good" ? l.goodMedian : s.median;
    const pbGoodDay = l?.pbOutcome === "bad" ? l.badP25 : l?.pbOutcome === "good" ? l.goodP25 : s.p25;
    if (s.pbTime != null && pbUsual != null && s.pbTime > pbUsual) {
      advice.push({
        ...base,
        kind: "weak-in-pb",
        estimatedSave: s.pbTime - (pbGoodDay ?? pbUsual),
        message: `Your PB lost time here: it was slower than your usual ${s.name}${l ? ` with ${l.pbOutcome} luck` : ""}. Even an average execution would save ${secs(s.pbTime - pbUsual)}.`,
      });
    }
    // For a luck segment the swing is measured within each outcome, so only execution counts.
    const swing = l ? (s.variability ?? 0) * l.goodMedian : s.p75 != null && s.p25 != null ? s.p75 - s.p25 : null;
    if (s.variability != null && s.variability > t.inconsistent && swing != null) {
      advice.push({
        ...base,
        kind: "inconsistent",
        estimatedSave: swing / 2,
        message: l
          ? `Even with the same luck, times here swing by ${secs(swing)}. Practising a safer, repeatable route would make it more reliable.`
          : `Times here swing by ${secs(swing)} between good and bad attempts. Practising a safer, repeatable route would make it more reliable.`,
      });
    }
    // A luck segment's gold is good luck and good play, so it's compared with your usual good-luck time.
    const usual = l ? l.goodMedian : s.median;
    if (s.gold != null && usual != null && (usual - s.gold) / s.gold > t.goldGap) {
      advice.push({
        ...base,
        kind: "gold-is-rare",
        estimatedSave: Math.min(s.timeSaveVsGold ?? 0, usual - s.gold),
        message: l
          ? `Your gold is ${secs(usual - s.gold)} faster than your typical time with good luck. You know the fast strat; practise it until it's your default.`
          : `Your gold is ${secs(usual - s.gold)} faster than your typical time. You know the fast strat; practise it until it's your default.`,
      });
    }
    const ratio = hazardRatios[s.index];
    if (
      s.goodRunResetRate != null &&
      s.goodRunsReached! >= t.minReachedForResets &&
      s.goodRunResets! >= t.minResets &&
      ratio != null &&
      ratio >= t.resetHazardRatio
    ) {
      advice.push({
        ...base,
        kind: "run-killer",
        // Not a direct time save; rank it alongside the segment's realistic save.
        estimatedSave: s.realisticTimeSave ?? 0,
        message: `${Math.round(s.goodRunResetRate * 100)}% of runs that reach this segment going well (in your faster half at the split before) reset here, ${ratio === Infinity ? "while good runs almost never reset elsewhere after the first split" : `${ratio.toFixed(1)} times as often per minute as in the rest of your run`}. ${s.luckMarked ? "You marked it as luck, so these may be resets on bad luck: the reset coach shows whether a run with bad luck here can still PB." : "Practising it in isolation should get more good runs to the end."}`,
      });
    }
  }
  return advice.sort((a, b) => b.estimatedSave - a.estimatedSave);
}

/**
 * Splits a marked segment's times into outcomes. The cut comes from the whole history (more
 * evidence); the typical and good-day times from recent times, or the whole history when an
 * outcome has too few recent times.
 */
function luckStats(all: Ms[], recentSorted: Ms[], pbTime: Ms | null, minSamples: number): LuckStats | null {
  const outcomes = splitOutcomes(all);
  if (!outcomes) return null;
  const { cut } = outcomes;
  const pick = (good: boolean) => {
    const of = (xs: Ms[]) => xs.filter((t) => (t <= cut) === good).sort((a, b) => a - b);
    const recent = of(recentSorted);
    return recent.length >= minSamples ? recent : of(all);
  };
  const good = pick(true);
  const bad = pick(false);
  const goodShare = recentSorted.length ? recentSorted.filter((t) => t <= cut).length / recentSorted.length : outcomes.goodShare;
  const goodMedian = quantile(good, 0.5);
  const goodP25 = quantile(good, ANALYSIS_DEFAULTS.goodDayPercentile);
  const badMedian = bad.length ? quantile(bad, 0.5) : null;
  const badP25 = bad.length ? quantile(bad, ANALYSIS_DEFAULTS.goodDayPercentile) : null;
  const badAll = all.filter((t) => t > cut);
  return {
    cut,
    goodShare,
    goodMedian,
    goodP25,
    badMedian,
    badP25,
    badBest: badAll.length ? Math.min(...badAll) : null,
    cost: badMedian != null ? badMedian - goodMedian : null,
    pbOutcome: pbTime == null ? null : pbTime <= cut ? "good" : "bad",
    executionGap:
      goodShare * (goodMedian - goodP25) + (1 - goodShare) * (badMedian != null && badP25 != null ? badMedian - badP25 : 0),
  };
}

/** Variability (IQR / median) within each outcome, weighted by how often each happens recently. */
function luckVariability(all: Ms[], recentSorted: Ms[], cut: Ms, minSamples: number): number | null {
  let weighted = 0;
  let count = 0;
  for (const good of [true, false]) {
    const times = recentSorted.filter((t) => (t <= cut) === good);
    if (times.length < minSamples) continue;
    const median = quantile(times, 0.5);
    if (!median) continue;
    weighted += ((quantile(times, 0.75) - quantile(times, 0.25)) / median) * times.length;
    count += times.length;
  }
  if (count > 0) return weighted / count;
  // Too few recent times in either outcome: fall back to the good outcome over the whole history.
  const good = all.filter((t) => t <= cut).sort((a, b) => a - b);
  if (good.length < minSamples) return null;
  const median = quantile(good, 0.5);
  return median ? (quantile(good, 0.75) - quantile(good, 0.25)) / median : null;
}

function opportunity(s: SegmentStats): number {
  return s.realisticTimeSave ?? s.timeSaveVsGold ?? 0;
}

/** Segment durations in the PB. A segment after a skipped split gets null. */
function segmentTimesOfPb(run: Run): Array<Ms | null> {
  return run.segments.map((s, i) => {
    if (s.pbSplit == null) return null;
    if (i === 0) return s.pbSplit;
    const prev = run.segments[i - 1].pbSplit;
    return prev == null ? null : s.pbSplit - prev;
  });
}

/** Linear-interpolated quantile of an ascending-sorted array. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) throw new Error("quantile of empty array");
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}

function minOrNull(a: Ms | null, b: Ms | null): Ms | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

/** "12.3s" under a minute, "4:05.2" from there, so long segments read like times. */
function secs(ms: number): string {
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : formatTime(ms, 1);
}
