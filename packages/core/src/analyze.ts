import type { Ms, Run } from "./types.js";

export interface AnalyzeOptions {
  /** How many of the most recent attempts per segment count towards "current form" stats. */
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
  /** Stats over the most recent `recentWindow` clean samples. */
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
  /** PB with each segment replaced by your good-day time where that is faster. */
  realisticTarget: Ms | null;
  segments: SegmentStats[];
  /** Segments ordered by how much time they could realistically give back, biggest first. */
  biggestOpportunities: SegmentStats[];
  advice: Advice[];
}

/** Default analysis settings. Exported so the UI and docs can quote the real numbers. */
export const ANALYSIS_DEFAULTS = {
  recentWindow: 50,
  minSamples: 5,
  outlierFloor: 0.6,
  goodDayPercentile: 0.25,
} as const;

export function analyzeRun(run: Run, options: AnalyzeOptions = {}): RunAnalysis {
  const recentWindow = options.recentWindow ?? ANALYSIS_DEFAULTS.recentWindow;
  const minSamples = options.minSamples ?? ANALYSIS_DEFAULTS.minSamples;
  const outlierFloor = options.outlierFloor ?? ANALYSIS_DEFAULTS.outlierFloor;
  const { segments } = run;
  const realAttemptIds = run.attempts.map((a) => a.id).filter((id) => id > 0);

  const pbTimes = segmentTimesOfPb(run);

  const stats: SegmentStats[] = segments.map((segment, i) => {
    // A history time is only this segment's own time if the previous split was not skipped
    // in the same attempt; otherwise LiveSplit recorded the combined time of both segments.
    const clean: Array<[number, Ms]> = [];
    for (const [id, time] of segment.history) {
      if (time == null || time <= 0) continue;
      if (i > 0 && segments[i - 1].history.get(id) == null) continue;
      clean.push([id, time]);
    }
    clean.sort((a, b) => a[0] - b[0]);
    const raw = clean.map(([, t]) => t);
    const floor =
      raw.length >= minSamples ? outlierFloor * quantile([...raw].sort((a, b) => a - b), 0.5) : 0;
    const all = raw.filter((t) => t >= floor);
    const recent = all.slice(-recentWindow).sort((a, b) => a - b);

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

    return {
      index: i,
      name: segment.name,
      pbTime,
      gold,
      samples: all.length,
      discardedSamples: raw.length - all.length,
      suspiciousGold,
      median,
      p25,
      p75,
      variability: median && p25 != null && p75 != null ? (p75 - p25) / median : null,
      timeSaveVsGold: pbTime != null && gold != null ? Math.max(0, pbTime - gold) : null,
      realisticTimeSave: pbTime != null && p25 != null ? Math.max(0, pbTime - p25) : null,
      reached,
      resets,
      resetRate: reached > 0 ? resets / reached : null,
    };
  });

  const personalBest = [...segments].reverse().find((s) => s.pbSplit != null)?.pbSplit ?? null;
  const golds = stats.map((s) => s.gold);
  const sumOfBest = golds.every((g) => g != null) ? golds.reduce<number>((a, g) => a + g!, 0) : null;
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
  /** Reset rate above this, with enough attempts, marks a run-killer segment. */
  resetRate: 0.15,
  minReachedForResets: 10,
};

function buildAdvice(stats: SegmentStats[]): Advice[] {
  const advice: Advice[] = [];
  const t = ADVICE_THRESHOLDS;
  for (const s of stats) {
    const base = { segmentIndex: s.index, segmentName: s.name };
    if (s.pbTime != null && s.median != null && s.pbTime > s.median) {
      advice.push({
        ...base,
        kind: "weak-in-pb",
        estimatedSave: s.pbTime - (s.p25 ?? s.median),
        message: `Your PB lost time here: it was slower than your usual ${s.name}. Even an average execution would save ${secs(s.pbTime - s.median)}.`,
      });
    }
    if (s.variability != null && s.variability > t.inconsistent && s.p75 != null && s.p25 != null) {
      advice.push({
        ...base,
        kind: "inconsistent",
        estimatedSave: (s.p75 - s.p25) / 2,
        message: `Times here swing by ${secs(s.p75 - s.p25)} between good and bad attempts. Practising a safer, repeatable route would make it more reliable.`,
      });
    }
    if (s.gold != null && s.median != null && (s.median - s.gold) / s.gold > t.goldGap) {
      advice.push({
        ...base,
        kind: "gold-is-rare",
        estimatedSave: Math.min(s.timeSaveVsGold ?? 0, s.median - s.gold),
        message: `Your gold is ${secs(s.median - s.gold)} faster than your typical time. You know the fast strat; practise it until it's your default.`,
      });
    }
    if (s.resetRate != null && s.reached >= t.minReachedForResets && s.resetRate > t.resetRate) {
      advice.push({
        ...base,
        kind: "run-killer",
        // Not a direct time save; rank it alongside the segment's realistic save.
        estimatedSave: s.realisticTimeSave ?? 0,
        message: `${Math.round(s.resetRate * 100)}% of attempts that reach this segment reset here. Practising it in isolation should get more runs to the end.`,
      });
    }
  }
  return advice.sort((a, b) => b.estimatedSave - a.estimatedSave);
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

function secs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
