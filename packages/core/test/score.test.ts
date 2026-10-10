import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  overallScore,
  parseLss,
  referencePace,
  scoreRun,
  weakestComponent,
  type CategoryScore,
} from "../src/index.js";
import { synthRun } from "./synth.js";

const load = (name: string) =>
  parseLss(readFileSync(new URL(`./fixtures/livesplit-core/${name}`, import.meta.url), "utf8"));

describe("scoreRun on real files", () => {
  it("scores the Dishonored file as worked through in the docs", () => {
    const s = scoreRun(load("livesplit1.6_gametime.lss"));
    expect(s.efficiency.gap!).toBeCloseTo(0.0235, 3);
    expect(Math.round(s.efficiency.score!)).toBe(76);
    expect(Math.round(s.consistency.score!)).toBe(66);
    // 116 attempts reached Tr4p Haus, 30 finished; most of the rest were reset for being behind.
    // Of the 40 in the faster half at the split before it, 27 finished.
    expect(s.completion).toMatchObject({ reachedMiddle: 116, goodRuns: 40, finished: 27 });
    expect(Math.round(s.completion.score!)).toBe(68);
    expect(s.improvement.change!).toBeCloseTo(0.0141, 3);
    expect(Math.round(s.improvement.score!)).toBe(74);
    expect(s.score).toBe(72);
    expect(s.provisional).toBe(false);
    expect(weakestComponent(s)).toBe("consistency");
  });

  it("reads a World Record comparison and marks a file without finishes as provisional", () => {
    const s = scoreRun(load("livesplit1.5.lss"));
    expect(s.fileReference?.name).toBe("World Record");
    expect(s.fileReference!.time).toBeLessThan(s.personalBest!);
    expect(s.provisional).toBe(true);
    expect(s.provisionalReasons).toContain("few-finished");
  });

  it("leaves out what a file can't support and rescales the weights", () => {
    const s = scoreRun(load("livesplit1.0.lss"));
    const used = Object.values(s.weights).filter((w) => w > 0);
    expect(used.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(s.improvement.score).toBeNull();
    expect(s.provisionalReasons).toEqual(expect.arrayContaining(["few-components", "few-segments"]));
  });
});

describe("scoreRun components", () => {
  const steady = (noise: number, attempts = 60) =>
    synthRun({ base: [30_000, 60_000, 45_000, 50_000, 40_000], attempts, noise: (seg, id) => ((seg * 7 + id * 13) % 10) * noise });

  it("rewards consistent segments", () => {
    const calm = scoreRun(steady(50));
    const shaky = scoreRun(steady(2_000));
    expect(calm.consistency.score!).toBeGreaterThan(shaky.consistency.score!);
    expect(calm.consistency.score!).toBeGreaterThan(95);
  });

  it("only counts attempts that reached the middle segment for completion", () => {
    const run = synthRun({
      base: [30_000, 60_000, 45_000, 50_000, 40_000],
      attempts: 60,
      noise: () => 0,
      // Half the attempts reset in the first segment, a quarter after the middle one.
      resetAt: (id) => (id % 2 === 0 ? 0 : id % 4 === 1 ? 3 : undefined),
    });
    const s = scoreRun(run);
    expect(s.completion.reachedMiddle).toBe(30);
    expect(s.completion.rate).toBeCloseTo(0.5);
  });

  it("doesn't count runs reset for being behind pace against completion", () => {
    // Every run that's slow by the middle is reset after it, as the reset coach would say; good runs all finish.
    const paced = synthRun({
      base: [30_000, 60_000, 45_000, 50_000, 40_000],
      attempts: 60,
      noise: (seg, id) => (seg === 0 ? (id % 2) * 3_000 : 0),
      resetAt: (id) => (id % 2 === 1 ? 3 : undefined),
    });
    const s = scoreRun(paced);
    expect(s.completion).toMatchObject({ reachedMiddle: 60, goodRuns: 30, finished: 30, rate: 1 });
    // Runs on the same pace that die after the middle still count against it.
    const choking = synthRun({
      base: [30_000, 60_000, 45_000, 50_000, 40_000],
      attempts: 60,
      noise: () => 0,
      resetAt: (id) => (id % 2 === 1 ? 3 : undefined),
    });
    expect(scoreRun(choking).completion.rate).toBeCloseTo(0.5);
  });

  it("scores improvement by comparing the latest half of the finishes with the half before, up to 10", () => {
    const faster = synthRun({ base: [60_000, 60_000, 60_000, 60_000, 60_000], attempts: 20, noise: (_, id) => (id <= 10 ? 1_200 : 0) });
    const s = scoreRun(faster);
    // 6s faster on a 306s run is about 2%, so between "no change" (50) and "3% faster" (100).
    expect(s.improvement.change!).toBeCloseTo(6_000 / 306_000, 4);
    expect(s.improvement.score!).toBeGreaterThan(80);
    expect(s.improvement.window).toBe(10);
    // 9 finishes a side out of 19, and too few below 8.
    expect(scoreRun(steady(50, 19)).improvement.window).toBe(9);
    expect(scoreRun(steady(50, 7)).improvement.score).toBeNull();
  });
});

describe("referencePace", () => {
  it("compares the PB and realistic target with a reference time", () => {
    const p = referencePace({ personalBest: 100_000, realisticTarget: 95_000 }, 90_000);
    expect(p.pbPace).toBeCloseTo(0.9);
    expect(p.targetPace).toBeCloseTo(90 / 95);
  });
});

describe("overallScore", () => {
  const cat = (score: number, provisional = false) => ({ score, provisional }) as CategoryScore;

  it("averages the 5 best firm categories and leaves out provisional ones", () => {
    const o = overallScore([cat(90), cat(80), cat(70), cat(60), cat(50), cat(10), cat(99, true)]);
    expect(o.score).toBe(70);
    expect(o.counted.map((c) => c.score)).toEqual([90, 80, 70, 60, 50]);
    expect(o.provisional).toHaveLength(1);
  });

  it("has no score when every category is provisional", () => {
    expect(overallScore([cat(80, true)]).score).toBeNull();
  });
});
