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

/** "12.5", "120", "2:30" or "−1:05.5" as milliseconds behind PB pace (negative is ahead), or null if it isn't a time. */
export function parseBehind(text: string): number | null {
  const t = text.trim().replace(/^[−–]/, "-").replace(",", ".");
  const sign = t.startsWith("-") ? -1 : 1;
  const body = t.replace(/^[-+]/, "");
  if (/^[-+]/.test(body)) return null;
  if (body.includes(":")) {
    if (/^[0:.]+$/.test(body)) return 0;
    const ms = parseTypedTime(body);
    return ms == null ? null : sign * ms;
  }
  const seconds = Number(body);
  return body !== "" && Number.isFinite(seconds) ? sign * Math.round(seconds * 1000) : null;
}

/** A 0-100 score as a whole number, or "-". */
export function formatScore(x: number | null): string {
  return x == null ? "-" : String(Math.round(x));
}
