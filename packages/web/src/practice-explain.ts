import { PRACTICE_SETTINGS as P } from "@speedrunner/core";
import type { MetricDoc } from "./explain";

/**
 * Plain-language definitions for the practice plan, shown in the ? tooltips and in the
 * How it's calculated section. Numbers come from PRACTICE_SETTINGS so they can't drift.
 */
const pct = (x: number) => `${Math.round(x * 100)}%`;

export const PRACTICE_DOCS: Record<"plan" | "expected" | "perHour" | "gap" | "rep" | "learning", MetricDoc> = {
  plan: {
    id: "practice-plan",
    label: "Practice plan",
    short: "How a practice session is split between single segments and playing them in context.",
    how: [
      `About ${pct(P.fullRunShare)} of the session is kept for playing segments in context: full runs when one typical run (the median of your recent finishes) fits in it.`,
      "When a full run doesn't fit, as in long categories, that time goes to a stretch of the route in one go: the top segment and its neighbours, as many as fit. If not even two segments fit, the whole session is segment practice.",
      `The rest is handed out in ${P.blockMinutes} minute blocks, one at a time, each to the segment whose next block is expected to save the most per minute. A segment whose rep takes longer than ${P.blockMinutes} minutes gets blocks of the next multiple of ${P.blockMinutes} that holds a whole rep. Time spreads out as a segment's returns shrink.`,
      "Minutes too short for another whole rep go to the full runs or the stretch when the plan has one, and are shown as left over when it hasn't, so the plan always adds up to the session. When every segment takes longer than the session to play once, there's no plan: pick a longer session.",
      "Segments with too few clean times to estimate are left out.",
    ],
  },
  expected: {
    id: "practice-expected",
    label: "Expected save",
    short: "What these minutes of practice are expected to take off a typical run.",
    how: [
      "For each segment, the learning rate used × log2((clean times so far + reps in the plan) ÷ clean times so far), capped at the gap to good day.",
      "The plan's total is the sum over its segments. It's an estimate of where your typical run is heading, not a promise for the next attempt.",
    ],
  },
  perHour: {
    id: "practice-per-hour",
    label: "Per hour",
    short: "Expected time off a typical run from one hour of reps on this segment alone.",
    how: [
      "The learning rate used × log2((n + reps in an hour) ÷ n), for n clean times so far, capped at the gap to good day.",
      "Each extra rep is worth less than the last, so a segment you've played 500 times gains less from an hour than one you've played 50 times.",
    ],
  },
  gap: {
    id: "practice-gap",
    label: "Gap to good day",
    short: "Your typical time minus your good-day time: the most practice is expected to take off a typical run.",
    how: [
      "Typical time (median) minus good-day time (25th percentile) of your recent clean times.",
      "A segment that varies a lot has a wider gap, so it has more room to gain from practice.",
    ],
  },
  rep: {
    id: "practice-rep",
    label: "One rep",
    short: `Your typical time plus ${P.repOverheadMs / 1000} seconds to reload a save or get back into position.`,
    how: [
      `One practice rep is your typical time for the segment plus ${P.repOverheadMs / 1000} seconds of overhead. The overhead is a first guess.`,
      "Short segments fit more reps into an hour, so they can gain faster.",
    ],
  },
  learning: {
    id: "practice-learning",
    label: "Learning per doubling",
    short: "How much faster the segment got each time your number of attempts at it doubled.",
    how: [
      `A straight line through (log2 of rep number, segment time), fitted to ${P.curveBins} equal groups of your clean times in attempt order. Needs ${P.minCurveSamples} clean times. Getting slower counts as no learning.`,
      `With little history it leans on an assumed ${pct(P.priorLearning)} of the typical time per doubling. Your own rate's weight is n ÷ (n + ${P.priorWeight}) for n clean times, so it counts as much as the assumption at ${P.priorWeight} times. "Assumed" marks segments where the assumption still counts for more.`,
    ],
  },
};

export const PRACTICE_ENTRIES: MetricDoc[] = [
  PRACTICE_DOCS.plan,
  PRACTICE_DOCS.expected,
  PRACTICE_DOCS.perHour,
  PRACTICE_DOCS.gap,
  PRACTICE_DOCS.rep,
  PRACTICE_DOCS.learning,
];
