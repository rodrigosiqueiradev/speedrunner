import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  analyzeRun,
  attemptsUntil,
  buildFormModel,
  buildSegmentModel,
  chanceOfBeating,
  describeChance,
  grindRate,
  oneIn,
  parseLiveSplitDate,
  parseLss,
  PB_ODDS_SETTINGS,
  pbChanceFrom,
  pbOdds,
  resetAdvice,
  sampleRun,
  seededRandom,
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

  it("never rates mistakes above the reset rate of every run", () => {
    // One reset in segment 2, on a fast run: 1 in 20 fast runs, but 1 in 40 of all runs.
    const lucky = synthRun({
      base: [60_000, 60_000],
      noise: (i, id) => (i === 0 ? (id % 2 ? 0 : 5000) + (id % 7) * 100 : (id % 5) * 100),
      resetAt: (id) => (id === 39 ? 1 : undefined),
      attempts: 40,
    });
    const [, second] = buildSegmentModel(lucky);
    expect(second.resetRate).toBeCloseTo(1 / 40, 5);
    expect(second.mistakeRate).toBe(second.resetRate);
  });
});

/** A repeatable number in [0, 1) for a pair of integers. */
const hash = (a: number, b: number) => {
  let h = Math.imul(a * 374_761_393 + b * 668_265_263, 1_274_126_177) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1_103_515_245) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
};

/** Spread (standard deviation) of simulated totals. */
function spread(model: NonNullable<ReturnType<typeof buildFormModel>>, count = 4000): { sd: number; median: number } {
  const random = seededRandom(1);
  const out = new Float64Array(model.segments.length);
  const totals = Array.from({ length: count }, () => sampleRun(model, random, out)).sort((a, b) => a - b);
  const mean = totals.reduce((a, b) => a + b, 0) / count;
  return { sd: Math.sqrt(totals.reduce((a, t) => a + (t - mean) ** 2, 0) / count), median: totals[count >> 1] };
}

describe("form model", () => {
  // Ten 60s segments. Each attempt has a form of the day, ±5%, that applies to every segment.
  const form = (id: number) => 1 + (hash(id, 0) - 0.5) * 0.1;
  const shared = synthRun({
    base: Array(10).fill(60_000),
    noise: (i, id) => 60_000 * (form(id) - 1) + hash(id, i + 1) * 1000,
    attempts: 60,
  });
  // The same segment times, but each segment's form comes from a different attempt, so good and bad days don't line up.
  const shuffled = synthRun({
    base: Array(10).fill(60_000),
    noise: (i, id) => 60_000 * (form(((id * (i + 3)) % 60) + 1) - 1) + hash(id, i + 1) * 1000,
    attempts: 60,
  });

  it("keeps a good day good across the whole run", () => {
    const a = spread(buildFormModel(shared)!);
    const b = spread(buildFormModel(shuffled)!);
    expect(a.sd).toBeGreaterThan(b.sd * 1.5);
  });

  it("follows a runner who is improving", () => {
    // Every attempt is 0.1% faster than the one before, 60 attempts.
    const improving = synthRun({
      base: [300_000, 300_000, 300_000],
      noise: (i, id) => 300_000 * (-0.001 * id) + hash(id, i) * 3000,
      attempts: 60,
    });
    const model = buildFormModel(improving)!;
    expect(model.trend).toBeLessThan(0);
    const latest = [...improving.segments].reduce((a, s) => a + s.history.get(60)!, 0);
    const all = improving.attempts.map((a) => a.time!).sort((x, y) => x - y);
    const { median } = spread(model);
    // Closer to the latest finishes than to the middle of the whole history.
    expect(Math.abs(median - latest)).toBeLessThan(Math.abs(median - all[30]) / 2);
  });

  it("never projects a slowdown", () => {
    const slowing = synthRun({
      base: [300_000, 300_000, 300_000],
      noise: (i, id) => 300 * id + hash(id, i) * 3000,
      attempts: 60,
    });
    expect(buildFormModel(slowing)!.trend).toBe(0);
  });
});

describe("pbOdds", () => {
  const odds = pbOdds(run, { now: new Date("2026-10-09T00:00:00Z") })!;

  it("multiplies the chance if you finish by your recent finish rate", () => {
    expect(odds.finishRate).toBeCloseTo(0.8, 2);
    expect(odds.perAttempt).toBeCloseTo(odds.ifFinished * odds.finishRate, 10);
    expect(odds.ifFinished).toBeGreaterThan(0);
    expect(odds.ifFinished).toBeLessThan(1);
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

  it("says to keep going inside the reset point and to reset past it", () => {
    const i = odds.splits.findIndex((s) => s.rule === "behind");
    const s = odds.splits[i];
    expect(i).toBeGreaterThanOrEqual(0);
    expect(resetAdvice(odds, i, s.pbSplit! + s.resetAfter! - 500).verdict).toBe("keep-going");
    expect(resetAdvice(odds, i, s.pbSplit! + s.resetAfter! + 500).verdict).toBe("reset");
    expect(resetAdvice(odds, i, s.pbSplit! + 60_000).message).toMatch(/^Reset/);
    expect(s.resetAfterShare).toBeCloseTo(s.resetAfter! / s.pbSplit!, 10);
  });

  it("gives the same odds and reset points, as a share of the time, at any run length", () => {
    const scaled = (k: number) =>
      synthRun({
        base: [60_000 * k, 60_000 * k, 60_000 * k],
        noise: (i, id) => ((id * 7 + i * 3) % 10) * 1000 * k,
        resetAt: (id) => (id % 5 === 0 ? 1 : undefined),
        attempts: 60,
      });
    const short = pbOdds(scaled(1))!;
    const long = pbOdds(scaled(60))!;
    expect(long.ifFinished).toBeCloseTo(short.ifFinished, 3);
    expect(long.perAttempt).toBeCloseTo(short.perAttempt, 3);
    short.splits.forEach((s, i) => {
      expect(long.splits[i].rule).toBe(s.rule);
      expect(long.splits[i].onPace!).toBeCloseTo(s.onPace!, 2);
      if (s.resetAfterShare != null) expect(long.splits[i].resetAfterShare!).toBeCloseTo(s.resetAfterShare, 3);
    });
  });

  it("gives the odds for a goal time instead of the PB", () => {
    const goal = pbOdds(run, { target: odds.medianFinish + 1 })!;
    expect(goal.targetIsPb).toBe(false);
    expect(goal.target).toBe(odds.medianFinish + 1);
    expect(goal.ifFinished).toBeGreaterThan(odds.ifFinished);
    expect(goal.ifFinished).toBeCloseTo(0.5, 1);
    expect(resetAdvice(goal, 0, goal.splits[0].pbSplit!).message).toMatch(/beat your goal/);
  });

  it("gives the odds for another time from the same runs", () => {
    expect(chanceOfBeating(odds, odds.target)).toEqual({ ifFinished: odds.ifFinished, perAttempt: odds.perAttempt });
    const goal = pbOdds(run, { target: odds.medianFinish + 1 })!;
    expect(chanceOfBeating(odds, odds.medianFinish + 1).ifFinished).toBe(goal.ifFinished);
  });

  it("measures attempt length from LiveSplit's start and end times", () => {
    const fmt = (t: number) => new Date(t).toISOString().replace(/^(\d+)-(\d+)-(\d+)T(\d+:\d+:\d+).*$/, "$2/$3/$1 $4");
    const dated = {
      ...run,
      attempts: run.attempts.map((a) => {
        const start = Date.UTC(2026, 0, 1) + a.id * 3_600_000;
        return { ...a, started: fmt(start), ended: fmt(start + 150_000) };
      }),
    };
    expect(pbOdds(dated)!.meanAttemptLength).toBe(150_000);
    // A timer left running for 10 hours on a reset attempt counts only for the time on its splits,
    // so one forgotten timer doesn't make every attempt look longer and every reset point looser.
    const id = [...dated.attempts].reverse().find((a) => a.time == null)!.id;
    const onSplits = run.segments.reduce((t, s) => t + (s.history.get(id) ?? 0), 0);
    const forgotten = {
      ...dated,
      attempts: dated.attempts.map((a) => (a.id === id ? { ...a, ended: fmt(Date.UTC(2026, 0, 1) + id * 3_600_000 + 36_000_000) } : a)),
    };
    const recent = forgotten.attempts.slice(-PB_ODDS_SETTINGS.recentAttempts);
    expect(pbOdds(forgotten)!.meanAttemptLength).toBeCloseTo(150_000 + (onSplits - 150_000) / recent.length, 0);
  });

  it("reaches back for finished runs when the latest attempts were all reset", () => {
    // 200 attempts that finish every 20th time, so the last 50 hold only 2 finishes and the
    // window has to reach back to hold 5.
    const resetty = synthRun({
      base: [60_000, 60_000, 60_000],
      noise: (i, id) => ((Math.floor(id / 20) * 3 + i * 7) % 10) * 1000,
      resetAt: (id) => (id % 20 === 0 ? undefined : 1),
      attempts: 200,
    });
    const o = pbOdds(resetty)!;
    // Back from attempt 200 to attempt 120: 81 attempts holding the finishes at 120, 140 ... 200.
    expect(o.finishWindow).toBe(81);
    expect(o.finishRate).toBeCloseTo(PB_ODDS_SETTINGS.minRecentFinishes / 81, 10);
    expect(o.perAttempt).toBeGreaterThan(0);
    // A long dry spell at the end doesn't drive the odds to zero.
    const dry = { ...resetty, attempts: resetty.attempts.map((a) => (a.id > 140 ? { ...a, time: null } : a)) };
    const last = dry.segments.length - 1;
    dry.segments = dry.segments.map((s, i) =>
      i === last ? { ...s, history: new Map([...s.history].filter(([id]) => id <= 140)) } : s,
    );
    const d = pbOdds(dry)!;
    expect(d.finishRate).toBeGreaterThan(0);
    expect(d.finishWindow).toBeGreaterThan(PB_ODDS_SETTINGS.recentAttempts);
    expect(d.perAttempt).toBeGreaterThan(0);
  });

  it("returns null without a PB", () => {
    const noPb = { ...run, segments: run.segments.map((s) => ({ ...s, pbSplit: null })) };
    expect(pbOdds(noPb)).toBeNull();
  });

  it("finds a recent PB within reach on a real file", () => {
    // The PB is one of the latest finishes, so the current form can match it now and then.
    const o = pbOdds(load("./fixtures/livesplit-core/livesplit1.6_gametime.lss"))!;
    expect(o.ifFinished).toBeGreaterThan(0.01);
    expect(o.perAttempt).toBeLessThan(o.ifFinished);
    expect(o.splits.some((s) => s.rule === "behind")).toBe(true);
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
