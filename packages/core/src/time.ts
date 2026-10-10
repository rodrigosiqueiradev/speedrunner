import type { Ms } from "./types.js";

/** Parses LiveSplit time strings like "01:23:45.6780000", "1.02:03:04.5" or "-00:00:01.5". */
export function parseTime(raw: string | undefined | null): Ms | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (text === "") return null;

  const match = /^(-)?(?:(\d+)\.)?(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(text);
  if (!match) throw new Error(`Unrecognised LiveSplit time: "${text}"`);
  const [, sign, days, hours, minutes, seconds] = match;
  const ms =
    ((Number(days ?? 0) * 24 + Number(hours)) * 60 + Number(minutes)) * 60_000 +
    Math.round(Number(seconds) * 1000);
  return sign ? -ms : ms;
}

/** Formats milliseconds the way runners read them: "1:02:03.456", "2:03.456", "3.456". */
export function formatTime(ms: Ms | null, decimals = 2): string {
  if (ms == null) return "-";
  const sign = ms < 0 ? "-" : "";
  // Cut to the shown precision first, as LiveSplit does: 3:11.265 reads 3:11.26 there too, and
  // 39:59.995 stays under 40 minutes. (The small epsilon keeps 191265 from reading as 191264.99.)
  const unit = 10 ** (3 - decimals);
  const abs = Math.floor(Math.abs(ms) / unit + 1e-9) * unit;
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const seconds = ((abs % 60_000) / 1000).toFixed(decimals);
  const [whole, frac] = seconds.split(".");
  const secs = frac ? `${whole}.${frac}` : whole;
  if (hours > 0) return `${sign}${hours}:${pad(minutes)}:${secs.padStart(decimals ? decimals + 3 : 2, "0")}`;
  if (minutes > 0) return `${sign}${minutes}:${secs.padStart(decimals ? decimals + 3 : 2, "0")}`;
  return `${sign}${secs}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
