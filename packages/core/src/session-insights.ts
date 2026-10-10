import { ANALYSIS_DEFAULTS, quantile } from "./analyze.js";
import { recentCount } from "./recency.js";
import { groupSessions, SESSION_DEFAULTS, type Session, type TimedAttempt } from "./sessions.js";
import type { Run } from "./types.js";

/**
 * Settings for session, fatigue and tilt insights. Exported so the UI and docs can quote
 * the real numbers. An effect is only stated when its interval excludes zero, it is at least
 * the minimum size below, and enough sessions or events back it.
 */
export const SESSION_INSIGHT_SETTINGS = {
  gapMinutes: SESSION_DEFAULTS.gapMinutes,
  /**
   * The rolling "usual" time each segment time is compared with is the median of this many clean
   * times around it, at most. Fewer when the segment has less history: half its times, at least 10
   * (see recency.ts), so a long category with 20 times a segment still follows its improvement.
   */
  paceWindow: 51,
  /** A segment taking more than this multiple of its usual time counts as this slow, no slower (pauses, AFK). */
  paceCap: 2,
  /** Sessions needed before a session-level effect is judged. */
  minSessions: 8,
  /** Events (late resets, near-PBs) needed before a tilt effect is judged. */
  minEvents: 15,
  /** Minutes from a session's first split that count as warm-up. */
  warmupMinutes: 20,
  /** Segment times needed on each side of a split (warm-up, fatigue) for a session to count. */
  minSegmentsPerSide: 3,
  /**
   * Minutes-into-session buckets for the peak window and the chart. Only the ones your sessions
   * reach are used: buckets that start before the length of your longer sessions (see sessionReach).
   */
  minuteBuckets: [0, 20, 40, 60, 90, 120, 180, 240, 300, 360, 480, 600],
  /** Candidate points (minutes in) where fatigue might start, again only up to your longer sessions. */
  fatigueThresholds: [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480],
  /** Sessions this long or shorter make up this share of your sessions; buckets and fatigue points stop there. */
  sessionReach: 0.9,
  /** Attempts needed on each side of a fatigue threshold for a session's reset rate to count. */
  fatigueMinAttemptsPerSide: 3,
  /** A reset at or after this fraction of the route counts as a late reset. */
  lateResetFraction: 2 / 3,
  /** A reset before this fraction of the route counts as an early reset. */
  earlyResetFraction: 1 / 3,
  /** A finished run within this fraction of the PB standing at the time is a near-PB. */
  nearPbFraction: 0.02,
  /** Smallest pace difference worth stating (0.005 = 0.5%). */
  minPaceEffect: 0.005,
  /** Smallest reset-rate difference worth stating (0.05 = 5 percentage points). */
  minRateEffect: 0.05,
  /** Confidence for single comparisons, and for "pick the best of several" searches. */
  confidence: 0.95,
  searchConfidence: 0.99,
} as const;

export type FindingKind = "warm-up" | "peak-window" | "fatigue" | "tilt-late-reset" | "tilt-near-pb" | "time-of-day" | "day-of-week";
/** clear: an effect we can state. no-effect: enough data, nothing beyond noise. not-enough-data: can't say yet. */
export type FindingStatus = "clear" | "no-effect" | "not-enough-data";

export interface Finding {
  kind: FindingKind;
  status: FindingStatus;
  title: string;
  message: string;
  /** Sessions or events behind the finding. */
  sample: number;
}

export interface PaceBucket {
  label: string;
  /** Segment times played in this bucket. */
  segments: number;
  sessions: number;
  /** Mean pace relative to usual (0.02 = 2% slower), or null when the bucket is too thin to show. */
  pace: number | null;
  low: number | null;
  high: number | null;
}

export interface SessionInsights {
  /** False when the file has no attempt timestamps (LiveSplit before 1.6) or too few attempts. */
  available: boolean;
  reason?: string;
  sessions: number;
  timedAttempts: number;
  medianSessionMinutes: number | null;
  medianAttemptsPerSession: number | null;
  findings: Finding[];
  /** Pace against each session's own average, by minutes into the session. */
  byMinutesIn: PaceBucket[];
  /** Bucket starts (minutes in) and fatigue points actually used, cut to the length of your longer sessions. */
  minuteEdges: number[];
  fatigueChecked: number[];
  /** Pace against your usual, by the local time of day and day of week each session started. */
  byTimeOfDay: PaceBucket[];
  byWeekday: PaceBucket[];
}

export interface SessionInsightOptions {
  /** Local hour (0-23) and weekday (0 = Sunday) for a UTC timestamp. Defaults to this machine's time zone. */
  localTime?: (ms: number) => { hour: number; weekday: number };
}

/** One segment as played: when it started in its session, its time (capped) and its usual time. */
interface SegmentPlay {
  segment: number;
  minutesIn: number;
  time: number;
  usual: number;
}

/** Facts about one attempt that the insights use. */
interface AttemptFacts {
  t: TimedAttempt;
  /** Every clean segment this attempt played, placed at the time it started within the session. */
  plays: SegmentPlay[];
  /** Segment-time-weighted pace against the rolling usual: 0.02 = 2% slower. Null when no clean segment. */
  pace: number | null;
  finished: boolean;
  /** Index of the segment the attempt reset in (segments.length when finished). */
  reached: number;
}

const S = SESSION_INSIGHT_SETTINGS;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [
  { label: "Night", from: 0, to: 6, noun: "at night (midnight to 6:00)" },
  { label: "Morning", from: 6, to: 12, noun: "in the morning (6:00 to noon)" },
  { label: "Afternoon", from: 12, to: 18, noun: "in the afternoon (noon to 18:00)" },
  { label: "Evening", from: 18, to: 24, noun: "in the evening (18:00 to midnight)" },
];

/** Groups a run's attempts into sessions and looks for warm-up, peak, fatigue, tilt and time effects. */
export function analyzeSessions(run: Run, options: SessionInsightOptions = {}): SessionInsights {
  const localTime =
    options.localTime ?? ((ms: number) => ({ hour: new Date(ms).getHours(), weekday: new Date(ms).getDay() }));
  const sessions = groupSessions(run.attempts, { gapMinutes: S.gapMinutes });
  const timedAttempts = sessions.reduce((n, s) => n + s.attempts.length, 0);
  const base = {
    sessions: sessions.length,
    timedAttempts,
    medianSessionMinutes: median(sessions.map((s) => (s.end - s.start) / 60_000)),
    medianAttemptsPerSession: median(sessions.map((s) => s.attempts.length)),
  };
  const reach = sessionReach(sessions);
  const minuteEdges = S.minuteBuckets.filter((m, i) => i < 2 || m < reach);
  const fatigueChecked = S.fatigueThresholds.filter((m, i) => i === 0 || m < reach);
  const empty = { findings: [], byMinutesIn: [], byTimeOfDay: [], byWeekday: [], minuteEdges, fatigueChecked };
  if (timedAttempts === 0) {
    return {
      ...base,
      ...empty,
      available: false,
      reason: "This file has no attempt dates. LiveSplit 1.6 and later save when each attempt started.",
    };
  }
  if (sessions.length < S.minSessions) {
    return {
      ...base,
      ...empty,
      available: false,
      reason: `Session insights need at least ${S.minSessions} sessions; this file has ${sessions.length}.`,
    };
  }

  const facts = attemptFacts(run, sessions);
  const bySession = sessions.map((s) => s.attempts.map((t) => facts.get(t.attempt.id)!));
  const startOf = (attempts: AttemptFacts[]) => localTime(attempts[0].t.start);

  const peak = peakWindow(bySession, minuteEdges);
  const findings = [
    warmUp(bySession),
    peak.finding,
    fatigue(bySession, fatigueChecked),
    tilt(bySession, run, "late-reset"),
    tilt(bySession, run, "near-pb"),
    timeEffect(bySession, (a) => periodOf(startOf(a).hour), "time-of-day"),
    timeEffect(bySession, (a) => startOf(a).weekday, "day-of-week"),
  ];
  return {
    ...base,
    available: true,
    findings,
    byMinutesIn: peak.buckets,
    minuteEdges,
    fatigueChecked,
    byTimeOfDay: timeBuckets(bySession, (a) => periodOf(startOf(a).hour), PERIODS.length).map((b, i) => ({
      ...b,
      label: PERIODS[i].label,
    })),
    byWeekday: timeBuckets(bySession, (a) => startOf(a).weekday, 7).map((b, i) => ({ ...b, label: DAYS[i] })),
  };
}

/**
 * Works out how each attempt's segments compare with a rolling usual time per segment, when in
 * the session each segment was played, and how far the attempt got. Placing segments at their own
 * time (not the attempt's start) is what lets one five-hour run show fatigue on its own.
 */
function attemptFacts(run: Run, sessions: Session[]): Map<number, AttemptFacts> {
  const n = run.segments.length;
  // Usual time for each (segment, attempt) clean time.
  const usualTimes = run.segments.map((seg) => {
    const usual = new Map<number, number>();
    const entries = [...seg.history.entries()].filter((e): e is [number, number] => e[1] != null && e[1] > 0);
    if (entries.length < ANALYSIS_DEFAULTS.minSamples) return usual;
    const overall = quantile(entries.map((e) => e[1]).sort((a, b) => a - b), 0.5);
    const clean = entries.filter((e) => e[1] >= overall * ANALYSIS_DEFAULTS.outlierFloor).sort((a, b) => a[0] - b[0]);
    const size = Math.min(S.paceWindow, recentCount(clean.length) + 1);
    const half = Math.floor(size / 2);
    clean.forEach(([id], i) => {
      const from = Math.max(0, Math.min(i - half, clean.length - size));
      const window = clean.slice(from, from + size).map((e) => e[1]).sort((a, b) => a - b);
      usual.set(id, quantile(window, 0.5));
    });
    return usual;
  });

  const facts = new Map<number, AttemptFacts>();
  for (const s of sessions) {
    for (const t of s.attempts) {
      const id = t.attempt.id;
      const plays: SegmentPlay[] = [];
      let elapsed = 0;
      let reached = n;
      for (let i = 0; i < n; i++) {
        const seg = run.segments[i];
        if (!seg.history.has(id)) {
          reached = i;
          break;
        }
        const time = seg.history.get(id);
        if (time == null) continue; // skipped split: its time lands in the next segment
        const usual = usualTimes[i].get(id);
        if (usual != null) plays.push({ segment: i, minutesIn: t.minutesIn + elapsed / 60_000, time: Math.min(time, usual * S.paceCap), usual });
        elapsed += time;
      }
      facts.set(id, { t, plays, pace: paceOf(plays), finished: n > 0 && reached === n, reached });
    }
  }
  return facts;
}

/** Your first minutes of play in each session against the rest of that session. */
function warmUp(bySession: AttemptFacts[][]): Finding {
  const w = S.warmupMinutes;
  const diffs: number[] = [];
  for (const attempts of bySession) {
    // Counted from the first split of the session, so quick resets before it don't use up the window.
    const all = attempts.flatMap((f) => f.plays);
    if (all.length === 0) continue;
    const from = all[0].minutesIn;
    const repeats = withinSession(all);
    const first = repeats.filter((p) => p.minutesIn < from + w);
    const rest = repeats.filter((p) => p.minutesIn >= from + w);
    if (first.length >= S.minSegmentsPerSide && rest.length >= S.minSegmentsPerSide) diffs.push(paceOf(first)! - paceOf(rest)!);
  }
  const base = { kind: "warm-up" as const, title: "Warm-up", sample: diffs.length };
  if (diffs.length < S.minSessions) {
    return {
      ...base,
      status: "not-enough-data",
      message: `Needs ${S.minSessions} sessions that replay at least ${S.minSegmentsPerSide} splits on each side of their first ${w} minutes; this file has ${diffs.length}.`,
    };
  }
  const ci = meanInterval(diffs, S.confidence);
  if (isClear(ci, S.minPaceEffect)) {
    return { ...base, status: "clear", message: `In the first ${w} minutes of a session you run ${paceWords(ci.mean)} than the rest of it.` };
  }
  return { ...base, status: "no-effect", message: `The first ${w} minutes of a session go about as fast as the rest.` };
}

/** Pace against each session's own average, by minutes in, and the window where it's clearly best. */
function peakWindow(bySession: AttemptFacts[][], edges: number[]): { finding: Finding; buckets: PaceBucket[] } {
  const bucketOf = (m: number) => edges.filter((e) => m >= e).length - 1;
  // Per session: its overall pace and its plays grouped by bucket.
  const perSession: { avg: number; groups: Map<number, SegmentPlay[]> }[] = [];
  for (const attempts of bySession) {
    const plays = withinSession(attempts.flatMap((f) => f.plays));
    if (plays.length < 2 * S.minSegmentsPerSide) continue;
    const groups = new Map<number, SegmentPlay[]>();
    for (const p of plays) groups.set(bucketOf(p.minutesIn), [...(groups.get(bucketOf(p.minutesIn)) ?? []), p]);
    if (groups.size >= 2) perSession.push({ avg: paceOf(plays)!, groups });
  }
  const valuesFor = (from: number, to: number) =>
    perSession.flatMap(({ avg, groups }) => {
      const v = [...groups.entries()].filter(([b]) => b >= from && b <= to).flatMap(([, x]) => x);
      return v.length > 0 ? [paceOf(v)! - avg] : [];
    });

  const buckets: PaceBucket[] = edges.map((from, i) => {
    const to = edges[i + 1];
    const values = valuesFor(i, i);
    const ci = values.length >= S.minSessions ? meanInterval(values, S.confidence) : null;
    return {
      label: to == null ? `${shortMinutes(from)}+` : `${shortMinutes(from)}-${shortMinutes(to)}`,
      segments: perSession.reduce((n, s) => n + (s.groups.get(i)?.length ?? 0), 0),
      sessions: values.length,
      pace: ci?.mean ?? null,
      low: ci?.low ?? null,
      high: ci?.high ?? null,
    };
  });

  const base = { kind: "peak-window" as const, title: "Peak window" };
  const shown = buckets.map((b, i) => ({ b, i })).filter(({ b }) => b.pace != null);
  if (shown.length < 2) {
    return {
      buckets,
      finding: {
        ...base,
        sample: perSession.length,
        status: "not-enough-data",
        message: `Needs ${S.minSessions} sessions that replay the same splits in at least two stretches of a session (0-20 min, 20-40 min and so on).`,
      },
    };
  }
  // Grow the fastest bucket into its neighbours while they are also faster than average.
  const best = shown.reduce((x, y) => (y.b.pace! < x.b.pace! ? y : x)).i;
  let from = best;
  let to = best;
  while (from > 0 && (buckets[from - 1].pace ?? 1) < 0) from--;
  while (to < buckets.length - 1 && (buckets[to + 1].pace ?? 1) < 0) to++;
  const values = valuesFor(from, to);
  const ci = meanInterval(values, S.searchConfidence);
  const span =
    to + 1 >= edges.length
      ? `after ${minutesLabel(edges[from])} into a session`
      : from === 0
        ? `in the first ${minutesLabel(edges[to + 1])} of a session`
        : `between ${minutesLabel(edges[from])} and ${minutesLabel(edges[to + 1])} into a session`;
  if (isClear(ci, S.minPaceEffect) && ci.mean < 0) {
    return {
      buckets,
      finding: { ...base, sample: values.length, status: "clear", message: `You run best ${span}: ${paceWords(ci.mean)} than your session average.` },
    };
  }
  return {
    buckets,
    finding: { ...base, sample: values.length, status: "no-effect", message: "No stretch of a session stands out as clearly faster than the rest." },
  };
}

/**
 * Reset rate and pace before and after each candidate point in a session. Reset rate needs several
 * attempts on each side; pace only needs splits, so long runs with one attempt a session still count.
 */
function fatigue(bySession: AttemptFacts[][], thresholds: number[]): Finding {
  const base = { kind: "fatigue" as const, title: "Fatigue" };
  type Candidate = { threshold: number; rate: Interval | null; pace: Interval | null; before: number; after: number; n: number };
  const candidates: Candidate[] = [];
  for (const threshold of thresholds) {
    const rateDiffs: number[] = [];
    const paceDiffs: number[] = [];
    let before = 0;
    let after = 0;
    for (const attempts of bySession) {
      const early = attempts.filter((f) => f.t.minutesIn < threshold);
      const late = attempts.filter((f) => f.t.minutesIn >= threshold);
      if (early.length >= S.fatigueMinAttemptsPerSide && late.length >= S.fatigueMinAttemptsPerSide) {
        const rb = resetRate(early);
        const ra = resetRate(late);
        rateDiffs.push(ra - rb);
        before += rb;
        after += ra;
      }
      const plays = withinSession(attempts.flatMap((f) => f.plays));
      const pe = plays.filter((p) => p.minutesIn < threshold);
      const pl = plays.filter((p) => p.minutesIn >= threshold);
      if (pe.length >= S.minSegmentsPerSide && pl.length >= S.minSegmentsPerSide) paceDiffs.push(paceOf(pl)! - paceOf(pe)!);
    }
    const rate = rateDiffs.length >= S.minSessions ? meanInterval(rateDiffs, S.searchConfidence) : null;
    const pace = paceDiffs.length >= S.minSessions ? meanInterval(paceDiffs, S.searchConfidence) : null;
    if (!rate && !pace) continue;
    candidates.push({
      threshold,
      rate,
      pace,
      before: before / Math.max(1, rateDiffs.length),
      after: after / Math.max(1, rateDiffs.length),
      n: Math.max(rateDiffs.length, paceDiffs.length),
    });
  }
  if (candidates.length === 0) {
    return {
      ...base,
      sample: 0,
      status: "not-enough-data",
      message: `Needs ${S.minSessions} sessions longer than ${minutesLabel(thresholds[0])} that replay the same splits on both sides of it.`,
    };
  }
  // The threshold where reset rate (or else pace) gets clearly worse by the most: the change point.
  const rateWorse = (c: Candidate) => c.rate != null && isClear(c.rate, S.minRateEffect) && c.rate.mean > 0;
  const paceWorse = (c: Candidate) => c.pace != null && isClear(c.pace, S.minPaceEffect) && c.pace.mean > 0;
  const byRate = candidates.filter(rateWorse).sort((x, y) => y.rate!.mean - x.rate!.mean);
  const byPace = candidates.filter(paceWorse).sort((x, y) => y.pace!.mean - x.pace!.mean);
  const c = byRate[0] ?? byPace[0];
  if (c) {
    const parts: string[] = [];
    if (rateWorse(c)) parts.push(`your reset rate goes from ${pctText(c.before)} to ${pctText(c.after)}`);
    if (paceWorse(c)) parts.push(`your splits run ${paceWords(c.pace!.mean)}`);
    return { ...base, sample: c.n, status: "clear", message: `After ${minutesLabel(c.threshold)}, ${parts.join(" and ")}.` };
  }
  const checked = candidates.some((c) => c.rate != null) ? "reset rate or pace" : "pace";
  return {
    ...base,
    sample: candidates[0].n,
    status: "no-effect",
    message: `No clear drop in your ${checked} late in a session (checked from ${minutesLabel(candidates[0].threshold)} to ${minutesLabel(candidates.at(-1)!.threshold)} in).`,
  };
}

/** What happens to the next attempt after a late reset or a near-PB, against every other next attempt. */
function tilt(bySession: AttemptFacts[][], run: Run, trigger: "late-reset" | "near-pb"): Finding {
  const n = run.segments.length;
  const lateFrom = Math.ceil(n * S.lateResetFraction);
  const earlyBefore = Math.max(1, Math.floor(n * S.earlyResetFraction));
  // The PB standing at each attempt, from finished attempts in id order.
  const standingPb = new Map<number, number | null>();
  let pb: number | null = null;
  for (const a of [...run.attempts].sort((x, y) => x.id - y.id)) {
    standingPb.set(a.id, pb);
    const finished = n > 0 && run.segments[n - 1].history.has(a.id);
    if (finished && a.time != null && (pb == null || a.time < pb)) pb = a.time;
  }
  const isTrigger = (f: AttemptFacts) => {
    if (trigger === "late-reset") return !f.finished && f.reached >= lateFrom && n >= 3;
    const prev = standingPb.get(f.t.attempt.id);
    const time = f.t.attempt.time;
    return f.finished && prev != null && time != null && time >= prev && time <= prev * (1 + S.nearPbFraction);
  };

  const after: AttemptFacts[] = [];
  const usual: AttemptFacts[] = [];
  for (const attempts of bySession) {
    for (let i = 1; i < attempts.length; i++) (isTrigger(attempts[i - 1]) ? after : usual).push(attempts[i]);
  }
  const title = trigger === "late-reset" ? "After a late reset" : "After a near-PB";
  const event = trigger === "late-reset" ? "a late reset" : "a near-PB";
  const base = { kind: trigger === "late-reset" ? ("tilt-late-reset" as const) : ("tilt-near-pb" as const), title, sample: after.length };
  if (after.length < S.minEvents || usual.length < S.minEvents) {
    const what = trigger === "late-reset" ? "resets in the last third of the run" : `finished runs within ${pctText(S.nearPbFraction)} of your PB`;
    return { ...base, status: "not-enough-data", message: `Needs ${S.minEvents} ${what} followed by another attempt; this file has ${after.length === 0 ? "none" : after.length}.` };
  }

  const early = (f: AttemptFacts) => (!f.finished && f.reached < earlyBefore ? 1 : 0);
  const rate = proportionDiff(after.map(early), usual.map(early), S.confidence);
  const pa = paces(after);
  const pu = paces(usual);
  const pace = pa.length >= S.minEvents ? welch(pa, pu, S.confidence) : null;
  const parts: string[] = [];
  if (isClear(rate, S.minRateEffect)) {
    parts.push(`it resets early ${pctText(mean(after.map(early)))} of the time, against ${pctText(mean(usual.map(early)))} usually`);
  }
  if (pace && isClear(pace, S.minPaceEffect)) parts.push(`its segments run ${paceWords(pace.mean)} than usual`);
  if (parts.length > 0) {
    return { ...base, status: "clear", message: `After ${event}, your next attempt changes: ${parts.join(", and ")}.` };
  }
  return { ...base, status: "no-effect", message: `Your next attempt after ${event} goes about like any other.` };
}

/** Compares sessions started at one time of day (or day of week) with the rest, on session pace. */
function timeEffect(bySession: AttemptFacts[][], groupOf: (attempts: AttemptFacts[]) => number, kind: "time-of-day" | "day-of-week"): Finding {
  const groups = kind === "time-of-day" ? PERIODS.length : 7;
  const units = sessionUnits(bySession, groupOf);
  const base = { kind, title: kind === "time-of-day" ? "Time of day" : "Day of week", sample: units.length };

  const tested: { g: number; ci: Interval }[] = [];
  for (let g = 0; g < groups; g++) {
    const inGroup = units.filter((u) => u.group === g).map((u) => u.pace);
    const rest = units.filter((u) => u.group !== g).map((u) => u.pace);
    if (inGroup.length >= S.minSessions && rest.length >= S.minSessions) tested.push({ g, ci: welch(inGroup, rest, S.searchConfidence) });
  }
  if (tested.length < 2) {
    const what = kind === "time-of-day" ? "times of day" : "days of the week";
    const names = kind === "time-of-day" ? PERIODS.map((p) => p.noun.replace(/ \(.*\)/, "")) : DAYS.map((d) => `on ${d}s`);
    const counts = Array.from({ length: groups }, (_, g) => units.filter((u) => u.group === g).length)
      .map((n, g) => ({ n, g }))
      .filter(({ n }) => n > 0)
      .sort((x, y) => y.n - x.n)
      .map(({ n, g }) => `${n} ${names[g]}`);
    return {
      ...base,
      status: "not-enough-data",
      message: `Needs ${S.minSessions} sessions in each of at least two ${what}. Your sessions with splits started ${listText(counts)}.`,
    };
  }
  const clear = tested.filter((t) => isClear(t.ci, S.minPaceEffect)).sort((x, y) => Math.abs(y.ci.mean) - Math.abs(x.ci.mean));
  if (clear.length > 0) {
    const { g, ci } = clear[0];
    const when = kind === "time-of-day" ? `in sessions you start ${PERIODS[g].noun}` : `in sessions you start on a ${DAYS[g]}`;
    return { ...base, status: "clear", message: `You run ${paceWords(ci.mean)} ${when} than in the rest.` };
  }
  return {
    ...base,
    status: "no-effect",
    message: kind === "time-of-day" ? "Your pace is about the same whatever time of day you start." : "Your pace is about the same whichever day you play.",
  };
}

function timeBuckets(bySession: AttemptFacts[][], groupOf: (attempts: AttemptFacts[]) => number, groups: number): Omit<PaceBucket, "label">[] {
  const units = sessionUnits(bySession, groupOf);
  // Shown against your overall average, so the buckets read as faster or slower than usual.
  const overall = mean(units.map((u) => u.pace));
  return Array.from({ length: groups }, (_, g) => {
    const mine = units.filter((u) => u.group === g);
    const ci = mine.length >= S.minSessions ? meanInterval(mine.map((u) => u.pace - overall), S.confidence) : null;
    return {
      segments: mine.reduce((n, u) => n + u.segments, 0),
      sessions: mine.length,
      pace: ci?.mean ?? null,
      low: ci?.low ?? null,
      high: ci?.high ?? null,
    };
  });
}

/**
 * The plays of segments you played more than once in the session, each measured against that
 * segment's own average in the session instead of its usual time. Comparing a segment only with
 * itself, in the same session, keeps route order out of the minutes-in findings: in a long
 * category with one run a session, the first splits are always played first, so "early in the
 * session" would otherwise just mean "early in the route", and the runs you reset would drag the
 * early part down. A segment played once in a session says nothing about when you play best.
 */
function withinSession(plays: SegmentPlay[]): SegmentPlay[] {
  const bySegment = new Map<number, SegmentPlay[]>();
  for (const p of plays) bySegment.set(p.segment, [...(bySegment.get(p.segment) ?? []), p]);
  const out: SegmentPlay[] = [];
  for (const group of bySegment.values()) {
    if (group.length < 2) continue;
    const average = group.reduce((a, p) => a + p.time, 0) / group.length;
    // Keep the usual time as the weight and shift the time so the segment's plays average out at
    // its usual: paceOf then reads each play against the session's own average for that segment.
    for (const p of group) out.push({ ...p, time: p.usual + (p.time - average) });
  }
  return out.sort((a, b) => a.minutesIn - b.minutesIn);
}

/** One value per session: its pace over every split played. Sessions, not attempts, are the unit. */
function sessionUnits(bySession: AttemptFacts[][], groupOf: (attempts: AttemptFacts[]) => number) {
  return bySession.flatMap((attempts) => {
    const plays = attempts.flatMap((f) => f.plays);
    return plays.length === 0 ? [] : [{ group: groupOf(attempts), pace: paceOf(plays)!, segments: plays.length }];
  });
}

/** Minutes that the given share (sessionReach) of your sessions fit within: how far into a session there's data. */
function sessionReach(sessions: Session[]): number {
  if (sessions.length === 0) return 0;
  const minutes = sessions.map((s) => (s.end - s.start) / 60_000).sort((a, b) => a - b);
  return quantile(minutes, S.sessionReach);
}

// ---- small statistics helpers ----

export interface Interval {
  mean: number;
  low: number;
  high: number;
}

/** Mean with a t-based confidence interval. */
export function meanInterval(values: number[], confidence: number): Interval {
  const m = mean(values);
  const n = values.length;
  if (n < 2) return { mean: m, low: -Infinity, high: Infinity };
  const variance = values.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1);
  const half = tQuantile(n - 1, confidence) * Math.sqrt(variance / n);
  return { mean: m, low: m - half, high: m + half };
}

/** Difference in means (a minus b) with a Welch interval. */
export function welch(a: number[], b: number[], confidence: number): Interval {
  const ma = mean(a);
  const mb = mean(b);
  const va = a.length > 1 ? a.reduce((s, x) => s + (x - ma) ** 2, 0) / (a.length - 1) / a.length : Infinity;
  const vb = b.length > 1 ? b.reduce((s, x) => s + (x - mb) ** 2, 0) / (b.length - 1) / b.length : Infinity;
  const se = Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / Math.max(1, a.length - 1) + vb ** 2 / Math.max(1, b.length - 1)) || 1;
  const half = tQuantile(df, confidence) * se;
  return { mean: ma - mb, low: ma - mb - half, high: ma - mb + half };
}

/** Difference in proportions (a minus b) of 0/1 values, with a normal interval. */
function proportionDiff(a: number[], b: number[], confidence: number): Interval {
  const pa = mean(a);
  const pb = mean(b);
  const se = Math.sqrt((pa * (1 - pa)) / a.length + (pb * (1 - pb)) / b.length);
  const half = tQuantile(Infinity, confidence) * se;
  return { mean: pa - pb, low: pa - pb - half, high: pa - pb + half };
}

/** Two-sided Student t quantile, approximated closely enough for df of 4 and up. */
function tQuantile(df: number, confidence: number): number {
  return confidence >= 0.99 ? 2.576 + 5 / df + 10 / df ** 2 : 1.96 + 2.5 / df + 3 / df ** 2;
}

function isClear(ci: Interval, minEffect: number): boolean {
  return (ci.low > 0 || ci.high < 0) && Math.abs(ci.mean) >= minEffect;
}

function mean(values: number[]): number {
  return values.length === 0 ? NaN : values.reduce((s, x) => s + x, 0) / values.length;
}

function median(values: number[]): number | null {
  return values.length === 0 ? null : quantile([...values].sort((a, b) => a - b), 0.5);
}

/** Time-weighted pace of a set of plays: total time over total usual time, minus 1. */
function paceOf(plays: SegmentPlay[]): number | null {
  if (plays.length === 0) return null;
  let time = 0;
  let usual = 0;
  for (const p of plays) {
    time += p.time;
    usual += p.usual;
  }
  return time / usual - 1;
}

function paces(attempts: AttemptFacts[]): number[] {
  return attempts.flatMap((f) => (f.pace == null ? [] : [f.pace]));
}

function resetRate(attempts: AttemptFacts[]): number {
  return attempts.filter((f) => !f.finished).length / attempts.length;
}

function periodOf(hour: number): number {
  return PERIODS.findIndex((p) => hour >= p.from && hour < p.to);
}

/** "2.1% slower" or "1.4% faster". */
function paceWords(pace: number): string {
  return `${(Math.abs(pace) * 100).toFixed(1)}% ${pace > 0 ? "slower" : "faster"}`;
}

/** "a", "a and b", "a, b and c". */
function listText(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function pctText(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** 40 -> "40m", 90 -> "1.5h". */
function shortMinutes(minutes: number): string {
  return minutes < 60 ? `${minutes}m` : `${+(minutes / 60).toFixed(1)}h`;
}

/** 40 -> "40 min", 90 -> "1.5 hours", 120 -> "2 hours". */
export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} ${h === 1 ? "hour" : "hours"}`;
}
