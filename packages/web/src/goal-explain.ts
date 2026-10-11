import { ANALYSIS_DEFAULTS as D } from "@speedrunner/core";
import type { MetricDoc } from "./explain";
import { RECENT_TIMES } from "./format";

/**
 * Plain-language definitions for the goal planner and the LiveSplit comparisons, shown in the
 * ? tooltips and in the How it's calculated section. Numbers come from the analyzer's constants.
 */
export const GOAL_DOCS: Record<"plan" | "pace" | "balanced" | "recentGolds" | "copy", MetricDoc> = {
  plan: {
    id: "goal-plan",
    label: "Goal plan",
    short: "The least demanding segment times that beat your goal, starting from your PB.",
    how: [
      "Your own spread of times is the difficulty of each segment: cutting a second where your times swing by ten is easier than where you play within a second of your best.",
      "So the plan asks every segment for the same pace, as a share of your recent clean times, and picks the most relaxed pace whose segment times add up to the goal.",
      `A segment keeps its PB time when the PB is already faster than that pace, or when it has fewer than ${D.minSamples} clean times.`,
      "The plan finishes a hundredth under the goal, so LiveSplit shows it as sub.",
      "A segment marked as luck is tagged \"needs luck\" when its planned time is faster than any time you've had there with bad luck.",
      "When even your best recent time in every segment isn't enough, each segment moves from its recent best towards its gold by the same fraction. When the goal is faster than every segment at its gold, it needs new golds first.",
    ],
  },
  pace: {
    id: "goal-pace",
    label: "Pace the goal needs",
    short: "How often you hit the plan's segment times in recent attempts, against your good-day pace.",
    how: [
      `The pace is the share of ${RECENT_TIMES} in a segment that are at or under the plan's time. The plan asks the same pace of every segment it cuts.`,
      `The realistic target uses a fixed pace of 1 in ${Math.round(1 / D.goodDayPercentile)}, your good-day time. A goal that needs a rarer pace says how much more often you'd need to hit those times to make it a good-day goal.`,
      "\"A typical attempt\" next to a segment means the plan's time is no faster than your usual (median) time there: the PB was just slow in that segment.",
    ],
  },
  balanced: {
    id: "balanced-comparison",
    label: "Sub goal (balanced)",
    short: "The goal plan, split by split, so you can race it in LiveSplit.",
    how: [
      "Each split is the plan's cumulative time at that point.",
      "It's written for the timing method the page is showing, since that's the one the goal was planned in.",
    ],
  },
  recentGolds: {
    id: "recent-golds",
    label: "Recent golds",
    short: "Your best time in each segment over its recent clean times.",
    how: [
      `For each segment, the fastest of ${RECENT_TIMES}, added up split by split.`,
      "Half of your history rather than a fixed number of attempts, so in a long category with few attempts a gold from months ago doesn't count as recent.",
      "Unlike the sum of best, a gold set long ago and never matched since doesn't count, so it's a fresher goal.",
    ],
  },
  copy: {
    id: "comparison-copy",
    label: "Saving comparisons",
    short: "A copy of your split file with the comparisons added. The original isn't changed.",
    how: [
      "Only each segment's list of comparison times changes; everything else in the file is kept exactly as it was.",
      "Saving again from a copy replaces these comparisons instead of adding them twice.",
      "The realistic target and recent golds are written for both real time and game time when the file has both.",
      "In LiveSplit, open the copy, then right-click and choose Compare Against to race one.",
    ],
  },
};

export const GOAL_ENTRIES: MetricDoc[] = [GOAL_DOCS.plan, GOAL_DOCS.pace, GOAL_DOCS.copy, GOAL_DOCS.balanced, GOAL_DOCS.recentGolds];
