import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EMPTY_SESSION,
  analyzeRun,
  planGoal,
  realisticTargetSplits,
  IDLE_SNAPSHOT,
  liveContext,
  liveStats,
  parseClock,
  parseLss,
  pbOdds,
  replayAttempt,
  replayLength,
  replaySnapshot,
  replayableAttempts,
  trackSession,
  type LiveSession,
  type Ms,
  type Run,
  type TimerSnapshot,
} from "../src/index.js";
import { synthRun } from "./synth.js";

const fixture = (name: string) =>
  parseLss(readFileSync(new URL(`./fixtures/livesplit-core/${name}`, import.meta.url), "utf8"));

// Smaugy's Twilight Princess file is kept outside the repo and must never be committed.
const REFERENCE = "/mnt/project-files/reference-splits/twilight-princess-jp-glitchless-any-smaugy.lss";

const jitter = (seg: number, id: number) => {
  let h = Math.imul(seg * 7919 + id, 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) / 0xffffffff) * 2 - 1;
};

function scaled(run: Run, k: number): Run {
  return {
    ...run,
    attempts: run.attempts.map((a) => ({ ...a, time: a.time == null ? null : a.time * k })),
    segments: run.segments.map((s) => ({
      ...s,
      pbSplit: s.pbSplit == null ? null : s.pbSplit * k,
      gold: s.gold == null ? null : s.gold * k,
      history: new Map([...s.history].map(([id, t]) => [id, t == null ? null : t * k])),
    })),
  };
}

const short = synthRun({
  base: [60_000, 90_000, 75_000, 80_000, 70_000, 85_000, 65_000, 75_000],
  attempts: 200,
  noise: (seg, id) => (seg === 2 ? 12_000 : 1_500) * jitter(seg, id) - id * 15,
  resetAt: (id) => (id % 9 === 0 ? 0 : id % 5 === 0 ? 5 : undefined),
});

const at = (splitTimes: number[], currentTime: number): TimerSnapshot => ({
  phase: "Running",
  splitIndex: splitTimes.length,
  currentTime,
  splitTimes,
});

describe("parseClock", () => {
  it("reads the times LiveSplit's server sends", () => {
    expect(parseClock("1:23:45.6700000")).toBe(5_025_670);
    expect(parseClock("00:01:02.5")).toBe(62_500);
    expect(parseClock("23:45.67")).toBe(1_425_670);
    expect(parseClock("45.67")).toBe(45_670);
    expect(parseClock("−0:01.50")).toBe(-1_500);
    expect(parseClock("1.02:00:00")).toBe(26 * 3_600_000);
    expect(parseClock("-")).toBeNull();
    expect(parseClock("")).toBeNull();
  });
});

describe("liveStats", () => {
  const ctx = liveContext(short, pbOdds(short, { simulations: 2000 }));
  const pb = short.segments.map((s) => s.pbSplit!);

  it("shows nothing about a run before it starts", () => {
    const s = liveStats(ctx, IDLE_SNAPSHOT);
    expect(s.current).toBeNull();
    expect(s.lastSplit).toBeNull();
    expect(s.pbChance).toBeNull();
    expect(s.likelyFinish).toBeNull();
  });

  it("follows a run split by split", () => {
    const start = liveStats(ctx, at([], 1000));
    expect(start.current!.index).toBe(0);
    expect(start.pbChance!).toBeGreaterThan(0);
    expect(start.likelyFinish).toBe(ctx.typicalFrom[0]);

    // Two seconds ahead of PB at the third split.
    const ahead = liveStats(ctx, at([pb[0], pb[1], pb[2] - 2000], pb[2]));
    expect(ahead.lastSplit!.vsPb).toBe(-2000);
    expect(ahead.lastSplit!.index).toBe(2);
    expect(ahead.current!.name).toBe("S4");
    expect(ahead.advice).not.toBeNull();
    // Far behind: worse odds than ahead, and the arrow points down from the split before.
    const behind = liveStats(ctx, at([pb[0], pb[1], pb[2] + 60_000], pb[2] + 61_000));
    expect(behind.pbChance!).toBeLessThan(ahead.pbChance!);
    expect(behind.pbChance!).toBeLessThan(behind.pbChanceBefore!);
    expect(behind.advice!.verdict).toBe("reset");
    expect(behind.likelyFinish!).toBeGreaterThan(ahead.likelyFinish!);
    expect(behind.bestPossible!).toBeLessThanOrEqual(behind.likelyFinish!);
  });

  it("counts golds and keeps projections at or past the timer", () => {
    const gold0 = ctx.gold[0]!;
    const s = liveStats(ctx, at([gold0 - 500], gold0 + 10 * 60_000));
    expect(s.golds).toBe(1);
    expect(s.lastSplit!.gold).toBe(true);
    // The segment has run far past both its usual and its gold: both projections start from now.
    expect(s.likelyFinish).toBe(gold0 + 10 * 60_000 + ctx.typicalFrom[2]!);
    expect(s.bestPossible).toBe(gold0 + 10 * 60_000 + ctx.goldFrom[2]!);
  });

  it("says whether a finished run beat the PB", () => {
    const fast = pb.map((t) => t - 1000);
    const s = liveStats(ctx, { phase: "Ended", splitIndex: pb.length, currentTime: fast.at(-1)!, splitTimes: fast });
    expect(s.pbChance).toBe(1);
    expect(s.current).toBeNull();
    // After a faster PB earlier in the session, the same finish isn't a PB.
    const after: LiveSession = { attempts: 2, finished: 2, pbs: 1, best: pb.at(-1)! - 5000, lastFinishPb: false };
    expect(liveStats(ctx, { phase: "Ended", splitIndex: pb.length, currentTime: fast.at(-1)!, splitTimes: fast }, after).pbChance).toBe(0);
  });

  it("gives the same answers for a 10 minute and a 6 hour category", () => {
    const k = 36;
    const long = scaled(short, k);
    const lctx = liveContext(long, pbOdds(long, { simulations: 2000 }));
    const splits = [pb[0] + 500, pb[1] + 3000, pb[2] - 800];
    const a = liveStats(ctx, at(splits, splits[2] + 5000));
    const b = liveStats(lctx, at(splits.map((t) => t * k), (splits[2] + 5000) * k));
    expect(b.pbChance!).toBeCloseTo(a.pbChance!, 2);
    expect(b.advice!.verdict).toBe(a.advice!.verdict);
    expect(b.lastSplit!.vsTypicalShare!).toBeCloseTo(a.lastSplit!.vsTypicalShare!, 4);
    expect(b.likelyFinish! / k / a.likelyFinish!).toBeCloseTo(1, 4);
  });
});

describe("up next and vs goal", () => {
  const ctx = liveContext(short, pbOdds(short, { simulations: 1000 }));
  const pb = short.segments.map((s) => s.pbSplit!);

  it("shows the first segment before the run and the one after the current segment during it", () => {
    expect(liveStats(ctx, IDLE_SNAPSHOT).next?.index).toBe(0);
    const s = liveStats(ctx, at([pb[0], pb[1]], pb[1] + 1000));
    expect(s.current?.index).toBe(2);
    expect(s.next).toMatchObject({ index: 3, name: short.segments[3].name, typical: ctx.typical[3], gold: ctx.gold[3] });
    expect(s.next!.endsRuns).toBe(ctx.endsRuns[3]);
    // No segment after the last one, and none once the run ends.
    const n = pb.length;
    expect(liveStats(ctx, at(pb.slice(0, n - 1), pb[n - 2] + 1000)).next).toBeNull();
    expect(liveStats(ctx, { phase: "Ended", splitIndex: n, currentTime: pb[n - 1], splitTimes: pb }).next).toBeNull();
  });

  it("compares with the realistic target until a goal is set", () => {
    const splits = realisticTargetSplits(ctx.analysis)!;
    const s = liveStats(ctx, at([pb[0], pb[1]], pb[1] + 1000));
    expect(s.goal).toMatchObject({ kind: "realistic", time: ctx.analysis.realisticTarget });
    expect(s.lastSplit!.vsGoal).toBe(pb[1] - splits[1]);
  });

  it("compares with the goal planner's splits for a goal", () => {
    const goal = Math.round(pb.at(-1)! * 0.99);
    const gctx = liveContext(short, ctx.odds, ctx.analysis, goal);
    const plan = planGoal(short, goal, {}, ctx.analysis);
    expect(gctx.goal).toMatchObject({ kind: "goal", time: goal, status: plan.status });
    const s = liveStats(gctx, at([pb[0], pb[1]], pb[1] + 1000));
    expect(s.lastSplit!.vsGoal).toBe(pb[1] - plan.splits![1]);
    // A goal faster than every gold has no splits to compare with.
    const far = liveContext(short, ctx.odds, ctx.analysis, Math.round(pb.at(-1)! * 0.5));
    expect(far.goal).toMatchObject({ kind: "goal", splits: null });
    expect(liveStats(far, at([pb[0]], pb[0] + 1000)).lastSplit!.vsGoal).toBeNull();
  });

  it("reads the same for a 10 minute and a 6 hour category", () => {
    const k = 36;
    const long = scaled(short, k);
    const lctx = liveContext(long, pbOdds(long, { simulations: 1000 }), analyzeRun(long), Math.round(pb.at(-1)! * 0.99) * k);
    const sctx = liveContext(short, ctx.odds, ctx.analysis, Math.round(pb.at(-1)! * 0.99));
    const splits = [pb[0] + 500, pb[1] + 3000];
    const a = liveStats(sctx, at(splits, splits[1] + 1000));
    const b = liveStats(lctx, at(splits.map((t) => t * k), (splits[1] + 1000) * k));
    expect(b.lastSplit!.vsGoal! / k).toBeCloseTo(a.lastSplit!.vsGoal!, -1);
    expect(b.next!.typical! / k).toBeCloseTo(a.next!.typical!, 0);
    expect(b.next!.endsRuns).toBeCloseTo(a.next!.endsRuns!, 6);
  });

  it.skipIf(!existsSync(REFERENCE))("works on the multi-hour Twilight Princess file", () => {
    const run = parseLss(readFileSync(REFERENCE, "utf8"));
    const odds = pbOdds(run, { simulations: 500 });
    const real = liveContext(run, odds);
    expect(real.goal?.kind).toBe("realistic");
    const pbs = run.segments.map((s) => s.pbSplit);
    const mid = Math.floor(pbs.length / 2);
    const splits = pbs.slice(0, mid + 1) as number[];
    const s = liveStats(real, at(splits, splits[mid] + 60_000));
    expect(s.next?.index).toBe(mid + 2);
    expect(s.lastSplit!.vsGoal).toBeGreaterThanOrEqual(0); // the PB is never faster than the realistic target
    const goal = liveContext(run, odds, real.analysis, Math.round(real.personalBest! * 0.99));
    expect(liveStats(goal, at(splits, splits[mid] + 60_000)).lastSplit!.vsGoal).not.toBeNull();
  });
});

describe("trackSession", () => {
  it("counts attempts, finishes and PBs", () => {
    const run = at([], 0);
    let s = trackSession(EMPTY_SESSION, IDLE_SNAPSHOT, run, 100_000);
    s = trackSession(s, run, IDLE_SNAPSHOT, 100_000);
    s = trackSession(s, IDLE_SNAPSHOT, run, 100_000);
    const end: TimerSnapshot = { phase: "Ended", splitIndex: 2, currentTime: 90_000, splitTimes: [40_000, 90_000] };
    s = trackSession(s, at([40_000], 80_000), end, 100_000);
    expect(s).toEqual({ attempts: 2, finished: 1, pbs: 1, best: 90_000, lastFinishPb: true });
  });

  it("compares later finishes with a PB got earlier in the session", () => {
    const end = (t: Ms): TimerSnapshot => ({ phase: "Ended", splitIndex: 2, currentTime: t, splitTimes: [40_000, t] });
    const finish = (s: LiveSession, t: Ms) => trackSession(trackSession(s, IDLE_SNAPSHOT, at([], 0), 100_000), at([40_000], t - 1), end(t), 100_000);
    let s = finish(EMPTY_SESSION, 90_000);
    s = finish(s, 95_000);
    expect(s).toMatchObject({ finished: 2, pbs: 1, best: 90_000, lastFinishPb: false });
    s = finish(s, 89_000);
    expect(s).toMatchObject({ finished: 3, pbs: 2, best: 89_000, lastFinishPb: true });
  });

  it("counts a reset and start between two reads of the timer as a new attempt", () => {
    let s = trackSession(EMPTY_SESSION, IDLE_SNAPSHOT, at([], 1_000), 100_000);
    s = trackSession(s, at([], 1_000), at([30_000], 35_000), 100_000);
    // Reset and started again before the next read.
    s = trackSession(s, at([30_000], 35_000), at([], 200), 100_000);
    expect(s.attempts).toBe(2);
    // Undoing a split keeps the time, so it isn't a new attempt.
    s = trackSession(s, at([], 200), at([10_000], 12_000), 100_000);
    s = trackSession(s, at([10_000], 12_000), at([], 12_250), 100_000);
    expect(s.attempts).toBe(2);
  });
});

describe("replays", () => {
  it("replays a finished and a reset attempt from the Dishonored file", () => {
    const run = fixture("livesplit1.6_gametime.lss");
    const ctx = liveContext(run, pbOdds(run, { simulations: 1000 }));
    const ids = replayableAttempts(run);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    const replays = ids.map((id) => replayAttempt(run, id, ctx));
    const finished = replays.find((r) => r.resetAt == null)!;
    const reset = replays.find((r) => r.resetAt != null)!;
    expect(finished && reset).toBeTruthy();

    const end = replaySnapshot(finished, replayLength(finished));
    expect(end.phase).toBe("Ended");
    expect(end.splitTimes.length).toBe(run.segments.length);
    expect(liveStats(ctx, end).pbChance).not.toBeNull();

    const mid = replaySnapshot(reset, reset.resetAt! - 1);
    expect(mid.phase).toBe("Running");
    expect(mid.splitIndex).toBe(reset.splitAt.length);
    expect(replaySnapshot(reset, reset.resetAt!).phase).toBe("NotRunning");
    // Midway through any replay, every stat has a value.
    const half = replaySnapshot(finished, replayLength(finished) / 2);
    const s = liveStats(ctx, half);
    expect(s.lastSplit).not.toBeNull();
    expect(s.likelyFinish).not.toBeNull();
    expect(s.pbChance).not.toBeNull();
  });

  it.skipIf(!existsSync(REFERENCE))("replays the multi-hour Twilight Princess file", () => {
    const run = parseLss(readFileSync(REFERENCE, "utf8"));
    const ctx = liveContext(run, pbOdds(run, { simulations: 1000 }));
    const ids = replayableAttempts(run);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) {
      const r = replayAttempt(run, id, ctx);
      const len = replayLength(r);
      for (const f of [0.25, 0.5, 0.75, 0.999]) {
        const s = liveStats(ctx, replaySnapshot(r, len * f));
        if (s.phase === "Running" && s.lastSplit) {
          expect(s.pbChance!).toBeGreaterThanOrEqual(0);
          expect(s.pbChance!).toBeLessThanOrEqual(1);
          expect(s.likelyFinish!).toBeGreaterThanOrEqual(s.lastSplit.time);
        }
      }
    }
  });
});
