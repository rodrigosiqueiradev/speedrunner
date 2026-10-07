import { ADVICE_THRESHOLDS, ANALYSIS_DEFAULTS, formatTime, type RunAnalysis } from "@speedrunner/core";
import { formatSave } from "./format";

/**
 * Plain-language definitions of every number the app shows. Each entry has a short
 * line for tooltips and a longer "how" that the How it works section expands.
 * Numbers quoted here come from the analyzer's own constants so the docs can't drift.
 */
export interface MetricDoc {
  id: string;
  label: string;
  short: string;
  how: string[];
  /** Optional worked example built from the loaded run. */
  example?: (a: RunAnalysis) => string | null;
}

const D = ANALYSIS_DEFAULTS;
const T = ADVICE_THRESHOLDS;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const ordinal = (q: number) => `${Math.round(q * 100)}th`;

export const CLEAN_TIME: MetricDoc = {
  id: "clean-time",
  label: "Clean segment time",
  short: "A segment time we trust enough to use in the stats.",
  how: [
    "LiveSplit records how long each segment took in every attempt. Before using those times we drop three kinds that would mislead:",
    "Skipped splits: if you skipped a split, the next segment's recorded time covers two segments, so neither is used for that attempt.",
    `Mis-splits: a time under ${pct(D.outlierFloor)} of the segment's median (for example a double press that split a 3 minute level after 5 seconds). This only applies once a segment has at least ${D.minSamples} times.`,
    "Imported history: entries LiveSplit marks with a zero or negative attempt id come from merged or imported files, not real attempts.",
  ],
};

export const METRICS: Record<string, MetricDoc> = {
  personalBest: {
    id: "personal-best",
    label: "Personal best",
    short: "Your PB's final time, exactly as saved in LiveSplit.",
    how: ["Read straight from the file: the last split of the comparison LiveSplit calls \"Personal Best\"."],
  },
  realisticTarget: {
    id: "realistic-target",
    label: "Realistic target",
    short: "Your PB if every segment went as well as a typical good attempt.",
    how: [
      `For each segment, take your last ${D.recentWindow} clean times and find your good-day time: the ${ordinal(D.goodDayPercentile)} percentile, the time you beat in 1 attempt out of 4.`,
      "Where your good-day time is faster than that segment in your PB, the difference is a good-day save. Where your PB segment was already faster, the save is zero.",
      "Realistic target = PB minus the sum of all good-day saves.",
      `Segments with fewer than ${D.minSamples} clean times have no good-day time yet, so they add nothing.`,
    ],
    example: (a) => {
      if (a.personalBest == null || a.realisticTarget == null) return null;
      const contributing = a.segments.filter((s) => (s.realisticTimeSave ?? 0) > 0);
      const top = [...contributing].sort((x, y) => y.realisticTimeSave! - x.realisticTimeSave!).slice(0, 3);
      const parts = top.map((s) => `${s.name} ${formatSave(s.realisticTimeSave)}`).join(", ");
      return `${formatTime(a.personalBest)} − ${formatSave(a.personalBest - a.realisticTarget)} from ${contributing.length} segment${contributing.length === 1 ? "" : "s"}${parts ? ` (biggest: ${parts})` : ""} = ${formatTime(a.realisticTarget)}.`;
    },
  },
  sumOfBest: {
    id: "sum-of-best",
    label: "Sum of best",
    short: "Every segment at its fastest ever time, added together.",
    how: [
      "Add up the gold of every segment. It is the theoretical best run with what you have already done, but every segment going perfectly in the same run is very unlikely.",
      "Theoretical save = PB minus sum of best.",
    ],
    example: (a) =>
      a.sumOfBest == null
        ? null
        : `${a.segments.length} golds added together = ${formatTime(a.sumOfBest)}, which is ${formatSave(a.possibleTimeSave)} under your PB.`,
  },
  attempts: {
    id: "attempts",
    label: "Attempts",
    short: "How many times you started the run, and how many reached the last split.",
    how: [
      "Attempts is LiveSplit's own attempt counter.",
      "Finished counts attempts that have a time for the final segment.",
    ],
  },
  pbTime: {
    id: "pb-segment",
    label: "PB",
    short: "How long this segment took in your PB.",
    how: [
      "This segment's split time in your PB minus the previous split's time. It is blank if the PB skipped a split next to it.",
    ],
  },
  gold: {
    id: "gold",
    label: "Gold",
    short: "Your fastest clean time ever for this segment.",
    how: [
      "The fastest of: LiveSplit's stored best segment, every clean time in your history, and the segment in your PB.",
      `If LiveSplit's stored gold is under ${pct(D.outlierFloor)} of your median it is treated as a mis-split and ignored. Those segments are marked "gold ignored".`,
    ],
  },
  median: {
    id: "typical",
    label: "Typical",
    short: `Your median time over your last ${D.recentWindow} clean attempts at this segment.`,
    how: [
      `Half of your last ${D.recentWindow} clean times were faster than this and half slower. The median is used instead of the average so one disaster attempt doesn't drag it.`,
    ],
  },
  timeSaveVsGold: {
    id: "save-to-gold",
    label: "Save to gold",
    short: "How much faster than your PB this segment has ever been.",
    how: ["PB segment minus gold, never below zero. This is the most this segment can give back."],
  },
  realisticTimeSave: {
    id: "good-day-save",
    label: "Good-day save",
    short: "Time a good attempt at this segment would save over your PB.",
    how: [
      `PB segment minus your good-day time (${ordinal(D.goodDayPercentile)} percentile of your last ${D.recentWindow} clean times), never below zero.`,
      "Zero means your PB already had a good or better-than-good version of this segment.",
    ],
  },
  variability: {
    id: "variability",
    label: "Variability",
    short: "How much your times swing between good and bad attempts.",
    how: [
      `Take your last ${D.recentWindow} clean times. The gap between your 25th and 75th percentile (the middle half of your attempts), divided by your median.`,
      "0% would be identical every time. 10% on a 2 minute segment means the middle half of your attempts spans about 12 seconds.",
    ],
  },
  resetRate: {
    id: "reset-rate",
    label: "Reset rate",
    short: "Of the attempts that started this segment, the share that ended in it.",
    how: [
      "Attempts that reached this segment (finished the previous one) but have no time recorded for it, divided by all attempts that reached it.",
      "A high reset rate on the first segment is normal: that is where most runners reset bad starts.",
    ],
  },
};

export const ADVICE_RULES: Array<{ tag: string; when: string; worth: string }> = [
  {
    tag: "Slow in PB",
    when: "Your PB's time for the segment was slower than your typical time.",
    worth: "PB segment minus your good-day time.",
  },
  {
    tag: "Inconsistent",
    when: `Variability is above ${pct(T.inconsistent)}.`,
    worth: "Half the gap between your 25th and 75th percentile times.",
  },
  {
    tag: "Gold is rare",
    when: `Your typical time is more than ${pct(T.goldGap)} slower than your gold.`,
    worth: "The smaller of save to gold and typical minus gold.",
  },
  {
    tag: "Runs die here",
    when: `Reset rate is above ${pct(T.resetRate)} and at least ${T.minReachedForResets} attempts reached the segment.`,
    worth: "The segment's good-day save.",
  },
];
