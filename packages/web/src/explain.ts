import {
  ADVICE_THRESHOLDS,
  ANALYSIS_DEFAULTS,
  LUCK_SETTINGS,
  SCORE_SETTINGS,
  formatTime,
  type CategoryScore,
  type ComponentKey,
  type RunAnalysis,
} from "@speedrunner/core";
import { RECENT_TIMES, formatSave } from "./format";

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
      `For each segment, take ${RECENT_TIMES} and find your good-day time: the ${ordinal(D.goodDayPercentile)} percentile, the time you beat in 1 attempt out of 4.`,
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
      "With segments marked as luck, it also says how much luck it needs: the share of your recent attempts with good luck in each marked segment, multiplied together. That's how often one run gets good luck in all of them.",
    ],
    example: (a) =>
      a.sumOfBest == null
        ? null
        : `${a.segments.length} golds added together = ${formatTime(a.sumOfBest)}, which is ${formatSave(a.possibleTimeSave)} under your PB.${
            a.luckNeeded ? ` It needs good luck in ${a.luckNeeded.segments} marked segment${a.luckNeeded.segments === 1 ? "" : "s"}: ${luckChance(a.luckNeeded.chance)} of runs get it in all of them.` : ""
          }`,
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
    short: "Your median time over your recent clean attempts at this segment.",
    how: [
      "Half of your recent clean times were faster than this and half slower. The median is used instead of the average so one disaster attempt doesn't drag it.",
      `Recent means ${RECENT_TIMES}. Half of your history, rather than a fixed number of attempts, means a category you've run thousands of times and one you've run a few dozen times both follow your current form.`,
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
      `PB segment minus your good-day time (${ordinal(D.goodDayPercentile)} percentile of your recent clean times), never below zero.`,
      "Zero means your PB already had a good or better-than-good version of this segment.",
      "For a segment marked as luck, the good-day time is taken only from attempts with the same luck your PB had there. Better luck isn't a save you can earn.",
    ],
  },
  variability: {
    id: "variability",
    label: "Variability",
    short: "How much your times swing between good and bad attempts.",
    how: [
      `Take ${RECENT_TIMES}. The gap between your 25th and 75th percentile (the middle half of your attempts), divided by your median.`,
      "0% would be identical every time. 10% on a 2 minute segment means the middle half of your attempts spans about 12 seconds.",
      "For a segment marked as luck, it's measured within good-luck and bad-luck attempts separately and averaged, so only your own execution counts.",
    ],
  },
  resetRate: {
    id: "reset-rate",
    label: "Reset rate",
    short: "Of the attempts that started this segment, the share that ended in it.",
    how: [
      "Attempts that reached this segment (finished the previous one) but have no time recorded for it, divided by all attempts that reached it.",
      "A high reset rate on the first segment is normal: that is where most runners reset bad starts.",
      "It counts every reset, including runs you reset for being behind pace. Runs die here only looks at runs that were going well.",
    ],
  },
  luck: {
    id: "luck",
    label: "Luck",
    short: "Tick segments where luck decides the time (a boss pattern, a minigame). Advice and practice plans then only count what you control.",
    how: [
      "A luck segment's times fall into a good and a bad outcome. The app finds the split between them: the cut that best separates your times into a fast group and a slow group, each holding at least a tenth of them.",
      `Marked segments then: measure variability within each outcome; take the good-day save from attempts with your PB's luck; compare your gold with your typical good-luck time; plan practice only for the spread within each outcome; and in the goal planner, tag "needs luck" on targets faster than any of your bad-luck times there. PB odds keep sampling your real times, so luck comes up as often as it really does, but a lucky segment no longer counts as a good day for the rest of the run.`,
      `Suggested segments look like luck in your own times: at least ${LUCK_SETTINGS.minSuggestSamples} clean times split into two clear groups, the slow one at least ${pct(LUCK_SETTINGS.minCostRatio - 1)} slower, good luck in ${pct(LUCK_SETTINGS.goodShareRange[0])} to ${pct(LUCK_SETTINGS.goodShareRange[1])} of attempts, and no streaks or drift over time (a change of strat makes old attempts slow and new ones fast; luck doesn't). Segments with "RNG" in their name are suggested too.`,
      "Times can't prove luck: a trick that fails a third of the time looks the same. So nothing changes until you tick a segment. Marks are kept in this app per game and category, by segment name.",
    ],
  },
};

/** "48%", or "1 in 140" once it's under 1%. */
export function luckChance(p: number): string {
  return p >= 0.01 ? pct(p) : `1 in ${Math.round(1 / p).toLocaleString("en-US")}`;
}

export const ADVICE_RULES: Array<{ tag: string; when: string; worth: string }> = [
  {
    tag: "Slow in PB",
    when: "Your PB's time for the segment was slower than your typical time (for a segment marked as luck, your typical time with the luck the PB had).",
    worth: "PB segment minus your good-day time.",
  },
  {
    tag: "Inconsistent",
    when: `Variability is above ${pct(T.inconsistent)} (for a segment marked as luck, within each outcome).`,
    worth: "Half the gap between your 25th and 75th percentile times.",
  },
  {
    tag: "Gold is rare",
    when: `Your typical time is more than ${pct(T.goldGap)} slower than your gold.`,
    worth: "The smaller of save to gold and typical minus gold. For a segment marked as luck, your typical good-luck time is used.",
  },
  {
    tag: "Runs die here",
    when: `Runs that were going well (in your faster half at the split before) reset here at least ${T.resetHazardRatio} times as often per minute as in the rest of the run, with at least ${T.minResets} such resets and ${T.minReachedForResets} such runs reaching it. Runs reset for being behind pace don't count, and neither does the first segment, where resets are mostly bad starts. Per minute, so a long segment isn't flagged for being long.`,
    worth: "The segment's good-day save. For a segment marked as luck, the advice says these may be resets on bad luck rather than mistakes.",
  },
];

/** Like MetricDoc, but its worked example comes from a category score. */
export interface ScoreDoc extends Omit<MetricDoc, "example"> {
  example?: (s: CategoryScore) => string | null;
}

const S = SCORE_SETTINGS;
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;
export const COMPONENT_LABELS: Record<ComponentKey, string> = {
  efficiency: "Efficiency",
  consistency: "Consistency",
  completion: "Completion",
  improvement: "Improvement",
};

export const SCORE_METRICS: Record<"category" | ComponentKey | "provisional" | "overall" | "pace", ScoreDoc> = {
  category: {
    id: "category-score",
    label: "Category score",
    short: "How well you run this category, from 0 to 100, worked out from your own split file.",
    how: [
      `A weighted average of four parts: efficiency ${pct(S.weights.efficiency)}, consistency ${pct(S.weights.consistency)}, completion ${pct(S.weights.completion)} and improvement ${pct(S.weights.improvement)}.`,
      "Each part is a ratio of your own run, not a time, so a 12 minute category and a 2 hour one are scored on the same scale.",
      "When a part can't be worked out from the file, it's left out and the other weights are scaled up to make 100%.",
      "It measures how well you run your category, not how fast you are against other runners. Nothing is compared with anyone else's times.",
    ],
    example: (s) => {
      if (s.score == null) return null;
      const parts = (["efficiency", "consistency", "completion", "improvement"] as const)
        .filter((k) => s[k].score != null)
        .map((k) => `${COMPONENT_LABELS[k]} ${Math.round(s[k].score!)} × ${pct(s.weights[k])}`);
      return `${parts.join(" + ")} = ${s.score}.`;
    },
  },
  efficiency: {
    id: "efficiency",
    label: "Efficiency",
    short: "How close your PB is to your sum of best.",
    how: [
      "Gap = (PB − sum of best) ÷ sum of best.",
      "Where your PB had bad luck in a segment marked as luck, the sum of best uses your best bad-luck time there, so a PB isn't marked down for its luck.",
      `Efficiency = 100 × (1 − gap ÷ ${pct(S.efficiencyZeroGap)}). A PB equal to your sum of best scores 100, a 5% gap scores 50, and a gap of ${pct(S.efficiencyZeroGap)} or more scores 0.`,
    ],
    example: (s) =>
      s.efficiency.gap == null
        ? null
        : `(${formatTime(s.efficiency.personalBest)} − ${formatTime(s.efficiency.sumOfBest)}) ÷ ${formatTime(s.efficiency.sumOfBest)} = ${pct1(s.efficiency.gap)} gap → ${Math.round(s.efficiency.score!)}.`,
  },
  consistency: {
    id: "consistency",
    label: "Consistency",
    short: "How much your segment times swing, across the whole run.",
    how: [
      "Each segment's variability, averaged with the segment's typical time as its weight, so a 5 minute segment counts more than a 10 second one.",
      `Consistency = 100 × (1 − variability ÷ ${pct(S.consistencyZeroVariability)}). ${pct(ADVICE_THRESHOLDS.inconsistent)}, where the Inconsistent advice starts, scores 50.`,
      `Segments with fewer than ${D.minSamples} clean times are left out.`,
    ],
    example: (s) =>
      s.consistency.variability == null
        ? null
        : `Variability ${pct1(s.consistency.variability)} across ${s.consistency.segmentsUsed} segments → ${Math.round(s.consistency.score!)}.`,
  },
  completion: {
    id: "completion",
    label: "Completion",
    short: "Of the runs that reached the middle of the run going well, the share that finished.",
    how: [
      "Resetting after a bad start is normal, so early resets don't count. Only attempts that reached the middle segment are counted.",
      "Of those, only runs going well count: the faster half of their times at the split before the middle segment. Resetting a run that's behind pace is often the right call (the reset coach says so too), and short categories do it far more than long ones, so it isn't held against you.",
      "Completion = 100 × good runs that finished ÷ good runs that reached the middle segment.",
    ],
    example: (s) =>
      s.completion.rate == null
        ? null
        : `${s.completion.finished} of the ${s.completion.goodRuns} runs that reached ${s.completion.middleSegmentName} in your faster half finished (${pct(s.completion.rate)}) → ${Math.round(s.completion.score!)}.`,
  },
  improvement: {
    id: "improvement",
    label: "Improvement",
    short: "Whether your latest finished runs are faster than the ones just before them.",
    how: [
      `Your finished runs are split into two equal groups: the latest ones and the ones just before them, half of your finishes each, at most ${S.improvementWindow}.`,
      "Change = (median of the earlier group − median of the latest group) ÷ the earlier median.",
      `No change scores 50, ${pct(S.improvementFullChange)} faster scores 100 and ${pct(S.improvementFullChange)} slower scores 0.`,
      `It needs at least ${S.minImprovementWindow * 2} finished runs, so a long category with a handful of finishes gets it too. With fewer, it's left out.`,
    ],
    example: (s) =>
      s.improvement.change == null
        ? null
        : `Median of ${s.improvement.window} finishes ${formatTime(s.improvement.previousMedian)} → ${formatTime(s.improvement.recentMedian)}, ${pct1(Math.abs(s.improvement.change))} ${s.improvement.change >= 0 ? "faster" : "slower"} → ${Math.round(s.improvement.score!)}.`,
  },
  provisional: {
    id: "provisional",
    label: "Provisional",
    short: "Too little data to trust the score yet, so it's left out of your overall score.",
    how: [
      `A category score is provisional when the file has fewer than ${S.provisional.minFinished} finished runs, fewer than ${S.provisional.minSegmentSamples} clean times in a typical segment, fewer than ${S.provisional.minSegments} segments, or fewer than ${S.provisional.minComponents} of the four parts could be worked out.`,
      "These are counted in your own runs and set low enough that a long category with few attempts can reach them.",
    ],
  },
  overall: {
    id: "overall-score",
    label: "Overall score",
    short: `The average of your ${S.overallTop} best category scores.`,
    how: [
      `The average of your ${S.overallTop} best category scores, or of all of them if you have fewer. Provisional scores are left out.`,
      "Using your best categories means a casual run in a side game doesn't drag you down.",
    ],
  },
  pace: {
    id: "wr-pace",
    label: "WR pace",
    short: "A reference time, such as the world record, as a share of your PB.",
    how: [
      "WR pace = reference time ÷ PB. 90% means the reference is 10% quicker than your PB.",
      "The reference comes from a comparison in your split file named \"World Record\" or \"WR\", or a time you type in, which takes priority.",
      "It's shown next to the score but doesn't change it, because only some categories have one.",
    ],
  },
};
