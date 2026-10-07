import { formatTime } from "@speedrunner/core";

/** Formats a time difference, adding "s" when it's under a minute so "0.51" doesn't read as a clock time. */
export function formatSave(ms: number | null): string {
  if (ms == null) return "-";
  return Math.abs(ms) < 60_000 ? `${formatTime(ms)}s` : formatTime(ms);
}
