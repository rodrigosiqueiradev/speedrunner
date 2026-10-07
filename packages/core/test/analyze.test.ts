import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeRun, parseLss, quantile, type Run } from "../src/index.js";

const small = parseLss(readFileSync(new URL("./fixtures/small.lss", import.meta.url), "utf8"));

describe("analyzeRun on a small file", () => {
  const a = analyzeRun(small, { minSamples: 1 });

  it("computes PB, sum of best and possible save", () => {
    expect(a.personalBest).toBe(180_000);
    expect(a.sumOfBest).toBe(55_000 + 68_000 + 50_000);
    expect(a.possibleTimeSave).toBe(7_000);
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

/** Builds a synthetic run: each attempt plays segments with the given base times plus noise. */
function synthRun(opts: {
  base: number[];
  noise: (segment: number, attempt: number) => number;
  resetAt?: (attempt: number) => number | undefined;
  attempts: number;
}): Run {
  const { base, noise, resetAt, attempts } = opts;
  const segments = base.map((_, i) => ({
    name: `S${i + 1}`,
    pbSplit: null as number | null,
    gold: null,
    history: new Map<number, number | null>(),
  }));
  let pb: number[] | null = null;
  for (let id = 1; id <= attempts; id++) {
    const stop = resetAt?.(id) ?? base.length;
    const times: number[] = [];
    for (let i = 0; i < stop; i++) {
      const t = base[i] + noise(i, id);
      segments[i].history.set(id, t);
      times.push(t);
    }
    if (stop === base.length) {
      const total = times.reduce((x, y) => x + y, 0);
      if (!pb || total < pb.reduce((x, y) => x + y, 0)) pb = times;
    }
  }
  let acc = 0;
  pb!.forEach((t, i) => (segments[i].pbSplit = acc += t));
  return {
    game: "Synth",
    category: "Any%",
    timingMethod: "RealTime",
    attemptCount: attempts,
    attempts: Array.from({ length: attempts }, (_, i) => ({ id: i + 1, time: null })),
    segments,
  };
}

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
