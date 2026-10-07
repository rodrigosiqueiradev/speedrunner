import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeRun, parseLss } from "../src/index.js";

const load = (name: string) =>
  parseLss(readFileSync(new URL(`./fixtures/livesplit-core/${name}`, import.meta.url), "utf8"));

describe("real LiveSplit files", () => {
  it("reads the pre-1.6 single-time format", () => {
    const a = analyzeRun(load("livesplit1.5.lss"));
    expect(a.game).toBe("Kirby's Dream Land");
    expect(a.personalBest).toBe(750_760);
    expect(a.sumOfBest!).toBeLessThan(a.personalBest!);
  });

  it("reads the 1.0 PersonalBestSplitTime format", () => {
    const run = load("livesplit1.0.lss");
    expect(run.segments.some((s) => s.pbSplit != null)).toBe(true);
    expect(run.segments[0].gold).toBe(4_960);
  });

  it("filters mis-split golds in a large file", () => {
    const a = analyzeRun(load("livesplit1.6_gametime.lss"));
    expect(a.attemptCount).toBe(1958);
    // LiveSplit's stored gold for the first split is a 5s mis-split of a ~3:11 segment.
    expect(a.segments[0].suspiciousGold).toBe(true);
    expect(a.segments[0].gold!).toBeGreaterThan(180_000);
    for (const s of a.segments) expect(s.gold!).toBeLessThanOrEqual(s.pbTime!);
    expect(a.realisticTarget!).toBeLessThanOrEqual(a.personalBest!);
    expect(a.realisticTarget!).toBeGreaterThanOrEqual(a.sumOfBest!);
  });

  it("reads game time when asked", () => {
    const a = analyzeRun(parseLss(
      readFileSync(new URL("./fixtures/livesplit-core/livesplit1.6_gametime.lss", import.meta.url), "utf8"),
      { timingMethod: "GameTime" },
    ));
    expect(a.timingMethod).toBe("GameTime");
    expect(a.personalBest!).toBeLessThan(analyzeRun(load("livesplit1.6_gametime.lss")).personalBest!);
  });
});
