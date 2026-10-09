import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRACTICE_SETTINGS, describePlan, learningPerDoubling, parseLss, planPractice } from "../src/index.js";
import { synthRun } from "./synth.js";

const load = (name: string) =>
  parseLss(readFileSync(new URL(`./fixtures/livesplit-core/${name}`, import.meta.url), "utf8"));

// Deterministic pseudo-random jitter in [-1, 1].
const jitter = (seg: number, id: number) => {
  let h = Math.imul(seg * 7919 + id, 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) / 0xffffffff) * 2 - 1;
};

describe("learningPerDoubling", () => {
  it("measures how much faster each doubling of reps made a segment", () => {
    // 60 s that drops by 4 s every time the rep count doubles.
    const times = Array.from({ length: 64 }, (_, k) => 60_000 - 4_000 * Math.log2(k + 1));
    expect(learningPerDoubling(times)!).toBeCloseTo(4_000, -3);
  });

  it("treats a segment that got slower as not learning, and needs enough history", () => {
    expect(learningPerDoubling(Array.from({ length: 40 }, (_, k) => 30_000 + k * 100))).toBe(0);
    expect(learningPerDoubling([30_000, 29_000, 28_000])).toBeNull();
  });
});

describe("planPractice", () => {
  // S1 is still improving, S2 has plateaued with a similar spread, S3 is a long segment, S4 is barely variable.
  const run = synthRun({
    base: [60_000, 60_000, 300_000, 60_000],
    attempts: 80,
    noise: (seg, id) => {
      if (seg === 0) return 60_000 / Math.sqrt(id) + 3_000 * jitter(seg, id);
      if (seg === 1) return 3_000 * jitter(seg, id);
      if (seg === 2) return 15_000 * jitter(seg, id);
      return 200 * jitter(seg, id);
    },
  });
  const plan = planPractice(run);
  const roi = (name: string) => plan.ranking.find((r) => r.name === name)!;

  it("ranks a segment you're still learning above one that has plateaued", () => {
    expect(roi("S1").measuredPerDoubling!).toBeGreaterThan(roi("S2").measuredPerDoubling!);
    expect(roi("S1").savePerHour).toBeGreaterThan(roi("S2").savePerHour);
    expect(plan.ranking[0].name).toBe("S1");
  });

  it("counts how long one rep takes", () => {
    expect(roi("S3").repTime).toBeGreaterThan(300_000);
    // S3's gap is bigger than S2's, but S2 fits far more reps into an hour.
    expect(roi("S3").gap).toBeGreaterThan(roi("S2").gap);
    expect(roi("S3").savePerHour / roi("S3").gap).toBeLessThan(roi("S2").savePerHour / roi("S2").gap);
  });

  it("never expects more than the gap to your good-day time", () => {
    for (const r of plan.ranking) expect(r.savePerHour).toBeLessThanOrEqual(r.gap);
    for (const i of plan.items) expect(i.expectedSave).toBeLessThanOrEqual(roi(i.name).gap);
  });

  it("fills the session with practice blocks and full runs", () => {
    const minutes = plan.items.reduce((a, i) => a + i.minutes, 0) + (plan.fullRuns?.minutes ?? 0);
    expect(minutes).toBeLessThanOrEqual(PRACTICE_SETTINGS.sessionMinutes);
    expect(plan.items.every((i) => i.minutes % PRACTICE_SETTINGS.blockMinutes === 0)).toBe(true);
    // A run takes about 8 minutes, so the quarter kept for full runs fits one.
    expect(plan.fullRuns).toMatchObject({ minutes: 15, runs: 1 });
    expect(describePlan(plan)).toMatch(/^60 minutes: \d+ on S1, .*15 full runs$/);
    expect(plan.expectedSave).toBeGreaterThan(0);
  });

  it("gives all the time to practice when a full run doesn't fit", () => {
    const short = planPractice(run, undefined, { sessionMinutes: 20 });
    expect(short.fullRuns).toBeNull();
    expect(short.items.reduce((a, i) => a + i.minutes, 0)).toBe(20);
  });
});

describe("planPractice on real files", () => {
  it("plans a session for the Dishonored file", () => {
    const plan = planPractice(load("livesplit1.6_gametime.lss"));
    expect(plan.segmentsWithoutData).toBe(0);
    expect(plan.ranking.length).toBeGreaterThan(5);
    // A 40 minute run doesn't fit in the 15 minutes kept for full runs.
    expect(plan.fullRuns).toBeNull();
    expect(plan.items.reduce((a, i) => a + i.minutes, 0)).toBe(60);
  });

  it("leans on the assumed learning rate when history is thin", () => {
    const plan = planPractice(load("livesplit1.5.lss"));
    expect(plan.ranking[0].ownCurveWeight).toBe(0);
    const typical = plan.ranking[0].repTime - PRACTICE_SETTINGS.repOverheadMs;
    expect(plan.ranking[0].perDoubling).toBeCloseTo(PRACTICE_SETTINGS.priorLearning * typical, 0);
  });

  it("returns an empty plan when no segment has enough times", () => {
    const plan = planPractice(load("livesplit1.0.lss"));
    expect(plan.items).toEqual([]);
    expect(plan.segmentsWithoutData).toBe(4);
    expect(describePlan(plan)).toBe("");
  });
});
