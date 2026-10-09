import { ANALYSIS_DEFAULTS, quantile } from "./analyze.js";
import { groupSessions, SESSION_DEFAULTS, type Session, type TimedAttempt } from "./sessions.js";
import type { Run } from "./types.js";

/**
 * Settings for session, fatigue and tilt insights. Exported so the UI and docs can quote
 * the real numbers. An effect is only stated when its interval excludes zero, it is at least
 * the minimum size below, and enough sessions or events back it.
 */
export const SESSION_INSIGHT_SETTINGS = {
  gapMinutes: SESSION_DEFAULTS.gapMinutes,
  /** Clean times per segment that make up the rolling "usual" time each attempt is compared with. */
  paceWindow: 51,
  /** A segment taking more than this multiple of its usual time counts as this slow, no slower (pauses, AFK). */
  paceCap: 2,
  /** Sessions needed before a session-level effect is judged. */
  minSessions: 8,
  /** Events (late resets, near-PBs) needed before a tilt effect is judged. */
  minEvents: 15,
  /** How many opening attempts of a session count as warm-up. */
  warmupAttempts: 3,
  /** Minutes-into-session buckets for the peak window and the chart. */
  minuteBuckets: [0, 20, 40, 60, 90, 120, 180, 240],
  /** Candidate points (minutes in) where fatigue might start. */
  fatigueThresholds: [60, 90, 120, 150, 180, 240],
  /** Attempts needed on each side of a fatigue threshold for a session to count. */
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
  attempts: number;
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
  /** Pace against your usual, by local time of day and day of week. */
  byTimeOfDay: PaceBucket[];
  byWeekday: PaceBucket[];
}

export interface SessionInsightOptions {
  /** Local hour (0-23) and weekday (0 = Sunday) for a UTC timestamp. Defaults to this machine's time zone. */
  localTime?: (ms: number) => { hour: number; weekday: number };
}

/** Facts about one attempt that the insights use. */
interface AttemptFacts {
  t: TimedAttempt;
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
  const empty = { findings: [], byMinutesIn: [], byTimeOfDay: [], byWeekday: [] };
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

  const peak = peakWindow(bySession);
  const findings = [
    warmUp(bySession),
    peak.finding,
    fatigue(bySession),
    tilt(bySession, run, "late-reset"),
    tilt(bySession, run, "near-pb"),
    timeEffect(bySession, localTime, "time-of-day"),
    timeEffect(bySession, localTime, "day-of-week"),
  ];
  return {
    ...base,
    available: true,
    findings,
    byMinutesIn: peak.buckets,
    byTimeOfDay: timeBuckets(bySession, (f) => periodOf(localTime(f.t.start).hour), PERIODS.length).map((b, i) => ({
      ...b,
      label: PERIODS[i].label,
    })),
    byWeekday: timeBuckets(bySession, (f) => localTime(f.t.start).weekday, 7).map((b, i) => ({ ...b, label: DAYS[i] })),
  };
}

/** Works out each attempt's pace against a rolling usual time per segment, and how far it got. */
function attemptFacts(run: Run, sessions: Session[]): Map<number, AttemptFacts> {
  const n = run.segments.length;
  // Per attempt: summed clean segment times and summed usual times for those segments.
  const sums = new Map<number, { time: number; usual: number }>();
  for (const seg of run.segments) {
    const entries = [...seg.history.entries()].filter((e): e is [number, number] => e[1] != null && e[1] > 0);
    if (entries.length < ANALYSIS_DEFAULTS.minSamples) continue;
    const overall = quantile(entries.map((e) => e[1]).sort((a, b) => a - b), 0.5);
    const clean = entries.filter((e) => e[1] >= overall * ANALYSIS_DEFAULTS.outlierFloor).sort((a, b) => a[0] - b[0]);
    const half = Math.floor(S.paceWindow / 2);
    clean.forEach(([id, time], i) => {
      const from = Math.max(0, Math.min(i - half, clean.length - S.paceWindow));
      const window = clean.slice(from, from + S.paceWindow).map((e) => e[1]).sort((a, b) => a - b);
      const usual = quantile(window, 0.5);
      const acc = sums.get(id) ?? { time: 0, usual: 0 };
      acc.time += Math.min(time, usual * S.paceCap);
      acc.usual += usual;
      sums.set(id, acc);
    });
  }

  const facts = new Map<number, AttemptFacts>();
  for (const s of sessions) {
    for (const t of s.attempts) {
      const id = t.attempt.id;
      let reached = run.segments.findIndex((seg) => !seg.history.has(id));
      if (reached === -1) reached = n;
      const sum = sums.get(id);
      facts.set(id, { t, pace: sum ? sum.time / sum.usual - 1 : null, finished: n > 0 && reached === n, reached });
    }
  }
  return facts;
}

function warmUp(bySession: AttemptFacts[][]): Finding {
  const k = S.warmupAttempts;
  const diffs: number[] = [];
  for (const attempts of bySession) {
    const first = paces(attempts.slice(0, k));
    const rest = paces(attempts.slice(k));
    if (first.length > 0 && rest.length >= k) diffs.push(mean(first) - mean(rest));
  }
  const base = { kind: "warm-up" as const, title: "Warm-up", sample: diffs.length };
  if (diffs.length < S.minSessions) {
    return { ...base, status: "not-enough-data", message: `Needs ${S.minSessions} sessions with at least ${2 * k} attempts that reach a split; this file has ${diffs.length}.` };
  }
  const ci = meanInterval(diffs, S.confidence);
  if (isClear(ci, S.minPaceEffect)) {
    return {
      ...base,
      status: "clear",
      message: `Your first ${k} attempts of a session run ${paceWords(ci.mean)} than the rest of the session.`,
    };
  }
  return { ...base, status: "no-effect", message: `Your first ${k} attempts of a session are about as fast as the rest.` };
}

/** Pace against each session's own average, by minutes in, and the window where it's clearly best. */
function peakWindow(bySession: AttemptFacts[][]): { finding: Finding; buckets: PaceBucket[] } {
  const edges = S.minuteBuckets;
  const bucketOf = (m: number) => edges.filter((e) => m >= e).length - 1;
  // Per session, centred pace values grouped by bucket.
  const perSession: Map<number, number[]>[] = [];
  for (const attempts of bySession) {
    const withPace = attempts.filter((f) => f.pace != null);
    if (withPace.length < 4) continue;
    const avg = mean(withPace.map((f) => f.pace!));
    const groups = new Map<number, number[]>();
    for (const f of withPace) {
      const b = bucketOf(f.t.minutesIn);
      groups.set(b, [...(groups.get(b) ?? []), f.pace! - avg]);
    }
    perSession.push(groups);
  }
  const valuesFor = (from: number, to: number) =>
    perSession.flatMap((g) => {
      const v = [...g.entries()].filter(([b]) => b >= from && b <= to).flatMap(([, x]) => x);
      return v.length > 0 ? [mean(v)] : [];
    });

  const buckets: PaceBucket[] = edges.map((from, i) => {
    const to = edges[i + 1];
    const values = valuesFor(i, i);
    const attempts = perSession.reduce((n, g) => n + (g.get(i)?.length ?? 0), 0);
    const ci = values.length >= S.minSessions ? meanInterval(values, S.confidence) : null;
    return {
      label: to == null ? `${shortMinutes(from)}+` : `${shortMinutes(from)}-${shortMinutes(to)}`,
      attempts,
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
      finding: { ...base, sample: perSession.length, status: "not-enough-data", message: `Needs ${S.minSessions} sessions with attempts in at least two stretches of a session (0-20 min, 20-40 min and so on).` },
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
      finding: {
        ...base,
        sample: values.length,
        status: "clear",
        message: `You run best ${span}: ${paceWords(ci.mean)} than your session average.`,
      },
    };
  }
  return {
    buckets,
    finding: { ...base, sample: values.length, status: "no-effect", message: "No stretch of a session stands out as clearly faster than the rest." },
  };
}

function fatigue(bySession: AttemptFacts[][]): Finding {
  const base = { kind: "fatigue" as const, title: "Fatigue" };
  type Candidate = { threshold: number; rate: Interval; pace: Interval | null; before: number; after: number; n: number };
  const candidates: Candidate[] = [];
  for (const threshold of S.fatigueThresholds) {
    const rateDiffs: number[] = [];
    const paceDiffs: number[] = [];
    let before = 0;
    let after = 0;
    for (const attempts of bySession) {
      const early = attempts.filter((f) => f.t.minutesIn < threshold);
      const late = attempts.filter((f) => f.t.minutesIn >= threshold);
      if (early.length < S.fatigueMinAttemptsPerSide || late.length < S.fatigueMinAttemptsPerSide) continue;
      const rb = resetRate(early);
      const ra = resetRate(late);
      rateDiffs.push(ra - rb);
      before += rb;
      after += ra;
      const pe = paces(early);
      const pl = paces(late);
      if (pe.length > 0 && pl.length > 0) paceDiffs.push(mean(pl) - mean(pe));
    }
    if (rateDiffs.length < S.minSessions) continue;
    candidates.push({
      threshold,
      rate: meanInterval(rateDiffs, S.searchConfidence),
      pace: paceDiffs.length >= S.minSessions ? meanInterval(paceDiffs, S.searchConfidence) : null,
      before: before / rateDiffs.length,
      after: after / rateDiffs.length,
      n: rateDiffs.length,
    });
  }
  if (candidates.length === 0) {
    return {
      ...base,
      sample: 0,
      status: "not-enough-data",
      message: `Needs ${S.minSessions} sessions longer than ${minutesLabel(S.fatigueThresholds[0])} with at least ${S.fatigueMinAttemptsPerSide} attempts on each side.`,
    };
  }
  // The threshold where reset rate (or else pace) gets clearly worse by the most: the change point.
  const rateWorse = (c: Candidate) => isClear(c.rate, S.minRateEffect) && c.rate.mean > 0;
  const paceWorse = (c: Candidate) => c.pace != null && isClear(c.pace, S.minPaceEffect) && c.pace.mean > 0;
  const byRate = candidates.filter(rateWorse).sort((x, y) => y.rate.mean - x.rate.mean);
  const byPace = candidates.filter(paceWorse).sort((x, y) => y.pace!.mean - x.pace!.mean);
  const c = byRate[0] ?? byPace[0];
  if (c) {
    const parts: string[] = [];
    if (rateWorse(c)) parts.push(`your reset rate goes from ${pctText(c.before)} to ${pctText(c.after)}`);
    if (paceWorse(c)) parts.push(`segments run ${paceWords(c.pace!.mean)}`);
    return { ...base, sample: c.n, status: "clear", message: `After ${minutesLabel(c.threshold)}, ${parts.join(" and ")}.` };
  }
  const longest = candidates[0];
  return {
    ...base,
    sample: longest.n,
    status: "no-effect",
    message: `Your reset rate and pace hold steady in long sessions (checked from ${minutesLabel(longest.threshold)} on).`,
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
    return { ...base, status: "not-enough-data", message: `Needs ${S.minEvents} ${what} followed by another attempt; this file has ${after.length}.` };
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

/** Compares sessions played at one time of day (or day of week) with the rest, on session-level pace. */
function timeEffect(
  bySession: AttemptFacts[][],
  localTime: NonNullable<SessionInsightOptions["localTime"]>,
  kind: "time-of-day" | "day-of-week",
): Finding {
  const groupOf = (f: AttemptFacts) =>
    kind === "time-of-day" ? periodOf(localTime(f.t.start).hour) : localTime(f.t.start).weekday;
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
    return { ...base, status: "not-enough-data", message: `Needs ${S.minSessions} sessions in at least two different ${what}.` };
  }
  const clear = tested.filter((t) => isClear(t.ci, S.minPaceEffect)).sort((x, y) => Math.abs(y.ci.mean) - Math.abs(x.ci.mean));
  if (clear.length > 0) {
    const { g, ci } = clear[0];
    const when = kind === "time-of-day" ? PERIODS[g].noun : `on ${DAYS[g]}s`;
    return { ...base, status: "clear", message: `You run ${paceWords(ci.mean)} ${when} than at other times.` };
  }
  return {
    ...base,
    status: "no-effect",
    message: kind === "time-of-day" ? "Your pace is about the same whatever the time of day." : "Your pace is about the same on every day of the week.",
  };
}

function timeBuckets(bySession: AttemptFacts[][], groupOf: (f: AttemptFacts) => number, groups: number): Omit<PaceBucket, "label">[] {
  const units = sessionUnits(bySession, groupOf);
  // Shown against your overall average, so the buckets read as faster or slower than usual.
  const overall = mean(units.map((u) => u.pace));
  return Array.from({ length: groups }, (_, g) => {
    const mine = units.filter((u) => u.group === g);
    const ci = mine.length >= S.minSessions ? meanInterval(mine.map((u) => u.pace - overall), S.confidence) : null;
    return {
      attempts: mine.reduce((n, u) => n + u.attempts, 0),
      sessions: mine.length,
      pace: ci?.mean ?? null,
      low: ci?.low ?? null,
      high: ci?.high ?? null,
    };
  });
}

/** One value per session and group: the session's mean pace in that group. Sessions, not attempts, are the unit. */
function sessionUnits(bySession: AttemptFacts[][], groupOf: (f: AttemptFacts) => number) {
  const units: { group: number; pace: number; attempts: number }[] = [];
  for (const attempts of bySession) {
    const groups = new Map<number, number[]>();
    for (const f of attempts) if (f.pace != null) groups.set(groupOf(f), [...(groups.get(groupOf(f)) ?? []), f.pace]);
    for (const [group, v] of groups) units.push({ group, pace: mean(v), attempts: v.length });
  }
  return units;
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
