import { RECENCY_SETTINGS, formatTime } from "@speedrunner/core";

/**
 * How the app describes "recent" everywhere: the latest half of a segment's clean times, with the
 * floor and cap from recency.ts. Counted in your own attempts, so it fits any category length.
 */
export const RECENT_TIMES = `the latest half of your clean times (at least ${2 * RECENCY_SETTINGS.minHalfLife}, at most ${2 * RECENCY_SETTINGS.maxHalfLife})`;

/** Formats a time difference, adding "s" when it's under a minute so "0.51" doesn't read as a clock time. */
export function formatSave(ms: number | null): string {
  if (ms == null) return "-";
  return Math.abs(ms) < 60_000 ? `${formatTime(ms)}s` : formatTime(ms);
}

/** Parses a time typed by a runner: "1:02:03.4", "36:00", "59.5". Returns null if it isn't one. */
export function parseTypedTime(text: string): number | null {
  const m = /^\s*(?:(?:(\d+):)?(\d{1,2}):)?(\d{1,2}(?:\.\d{1,3})?)\s*$/.exec(text);
  if (!m) return null;
  const [, h, min, sec] = m;
  const ms = ((Number(h ?? 0) * 60 + Number(min ?? 0)) * 60 + Number(sec)) * 1000;
  return ms > 0 ? Math.round(ms) : null;
}

/** A 0-100 score as a whole number, or "-". */
export function formatScore(x: number | null): string {
  return x == null ? "-" : String(Math.round(x));
}
