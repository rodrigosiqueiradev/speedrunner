import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLss, recapYears, undatedAttempts, yearRecap, type Run } from "../src/index.js";

/** "MM/dd/yyyy HH:mm:ss" as LiveSplit writes it. */
const stamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};

/** A two-segment run where each attempt is [start, segment times...]; a missing second time is a reset. */
function run(attempts: Array<[string, number, number?]>): Run {
  const s1 = new Map<number, number | null>();
  const s2 = new Map<number, number | null>();
  const list = attempts.map(([iso, a, b], i) => {
    const id = i + 1;
    const start = new Date(iso);
    s1.set(id, a);
    if (b != null) s2.set(id, b);
    const length = a + (b ?? 0);
    return {
      id,
      started: stamp(start),
      ended: stamp(new Date(start.getTime() + length)),
      time: b != null ? a + b : null,
    };
  });
  return {
    game: "Game",
    category: "Any%",
    timingMethod: "RealTime",
    attemptCount: list.length,
    attempts: list,
    segments: [
      { name: "Forest", rawName: "Forest", pbSplit: null, gold: null, history: s1 },
      { name: "Boss", rawName: "Boss", pbSplit: null, gold: null, history: s2 },
    ],
    comparisons: [],
  };
}

describe("yearRecap", () => {
  const r = run([
    ["2025-12-26T20:00:00Z", 60_000, 60_000], // PB going into 2026: 2:00
    // Golds only count once a segment has a few earlier times to beat.
    ...["27", "28", "29", "30"].map((d): [string, number, number] => [`2025-12-${d}T20:00:00Z`, 62_000, 62_000]),
    ["2026-01-01T20:00:00Z", 61_000, 62_000],
    ["2026-01-02T20:00:00Z", 59_000], // reset, Forest gold by 1 s
    ["2026-01-03T20:00:00Z", 58_000, 61_000], // PB 1:59, Forest gold by 1 s
    ["2026-01-05T20:00:00Z", 60_000, 55_000], // PB 1:55, Boss gold by 5 s
    ["2027-01-01T20:00:00Z", 50_000, 50_000], // next year: ignored
  ]);
  const recap = yearRecap([r], 2026, { timeZone: "utc" });

  it("counts attempts, finishes and play time in the year only", () => {
    expect(recap.attempts).toBe(4);
    expect(recap.finished).toBe(3);
    expect(recap.playMs).toBe(123_000 + 59_000 + 119_000 + 115_000);
    expect(recap.monthly[0]).toBe(4);
    expect(recap.monthly.slice(1).every((n) => n === 0)).toBe(true);
  });

  it("finds the longest run of consecutive days", () => {
    expect(recap.daysPlayed).toBe(4);
    expect(recap.longestStreak).toEqual({ days: 3, from: "2026-01-01", to: "2026-01-03" });
  });

  it("counts PBs against the best time from before the year", () => {
    expect(recap.pbCount).toBe(2);
    expect(recap.pbs).toEqual([{ game: "Game", category: "Any%", before: 120_000, after: 115_000, count: 2 }]);
  });

  it("finds golds and the one that saved the most", () => {
    expect(recap.goldCount).toBe(3);
    expect(recap.bestGold).toMatchObject({ segment: "Boss", time: 55_000, previous: 60_000, saved: 5_000 });
  });

  it("lists years newest first", () => {
    expect(recapYears([r], { timeZone: "utc" })).toEqual([2027, 2026, 2025]);
  });

  it("treats the first finish of a new category as a PB with nothing before it", () => {
    const fresh = yearRecap([run([["2026-03-01T10:00:00Z", 60_000, 60_000]])], 2026, { timeZone: "utc" });
    expect(fresh.pbs).toEqual([{ game: "Game", category: "Any%", before: null, after: 120_000, count: 1 }]);
    expect(fresh.goldCount).toBe(0);
  });

  it("finds the most improved segment from early and late times in the year", () => {
    const attempts: Array<[string, number, number]> = [];
    for (let i = 0; i < 20; i++) {
      const day = new Date(Date.UTC(2026, 1, 1 + i, 18)).toISOString();
      attempts.push([day, 60_000, (i < 10 ? 70_000 : 64_000) + (i % 3) * 100]);
    }
    const improved = yearRecap([run(attempts)], 2026, { timeZone: "utc" });
    expect(improved.mostImproved).toMatchObject({ segment: "Boss", early: 70_100, late: 64_100, saved: 6_000 });
  });

  it("has nothing to say about a year with no attempts", () => {
    const empty = yearRecap([r], 2020, { timeZone: "utc" });
    expect(empty.attempts).toBe(0);
    expect(empty.longestStreak).toBeNull();
    expect(empty.categories).toEqual([]);
  });
});

describe("a real split file", () => {
  const xml = readFileSync(resolve(__dirname, "fixtures/livesplit-core/livesplit1.6_gametime.lss"), "utf8");
  const real = parseLss(xml);

  it("recaps each year the file covers", () => {
    const years = recapYears([real], { timeZone: "utc" });
    expect(years.length).toBeGreaterThan(0);
    const total = years.reduce((n, y) => n + yearRecap([real], y, { timeZone: "utc" }).attempts, 0);
    expect(total + undatedAttempts([real])).toBe(real.attempts.filter((a) => a.id > 0).length);
    const recap = yearRecap([real], years.at(-1)!, { timeZone: "utc" });
    expect(recap.playMs).toBeGreaterThan(0);
    expect(recap.longestStreak!.days).toBeGreaterThanOrEqual(1);
  });
});
