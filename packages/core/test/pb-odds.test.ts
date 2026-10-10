import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  analyzeRun,
  attemptsUntil,
  buildSegmentModel,
  describeChance,
  grindRate,
  oneIn,
  parseLiveSplitDate,
  parseLss,
  pbChanceFrom,
  pbOdds,
  resetAdvice,
} from "../src/index.js";
import { synthRun } from "./synth.js";

const load = (path: string) => parseLss(readFileSync(new URL(path, import.meta.url), "utf8"));

// Three 60s segments with a fixed spread of up to 9s each, and a reset in segment 2 every 5th attempt.
const run = synthRun({
  base: [60_000, 60_000, 60_000],
  noise: (i, id) => ((id * 7 + i * 3) % 10) * 1000,
  resetAt: (id) => (id % 5 === 0 ? 1 : undefined),
  attempts: 60,
});

describe("segment model", () => {
  it("samples the same clean times the analyzer uses, capped to the recent window", () => {
    const a = analyzeRun(load("./fixtures/livesplit-core/livesplit1.6_gametime.lss"));
    const models = buildSegmentModel(load("./fixtures/livesplit-core/livesplit1.6_gametime.lss"));
    models.forEach((m, i) => expect(m.times.length).toBe(Math.min(50, a.segments[i].samples)));
  });

  it("measures recent reset rates per segment", () => {
    const models = buildSegmentModel(run);
    expect(models[0].resetRate).toBe(0);
    expect(models[1].resetRate).toBeCloseTo(0.2, 2);
  });

  it("tells mistakes apart from pace resets", () => {
    // Resets in segment 2 only ever happen after a slow segment 1.
    const paced = synthRun({
      base: [60_000, 60_000],
      noise: (i, id) => (id % 2 ? 0 : 5000) + (id % 7) * 100,
      resetAt: (id) => (id % 4 === 0 ? 1 : undefined),
      attempts: 40,
    });
    const [, second] = buildSegmentModel(paced);
    expect(second.resetRate).toBeGreaterThan(0.2);
    expect(second.mistakeRate).toBe(0);
  });
});

describe("pbOdds", () => {
  const odds = pbOdds(run, { now: new Date("2026-10-09T00:00:00Z") })!;

  it("matches the exact chance worked out by enumerating every combination", () => {
    const [a, b, c] = buildSegmentModel(run);
    let beat = 0;
    for (const x of a.times) for (const y of b.times) for (const z of c.times) if (x + y + z < odds.personalBest) beat++;
    const exact = beat / (a.times.length * b.times.length * c.times.length);
    expect(odds.ifFinished).toBeCloseTo(exact, 2);
    expect(odds.perAttempt).toBeCloseTo(exact * (1 - b.resetRate), 2);
    expect(odds.finishRate).toBeCloseTo(1 - b.resetRate, 2);
  });

  it("gives the same answer every time", () => {
    expect(pbOdds(run)!.perAttempt).toBe(odds.perAttempt);
  });

  it("lowers the odds the further behind PB pace a run is", () => {
    const pace = odds.splits[0].pbSplit!;
    const chances = [-3000, 0, 3000, 6000].map((d) => pbChanceFrom(odds, 0, pace + d));
    expect(chances).toEqual([...chances].sort((x, y) => y - x));
    expect(chances[0]).toBeGreaterThan(chances[3]);
    expect(odds.splits[0].onPace).toBe(chances[1]);
  });

  it("says to keep going when ahead and stops when far behind", () => {
    const s = odds.splits[1];
    expect(s.resetAfter).not.toBeNull();
    expect(resetAdvice(odds, 1, s.pbSplit! - 2000).verdict).toBe("keep-going");
    expect(resetAdvice(odds, 1, s.pbSplit! + s.resetAfter! + 1000).verdict).not.toBe("keep-going");
    expect(resetAdvice(odds, 1, s.pbSplit! + 60_000).message).toMatch(/no run from here/i);
  });

  it("returns null without a PB", () => {
    const noPb = { ...run, segments: run.segments.map((s) => ({ ...s, pbSplit: null })) };
    expect(pbOdds(noPb)).toBeNull();
  });

  it("reports a PB that recent form can't reach on a real file", () => {
    const o = pbOdds(load("./fixtures/livesplit-core/livesplit1.6_gametime.lss"))!;
    expect(o.perAttempt).toBeLessThan(0.001);
    expect(o.medianFinish).toBeGreaterThan(o.personalBest);
    // The simulated finish rate tracks the file's: 30 of the last ~650 attempts finished.
    expect(o.finishRate).toBeGreaterThan(0.02);
    expect(o.finishRate).toBeLessThan(0.1);
  });
});

describe("forecast", () => {
  it("counts attempts until an even and a 90% chance", () => {
    expect(attemptsUntil(1 / 40, 0.5)).toBe(28);
    expect(attemptsUntil(1 / 40, 0.9)).toBe(91);
    expect(attemptsUntil(0, 0.5)).toBe(Infinity);
  });

  it("works out a grind rate from attempt dates", () => {
    expect(parseLiveSplitDate("01/02/2026 10:00:00")).toBe(Date.UTC(2026, 0, 2, 10));
    expect(parseLiveSplitDate(undefined)).toBeNull();
    const dated = {
      ...run,
      attempts: run.attempts.map((a) => ({
        ...a,
        // 60 attempts over 30 days, two a day.
        started: new Date(Date.UTC(2026, 0, 1) + Math.floor((a.id - 1) / 2) * 86_400_000)
          .toISOString()
          .replace(/^(\d+)-(\d+)-(\d+)T(\d+:\d+:\d+).*$/, "$2/$3/$1 $4"),
      })),
    };
    expect(grindRate(dated)).toBeCloseTo(2, 0);
    const o = pbOdds(dated, { now: new Date("2026-10-09T00:00:00Z") })!;
    expect(o.forecast!.date50! >= "2026-10-09").toBe(true);
    expect(o.forecast!.date90! >= o.forecast!.date50!).toBe(true);
    expect(pbOdds(run)!.forecast!.attemptsPerDay).toBeNull();
  });
});

describe("wording", () => {
  it("writes chances the way a runner says them", () => {
    expect(describeChance(0.034)).toBe("3.4%");
    expect(describeChance(0.004)).toBe("0.4%");
    expect(describeChance(0.25)).toBe("25%");
    expect(describeChance(0.00001)).toBe("under 0.01%");
    expect(oneIn(1 / 40)).toBe("1 in 40");
    expect(oneIn(1 / 7.2)).toBe("1 in 7");
  });
});
