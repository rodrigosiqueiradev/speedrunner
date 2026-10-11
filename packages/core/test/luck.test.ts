import { describe, expect, it } from "vitest";
import {
  analyzeRun,
  buildFormModel,
  markLuck,
  planGoal,
  planPractice,
  runsTestZ,
  scoreRun,
  splitOutcomes,
  suggestLuckSegments,
  type Run,
} from "../src/index.js";
import { synthRun } from "./synth.js";

// Deterministic pseudo-random numbers in [0, 1).
const rand = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const jitter = (seg: number, id: number) => rand(seg, id) * 2 - 1;

/**
 * Five segments of about a minute. S3 is a boss with a bad pattern 55% of the time that costs 20 s,
 * on top of 1 s of execution noise. S4 got a new strat halfway (25 s slower before it). S5 has a
 * mistake that costs 15 s in about one attempt in twelve.
 */
function build(scale = 1): Run {
  return synthRun({
    base: [60_000, 70_000, 50_000, 65_000, 55_000].map((t) => t * scale),
    attempts: 200,
    noise: (seg, id) => {
      let t = 1_000 * jitter(seg, id);
      if (seg === 2 && rand(99, id) < 0.55) t += 20_000;
      if (seg === 3 && id <= 100) t += 25_000;
      if (seg === 4 && rand(7, id) < 0.08) t += 15_000;
      return t * scale;
    },
  });
}

describe("luck-based segments", () => {
  const run = build();

  it("splits a segment's times into a good and a bad outcome", () => {
    const times = [...run.segments[2].history.values()].map((t) => t!);
    const o = splitOutcomes(times)!;
    expect(o.goodShare).toBeGreaterThan(0.35);
    expect(o.goodShare).toBeLessThan(0.55);
    expect(o.costRatio).toBeGreaterThan(1.3);
    expect(o.separation).toBeGreaterThan(2);
    // Too few times, or one group, gives nothing.
    expect(splitOutcomes(times.slice(0, 5))).toBeNull();
    expect(splitOutcomes(Array(30).fill(50_000))).toBeNull();
  });

  it("suggests luck-shaped segments but not a strat change or a rare mistake", () => {
    expect(suggestLuckSegments(run).map((s) => s.name)).toEqual(["S3"]);
    const s = suggestLuckSegments(run)[0];
    expect(s.reason).toBe("pattern");
    expect(s.cost!).toBeGreaterThan(18_000);
    expect(s.cost!).toBeLessThan(22_000);
  });

  it("suggests a segment named RNG whatever its times", () => {
    const named: Run = { ...run, segments: run.segments.map((s, i) => (i === 0 ? { ...s, name: "Fairy RNG + bombs" } : s)) };
    expect(suggestLuckSegments(named).map((s) => [s.name, s.reason])).toEqual([
      ["Fairy RNG + bombs", "name"],
      ["S3", "pattern"],
    ]);
  });

  it("tells streaks from independent outcomes", () => {
    const alternating = Array.from({ length: 40 }, (_, i) => i % 2 === 0);
    const streak = Array.from({ length: 40 }, (_, i) => i < 20);
    expect(runsTestZ(streak)).toBeLessThan(-3);
    expect(Math.abs(runsTestZ(alternating.map((x, i) => (i % 4 < 2 ? x : !x))))).toBeLessThan(3);
  });

  it("matches marks by name, ignoring case and spaces", () => {
    const marked = markLuck(run, [" s3 "]);
    expect(marked.segments.map((s) => !!s.luck)).toEqual([false, false, true, false, false]);
    // The run passed in is left alone.
    expect(run.segments.some((s) => s.luck)).toBe(false);
  });

  it("changes nothing until a segment is marked", () => {
    const a = analyzeRun(run);
    expect(a.segments.every((s) => s.luck == null && !s.luckMarked)).toBe(true);
    expect(a.luckNeeded).toBeNull();
    expect(a.sumOfBestWithPbLuck).toBe(a.sumOfBest);
  });

  describe("once marked", () => {
    const before = analyzeRun(run);
    const marked = markLuck(run, ["S3"]);
    const a = analyzeRun(marked);
    const s = a.segments[2];

    it("describes both outcomes", () => {
      expect(s.luckMarked).toBe(true);
      expect(s.luck!.goodShare).toBeGreaterThan(0.3);
      expect(s.luck!.cost!).toBeGreaterThan(18_000);
      expect(a.luckNeeded).toEqual({ segments: 1, chance: s.luck!.goodShare });
    });

    it("measures variability within each outcome", () => {
      expect(before.segments[2].variability!).toBeGreaterThan(0.2);
      expect(s.variability!).toBeLessThan(0.05);
      const kinds = (x: typeof a) => x.advice.filter((v) => v.segmentIndex === 2).map((v) => v.kind);
      expect(kinds(before)).toContain("inconsistent");
      expect(kinds(a)).not.toContain("inconsistent");
    });

    it("only plans practice for the spread within each outcome", () => {
      const gap = (r: Run) => planPractice(r).ranking.find((x) => x.index === 2)?.gap ?? 0;
      expect(gap(run)).toBeGreaterThan(5_000);
      expect(gap(marked)).toBeLessThan(2_000);
    });

    it("compares the PB with its own luck", () => {
      // The PB had good luck here, so the plain sum of best already matches it.
      expect(s.luck!.pbOutcome).toBe("good");
      expect(a.sumOfBestWithPbLuck).toBe(a.sumOfBest);
      // A PB with bad luck here is compared with the best bad-luck time instead.
      const unlucky = withPbSegment(marked, 2, 70_500);
      const u = analyzeRun(unlucky);
      expect(u.segments[2].luck!.pbOutcome).toBe("bad");
      expect(u.sumOfBestWithPbLuck! - u.sumOfBest!).toBeGreaterThan(15_000);
      expect(scoreRun(unlucky).efficiency.gap!).toBeLessThan(scoreRun(withPbSegment(run, 2, 70_500)).efficiency.gap!);
      // And its good-day save is a good day with bad luck, not good luck.
      expect(u.segments[2].realisticTimeSave!).toBeLessThan(2_000);
    });

    it("tags goal targets that need good luck", () => {
      const unlucky = withPbSegment(marked, 2, 70_500);
      const plan = planGoal(unlucky, analyzeRun(unlucky).personalBest! - 15_000);
      expect(plan.segments[2].needsLuck).toBe(true);
      expect(plan.segments.filter((x) => x.index !== 2).every((x) => !x.needsLuck)).toBe(true);
    });

    it("leaves luck out of each attempt's form", () => {
      const plain = buildFormModel(run)!;
      const lucky = buildFormModel(marked)!;
      expect(lucky.segments[2].luck).toBe(true);
      expect(plain.segments[2].luck).toBe(false);
      // Without the boss's 20 s swings, attempts' forms vary less.
      const spread = (f: Float64Array) => Math.max(...f) - Math.min(...f);
      expect(spread(lucky.forms)).toBeLessThan(spread(plain.forms));
    });
  });

  it("gives the same answers at 10 minutes and at 6 hours", () => {
    const long = build(36);
    expect(suggestLuckSegments(long).map((s) => s.name)).toEqual(["S3"]);
    const a = analyzeRun(markLuck(run, ["S3"])).segments[2].luck!;
    const b = analyzeRun(markLuck(long, ["S3"])).segments[2].luck!;
    expect(b.goodShare).toBe(a.goodShare);
    expect(b.cost! / 36).toBeCloseTo(a.cost!, -1);
  });
});

/** The run with segment `index` of the PB replaced by `time` (later splits shift with it). */
function withPbSegment(run: Run, index: number, time: number): Run {
  const segments = run.segments.map((s) => ({ ...s }));
  const prev = index === 0 ? 0 : segments[index - 1].pbSplit!;
  const delta = time - (segments[index].pbSplit! - prev);
  for (let i = index; i < segments.length; i++) segments[i].pbSplit = segments[i].pbSplit! + delta;
  return { ...run, segments };
}
