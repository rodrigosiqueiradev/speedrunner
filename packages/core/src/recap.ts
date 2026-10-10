import { ANALYSIS_DEFAULTS } from "./analyze.js";
import { attemptLimit, parseLiveSplitDate, playedMs, SESSION_DEFAULTS } from "./sessions.js";
import type { Ms, Run } from "./types.js";

/**
 * "Year in runs": a yearly recap across every split file a runner loads, built only from the
 * attempt timestamps and segment history that LiveSplit already saves.
 */

export interface RecapOptions {
  /**
   * Which calendar decides the year and the day of each attempt. LiveSplit saves timestamps in UTC;
   * "local" (the default) uses the clock of the machine the recap is made on.
   */
  timeZone?: "local" | "utc";
}

export const RECAP_SETTINGS = {
  /** A timer left running counts only for the time on its splits (shared with sessions and PB odds, see attemptLimit). */
  leftRunningFactor: SESSION_DEFAULTS.leftRunningFactor,
  maxAttemptMs: SESSION_DEFAULTS.maxAttemptMs,
  /** A segment needs this many clean times early and late in the year to be "most improved". */
  minImprovementSamples: 5,
  /** A new best segment only counts as a gold once the segment has this many earlier clean times. */
  minGoldHistory: 5,
  /** How many of its first and last clean times in the year each segment compares. */
  improvementWindow: 10,
} as const;

export interface RecapPb {
  game: string;
  category: string;
  /** Best time at the start of the year, or null if the year brought the first finished run. */
  before: Ms | null;
  /** Best time at the end of the year. */
  after: Ms;
  /** How many times the PB was beaten during the year. */
  count: number;
}

export interface RecapGold {
  game: string;
  category: string;
  segment: string;
  time: Ms;
  /** The best clean time for this segment before this one. */
  previous: Ms;
  saved: Ms;
  /** saved / previous. */
  fraction: number;
  date: Date;
}

export interface RecapImprovement {
  game: string;
  category: string;
  segment: string;
  /** Median of the segment's first clean times in the year. */
  early: Ms;
  /** Median of its last clean times in the year. */
  late: Ms;
  saved: Ms;
  /** saved / early. */
  fraction: number;
}

export interface RecapStreak {
  days: number;
  /** First and last day of the streak as yyyy-mm-dd. */
  from: string;
  to: string;
}

export interface RecapCategory {
  game: string;
  category: string;
  attempts: number;
  finished: number;
  playMs: Ms;
}

export interface YearRecap {
  year: number;
  attempts: number;
  finished: number;
  /** Time between each attempt's start and end, summed. */
  playMs: Ms;
  /** Attempts per month, January first. */
  monthly: number[];
  daysPlayed: number;
  longestStreak: RecapStreak | null;
  /** Personal bests set this year, per category, biggest share of the old PB cut first. */
  pbs: RecapPb[];
  pbCount: number;
  /** Golds (best segments) set this year, once a segment has a few earlier times to beat. */
  goldCount: number;
  /**
   * The gold that beat the previous best by the biggest share of it. Shares, not seconds, so a
   * 6 hour category's long segments don't always beat a 10 minute category's short ones.
   */
  bestGold: RecapGold | null;
  /** The segment whose typical time dropped by the biggest share. */
  mostImproved: RecapImprovement | null;
  /** Categories played this year, most attempts first. */
  categories: RecapCategory[];
}

/** An attempt's start or end time as a Date, from LiveSplit's UTC timestamp. */
function attemptDate(text: string | undefined): Date | null {
  const ms = parseLiveSplitDate(text);
  return ms == null ? null : new Date(ms);
}

interface Calendar {
  year: (d: Date) => number;
  month: (d: Date) => number;
  day: (d: Date) => string;
}

function calendar(timeZone: RecapOptions["timeZone"]): Calendar {
  const pad = (n: number) => String(n).padStart(2, "0");
  return timeZone === "utc"
    ? {
        year: (d) => d.getUTCFullYear(),
        month: (d) => d.getUTCMonth(),
        day: (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      }
    : {
        year: (d) => d.getFullYear(),
        month: (d) => d.getMonth(),
        day: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      };
}

/** Years that have at least one dated attempt in any of the runs, newest first. */
export function recapYears(runs: Run[], options: RecapOptions = {}): number[] {
  const cal = calendar(options.timeZone);
  const years = new Set<number>();
  for (const run of runs) {
    for (const a of run.attempts) {
      const d = attemptDate(a.started);
      if (d) years.add(cal.year(d));
    }
  }
  return [...years].sort((a, b) => b - a);
}

/** Attempts that can't be placed in a year because LiveSplit saved no start time for them. */
export function undatedAttempts(runs: Run[]): number {
  return runs.reduce((n, run) => n + run.attempts.filter((a) => a.id > 0 && !attemptDate(a.started)).length, 0);
}

export function yearRecap(runs: Run[], year: number, options: RecapOptions = {}): YearRecap {
  const cal = calendar(options.timeZone);
  const monthly = new Array<number>(12).fill(0);
  const days = new Set<string>();
  const pbs: RecapPb[] = [];
  const categories: RecapCategory[] = [];
  let attempts = 0;
  let finished = 0;
  let playMs = 0;
  let goldCount = 0;
  let bestGold: RecapGold | null = null;
  let mostImproved: RecapImprovement | null = null;

  for (const run of runs) {
    const dates = new Map<number, Date>();
    for (const a of run.attempts) {
      const d = attemptDate(a.started);
      if (a.id > 0 && d) dates.set(a.id, d);
    }
    const inYear = (id: number) => {
      const d = dates.get(id);
      return d != null && cal.year(d) === year;
    };

    // Play counts.
    const limit = attemptLimit(run);
    const cat: RecapCategory = { game: run.game, category: run.category, attempts: 0, finished: 0, playMs: 0 };
    for (const a of run.attempts) {
      if (!inYear(a.id)) continue;
      const start = dates.get(a.id)!;
      cat.attempts++;
      if (a.time != null) cat.finished++;
      monthly[cal.month(start)]++;
      days.add(cal.day(start));
      const end = attemptDate(a.ended);
      const length = end ? end.getTime() - start.getTime() : 0;
      if (length > 0) cat.playMs += playedMs(run, a, length, limit);
    }
    if (cat.attempts === 0) continue;
    categories.push(cat);
    attempts += cat.attempts;
    finished += cat.finished;
    playMs += cat.playMs;

    // Personal bests, in the order the attempts were played. Undated attempts are kept in id
    // order so a PB from before the year still counts as the time to beat.
    let best: Ms | null = null;
    let startOfYear: Ms | null = null;
    let count = 0;
    for (const a of [...run.attempts].sort((x, y) => x.id - y.id)) {
      if (a.id <= 0 || a.time == null || a.time <= 0) continue;
      const d = dates.get(a.id);
      if (d && cal.year(d) > year) break;
      if (best == null || a.time < best) {
        if (inYear(a.id)) count++;
        else startOfYear = a.time;
        best = a.time;
      }
    }
    if (count > 0 && best != null) {
      pbs.push({ game: run.game, category: run.category, before: startOfYear, after: best, count });
    }

    // Golds and improvement, from clean segment times only (same rules as the analysis).
    run.segments.forEach((segment, i) => {
      const clean: Array<[number, Ms]> = [];
      for (const [id, time] of segment.history) {
        if (id <= 0 || time == null || time <= 0) continue;
        if (i > 0 && run.segments[i - 1].history.get(id) == null) continue;
        clean.push([id, time]);
      }
      if (!clean.length) return;
      clean.sort((a, b) => a[0] - b[0]);
      const sorted = clean.map(([, t]) => t).sort((a, b) => a - b);
      const floor =
        clean.length >= ANALYSIS_DEFAULTS.minSamples ? ANALYSIS_DEFAULTS.outlierFloor * median(sorted) : 0;

      let segBest: Ms | null = null;
      let seen = 0;
      const yearTimes: Ms[] = [];
      for (const [id, time] of clean) {
        if (time < floor) continue;
        const d = dates.get(id);
        if (d && cal.year(d) > year) break;
        if (inYear(id)) {
          yearTimes.push(time);
          if (segBest != null && time < segBest && seen >= RECAP_SETTINGS.minGoldHistory) {
            goldCount++;
            const saved = segBest - time;
            const fraction = saved / segBest;
            if (!bestGold || fraction > bestGold.fraction) {
              bestGold = {
                game: run.game,
                category: run.category,
                segment: segment.name,
                time,
                previous: segBest,
                saved,
                fraction,
                date: d!,
              };
            }
          }
        }
        if (segBest == null || time < segBest) segBest = time;
        seen++;
      }

      const n = Math.min(RECAP_SETTINGS.improvementWindow, Math.floor(yearTimes.length / 2));
      if (n < RECAP_SETTINGS.minImprovementSamples) return;
      const early = median(yearTimes.slice(0, n).sort((a, b) => a - b));
      const late = median(yearTimes.slice(-n).sort((a, b) => a - b));
      const saved = early - late;
      if (saved > 0 && (!mostImproved || saved / early > mostImproved.fraction)) {
        mostImproved = { game: run.game, category: run.category, segment: segment.name, early, late, saved, fraction: saved / early };
      }
    });
  }

  pbs.sort((a, b) => pbImprovement(b) - pbImprovement(a));
  categories.sort((a, b) => b.attempts - a.attempts);

  return {
    year,
    attempts,
    finished,
    playMs,
    monthly,
    daysPlayed: days.size,
    longestStreak: longestStreak([...days]),
    pbs,
    pbCount: pbs.reduce((n, p) => n + p.count, 0),
    goldCount,
    bestGold,
    mostImproved,
    categories,
  };
}

/**
 * Share of a category's PB cut this year, so categories of any length compare fairly; a first ever
 * finish ranks after any real improvement.
 */
export function pbImprovement(pb: RecapPb): number {
  return pb.before == null ? -1 : (pb.before - pb.after) / pb.before;
}

function longestStreak(days: string[]): RecapStreak | null {
  if (!days.length) return null;
  const dayNumber = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86_400_000;
  const sorted = [...days].sort();
  let best: RecapStreak = { days: 1, from: sorted[0], to: sorted[0] };
  let from = sorted[0];
  let length = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (dayNumber(sorted[i]) - dayNumber(sorted[i - 1]) === 1) length++;
    else {
      length = 1;
      from = sorted[i];
    }
    if (length > best.days) best = { days: length, from, to: sorted[i] };
  }
  return best;
}

function median(sorted: Ms[]): Ms {
  const mid = (sorted.length - 1) / 2;
  return (sorted[Math.floor(mid)] + sorted[Math.ceil(mid)]) / 2;
}
