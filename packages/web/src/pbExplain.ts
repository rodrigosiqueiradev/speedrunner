import { ANALYSIS_DEFAULTS, PB_ODDS_SETTINGS, describeChance, formatTime, oneIn, type PbOdds } from "@speedrunner/core";
import type { MetricDoc } from "./explain";
import { formatSave } from "./format";

/** A PB odds explanation, with an optional worked example from the loaded run's odds. */
export interface PbOddsDoc extends Omit<MetricDoc, "example"> {
  example?: (o: PbOdds) => string | null;
}

const S = PB_ODDS_SETTINGS;
const sims = S.simulations.toLocaleString("en-US");

export const PB_ODDS_METRICS: Record<"perAttempt" | "ifFinished" | "forecast" | "fromSplit" | "resetAfter" | "practice" | "reset", PbOddsDoc> = {
  perAttempt: {
    id: "pb-per-attempt",
    label: "PB chance per attempt",
    short: "How often an attempt beats your PB at your current form, counting resets.",
    how: [
      `We play ${sims} attempts on paper. Each segment's time is picked at random from your last ${ANALYSIS_DEFAULTS.recentWindow} clean times for it, so a segment you're inconsistent on swings as much as it does for you.`,
      "In each segment the attempt can also end in a reset, as often as your recent attempts that reached that segment reset there.",
      "PB chance per attempt = simulated attempts that finish under your PB ÷ all simulated attempts.",
      "Segments are picked independently, so a bad day that slows every segment at once isn't modelled. Resets are counted even when they were only pace resets, which makes the odds a little cautious.",
    ],
    example: (o) =>
      `${Math.round(o.perAttempt * o.simulations).toLocaleString("en-US")} of ${o.simulations.toLocaleString("en-US")} simulated attempts beat ${formatTime(o.personalBest)}, about ${o.perAttempt > 0 ? oneIn(o.perAttempt) : `fewer than 1 in ${sims}`}.`,
  },
  ifFinished: {
    id: "pb-if-finished",
    label: "If you finish",
    short: "How often a run played all the way to the end beats your PB.",
    how: [
      "The same simulation with resets left out: every attempt is played to the end.",
      "Typical finish is the middle simulated finish time; a good finish is the one you beat 1 run in 10.",
    ],
    example: (o) =>
      `${describeChance(o.ifFinished)} of finished runs beat your PB. Typical finish ${formatTime(o.medianFinish)}, good finish ${formatTime(o.goodFinish)}.`,
  },
  forecast: {
    id: "pb-forecast",
    label: "PB forecast",
    short: "How many attempts until a PB is more likely than not, and roughly when.",
    how: [
      "If each attempt has chance p, the chance of at least one PB in n attempts is 1 − (1 − p)ⁿ. We find the n where that reaches 50% and 90%.",
      `Your grind rate is your attempts per day over the last ${S.grindWindowDays} days you ran, from LiveSplit's attempt start dates. The dates assume you keep that rate from today.`,
      "Your odds improve as you practise, so this is a ceiling on the wait rather than a promise.",
    ],
  },
  fromSplit: {
    id: "pb-from-split",
    label: "PB chance from a split",
    short: "How often a run at this split, this far behind or ahead of PB pace, still PBs.",
    how: [
      "Take the simulated rest-of-run times from the next segment to the end.",
      "Once you've decided to play on, pace resets don't apply, so a run only ends on a mistake: each segment resets as often as it did for your attempts that were in the faster half at the split before it.",
      "PB chance from here = rest-of-run times shorter than (PB − time at this split) ÷ all simulated attempts.",
      "On pace means you reach the split at exactly your PB's time for it.",
    ],
  },
  resetAfter: {
    id: "pb-reset-after",
    label: "Reset when behind by",
    short: "How far behind PB pace a run can be before a reset gets you a PB sooner.",
    how: [
      "Fresh attempts find PBs at a rate of PB chance per attempt ÷ average attempt length (counting resets, a reset costs half its segment).",
      "Playing on finds them at PB chance from here ÷ average time left in the attempt.",
      "Keep going while playing on is the faster of the two. The number shown is the deficit where they're equal. A minus sign means you need to be ahead.",
      "A dash means playing on is never the faster way to a PB from this split.",
    ],
    example: (o) => {
      const s = o.splits.find((x) => x.resetAfter != null && x.resetAfter > 0);
      return s ? `At ${s.name}, keep going unless you're more than ${formatSave(s.resetAfter)} behind PB pace.` : null;
    },
  },
  practice: {
    id: "pb-practice",
    label: "Practice value",
    short: "When the run can't PB, whether the rest of it is still worth playing for practice.",
    how: [
      "Each segment's room to improve is your typical time minus your best recent time.",
      "We compare room to improve per minute in the rest of the run with the part you'd replay after a reset.",
      `If the rest of the run has at least ${S.practiceBias === 1 ? "as much" : `${S.practiceBias} times as much`}, the coach says keep going for the practice. Otherwise the early game is the bottleneck, so reset and get more reps there.`,
    ],
  },
  reset: {
    id: "pb-reset",
    label: "Should I reset?",
    short: "Pick a split and how far behind PB pace you are to get your PB chance from there and whether to play on.",
    how: [
      "Your PB chance from that split is worked out as in PB chance from a split, with the time you type instead of PB pace.",
      "Keep going when playing on finds a PB at least as fast as starting over (see Reset when behind by).",
      "Otherwise the run is dead for a PB, and the advice follows Practice value: keep going for practice when the rest of the run is where you have the most to gain, reset when the early game is.",
    ],
  },
};
