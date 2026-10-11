import { PB_ODDS_SETTINGS, describeChance, formatTime, type LiveSession, type LiveStats } from "@speedrunner/core";
import type { MetricDoc } from "../explain";
import { RECENT_TIMES, formatSave } from "../format";

/** A stat's value on the live card. Null means "nothing to show yet" and the row shows a dash. */
export interface StatView {
  value: string;
  detail?: string;
  tone?: "ahead" | "behind" | "gold";
  /** A word rather than a number, set in the text face. */
  word?: boolean;
  /** Which way the value moved since the last split, shown as a coloured arrow before the detail. */
  trend?: "up" | "down";
}

export interface LiveStatDef {
  id: string;
  doc: MetricDoc;
  /** Shown by default to a runner who hasn't picked any. */
  standard: boolean;
  view: (s: LiveStats, session: LiveSession) => StatView | null;
}

const signed = (ms: number) => (ms > 0 ? `+${formatSave(ms)}` : ms < 0 ? `−${formatSave(-ms)}` : "±0");
const signedPct = (x: number) => {
  const p = Math.round(x * 1000) / 10;
  return p > 0 ? `+${p}%` : p < 0 ? `−${-p}%` : "±0%";
};
const tone = (ms: number | null): StatView["tone"] => (ms == null || ms === 0 ? undefined : ms < 0 ? "ahead" : "behind");

export const LIVE_STATS: LiveStatDef[] = [
  {
    id: "split",
    standard: true,
    doc: {
      id: "live-split",
      label: "Split",
      short: "Which segment you're on, from LiveSplit's split index.",
      how: ["The segment LiveSplit is timing now, and how many segments the run has."],
    },
    view: (s) =>
      s.current
        ? { value: `${s.current.index + 1} / ${s.segmentCount}`, detail: s.current.name }
        : s.phase === "Ended"
          ? { value: "Finished", word: true }
          : null,
  },
  {
    id: "timer",
    standard: false,
    doc: {
      id: "live-timer",
      label: "Run time",
      short: "The time on LiveSplit's timer, in its current timing method.",
      how: ["Read from LiveSplit a few times a second. It uses whichever timing method LiveSplit is showing, real time or game time."],
    },
    view: (s) => (s.currentTime == null || s.phase === "NotRunning" ? null : { value: formatTime(s.currentTime, 1) }),
  },
  {
    id: "pbChance",
    standard: true,
    doc: {
      id: "live-pb-chance",
      label: "PB chance",
      short: "How often a run where yours is now still goes on to beat your PB.",
      how: [
        `Uses the same ${PB_ODDS_SETTINGS.simulations.toLocaleString("en-US")} simulated runs as Your PB odds. At each split it looks at the simulated runs that reached that split at about your time and counts how many went on to beat your PB, allowing for a run-ending mistake later on.`,
        "Before the first split it's the chance a run you play to the end beats your PB.",
        "The arrow shows how the last segment moved it.",
      ],
    },
    view: (s) => {
      if (s.pbChance == null) return null;
      if (s.phase === "Ended") return s.pbChance === 1 ? { value: "New PB", tone: "gold", word: true } : { value: "No PB", word: true };
      const before = s.pbChanceBefore;
      const move = before == null || describeChance(before) === describeChance(s.pbChance) ? undefined : before;
      return {
        value: describeChance(s.pbChance),
        detail: move == null ? undefined : `from ${describeChance(move)}`,
        trend: move == null ? undefined : s.pbChance > move ? "up" : "down",
      };
    },
  },
  {
    id: "advice",
    standard: true,
    doc: {
      id: "live-advice",
      label: "Keep going?",
      short: "Whether playing on or starting over gets you to a PB sooner, from your reset rules.",
      how: [
        "The same rule as Should you reset: keep going when the chance of a PB from here, per minute of the run you have left, is at least what fresh attempts give you per minute of play.",
        "It never resets for you. It's shown from the first split until the last.",
      ],
    },
    view: (s) =>
      s.advice
        ? {
            value: s.advice.verdict === "keep-going" ? "Keep going" : "Reset",
            detail: s.advice.verdict === "keep-going" ? "PBs sooner than a fresh run" : "a fresh run PBs sooner",
            tone: s.advice.verdict === "keep-going" ? "ahead" : undefined,
            word: true,
          }
        : null,
  },
  {
    id: "delta",
    standard: true,
    doc: {
      id: "live-delta",
      label: "vs PB",
      short: "How far ahead (−) or behind (+) your PB's time you were at the last split.",
      how: [
        "Your time at the latest split minus your PB's time at the same split. Splits your PB skipped have no comparison.",
        "Once the timer passes your PB's time for the split you're on, it counts up live from there, as LiveSplit's delta does.",
      ],
    },
    view: (s) =>
      s.liveVsPb != null
        ? { value: signed(s.liveVsPb), detail: `live · ${s.current!.name}`, tone: tone(s.liveVsPb) }
        : s.lastSplit?.vsPb == null
          ? null
          : { value: signed(s.lastSplit.vsPb), detail: `at ${s.lastSplit.name}`, tone: tone(s.lastSplit.vsPb) },
  },
  {
    id: "goal",
    standard: false,
    doc: {
      id: "live-goal",
      label: "vs goal",
      short: "How far ahead (−) or behind (+) your goal's splits you were at the last split.",
      how: [
        "Until you set a goal it compares with your realistic target: each segment at your good-day time or your PB time, whichever is faster.",
        "With a goal set, here or in What does your goal take?, it compares with the goal planner's splits for it: the same times as the balanced comparison it saves for LiveSplit.",
        "Once the timer passes the goal's time for the split you're on, it counts up live from there, as LiveSplit's delta does.",
        "A goal faster than every segment at its gold has no splits, so nothing shows.",
      ],
    },
    view: (s) => {
      const g = s.goal;
      if (!g) return null;
      const target = g.kind === "goal" ? `sub ${formatTime(g.time, g.time % 1000 === 0 ? 0 : 2)}` : "realistic target";
      if (!g.splits) return { value: "Out of reach", detail: `${target} needs new golds`, word: true };
      if (s.liveVsGoal != null) return { value: signed(s.liveVsGoal), detail: `${target} · live`, tone: tone(s.liveVsGoal) };
      const vs = s.lastSplit?.vsGoal;
      return vs == null ? null : { value: signed(vs), detail: `${target} · at ${s.lastSplit!.name}`, tone: tone(vs) };
    },
  },
  {
    id: "lastSegment",
    standard: true,
    doc: {
      id: "live-last-segment",
      label: "Last segment",
      short: "The segment you just finished against your usual time for it, in time and as a share.",
      how: [
        `Your usual time is the median of ${RECENT_TIMES} for that segment, the same as in All segments.`,
        "The share makes a 2 second loss in a 30 second segment and a 2 minute loss in a 1 hour segment read the same way.",
        "A segment faster than your best ever time for it shows as a gold.",
      ],
    },
    view: (s) => {
      const l = s.lastSplit;
      if (!l || l.vsTypical == null || l.vsTypicalShare == null) return null;
      return {
        value: l.gold ? "Gold" : signed(l.vsTypical),
        detail: l.gold ? `${formatTime(l.segmentTime)} · ${l.name}` : `${signedPct(l.vsTypicalShare)} vs usual · ${l.name}`,
        tone: l.gold ? "gold" : tone(l.vsTypical),
        word: l.gold,
      };
    },
  },
  {
    id: "likelyFinish",
    standard: true,
    doc: {
      id: "live-likely-finish",
      label: "Likely finish",
      short: "Where this run ends if every segment left goes at your usual pace.",
      how: [
        "Your time at the last split plus your usual time for every segment still to play.",
        "If the segment you're on has already run longer than usual, it counts from the time on the timer instead.",
      ],
    },
    view: (s) =>
      s.likelyFinish == null ? null : { value: formatTime(s.likelyFinish, 1), detail: s.phase === "Ended" ? "final time" : undefined },
  },
  {
    id: "bestPossible",
    standard: false,
    doc: {
      id: "live-best-possible",
      label: "Best possible",
      short: "Where this run ends if every segment left is a gold.",
      how: ["Your time at the last split plus your best ever time for every segment still to play (the same golds as the Segments tab)."],
    },
    view: (s) => (s.bestPossible == null || s.phase === "Ended" ? null : { value: formatTime(s.bestPossible, 1) }),
  },
  {
    id: "segment",
    standard: false,
    doc: {
      id: "live-segment",
      label: "This segment",
      short: "Your usual time for the segment you're on, with its gold and its time in your PB.",
      how: [`Usual is the median of ${RECENT_TIMES}. Gold is your best ever time for it.`],
    },
    view: (s) =>
      s.current?.typical == null
        ? null
        : {
            value: formatTime(s.current.typical, 1),
            detail: `gold ${formatTime(s.current.gold, 1)} · PB ${formatTime(s.current.pb, 1)}`,
          },
  },
  {
    id: "next",
    standard: false,
    doc: {
      id: "live-next",
      label: "Up next",
      short: "The segment after this one: your usual time for it, its gold, and how often good runs die in it.",
      how: [
        `Usual is the median of ${RECENT_TIMES}. Gold is your best ever time for it.`,
        "The share is the same as Runs die here: of your attempts that reached it going well, how many were reset in it.",
        "Before the run starts it shows the first segment.",
      ],
    },
    view: (s) => {
      const n = s.next;
      if (!n) return null;
      const parts = [n.name];
      if (n.gold != null) parts.push(`gold ${formatTime(n.gold, 1)}`);
      if (n.endsRuns != null) parts.push(`${Math.round(n.endsRuns * 100)}% die here`);
      return { value: n.typical == null ? "—" : formatTime(n.typical, 1), detail: parts.join(" · ") };
    },
  },
  {
    id: "risk",
    standard: false,
    doc: {
      id: "live-risk",
      label: "Runs die here",
      short: "How often a run that reached this segment going well was reset in it.",
      how: [
        "Among your attempts that reached this segment in the faster half of times at the split before, the share that were reset during it. Pace resets of runs that were already slow don't count.",
        "For the first segment it's every attempt, since there's no split before it.",
      ],
    },
    view: (s) => (s.current?.endsRuns == null ? null : { value: `${Math.round(s.current.endsRuns * 100)}%`, detail: "of good runs" }),
  },
  {
    id: "golds",
    standard: false,
    doc: {
      id: "live-golds",
      label: "Golds this run",
      short: "Segments in this attempt that beat your best ever time for them.",
      how: ["Counted against the golds in your split file, so a gold LiveSplit saved after you loaded the file still counts here."],
    },
    view: (s) => (s.phase === "NotRunning" ? null : { value: String(s.golds), tone: s.golds > 0 ? "gold" : undefined }),
  },
  {
    id: "session",
    standard: false,
    doc: {
      id: "live-session",
      label: "This session",
      short: "Attempts, finishes and PBs since you opened this page.",
      how: ["Counted from the timer while this page is open: an attempt when the timer starts, a finish when it ends, a PB when a finish beats the PB in your split file."],
    },
    view: (_s, session) =>
      session.attempts === 0
        ? null
        : {
            value: String(session.attempts),
            detail: `${session.attempts === 1 ? "attempt" : "attempts"} · ${session.finished} finished${session.pbs ? ` · ${session.pbs} PB` : ""}${session.best != null ? ` · best ${formatTime(session.best, 1)}` : ""}`,
          },
  },
];

export const STAT_BY_ID = new Map(LIVE_STATS.map((s) => [s.id, s]));

/** The runner's choice of stats, in their order. */
export interface StatChoice {
  id: string;
  shown: boolean;
}

export const DEFAULT_CHOICES: StatChoice[] = LIVE_STATS.map((s) => ({ id: s.id, shown: s.standard }));

/** A saved choice list, with stats added since it was saved appended (hidden) and unknown ones dropped. */
export function normalizeChoices(saved: unknown): StatChoice[] {
  const list = Array.isArray(saved) ? saved : [];
  const seen = new Set<string>();
  const out: StatChoice[] = [];
  for (const c of list) {
    if (c && typeof c.id === "string" && STAT_BY_ID.has(c.id) && !seen.has(c.id)) {
      seen.add(c.id);
      out.push({ id: c.id, shown: !!c.shown });
    }
  }
  if (!out.length) return DEFAULT_CHOICES;
  for (const s of LIVE_STATS) if (!seen.has(s.id)) out.push({ id: s.id, shown: false });
  return out;
}
