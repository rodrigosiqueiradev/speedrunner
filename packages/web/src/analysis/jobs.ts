import {
  analyzeRun,
  analyzeSessions,
  hasGameTime,
  markLuck,
  parseLss,
  pbOdds,
  scoreRun,
  suggestLuckSegments,
  type CategoryScore,
  type LuckSuggestion,
  type PbOdds,
  type Run,
  type RunAnalysis,
  type SessionInsights,
  type TimingMethod,
} from "@speedrunner/core";
import type { LuckMarks } from "../luckMarks";
import { categoryKey } from "../profile";

/**
 * The work that reads and analyses split files. It runs in a web worker (./background.ts), so a file
 * with tens of thousands of attempts doesn't freeze the window, and it only takes and returns plain
 * data. Nothing here may touch the page, local storage or React.
 */

export interface RunPageInput {
  xml: string;
  /** The clock chosen on the run page; null reads the file's own. */
  timing: TimingMethod | null;
  luckMarks: LuckMarks;
}

export interface RunPage {
  run: Run;
  analysis: RunAnalysis;
  score: CategoryScore;
  odds: PbOdds | null;
  sessions: SessionInsights;
  luckSuggestions: LuckSuggestion[];
  hasGameTime: boolean;
}

export type Failed = { error: true };

// Reading the file and the parts that don't depend on luck marks (sessions take seconds on files
// with tens of thousands of attempts) run once per file, not again on every luck mark.
let lastBase: { xml: string; timing: TimingMethod | null; base: Omit<RunPage, "run" | "analysis" | "score" | "odds"> & { parsed: Run } } | null =
  null;

/** Everything the run page shows for a split file. */
export function runPage({ xml, timing, luckMarks }: RunPageInput): RunPage | Failed {
  try {
    if (lastBase?.xml !== xml || lastBase.timing !== timing) {
      lastBase = null;
      const parsed = parseLss(xml, timing ? { timingMethod: timing } : {});
      lastBase = {
        xml,
        timing,
        base: { parsed, luckSuggestions: suggestLuckSegments(parsed), sessions: analyzeSessions(parsed), hasGameTime: hasGameTime(xml) },
      };
    }
    const { parsed, ...rest } = lastBase.base;
    const run = markLuck(parsed, luckMarks[categoryKey(parsed)] ?? []);
    const analysis = analyzeRun(run);
    return { ...rest, run, analysis, score: scoreRun(run, analysis), odds: pbOdds(run) };
  } catch {
    return { error: true };
  }
}

export interface LiveReadInput {
  xml: string;
  /** The clock to read, or null for the file's own (a file without game times). */
  timing: TimingMethod | null;
  luckMarks: LuckMarks;
}

export interface LiveRead {
  run: Run;
  category: string;
  odds: PbOdds | null;
  analysis: RunAnalysis;
}

/** What the live page needs from its split file. */
export function liveRead({ xml, timing, luckMarks }: LiveReadInput): LiveRead | Failed {
  try {
    const plain = parseLss(xml, timing ? { timingMethod: timing } : {});
    const category = categoryKey(plain);
    const run = markLuck(plain, luckMarks[category] ?? []);
    return { run, category, odds: pbOdds(run), analysis: analyzeRun(run) };
  } catch {
    return { error: true };
  }
}

export interface ProfileScoreInput {
  xml: string;
  /**
   * The clock to score with. "kept" keeps the one the profile already uses for this category, when
   * the file has game times; null reads the file's own.
   */
  timing: TimingMethod | null | { kept: Record<string, TimingMethod> };
  luckMarks: LuckMarks;
}

/** A split file's score for the profile, with the luck marks saved for its category; null if it isn't a split file. */
export function profileScore({ xml, timing, luckMarks }: ProfileScoreInput): CategoryScore | null {
  try {
    let method: TimingMethod | null;
    if (timing && typeof timing === "object") {
      // A file replacing one in the profile keeps the timing method chosen for that category.
      const run = parseLss(xml);
      const before = timing.kept[categoryKey(run)];
      method = before && before !== run.timingMethod && hasGameTime(xml) ? before : null;
    } else method = timing && hasGameTime(xml) ? timing : null;
    const run = parseLss(xml, method ? { timingMethod: method } : {});
    return scoreRun(markLuck(run, luckMarks[categoryKey(run)] ?? []));
  } catch {
    return null;
  }
}

/** Reads a split file with the given clock where it has times for it; null if it isn't a split file. */
export function readRun({ xml, timingMethod }: { xml: string; timingMethod?: TimingMethod }): Run | null {
  try {
    return parseLss(xml, timingMethod && hasGameTime(xml) ? { timingMethod } : {});
  } catch {
    return null;
  }
}

/** What the live page matches LiveSplit's open splits by. */
export interface SplitsFingerprint {
  rawNames: string[];
  attempts: number;
  completed: number;
}

/** A split file's segment names and attempt counts; null if it isn't a split file. */
export function splitsFingerprint(xml: string): SplitsFingerprint | null {
  const run = readRun({ xml });
  return run && {
    rawNames: run.segments.map((s) => s.rawName),
    attempts: run.attemptCount,
    completed: run.attempts.filter((a) => a.time != null).length,
  };
}

export const JOBS = { runPage, liveRead, profileScore, readRun, splitsFingerprint };
export type Jobs = typeof JOBS;
export type JobName = keyof Jobs;
