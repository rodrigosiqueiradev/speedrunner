import {
  ANALYSIS_DEFAULTS,
  FORM_MODEL_SETTINGS,
  PB_ODDS_SETTINGS,
  SESSION_DEFAULTS,
  describeChance,
  formatTime,
  oneIn,
  type PbOdds,
} from "@speedrunner/core";
import type { MetricDoc } from "./explain";
import { formatSave } from "./format";

/** A PB odds explanation, with an optional worked example from the loaded run's odds. */
export interface PbOddsDoc extends Omit<MetricDoc, "example"> {
  example?: (o: PbOdds) => string | null;
}

const S = PB_ODDS_SETTINGS;
const F = FORM_MODEL_SETTINGS;
const sims = S.simulations.toLocaleString("en-US");
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** "1.1 s (1.1% of the split time)": a reset point the same way at any run length. */
export function describeResetAfter(resetAfter: number, share: number): string {
  const p = `${Math.abs(share * 100).toFixed(1).replace(/\.0$/, "")}%`;
  return resetAfter < 0 ? `ahead by ${formatSave(-resetAfter)} (${p})` : `${formatSave(resetAfter)} (${p})`;
}

export const PB_ODDS_METRICS: Record<
  "perAttempt" | "ifFinished" | "forecast" | "fromSplit" | "resetAfter" | "mode" | "reset" | "goal",
  PbOddsDoc
> = {
  perAttempt: {
    id: "pb-per-attempt",
    label: "PB chance per attempt",
    short: "How often an attempt beats your PB at your current form, counting the ones you reset.",
    how: [
      "PB chance per attempt = chance a finished run beats your PB (see If you finish) × your finish rate.",
      `Your finish rate is the share of your last ${S.recentAttempts} attempts that reached the end. When fewer than ${S.minRecentFinishes} of them finished, it reaches further back until it holds ${S.minRecentFinishes} finished runs, so a category where most attempts are reset doesn't read as never finishing.`,
      "Nothing here is a fixed time: it works the same for a 5 minute category and a 6 hour one.",
    ],
    example: (o) =>
      `${describeChance(o.ifFinished)} of finished runs beat ${formatTime(o.personalBest)}, and ${o.finishWindow > 0 ? `${describeChance(o.finishRate)} of your last ${o.finishWindow.toLocaleString("en-US")} attempts finished` : `your reset rates finish ${describeChance(o.finishRate)} of runs`}, so about ${o.perAttempt > 0 ? oneIn(o.perAttempt) : "none"}.`,
  },
  ifFinished: {
    id: "pb-if-finished",
    label: "If you finish",
    short: "How often a run played all the way to the end beats your PB, at your current form.",
    how: [
      `We play ${sims} runs on paper from a model of how you run now.`,
      `Each run first picks a form of the day: how much faster or slower than usual one of your recent attempts was, across all of its segments. That applies to the whole run, so a good day is good everywhere, as it is for real. An attempt counts once it has clean times for at least ${pct(F.formCoverage)} of the segments.`,
      `Then each segment adds its own variation, picked from your clean times for it. Times from runs you finished are used once a segment has at least ${F.minFinishedSamples}, since runs you reset are mostly bad ones.`,
      `Recent times count more: a time's weight halves every quarter of your samples (between 5 and 25 newer ones). If your form has been improving, half of that trend is projected onto your next attempt. A slowdown never is.`,
      "Typical finish is the middle simulated finish; a good finish is the one you beat 1 run in 10.",
    ],
    example: (o) =>
      `${describeChance(o.ifFinished)} of simulated finishes beat your PB. Typical finish ${formatTime(o.medianFinish)}, good finish ${formatTime(o.goodFinish)}.${o.trend < 0 ? ` Following your improvement trims about ${(-o.trend * 100).toFixed(1)}% off every simulated run.` : ""}`,
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
      `We look at the simulated runs that reached this split at about your time, and count how many of them went on to beat your PB. "About" is ${pct(S.nearShare)} of how spread out the simulated times at the split are, so it's the same rule early in a short run and late in a long one.`,
      "Being behind also says something about today's form, and that carries into the rest of the run.",
      "A run that plays on can still end in a mistake: each later segment ends it as often as it ended your attempts that were in the faster half at the split before it.",
      "On pace means you reach the split at exactly your PB's time for it.",
    ],
  },
  resetAfter: {
    id: "pb-reset-after",
    label: "Reset if behind by",
    short: "How far behind PB pace a run can be before starting over gets you a PB sooner. Shown in seconds and as a share of the split time.",
    how: [
      `Starting over finds PBs at a rate of PB chance per attempt ÷ your average attempt length, from LiveSplit's start and end times of your last ${S.recentAttempts} attempts. An attempt longer than ${SESSION_DEFAULTS.leftRunningFactor} times your typical finished run is a timer left running and counts only for the time on its splits.`,
      "Playing on finds them at PB chance from here ÷ the average time left in the run.",
      "Keep going while playing on is the faster of the two. The number shown is the deficit where they're equal; \"ahead by\" means you need to be ahead.",
      `"Never" means playing on stays faster even ${pct(S.searchShare)} of the split time behind. "Always" means starting over is faster even that far ahead.`,
      "Early splits are cheap to replay, so their reset points are tight; late ones cost a lot of time, so they're loose.",
    ],
    example: (o) => {
      const s = o.splits.find((x) => x.rule === "behind" && x.resetAfter! > 0);
      return s ? `At ${s.name}, keep going unless you're more than ${describeResetAfter(s.resetAfter!, s.resetAfterShare!)} behind PB pace.` : null;
    },
  },
  mode: {
    id: "pb-mode",
    label: "PB hunting or practising",
    short: "PB hunting shows when to reset; practising only shows your odds from a split and never says reset.",
    how: [
      "PB hunting gives the reset points that get you a PB in the least time played.",
      "In a long category that can mean resetting hours in for a small deficit. If you play runs to the end for the practice, pick Practising.",
    ],
  },
  reset: {
    id: "pb-reset",
    label: "Should I reset?",
    short: "Pick a split and how far behind PB pace you are to get your PB chance from there and whether to play on.",
    how: [
      "Your PB chance from that split is worked out as in PB chance from a split, with the time you type instead of PB pace.",
      "When PB hunting, keep going when playing on finds a PB at least as fast as starting over (see Reset if behind by).",
    ],
  },
  goal: {
    id: "pb-goal-odds",
    label: "Goal odds",
    short: "How often a run at your current form beats the goal.",
    how: [
      "The same simulated runs as your PB odds, counted against the goal instead.",
      "Per attempt multiplies that by your recent finish rate.",
      `It uses your form today, so it rises as you improve; the plan above says where the time has to come from. Segments with fewer than ${ANALYSIS_DEFAULTS.minSamples} clean times make it rough.`,
    ],
  },
};
