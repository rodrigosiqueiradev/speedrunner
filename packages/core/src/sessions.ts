import type { Attempt, Ms, Run } from "./types.js";

/** Default session settings. Exported so the UI and docs can quote the real numbers. */
export const SESSION_DEFAULTS = {
  /** A break longer than this between two attempts starts a new session. */
  gapMinutes: 30,
  /**
   * An attempt that lasted more than this many times the category's typical finished run is
   * treated as LiveSplit left running: only the time on its splits counts as play. The limit
   * follows the category, so a 10 minute category and a 20 hour one are judged the same way.
   */
  leftRunningFactor: 3,
  /** The limit for a category with no finished run or PB to judge by. */
  maxAttemptMs: 12 * 60 * 60 * 1000,
} as const;

export interface SessionOptions {
  gapMinutes?: number;
  /**
   * How much of an attempt's length (end minus start) was play. Defaults to all of it; runSessions
   * leaves out a timer left running (see playedMs), so it doesn't stretch a session overnight.
   */
  playedMs?: (attempt: Attempt, length: Ms) => Ms;
}

/** An attempt with its timestamps resolved and its place in a session. */
export interface TimedAttempt {
  attempt: Attempt;
  /** Start and end as epoch milliseconds (UTC). End falls back to start when LiveSplit has none. */
  start: number;
  end: number;
  /** Index of the session this attempt belongs to. */
  session: number;
  /** 0 for the first attempt of a session. */
  indexInSession: number;
  /** Minutes from the session's first start to this attempt's start. */
  minutesIn: number;
}

export interface Session {
  index: number;
  start: number;
  end: number;
  attempts: TimedAttempt[];
}

/**
 * Groups attempts into play sessions: consecutive attempts with no break longer than
 * `gapMinutes` between one attempt's end and the next one's start. Attempts without a
 * readable start time are left out.
 */
export function groupSessions(attempts: Attempt[], options: SessionOptions = {}): Session[] {
  const gap = (options.gapMinutes ?? SESSION_DEFAULTS.gapMinutes) * 60_000;
  const timed = attempts
    .map((attempt) => {
      const start = parseLiveSplitDate(attempt.started);
      if (start == null) return null;
      const end = parseLiveSplitDate(attempt.ended);
      const length = end != null && end >= start ? end - start : 0;
      return { attempt, start, end: start + (options.playedMs && length > 0 ? options.playedMs(attempt, length) : length) };
    })
    .filter((t): t is { attempt: Attempt; start: number; end: number } => t != null)
    .sort((a, b) => a.start - b.start || a.attempt.id - b.attempt.id);

  const sessions: Session[] = [];
  let current: Session | null = null;
  for (const t of timed) {
    if (!current || t.start - current.end > gap) {
      current = { index: sessions.length, start: t.start, end: t.end, attempts: [] };
      sessions.push(current);
    }
    current.attempts.push({
      ...t,
      session: current.index,
      indexInSession: current.attempts.length,
      minutesIn: (t.start - current.start) / 60_000,
    });
    current.end = Math.max(current.end, t.end);
  }
  return sessions;
}

/** Sessions for a parsed run. A timer left running only counts for the time on its splits. */
export function runSessions(run: Run, options: SessionOptions = {}): Session[] {
  const limit = attemptLimit(run);
  return groupSessions(run.attempts, { playedMs: (a, length) => playedMs(run, a, length, limit), ...options });
}

/**
 * How long an attempt at this category can last before it counts as a timer left running:
 * leftRunningFactor times the median finished run, or the PB, or the 12 hour fallback.
 */
export function attemptLimit(run: Run): Ms {
  const finished = run.attempts
    .filter((a) => a.id > 0 && a.time != null && a.time > 0)
    .map((a) => a.time!)
    .sort((a, b) => a - b);
  const pb = [...run.segments].reverse().find((s) => s.pbSplit != null)?.pbSplit ?? null;
  const typical = finished.length ? (finished[Math.floor((finished.length - 1) / 2)] + finished[Math.ceil((finished.length - 1) / 2)]) / 2 : pb;
  return typical != null && typical > 0 ? SESSION_DEFAULTS.leftRunningFactor * typical : SESSION_DEFAULTS.maxAttemptMs;
}

/**
 * The part of an attempt's `length` (end minus start) that was play: all of it up to `limit`
 * (see attemptLimit); past it, the timer was left running, so only the time on its splits.
 */
export function playedMs(run: Run, attempt: Attempt, length: Ms, limit: Ms): Ms {
  if (length <= limit) return length;
  if (attempt.time != null && attempt.time > 0) return attempt.time;
  let total = 0;
  for (const segment of run.segments) {
    const t = segment.history.get(attempt.id);
    if (t != null && t > 0) total += t;
  }
  return total;
}

/**
 * Parses LiveSplit's attempt timestamps ("MM/dd/yyyy HH:mm:ss", always UTC) into epoch
 * milliseconds. Returns null for anything else.
 */
export function parseLiveSplitDate(text: string | undefined): number | null {
  if (!text) return null;
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})\s*$/.exec(text);
  if (!m) return null;
  const [, mo, d, y, h, mi, s] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  return Date.UTC(y, mo - 1, d, h, mi, s);
}
