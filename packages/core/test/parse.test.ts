import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeRun, formatTime, parseLss, parseTime } from "../src/index.js";

const small = readFileSync(new URL("./fixtures/small.lss", import.meta.url), "utf8");

describe("parseTime", () => {
  it("parses LiveSplit time strings", () => {
    expect(parseTime("00:01:23.4560000")).toBe(83_456);
    expect(parseTime("01:00:00")).toBe(3_600_000);
    expect(parseTime("1.02:00:00.5")).toBe(26 * 3_600_000 + 500);
    expect(parseTime("-00:00:01.5000000")).toBe(-1_500);
    expect(parseTime("")).toBeNull();
    expect(parseTime(undefined)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(() => parseTime("abc")).toThrow();
  });
});

describe("formatTime", () => {
  it("formats like a timer", () => {
    expect(formatTime(83_456)).toBe("1:23.46");
    expect(formatTime(3_723_450)).toBe("1:02:03.45");
    expect(formatTime(5_000)).toBe("5.00");
    expect(formatTime(null)).toBe("-");
  });
});

describe("parseLss", () => {
  const run = parseLss(small);

  it("reads run metadata and attempts", () => {
    expect(run.game).toBe("Test Game");
    expect(run.category).toBe("Any%");
    expect(run.timingMethod).toBe("RealTime");
    expect(run.attemptCount).toBe(4);
    expect(run.attempts.map((a) => a.time)).toEqual([190_000, null, 180_000, 185_500]);
  });

  it("reads segments, PB splits, golds and history", () => {
    expect(run.segments.map((s) => s.name)).toEqual(["Level 1", "Level 2", "Final Boss"]);
    expect(run.segments.map((s) => s.pbSplit)).toEqual([60_000, 130_000, 180_000]);
    expect(run.segments[0].gold).toBe(55_000);
    // Imported history (id <= 0) is dropped, skipped splits are kept as null.
    expect([...run.segments[0].history]).toEqual([
      [1, 65_000],
      [2, 58_000],
      [3, 60_000],
      [4, null],
    ]);
  });

  it("falls back to game time when the PB only has game time", () => {
    const gameTimeOnly = small.replaceAll("RealTime", "GameTime");
    const gt = parseLss(gameTimeOnly);
    expect(gt.timingMethod).toBe("GameTime");
    expect(gt.segments[2].pbSplit).toBe(180_000);
  });

  it("shows subsplit names without their markers, keeping the file's names for LiveSplit", () => {
    let n = 0;
    const subsplits = small.replace(/<Name>([^<]*)<\/Name>/g, (m, name) => (n++ === 0 ? `<Name>-${name}</Name>` : n === 2 ? `<Name>{Forest}${name}</Name>` : m));
    const run = parseLss(subsplits);
    expect(run.segments[0].rawName).toMatch(/^-/);
    expect(run.segments[0].name).toBe(run.segments[0].rawName.slice(1));
    expect(run.segments[1].rawName).toMatch(/^\{Forest\}/);
    expect(run.segments[1].name).not.toContain("{");
    expect(analyzeRun(run).advice.every((a) => !/[{}]|usual -/.test(a.message))).toBe(true);
  });

  it("rejects files that are not splits", () => {
    expect(() => parseLss("<Layout></Layout>")).toThrow(/Run/);
  });
});
