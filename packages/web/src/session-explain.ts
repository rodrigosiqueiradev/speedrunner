import { SESSION_INSIGHT_SETTINGS as S, type FindingKind } from "@speedrunner/core";
import type { MetricDoc } from "./explain";

/**
 * Plain-language definitions for the session insights, shown in the ? tooltips and in the
 * How it's calculated section. Numbers come from SESSION_INSIGHT_SETTINGS so they can't drift.
 */
const pct = (x: number) => `${+(x * 100).toFixed(1)}%`;
const hours = (m: number) => (m < 60 ? `${m} min` : `${m / 60}h`);

export const SESSION_DOCS: Record<"sessions" | "pace" | "clear" | "playing" | "timeOfDay" | "weekday", MetricDoc> = {
  sessions: {
    id: "sessions",
    label: "Sessions",
    short: `Attempts played with no break longer than ${S.gapMinutes} minutes between them.`,
    how: [
      "LiveSplit 1.6 and later save when every attempt started and ended. Attempts are sorted by start time and grouped into sessions.",
      `A break of more than ${S.gapMinutes} minutes between one attempt's end and the next one's start starts a new session.`,
      `Session insights need at least ${S.minSessions} sessions.`,
    ],
  },
  pace: {
    id: "session-pace",
    label: "Pace",
    short: "How your split times compare with your usual time for those segments. +2% means 2% slower than usual.",
    how: [
      `Each clean segment time is compared with your usual time for that segment: the median of the ${S.paceWindow} clean times around that attempt. Using nearby attempts means getting better over the months doesn't look like a session effect.`,
      `A segment counts as at most ${S.paceCap}× its usual time, so a pause doesn't swamp the rest.`,
      "A group of splits' pace is their total time over their total usual time, so long segments count for more than short ones.",
      "Each split is placed at the time it was played within its session, not when its attempt started, so one long run spreads across the whole session.",
    ],
  },
  clear: {
    id: "clear-effect",
    label: "Clear effect",
    short: "An effect is only stated when it's big enough and the data rules out chance.",
    how: [
      `Pace effects need to be at least ${pct(S.minPaceEffect)}, and reset-rate effects at least ${pct(S.minRateEffect)} points.`,
      `The effect's ${pct(S.confidence)} interval must not include zero. When the best of several windows, thresholds, times or days is picked, the bar is ${pct(S.searchConfidence)}.`,
      "Sessions, not single attempts, are what gets compared, because attempts in the same session aren't independent.",
      `Each check needs ${S.minSessions} sessions (or ${S.minEvents} events for the next-attempt checks). With less, it says not enough data. With enough data but nothing beyond chance, it says no clear effect.`,
    ],
  },
  playing: {
    id: "playing-time",
    label: "How long you'd been playing",
    short: "Splits grouped by how long the session had been going, against that session's own average.",
    how: [
      "A split at 13:30 in a session that started at 9:00 counts as 4h30.",
      "Each bar is the average, over sessions, of that stretch's pace minus the whole session's pace. The thin line is its 95% interval.",
      `Rows with fewer than ${S.minSessions} sessions show how many there are instead of a bar.`,
    ],
  },
  timeOfDay: {
    id: "time-of-day-chart",
    label: "Time of day",
    short: "Sessions grouped by when they started, against your average across all sessions.",
    how: [
      "Night is 0-6h, morning 6-12h, afternoon 12-18h and evening 18-24h, in this computer's time zone.",
      "Whole sessions are grouped by their start, so a long session isn't split across two parts of the day.",
      `Rows with fewer than ${S.minSessions} sessions show how many there are instead of a bar.`,
    ],
  },
  weekday: {
    id: "day-of-week-chart",
    label: "Day of week",
    short: "Sessions grouped by the day they started, against your average across all sessions.",
    how: [
      "Days use this computer's time zone. Whole sessions are grouped by their start.",
      `Rows with fewer than ${S.minSessions} sessions show how many there are instead of a bar.`,
    ],
  },
};

export const FINDING_DOCS: Record<FindingKind, MetricDoc> = {
  "warm-up": {
    id: "warm-up",
    label: "Warm-up",
    short: `Whether your first ${S.warmupMinutes} minutes of splits in a session are slower than the rest.`,
    how: [
      `For each session, the pace of splits in the first ${S.warmupMinutes} minutes after its first split, minus the pace of the rest. Quick resets before the first split don't use up the window.`,
      `A session counts when it has at least ${S.minSegmentsPerSide} splits on each side.`,
    ],
  },
  "peak-window": {
    id: "peak-window",
    label: "Peak window",
    short: "The stretch of a session where you run clearly faster than that session's average.",
    how: [
      `Sessions are cut into stretches: ${S.minuteBuckets.map((m, i) => (i + 1 < S.minuteBuckets.length ? `${hours(m)}-${hours(S.minuteBuckets[i + 1])}` : `${hours(m)}+`)).join(", ")}.`,
      "The fastest stretch is joined with neighbouring stretches that are also faster than average, then checked against that session's average.",
    ],
  },
  fatigue: {
    id: "fatigue",
    label: "Fatigue",
    short: "Whether your pace or reset rate gets worse after you've been playing for a while.",
    how: [
      `Checked at ${S.fatigueThresholds.map(hours).join(", ")} into a session: the pace of splits after that point minus before it, for sessions with at least ${S.minSegmentsPerSide} splits on each side.`,
      `Reset rate is compared the same way for sessions with at least ${S.fatigueMinAttemptsPerSide} attempts on each side, so it only counts when you do many attempts per session.`,
      "The point where things get worse the most is reported.",
      "Pace is against each segment's own usual time, so fatigue only shows when the same segments get played at different points in a session. If every run starts fresh, a slow late segment just looks like how long that segment takes.",
    ],
  },
  "tilt-late-reset": {
    id: "tilt-late-reset",
    label: "After a late reset",
    short: `How your next attempt goes after a reset in the last ${pct(1 - S.lateResetFraction)} of the run.`,
    how: [
      `Every attempt that follows one that reset in the last ${pct(1 - S.lateResetFraction)} of the route, in the same session, against every other next attempt.`,
      `It compares how often the next attempt resets early (in the first ${pct(S.earlyResetFraction)} of the route) and its pace.`,
      `Needs ${S.minEvents} such resets followed by another attempt.`,
    ],
  },
  "tilt-near-pb": {
    id: "tilt-near-pb",
    label: "After a near-PB",
    short: `How your next attempt goes after finishing within ${pct(S.nearPbFraction)} of your PB.`,
    how: [
      `Every attempt that follows a finished run within ${pct(S.nearPbFraction)} of the PB standing at the time (but not a new PB), in the same session, against every other next attempt.`,
      `It compares how often the next attempt resets early (in the first ${pct(S.earlyResetFraction)} of the route) and its pace.`,
      `Needs ${S.minEvents} such runs followed by another attempt.`,
    ],
  },
  "time-of-day": {
    id: "time-of-day",
    label: "Time of day",
    short: "Whether sessions you start at one time of day go faster or slower than the rest.",
    how: [
      "Each session's pace is grouped by when it started (night, morning, afternoon or evening, in this computer's time zone) and each group is compared with all other sessions.",
      `Each group needs ${S.minSessions} sessions, and at least two groups need to have that many.`,
    ],
  },
  "day-of-week": {
    id: "day-of-week",
    label: "Day of week",
    short: "Whether sessions you start on one day of the week go faster or slower than the rest.",
    how: [
      "Each session's pace is grouped by the day it started and each day is compared with all other sessions.",
      `Each day needs ${S.minSessions} sessions, and at least two days need to have that many.`,
    ],
  },
};

/** Every session doc, in the order the How it's calculated section lists them. */
export const SESSION_ENTRIES: MetricDoc[] = [
  SESSION_DOCS.sessions,
  SESSION_DOCS.pace,
  SESSION_DOCS.clear,
  ...Object.values(FINDING_DOCS),
  SESSION_DOCS.playing,
  SESSION_DOCS.timeOfDay,
  SESSION_DOCS.weekday,
];
