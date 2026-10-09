import type { Attempt, Run } from "./types.js";

/** Default session settings. Exported so the UI and docs can quote the real numbers. */
export const SESSION_DEFAULTS = {
  /** A break longer than this between two attempts starts a new session. */
  gapMinutes: 30,
} as const;

export interface SessionOptions {
  gapMinutes?: number;
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
      return { attempt, start, end: end != null && end >= start ? end : start };
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

/** Convenience: sessions for a parsed run. */
export function runSessions(run: Run, options: SessionOptions = {}): Session[] {
  return groupSessions(run.attempts, options);
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
