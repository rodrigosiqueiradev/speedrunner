import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addComparisons,
  analyzeRun,
  COMPARISON_NAMES,
  formatLssTime,
  formatTime,
  parseLss,
  planGoal,
  realisticTargetSplits,
  recentGoldSplits,
  suggestGoal,
} from "../src/index.js";
import type { Run } from "../src/index.js";
import { synthRun } from "./synth.js";

// Deterministic pseudo-random noise in [0, 1).
const rand = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Segment 1 is tight (0.5s spread), segment 2 swings by 10s, segment 3 has too few attempts to plan.
const run = withPb(
  synthRun({
    base: [60_000, 60_000, 60_000],
    noise: (s, id) => Math.round([500, 10_000, 1_000][s] * rand(s, id)),
    resetAt: (id) => (id > 3 ? 2 : undefined),
    attempts: 40,
  }),
  [60_300, 66_000, 60_500],
);
const analysis = analyzeRun(run);
const pb = analysis.personalBest!;

/** Replaces the PB with one that has the given segment times. */
function withPb(r: Run, times: number[]): Run {
  let acc = 0;
  return { ...r, segments: r.segments.map((s, i) => ({ ...s, pbSplit: (acc += times[i]) })) };
}

describe("planGoal", () => {
  it("says when the PB already beats the goal", () => {
    expect(planGoal(run, pb + 1000).status).toBe("already");
  });

  it("takes the time from the segment where your times spread the most", () => {
    const plan = planGoal(run, pb - 2000);
    expect(plan.status).toBe("reachable");
    expect(plan.plannedTime).toBeLessThan(plan.goal);
    expect(plan.plannedTime).toBeGreaterThan(plan.goal - 50);
    const [tight, loose, unplanned] = plan.segments;
    expect(loose.cut).toBeGreaterThan(tight.cut);
    expect(unplanned).toMatchObject({ cut: 0, kind: "none", target: unplanned.pbTime });
    expect(plan.splits!.at(-1)).toBe(plan.plannedTime);
    // The same pace is asked of every segment the plan cuts.
    for (const s of plan.segments.filter((s) => s.cut > 0)) expect(s.hitRate).toBeCloseTo(plan.pace!, 1);
  });

  it("asks for a faster pace as the goal gets harder", () => {
    const easy = planGoal(run, pb - 1000);
    const hard = planGoal(run, pb - 3000);
    expect(hard.pace!).toBeLessThan(easy.pace!);
  });

  it("falls back to older golds, then says when a goal is out of reach", () => {
    // With only the last 5 attempts counting as recent, the golds are older than that.
    const options = { recentWindow: 5 };
    const recentBest = planGoal(run, 0, options).segments; // out of reach: every segment keeps its PB
    expect(recentBest.every((s) => s.cut === 0)).toBe(true);
    const golds = analysis.segments[0].gold! + analysis.segments[1].gold! + 60_500;
    const plan = planGoal(run, golds + 100, options);
    expect(plan.status).toBe("needs-golds");
    expect(plan.plannedTime).toBeLessThan(golds + 100);
    expect(planGoal(run, golds - 1000, options)).toMatchObject({ status: "out-of-reach", shortfall: 1010 });
  });

  it("can't plan without a full PB", () => {
    const noPb = { ...run, segments: run.segments.map((s, i) => ({ ...s, pbSplit: i === 1 ? null : s.pbSplit })) };
    expect(planGoal(noPb, pb - 1000).status).toBe("no-data");
  });
});

describe("suggestGoal", () => {
  it("picks the next round time under the PB, on a step that scales with the run", () => {
    expect(suggestGoal(40 * 60_000 + 1520)).toBe(40 * 60_000);
    // 1% of 40 minutes is 24 s, so the step is 15 s.
    expect(suggestGoal(40 * 60_000)).toBe(39 * 60_000 + 45_000);
    expect(suggestGoal(93_400)).toBe(93_000);
    // A 6-hour PB steps by whole minutes, a 20-hour one by 10 minutes.
    expect(suggestGoal(5 * 3_600_000 + 42 * 60_000 + 54_890)).toBe(5 * 3_600_000 + 42 * 60_000);
    expect(suggestGoal(20 * 3_600_000 + 7 * 60_000)).toBe(20 * 3_600_000);
  });
});

describe("comparisons", () => {
  const xml = readFileSync(new URL("../../web/public/sample.lss", import.meta.url), "utf8");
  const sample = parseLss(xml);
  const a = analyzeRun(sample);

  it("cuts times like LiveSplit, so a time just under a round one stays under it", () => {
    expect(formatTime(2_399_999)).toBe("39:59.99");
    expect(formatTime(191_265)).toBe("3:11.26");
    expect(formatTime(59_999)).toBe("59.99");
    expect(formatTime(-1_239)).toBe("-1.23");
  });

  it("formats times the way LiveSplit writes them", () => {
    expect(formatLssTime(191_265)).toBe("00:03:11.2650000");
    expect(formatLssTime(93_784_500)).toBe("1.02:03:04.5000000");
  });

  it("ends the realistic target comparison at the realistic target", () => {
    expect(realisticTargetSplits(a)!.at(-1)).toBe(a.realisticTarget);
  });

  it("builds recent golds from the best recent time in each segment", () => {
    const splits = recentGoldSplits(sample);
    expect(splits.every((t) => t != null)).toBe(true);
    // Never faster than the all-time sum of best.
    expect(splits.at(-1)!).toBeGreaterThanOrEqual(a.sumOfBest!);
  });

  it("writes comparisons LiveSplit can read and keeps the rest of the file", () => {
    const plan = planGoal(sample, suggestGoal(a.personalBest!), {}, a);
    const comparisons = [
      { name: COMPARISON_NAMES.realisticTarget, splits: { RealTime: realisticTargetSplits(a) } },
      { name: COMPARISON_NAMES.balanced(plan.goal), splits: { RealTime: plan.splits } },
    ];
    const out = addComparisons(xml, comparisons);
    const back = parseLss(out);
    expect(back.comparisons.slice(-2)).toEqual([
      { name: "Realistic target", time: a.realisticTarget },
      { name: "Sub 40:00 (balanced)", time: plan.plannedTime },
    ]);
    // Nothing else changes: removing the added entries gives back the original file.
    expect(out.replace(/\s*<SplitTime name="(Realistic target|Sub 40:00 \(balanced\))">[\s\S]*?<\/SplitTime>/g, "")).toBe(xml);
    // Exporting again replaces the comparisons instead of adding them twice.
    expect(addComparisons(out, comparisons)).toBe(out);
    expect(parseLss(out).segments).toEqual(sample.segments);
  });

  it("fills empty or self-closing SplitTimes", () => {
    const small = readFileSync(new URL("./fixtures/small.lss", import.meta.url), "utf8");
    const segments = parseLss(small).segments.length;
    const bare = small.replace(/<SplitTimes>[\s\S]*?<\/SplitTimes>/g, "<SplitTimes />");
    const out = addComparisons(bare, [{ name: "A & B", splits: { GameTime: Array(segments).fill(1000) } }]);
    expect(parseLss(out, { timingMethod: "GameTime" }).comparisons).toEqual([{ name: "A & B", time: 1000 }]);
  });

  it("refuses files from LiveSplit versions without SplitTimes", () => {
    const old = readFileSync(new URL("./fixtures/livesplit-core/livesplit1.0.lss", import.meta.url), "utf8");
    expect(() => addComparisons(old, [{ name: "X", splits: {} }])).toThrow(/old LiveSplit version/);
  });
});
