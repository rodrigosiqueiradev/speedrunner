import { analyzeRun, type RunAnalysis } from "./analyze.js";
import { realisticTargetSplits } from "./comparisons.js";
import { planGoal, type GoalStatus } from "./goal.js";
import { pbChanceFrom, resetAdvice, type PbOdds, type ResetAdvice } from "./pb-odds.js";
import { recentSlice } from "./recency.js";
import type { Ms, Run } from "./types.js";

/**
 * Live stats: what a run in progress looks like next to the runner's own history. Everything here
 * reads the timer, it never drives it, and every number compares the run with the runner's own
 * times, so it reads the same in a 10 minute category and a 6 hour one.
 */

/** LiveSplit's timer phases, as its server names them. */
export type TimerPhase = "NotRunning" | "Running" | "Paused" | "Ended";

/** The timer as a live feed reports it: LiveSplit's server, or a replay of an old attempt. */
export interface TimerSnapshot {
  phase: TimerPhase;
  /** Index of the segment being played: 0 before the first split, the segment count once ended, -1 when not running. */
  splitIndex: number;
  /** Time on the timer, or null when it isn't known. */
  currentTime: Ms | null;
  /**
   * Cumulative time at each split done so far in this attempt (length = splitIndex). Null for a
   * skipped split or one the feed didn't see (it connected mid-run, say).
   */
  splitTimes: Array<Ms | null>;
}

export const IDLE_SNAPSHOT: TimerSnapshot = { phase: "NotRunning", splitIndex: -1, currentTime: null, splitTimes: [] };

/** Everything about the run that doesn't change during an attempt, worked out once. */
export interface LiveContext {
  run: Run;
  analysis: RunAnalysis;
  odds: PbOdds | null;
  personalBest: Ms | null;
  /** Per segment: your usual time (recent median), gold, PB segment, and how often good runs end in it. */
  typical: Array<Ms | null>;
  gold: Array<Ms | null>;
  pbSegment: Array<Ms | null>;
  endsRuns: Array<number | null>;
  /** Sum of `typical` / `gold` from each segment to the end (index n is 0). Null if any is missing. */
  typicalFrom: Array<Ms | null>;
  goldFrom: Array<Ms | null>;
  /**
   * What "vs goal" compares with: the goal planner's cumulative splits for your goal, or your
   * realistic target's splits when you haven't set one. Null when neither exists.
   */
  goal: LiveGoal | null;
}

export type LiveGoal =
  | { kind: "goal"; time: Ms; status: GoalStatus; splits: Ms[] | null }
  | { kind: "realistic"; time: Ms; splits: Ms[] };

export function liveContext(
  run: Run,
  odds: PbOdds | null,
  analysis: RunAnalysis = analyzeRun(run),
  goal: Ms | null = null,
): LiveContext {
  const seg = analysis.segments;
  const typical = seg.map((s) => s.median ?? s.pbTime);
  const gold = seg.map((s) => s.gold);
  const suffix = (xs: Array<Ms | null>) => {
    const out: Array<Ms | null> = new Array(xs.length + 1).fill(null);
    out[xs.length] = 0;
    for (let i = xs.length - 1; i >= 0; i--) out[i] = xs[i] == null || out[i + 1] == null ? null : xs[i]! + out[i + 1]!;
    return out;
  };
  return {
    run,
    analysis,
    odds,
    personalBest: analysis.personalBest,
    typical,
    gold,
    pbSegment: seg.map((s) => s.pbTime),
    endsRuns: seg.map((s) => s.goodRunResetRate ?? s.resetRate),
    typicalFrom: suffix(typical),
    goldFrom: suffix(gold),
    goal: liveGoal(run, analysis, goal),
  };
}

function liveGoal(run: Run, analysis: RunAnalysis, time: Ms | null): LiveGoal | null {
  if (time != null) {
    const plan = planGoal(run, time, {}, analysis);
    return { kind: "goal", time, status: plan.status, splits: plan.splits };
  }
  const splits = realisticTargetSplits(analysis);
  return splits && analysis.realisticTarget != null ? { kind: "realistic", time: analysis.realisticTarget, splits } : null;
}

export interface LiveSplitResult {
  index: number;
  name: string;
  /** Cumulative time at the split. */
  time: Ms;
  /** Ahead (negative) or behind (positive) your PB's time at this split, or null if the PB skipped it. */
  vsPb: Ms | null;
  /** The same against the goal planner's split for your goal, or null without a plan for it. */
  vsGoal: Ms | null;
  /** The segment's own time, when the split before it is known too. */
  segmentTime: Ms | null;
  /** Segment time minus your usual time for it, and the same as a share of your usual. */
  vsTypical: Ms | null;
  vsTypicalShare: number | null;
  /** True when the segment beat your best ever time for it. */
  gold: boolean;
}

/** A segment of the run with your usual time, gold, PB time, and how often good runs end in it. */
export interface SegmentView {
  index: number;
  name: string;
  typical: Ms | null;
  gold: Ms | null;
  pb: Ms | null;
  endsRuns: number | null;
}

export interface LiveStats {
  phase: TimerPhase;
  segmentCount: number;
  /** The segment being played (null before the run starts or after it ends). */
  current: SegmentView | null;
  /** The segment after the one being played, or the first one before the run starts. */
  next: SegmentView | null;
  currentTime: Ms | null;
  /** The latest split with a time, or null before the first one. */
  lastSplit: LiveSplitResult | null;
  /** Chance this run still beats your PB, and what it was one split earlier. Null without PB odds. */
  pbChance: number | null;
  pbChanceBefore: number | null;
  /** Keep going or reset, from the PB odds reset rules. Only between the first and last split. */
  advice: ResetAdvice | null;
  /** Where the run ends if every segment left goes at your usual pace, and at your golds. */
  likelyFinish: Ms | null;
  bestPossible: Ms | null;
  /** Segments in this attempt that beat their gold. */
  golds: number;
  /** What "vs goal" compares with (see LiveContext). */
  goal: LiveGoal | null;
}

/**
 * Live stats for one timer snapshot. With the session, a finished run is a PB only if it also beat
 * the session's earlier PBs, since the file's PB is out of date after one.
 */
export function liveStats(ctx: LiveContext, snap: TimerSnapshot, session?: LiveSession): LiveStats {
  const n = ctx.run.segments.length;
  const running = snap.phase === "Running" || snap.phase === "Paused";
  const splits = snap.splitTimes.slice(0, Math.max(0, Math.min(n, snap.splitIndex)));

  const goalSplits = ctx.goal?.splits;
  let last: LiveSplitResult | null = null;
  let golds = 0;
  splits.forEach((time, i) => {
    if (time == null) return;
    const before = i === 0 ? 0 : splits[i - 1];
    const segmentTime = before == null ? null : time - before;
    const typical = ctx.typical[i];
    const gold = ctx.gold[i];
    const isGold = segmentTime != null && gold != null && segmentTime < gold;
    if (isGold) golds++;
    const pbSplit = ctx.run.segments[i].pbSplit;
    last = {
      index: i,
      name: ctx.run.segments[i].name,
      time,
      vsPb: pbSplit == null ? null : time - pbSplit,
      vsGoal: goalSplits?.[i] == null ? null : time - goalSplits[i],
      segmentTime,
      vsTypical: segmentTime != null && typical != null ? segmentTime - typical : null,
      vsTypicalShare: segmentTime != null && typical ? (segmentTime - typical) / typical : null,
      gold: isGold,
    };
  });
  const lastSplit = last as LiveSplitResult | null;

  const ci = running && snap.splitIndex >= 0 && snap.splitIndex < n ? snap.splitIndex : null;
  const segment = (i: number): SegmentView => ({
    index: i,
    name: ctx.run.segments[i].name,
    typical: ctx.typical[i],
    gold: ctx.gold[i],
    pb: ctx.pbSegment[i],
    endsRuns: ctx.endsRuns[i],
  });
  const current = ci == null ? null : segment(ci);
  const nextIndex = snap.phase === "NotRunning" ? 0 : ci == null ? null : ci + 1;
  const next = nextIndex != null && nextIndex < n ? segment(nextIndex) : null;

  // The chance at a split; -1 is the start of the run.
  const chanceAt = (i: number, time: Ms | null): number | null => {
    const odds = ctx.odds;
    if (!odds) return null;
    if (i < 0) return odds.ifFinished * odds.survival[0];
    if (time == null) return null;
    return pbChanceFrom(odds, i, time);
  };

  let pbChance: number | null = null;
  let pbChanceBefore: number | null = null;
  let advice: ResetAdvice | null = null;
  if (snap.phase === "Ended") {
    const final = splits[n - 1];
    pbChance = final != null && ctx.odds ? (final < ctx.odds.target && (!session?.pbs || session.lastFinishPb) ? 1 : 0) : null;
  } else if (running) {
    const at = lastSplit?.index ?? -1;
    pbChance = chanceAt(at, lastSplit?.time ?? null);
    const prev = at - 1;
    pbChanceBefore = at < 0 ? null : chanceAt(prev, prev < 0 ? null : splits[prev]);
    if (ctx.odds && lastSplit && lastSplit.index < n - 1) advice = resetAdvice(ctx.odds, lastSplit.index, lastSplit.time);
  }

  // Projections from the last known split, never earlier than the time already on the timer.
  let likelyFinish: Ms | null = null;
  let bestPossible: Ms | null = null;
  if (snap.phase === "Ended") {
    likelyFinish = bestPossible = splits[n - 1] ?? snap.currentTime;
  } else if (running) {
    const from = lastSplit ? lastSplit.index + 1 : 0;
    const base = lastSplit?.time ?? 0;
    const project = (perSegment: Array<Ms | null>, suffix: Array<Ms | null>) => {
      if (suffix[from] == null) return null;
      // A segment already running longer than the projection for it counts as finishing now.
      const throughCurrent = base + (from < n ? perSegment[from]! : 0);
      const now = snap.currentTime ?? 0;
      const afterCurrent = from < n ? suffix[from + 1]! : 0;
      return from === ci && now > throughCurrent ? now + afterCurrent : base + suffix[from]!;
    };
    likelyFinish = project(ctx.typical, ctx.typicalFrom);
    bestPossible = project(ctx.gold, ctx.goldFrom);
  }

  return {
    phase: snap.phase,
    segmentCount: n,
    current,
    next,
    currentTime: snap.currentTime,
    lastSplit,
    pbChance,
    pbChanceBefore,
    advice,
    likelyFinish,
    bestPossible,
    golds,
    goal: ctx.goal,
  };
}

/** What happened in the attempts seen since the feed connected. */
export interface LiveSession {
  attempts: number;
  finished: number;
  pbs: number;
  /** Fastest finish this session, if any. */
  best: Ms | null;
  /** Whether the latest finish beat both the file's PB and every earlier finish this session. */
  lastFinishPb: boolean;
}

export const EMPTY_SESSION: LiveSession = { attempts: 0, finished: 0, pbs: 0, best: null, lastFinishPb: false };

/**
 * Updates the session when the timer moves from `prev` to `next`. A PB this session becomes the
 * time to beat for the rest of it, so a later finish between the two isn't counted as another PB.
 */
export function trackSession(session: LiveSession, prev: TimerSnapshot, next: TimerSnapshot, personalBest: Ms | null): LiveSession {
  let s = session;
  const wasIdle = prev.phase === "NotRunning" || prev.phase === "Ended";
  const wasRunning = prev.phase === "Running" || prev.phase === "Paused";
  const isRunning = next.phase === "Running" || next.phase === "Paused";
  // A reset and a new start between two reads of the timer: the time goes back without an undo.
  // Undoing a split keeps the time, and a timer only runs backwards when it starts again.
  const restarted =
    wasRunning &&
    isRunning &&
    prev.currentTime != null &&
    next.currentTime != null &&
    next.currentTime < prev.currentTime &&
    next.splitIndex <= prev.splitIndex;
  if ((wasIdle && isRunning) || restarted) s = { ...s, attempts: s.attempts + 1 };
  if (prev.phase !== "Ended" && next.phase === "Ended") {
    const final = next.splitTimes[next.splitTimes.length - 1] ?? next.currentTime;
    const toBeat = personalBest == null ? null : Math.min(personalBest, s.best ?? Infinity);
    const pb = final != null && toBeat != null && final < toBeat;
    s = {
      ...s,
      // A run that ended before the feed saw it start still counts as an attempt.
      attempts: Math.max(s.attempts, s.finished + 1),
      finished: s.finished + 1,
      pbs: s.pbs + (pb ? 1 : 0),
      best: final == null ? s.best : s.best == null ? final : Math.min(s.best, final),
      lastFinishPb: pb,
    };
  }
  return s;
}

/**
 * Reads a time as LiveSplit's server writes it: "1:23:45.6700000", "23:45.67", "45.67", with an
 * optional minus sign or day count. "-" or anything unreadable is null.
 */
export function parseClock(raw: string): Ms | null {
  const text = raw.trim().replace(/^[−–]/, "-");
  const m = /^(-)?(?:(\d+)\.(?=\d+:\d+:))?(?:(\d+):)?(?:(\d+):)?(\d+(?:[.,]\d+)?)$/.exec(text);
  if (!m) return null;
  const [, sign, days, a, b, sec] = m;
  // With one colon part it's minutes; with two, hours and minutes.
  const hours = b != null ? Number(a) : 0;
  const minutes = b != null ? Number(b) : a != null ? Number(a) : 0;
  const ms = ((Number(days ?? 0) * 24 + hours) * 60 + minutes) * 60_000 + Math.round(Number(sec.replace(",", ".")) * 1000);
  return sign ? -ms : ms;
}

/** One past attempt, laid out so a demo feed can replay it as if it were happening now. */
export interface Replay {
  attemptId: number;
  /** When each split happens, on the timer. Skipped splits happen with the next one. */
  splitAt: Ms[];
  /** The time each split records: null where the attempt skipped it. */
  splitTimes: Array<Ms | null>;
  /** When the attempt was reset, or null if it finished. */
  resetAt: Ms | null;
}

/** Recent attempts that reached at least the first split: the ones worth replaying in a demo. */
export function replayableAttempts(run: Run): number[] {
  const first = run.segments[0];
  if (!first) return [];
  const ids = run.attempts.map((a) => a.id).filter((id) => id > 0 && first.history.has(id));
  return recentSlice(ids);
}

/** Lays out an attempt from the file for replay. */
export function replayAttempt(run: Run, attemptId: number, ctx?: LiveContext): Replay {
  const splitAt: Ms[] = [];
  const splitTimes: Array<Ms | null> = [];
  let acc = 0;
  let pending = 0;
  for (const segment of run.segments) {
    if (!segment.history.has(attemptId)) break;
    const t = segment.history.get(attemptId);
    if (t == null) {
      splitTimes.push(null);
      pending++;
      continue;
    }
    acc += t;
    for (; pending > 0; pending--) splitAt.push(acc);
    splitAt.push(acc);
    splitTimes.push(acc);
  }
  // Trailing skipped splits with nothing after them: drop them, the attempt ended there.
  splitTimes.length = splitAt.length;
  const finished = splitAt.length === run.segments.length;
  // A reset comes partway into the segment it ended in: half your usual time for it.
  const next = splitAt.length;
  const usual = ctx?.typical[next] ?? run.segments[next]?.gold ?? null;
  const resetAt = finished ? null : acc + Math.max(1000, (usual ?? 2000) / 2);
  return { attemptId, splitAt, splitTimes, resetAt };
}

/** The timer of a replay `elapsed` ms after it started. */
export function replaySnapshot(replay: Replay, elapsed: Ms): TimerSnapshot {
  if (replay.resetAt != null && elapsed >= replay.resetAt) return IDLE_SNAPSHOT;
  let index = 0;
  while (index < replay.splitAt.length && replay.splitAt[index] <= elapsed) index++;
  const ended = replay.resetAt == null && index === replay.splitAt.length;
  const splitTimes = replay.splitTimes.slice(0, index);
  return {
    phase: ended ? "Ended" : "Running",
    splitIndex: index,
    currentTime: ended ? replay.splitAt[index - 1] : elapsed,
    splitTimes,
  };
}

/** How long a replay runs on the timer: to its reset or its last split. */
export function replayLength(replay: Replay): Ms {
  return replay.resetAt ?? replay.splitAt[replay.splitAt.length - 1] ?? 0;
}
