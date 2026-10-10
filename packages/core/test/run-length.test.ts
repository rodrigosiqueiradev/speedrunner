import { describe, expect, it } from "vitest";
import {
  analyzeRun,
  attemptLimit,
  halfLife,
  planGoal,
  recentCount,
  recentGoldSplits,
  recencyWeights,
  scoreRun,
  suggestGoal,
  weightedQuantile,
  yearRecap,
  type Run,
} from "../src/index.js";
import { synthRun } from "./synth.js";

/**
 * The app can't assume how long a category is. These check that the same runner, playing the same
 * way, gets the same answers whether the category takes ten minutes or six hours, and that a long
 * category with only a few dozen attempts isn't left without results.
 */

// Deterministic pseudo-random jitter in [-1, 1].
const jitter = (seg: number, id: number) => {
  let h = Math.imul(seg * 7919 + id, 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) / 0xffffffff) * 2 - 1;
};

/** The same run with every time multiplied by `k`. */
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

// A 10-minute category: 8 segments of about 75 s, with a shaky segment and one where runs die.
const short = synthRun({
  base: [60_000, 90_000, 75_000, 80_000, 70_000, 85_000, 65_000, 75_000],
  attempts: 200,
  noise: (seg, id) => (seg === 2 ? 12_000 : 1_500) * jitter(seg, id) - id * 15,
  resetAt: (id) => (id % 9 === 0 ? 0 : id % 5 === 0 ? 5 : undefined),
});
// The same runner in a 6-hour category: every time 36 times longer.
const long = scaled(short, 36);

describe("recency", () => {
  it("counts recent form in the runner's own attempts", () => {
    expect([8, 20, 40, 100, 400].map(halfLife)).toEqual([5, 5, 10, 25, 25]);
    // The latest half of the history, at least 10 (or all of it) and at most 50.
    expect([8, 20, 40, 100, 400].map(recentCount)).toEqual([8, 10, 20, 50, 50]);
    const w = recencyWeights(11);
    expect(w.at(-1)).toBe(1);
    expect(w[w.length - 6]).toBeCloseTo(0.5);
    expect(weightedQuantile([10, 20, 30], [1, 1, 1], 0.5)).toBe(20);
    expect(weightedQuantile([10, 20, 30], [0.1, 0.1, 1], 0.5)).toBe(30);
  });
});

describe("the same runner at 10 minutes and at 6 hours", () => {
  it("gets the same score", () => {
    const a = scoreRun(short);
    const b = scoreRun(long);
    expect(b.score).toBe(a.score);
    for (const k of ["efficiency", "consistency", "completion", "improvement"] as const) {
      // Equal up to rounding times to whole milliseconds.
      expect(b[k].score!).toBeCloseTo(a[k].score!, 1);
    }
    expect(b.provisional).toBe(a.provisional);
  });

  it("gets the same advice", () => {
    const kinds = (run: Run) => analyzeRun(run).advice.map((x) => `${x.segmentName} ${x.kind}`).sort();
    expect(kinds(long)).toEqual(kinds(short));
    expect(kinds(short)).toContain("S3 inconsistent");
  });

  it("gets the same goal plan for the same share of the run", () => {
    const pb = analyzeRun(short).personalBest!;
    const a = planGoal(short, Math.round(pb * 0.995));
    const b = planGoal(long, Math.round(pb * 0.995) * 36);
    expect(b.status).toBe(a.status);
    expect(b.pace!).toBeCloseTo(a.pace!, 2);
    // And the suggested goal asks for a similar share of the run, not a fixed minute.
    for (const p of [pb, pb * 36]) expect((p - suggestGoal(p)) / p).toBeLessThanOrEqual(0.01);
  });
});

describe("a long category with few attempts", () => {
  // 56 segments of about 6 minutes, 40 attempts, 14 finished, getting 2 s faster a segment every attempt.
  const run = synthRun({
    base: Array(56).fill(360_000),
    attempts: 40,
    noise: (seg, id) => 6_000 * jitter(seg, id) + (40 - id) * 2_000,
    resetAt: (id) => (id % 3 === 0 ? undefined : (id * 7) % 56),
  });
  const a = analyzeRun(run);

  it("follows current form instead of the whole history", () => {
    const s = a.segments[0];
    // 36 clean times: the latest 18 count, so the typical time sits near recent attempts.
    expect(s.samples).toBe(36);
    expect(s.recentSamples).toBe(18);
    const allMedian = [...run.segments[0].history.values()].map((t) => t!).sort((x, y) => x - y)[18];
    expect(s.median!).toBeLessThan(allMedian - 20_000);
    // Recent golds ignore a lucky best set early in the history.
    const lucky: Run = { ...run, segments: run.segments.map((seg, i) => (i === 0 ? { ...seg, history: new Map(seg.history).set(1, 300_000) } : seg)) };
    expect(recentGoldSplits(lucky)[0]!).toBeGreaterThan(300_000);
  });

  it("still gets an improvement score and a firm category score", () => {
    const s = scoreRun(run);
    expect(s.finishedAttempts).toBeLessThan(20);
    expect(s.improvement.score!).toBeGreaterThan(50);
    expect(s.provisional).toBe(false);
  });

  it("flags where runs die per minute, not per segment", () => {
    // A uniform draw in [0, 1) for each attempt, independent of its pace.
    const draw = (id: number) => {
      const x = Math.sin(id * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    const killers = (long: number) =>
      analyzeRun(
        synthRun({
          base: [60_000, 60_000, long, 60_000, 60_000],
          attempts: 1000,
          noise: (seg, id) => 500 * jitter(seg, id),
          // About 2% of runs die per minute played after the first split, and S3 takes ten times as many
          // runs as one of the 1 minute segments.
          resetAt: (id) => {
            const r = draw(id);
            return r < 0.02 ? 1 : r < 0.2 ? 2 : r < 0.22 ? 3 : r < 0.24 ? 4 : undefined;
          },
        }),
      )
        .advice.filter((x) => x.kind === "run-killer")
        .map((x) => x.segmentName);
    // Ten minutes long, so that is the same rate per minute: not a run killer.
    expect(killers(600_000)).not.toContain("S3");
    // One minute long, it kills runs ten times as fast as the rest.
    expect(killers(60_000)).toContain("S3");
  });
});

describe("year in runs", () => {
  const stamp = (ms: number) => {
    const d = new Date(ms);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
  };

  it("judges a timer left running by the category's own length", () => {
    const T0 = Date.UTC(2026, 2, 1, 10);
    // One finished 6-hour run that took 7 hours with breaks, in a 6-hour category: it all counts.
    const sixHours = synthRun({ base: Array(6).fill(3_600_000), attempts: 3, noise: () => 0 });
    sixHours.attempts = sixHours.attempts.map((a, i) => ({ ...a, started: stamp(T0 + i * 86_400_000), ended: stamp(T0 + i * 86_400_000 + 7 * 3_600_000) }));
    expect(attemptLimit(sixHours)).toBe(18 * 3_600_000);
    expect(yearRecap([sixHours], 2026, { timeZone: "utc" }).playMs).toBe(3 * 7 * 3_600_000);
    // The same 7 hours in a 10-minute category is LiveSplit left open: only the 10 minutes on splits count.
    const tenMinutes = scaled(sixHours, 1 / 36);
    tenMinutes.attempts = sixHours.attempts.map((a, i) => ({ ...a, time: tenMinutes.attempts[i].time }));
    expect(yearRecap([tenMinutes], 2026, { timeZone: "utc" }).playMs).toBe(3 * 600_000);
  });

  it("ranks highlights by share, so a long category doesn't win for being long", () => {
    // The same runner improving in a 10 minute category (by about 10%) and a 6 hour one (by under 2%).
    // In seconds the 6 hour category saves more everywhere; as a share of the time, the short one does.
    const category = (name: string, base: number[], step: number): Run => {
      const run = synthRun({ base, attempts: 30, noise: (_, id) => -id * step });
      return {
        ...run,
        category: name,
        // The first 5 attempts are from December, so there's an old PB to beat.
        attempts: run.attempts.map((a) => {
          const at = Date.UTC(2025, 11, 27) + a.id * 86_400_000;
          return { ...a, started: stamp(at), ended: stamp(at + (a.time ?? 0)) };
        }),
      };
    };
    const short = category("10 minutes", Array(5).fill(120_000), 400);
    const long = category("6 hours", Array(6).fill(3_600_000), 2_000);
    const r = yearRecap([long, short], 2026, { timeZone: "utc" });
    expect(r.pbs.map((p) => p.category)).toEqual(["10 minutes", "6 hours"]);
    expect(r.pbs[1].before! - r.pbs[1].after).toBeGreaterThan(r.pbs[0].before! - r.pbs[0].after);
    expect(r.bestGold!.category).toBe("10 minutes");
    expect(r.mostImproved!.category).toBe("10 minutes");
  });
});
