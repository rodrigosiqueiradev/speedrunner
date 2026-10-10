import { ANALYSIS_DEFAULTS, RECAP_SETTINGS as R } from "@speedrunner/core";
import type { MetricDoc } from "./explain";

/**
 * Plain-language definitions for the Year in runs recap, shown in the ? tooltips and in the
 * How it's calculated section. Numbers come from RECAP_SETTINGS so they can't drift.
 */
export type RecapDocKey =
  | "attempts"
  | "hours"
  | "finished"
  | "pbs"
  | "golds"
  | "streak"
  | "biggestPb"
  | "bestGold"
  | "mostImproved";

export const RECAP_DOCS: Record<RecapDocKey, MetricDoc> = {
  attempts: {
    id: "recap-attempts",
    label: "Attempts",
    short: "Every attempt you started this year, across all the split files you added.",
    how: [
      "LiveSplit 1.6 and later save when every attempt started. Each attempt counts in the year it started, in this computer's time zone.",
      "Attempts with no start time, as in files from older LiveSplit versions, aren't in any year.",
      "If you add two files for the same game and category, only the newer one is used, so attempts aren't counted twice.",
    ],
  },
  hours: {
    id: "recap-hours",
    label: "Hours played",
    short: "Time from the start of each attempt to its reset or finish, added up.",
    how: [
      "Each attempt's length is its end time minus its start time, as LiveSplit saved them.",
      `An attempt that lasted more than ${R.leftRunningFactor} times the category's typical finished run is treated as a timer left running, and only the time on its splits counts. The limit follows each category's own length, so it works for a 10 minute category and a 20 hour one. Time between attempts doesn't count.`,
    ],
  },
  finished: {
    id: "recap-finished",
    label: "Finished runs",
    short: "Attempts this year that reached the last split.",
    how: ["An attempt is finished when LiveSplit saved a final time for it. Resets don't count."],
  },
  pbs: {
    id: "recap-pbs",
    label: "Personal bests",
    short: "Finished runs this year that were faster than every earlier finish in their category.",
    how: [
      "Attempts are taken in the order they were played. Each finish faster than all earlier finishes in that category is a PB, including finishes from before this year.",
      "The first finish in a category counts as a PB.",
    ],
  },
  golds: {
    id: "recap-golds",
    label: "Golds",
    short: `Segment times this year faster than every earlier time for that segment, once it has at least ${R.minGoldHistory}.`,
    how: [
      "Only clean segment times count: the split before it wasn't skipped, and the time isn't a mis-split.",
      `A mis-split is a time under ${Math.round(ANALYSIS_DEFAULTS.outlierFloor * 100)}% of the segment's median, the same rule as the rest of the app.`,
      `A segment needs ${R.minGoldHistory} earlier clean times before a new best counts, so times from the first days of learning a segment don't count as golds.`,
    ],
  },
  streak: {
    id: "recap-streak",
    label: "Longest streak",
    short: "The most days in a row with at least one attempt.",
    how: ["Days use this computer's time zone. One attempt is enough for a day to count."],
  },
  biggestPb: {
    id: "recap-biggest-pb",
    label: "Biggest PB",
    short: "The category whose best time dropped the most this year.",
    how: [
      "For each category, the best time at the end of the year minus the best time at the start of it.",
      "If no category had a PB before this year, the card shows your first finish instead.",
    ],
  },
  bestGold: {
    id: "recap-best-gold",
    label: "Best gold",
    short: "The gold this year that beat the segment's old best by the most time.",
    how: ["Among this year's golds, the one with the largest gap to the best clean time that segment had before it."],
  },
  mostImproved: {
    id: "recap-most-improved",
    label: "Most improved",
    short: `The segment whose typical time this year dropped the most, from its first ${R.improvementWindow} clean times to its last ${R.improvementWindow}.`,
    how: [
      `Typical time is the median. A segment's first ${R.improvementWindow} clean times of the year are compared with its last ${R.improvementWindow}, or each half of its times when it has fewer than ${R.improvementWindow * 2}.`,
      `It needs at least ${R.minImprovementSamples * 2} clean times in the year. The segment that saved the most seconds is shown.`,
    ],
  },
};
