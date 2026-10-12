import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeRun, liveContext, parseLss, quantile, realisticTargetSplits, type Run } from "../src/index.js";
import { synthRun } from "./synth.js";

const small = parseLss(readFileSync(new URL("./fixtures/small.lss", import.meta.url), "utf8"));

describe("analyzeRun on a small file", () => {
  const a = analyzeRun(small, { minSamples: 1 });

  it("computes PB, sum of best and possible save", () => {
    expect(a.personalBest).toBe(180_000);
    expect(a.sumOfBest).toBe(55_000 + 68_000 + 50_000);
    expect(a.possibleTimeSave).toBe(7_000);
  });

  it("has no PB when the last split has no PB time, as in LiveSplit", () => {
    // A split added after the PB: LiveSplit leaves its PB time empty and shows no PB.
    const added = { ...small, segments: [...small.segments, { ...small.segments.at(-1)!, name: "New", pbSplit: null, history: new Map() }] };
    const b = analyzeRun(added, { minSamples: 1 });
    expect(b.personalBest).toBeNull();
    expect(b.realisticTarget).toBeNull();
  });

  it("ignores segment times that include a skipped split", () => {
    // Attempt 4 skipped Level 1, so its 2:15.5 for Level 2 covers both levels.
    expect(a.segments[1].samples).toBe(2);
    expect(a.segments[1].median).toBe(71_000);
  });

  it("counts resets per segment", () => {
    expect(a.segments[0]).toMatchObject({ reached: 4, resets: 0 });
    // Attempt 2 finished Level 1 but never reached the end of Level 2.
    expect(a.segments[1]).toMatchObject({ reached: 4, resets: 1 });
    expect(a.finishedAttempts).toBe(3);
  });

  it("ranks the segments with the most time to give back", () => {
    expect(a.segments.map((s) => s.timeSaveVsGold)).toEqual([5_000, 2_000, 0]);
    expect(a.biggestOpportunities[0].name).toBe("Level 1");
  });
});

describe("realistic target with a skipped PB split", () => {
  // The same rule for a 4 minute and a 2 hour run: the stretch is compared as one piece.
  for (const [label, scale] of [["short", 1], ["multi-hour", 30]] as const) {
    it(`compares the stretch around the skipped split as one piece (${label})`, () => {
      const full = synthRun({
        base: [60_000, 120_000, 90_000].map((t) => t * scale),
        noise: (i, id) => Math.round((((id * 7919 + i * 104_729) % 997) / 997) * 0.1 * 60_000 * scale),
        attempts: 60,
      });
      const skipped: Run = { ...full, segments: full.segments.map((s, i) => (i === 1 ? { ...s, pbSplit: null } : s)) };
      const f = analyzeRun(full);
      const a = analyzeRun(skipped);

      expect(a.personalBest).toBe(f.personalBest);
      expect(a.segments[1].pbTime).toBeNull();
      expect(a.segments[2].pbTime).toBeNull();
      const stretchPb = f.segments[1].pbTime! + f.segments[2].pbTime!;
      expect(a.skippedPbStretches).toEqual([
        { from: 1, to: 2, pbTime: stretchPb, realisticTimeSave: Math.max(0, stretchPb - f.segments[1].p25! - f.segments[2].p25!) },
      ]);
      expect(a.realisticTarget).toBe(a.personalBest! - a.segments[0].realisticTimeSave! - a.skippedPbStretches[0].realisticTimeSave!);
      // Knowing less about the PB never makes the target more ambitious.
      expect(a.realisticTarget!).toBeGreaterThanOrEqual(f.realisticTarget!);

      const splits = realisticTargetSplits(a)!;
      expect(splits).toHaveLength(3);
      expect(splits.at(-1)).toBe(a.realisticTarget);
      expect(splits[0]).toBe(realisticTargetSplits(f)![0]);
      expect(splits[1]).toBeGreaterThan(splits[0]);
      expect(liveContext(skipped, null, a).goal).toMatchObject({ kind: "realistic", time: a.realisticTarget });
    });
  }

  it("treats a skipped first split the same way", () => {
    const full = synthRun({ base: [30_000, 40_000], noise: (i, id) => (id * 31 + i * 17) % 3_000, attempts: 30 });
    const a = analyzeRun({ ...full, segments: full.segments.map((s, i) => (i === 0 ? { ...s, pbSplit: null } : s)) });
    expect(a.skippedPbStretches).toMatchObject([{ from: 0, to: 1, pbTime: a.personalBest }]);
    expect(a.realisticTarget).not.toBeNull();
  });

  const OOT = "/mnt/project-files/reference-splits/oot-100-glitchless-smaugy.lss";
  // Reference files stay outside the repo and are never committed.
  it.skipIf(!existsSync(OOT))("gives OoT 100% Glitchless, which has skipped PB splits, a target", () => {
    const a = analyzeRun(parseLss(readFileSync(OOT, "utf8")));
    expect(a.skippedPbStretches.length).toBeGreaterThan(0);
    expect(a.realisticTarget!).toBeLessThan(a.personalBest!);
    expect(a.realisticTarget!).toBeGreaterThanOrEqual(a.sumOfBest!);
    expect(realisticTargetSplits(a)!.at(-1)).toBe(a.realisticTarget);
  });
});

describe("advice", () => {
  // Deterministic pseudo-random noise in [0, 1).
  const rand = (a: number, b: number) => {
    const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  it("flags an inconsistent segment and a segment that kills runs", () => {
    const run = synthRun({
      base: [30_000, 60_000, 45_000],
      attempts: 100,
      // S2 swings by up to 20s, the others by under a second.
      noise: (seg, id) => (seg === 1 ? rand(seg, id) * 20_000 : rand(seg, id) * 800),
      // A third of attempts reset in S3.
      resetAt: (id) => (id % 3 === 0 ? 2 : undefined),
    });
    const a = analyzeRun(run);
    const kinds = (name: string) => a.advice.filter((x) => x.segmentName === name).map((x) => x.kind);

    expect(kinds("S2")).toContain("inconsistent");
    expect(kinds("S1")).not.toContain("inconsistent");
    expect(kinds("S3")).toContain("run-killer");
    expect(a.segments[2].resetRate).toBeCloseTo(33 / 100, 1);
    expect(a.realisticTarget!).toBeLessThanOrEqual(a.personalBest!);
    expect(a.realisticTarget!).toBeGreaterThanOrEqual(a.sumOfBest!);
  });

  it("only calls a segment a run killer when runs going well die there", () => {
    const shape = (resetSlowOnly: boolean) =>
      synthRun({
        base: [30_000, 60_000, 45_000, 50_000],
        attempts: 120,
        noise: (seg, id) => rand(seg, id) * 800 + (seg === 1 && id % 2 ? 4_000 : 0),
        // A fifth of the attempts reset at the start (bad starts). Of the rest, half are 4 s behind by
        // split 2; either those all reset in S3, or a third of all runs do, good and bad alike.
        resetAt: (id) => (id % 5 === 0 ? 0 : (resetSlowOnly ? id % 2 === 1 : id % 3 === 0) ? 2 : undefined),
      });
    const killers = (run: Run) => analyzeRun(run).advice.filter((x) => x.kind === "run-killer").map((x) => x.segmentName);
    // Resetting runs that are behind pace is a choice, not a deadly segment; nor are bad starts.
    const paceResets = analyzeRun(shape(true));
    expect(paceResets.segments[2].resetRate!).toBeGreaterThanOrEqual(0.5);
    expect(paceResets.segments[2].goodRunResetRate).toBe(0);
    expect(paceResets.segments[0].goodRunResetRate).toBeNull();
    expect(killers(shape(true))).toEqual([]);
    // Good runs dying there is.
    expect(killers(shape(false))).toEqual(["S3"]);
  });

  it("orders advice by estimated time save", () => {
    const run = synthRun({
      base: [30_000, 60_000],
      attempts: 40,
      noise: (seg, id) => rand(seg, id) * (seg === 0 ? 2_000 : 15_000),
    });
    const saves = analyzeRun(run).advice.map((x) => x.estimatedSave);
    expect(saves).toEqual([...saves].sort((x, y) => y - x));
  });
});

describe("mis-splits", () => {
  it("ignores implausibly fast segment times and a bogus stored gold", () => {
    const run = synthRun({ base: [60_000, 60_000], attempts: 20, noise: (seg, id) => (id % 7) * 500 });
    // Attempt 5 double-split: S1 took 0.4s. LiveSplit saved it as the gold.
    run.segments[0].history.set(5, 400);
    run.segments[0].gold = 400;
    const s1 = analyzeRun(run).segments[0];
    expect(s1.suspiciousGold).toBe(true);
    expect(s1.discardedSamples).toBe(1);
    expect(s1.gold).toBe(60_000);
  });
});

describe("quantile", () => {
  it("interpolates", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(3); // 2.5 rounded
    expect(quantile([10], 0.25)).toBe(10);
  });
});
