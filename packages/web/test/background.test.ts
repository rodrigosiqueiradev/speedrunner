// In node rather than jsdom: jsdom's typed arrays are another realm's than the ones structuredClone makes.
// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeRun, analyzeSessions, hasGameTime, markLuck, parseLss, pbOdds, scoreRun, suggestLuckSegments } from "@speedrunner/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JOBS, liveRead, profileScore, runPage, splitsFingerprint } from "../src/analysis/jobs";

const sample = readFileSync(resolve(__dirname, "../public/sample.lss"), "utf8");
const fixture = (name: string) => readFileSync(resolve(__dirname, `../../core/test/fixtures/livesplit-core/${name}`), "utf8");
const FILES: Array<[string, string]> = [
  ["sample", sample],
  ["1.6 game time", fixture("livesplit1.6_gametime.lss")],
  ["1.5", fixture("livesplit1.5.lss")],
  ["1.0", fixture("livesplit1.0.lss")],
];
const CATEGORY = "dishonored|any%";
const MARKS = { [CATEGORY]: ["RNG Roulette"] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("analysis jobs", () => {
  it("give the run page what it worked out on the page before", () => {
    for (const timing of [null, "GameTime"] as const) {
      const parsed = parseLss(sample, timing ? { timingMethod: timing } : {});
      const run = markLuck(parsed, MARKS[CATEGORY]);
      const analysis = analyzeRun(run);
      expect(runPage({ xml: sample, timing, luckMarks: MARKS })).toStrictEqual({
        run,
        analysis,
        score: scoreRun(run, analysis),
        odds: pbOdds(run),
        sessions: analyzeSessions(parsed),
        luckSuggestions: suggestLuckSegments(parsed),
        hasGameTime: hasGameTime(sample),
      });
    }
  });

  it("re-use the file they read last only while it's the same file and clock", () => {
    const fresh = runPage({ xml: sample, timing: null, luckMarks: {} });
    runPage({ xml: sample, timing: null, luckMarks: MARKS });
    expect(runPage({ xml: sample, timing: null, luckMarks: {} })).toStrictEqual(fresh);
    runPage({ xml: sample, timing: "GameTime", luckMarks: {} });
    expect(runPage({ xml: sample, timing: null, luckMarks: {} })).toStrictEqual(fresh);
    expect(runPage({ xml: "<Run>", timing: null, luckMarks: {} })).toEqual({ error: true });
    expect(runPage({ xml: sample, timing: null, luckMarks: {} })).toStrictEqual(fresh);
  });

  it("give the live page and the profile what they worked out on the page before", () => {
    const run = markLuck(parseLss(sample, { timingMethod: "GameTime" }), MARKS[CATEGORY]);
    expect(liveRead({ xml: sample, timing: "GameTime", luckMarks: MARKS })).toStrictEqual({
      run,
      category: CATEGORY,
      odds: pbOdds(run),
      analysis: analyzeRun(run),
    });
    expect(profileScore({ xml: sample, timing: "GameTime", luckMarks: MARKS })).toStrictEqual(scoreRun(run));
    // A file replacing one in the profile keeps that category's clock.
    expect(profileScore({ xml: sample, timing: { kept: { [CATEGORY]: "GameTime" } }, luckMarks: MARKS })).toStrictEqual(scoreRun(run));
    expect(profileScore({ xml: sample, timing: { kept: {} }, luckMarks: {} })?.timingMethod).toBe("RealTime");
    expect(profileScore({ xml: "not a split file", timing: null, luckMarks: {} })).toBeNull();
    expect(splitsFingerprint(sample)).toEqual({
      rawNames: parseLss(sample).segments.map((s) => s.rawName),
      attempts: parseLss(sample).attemptCount,
      completed: parseLss(sample).attempts.filter((a) => a.time != null).length,
    });
  });

  // A worker hands results back as structured clones: anything that doesn't survive one unchanged
  // (a function, a class instance) would change what the page shows.
  it.each(FILES)("come back from a worker unchanged (%s)", (_, xml) => {
    for (const timing of [null, "GameTime"] as const) {
      const results = [
        runPage({ xml, timing, luckMarks: {} }),
        liveRead({ xml, timing, luckMarks: {} }),
        profileScore({ xml, timing, luckMarks: {} }),
        JOBS.readRun({ xml, timingMethod: timing ?? undefined }),
        splitsFingerprint(xml),
      ];
      for (const r of results) expect(structuredClone(r)).toStrictEqual(r);
    }
  });
});

/** A stand-in for the browser's Worker that runs the jobs a turn later, as a real one would. */
class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { preventDefault: () => void }) => void) | null = null;
  terminated = false;
  constructor() {
    FakeWorker.made.push(this);
  }
  postMessage({ id, job, input }: { id: number; job: keyof typeof JOBS; input: never }) {
    setTimeout(() => {
      if (!this.terminated) this.onmessage?.({ data: { id, value: structuredClone(JOBS[job](input)) } });
    });
  }
  terminate() {
    this.terminated = true;
  }
}

describe("background lanes", () => {
  it("run jobs in a worker, and a new file replaces one still being read", async () => {
    FakeWorker.made = [];
    vi.stubGlobal("Worker", FakeWorker);
    const { inBackground, Superseded } = await import("../src/analysis/background");
    const old = inBackground("run", "runPage", { xml: sample, timing: null, luckMarks: {} }, sample);
    const other = fixture("livesplit1.5.lss");
    const now = inBackground("run", "runPage", { xml: other, timing: null, luckMarks: {} }, other);
    await expect(old).rejects.toBeInstanceOf(Superseded);
    expect(await now).toStrictEqual(runPage({ xml: other, timing: null, luckMarks: {} }));
    expect(FakeWorker.made.map((w) => w.terminated)).toEqual([true, false]);

    // The same file with other marks waits its turn instead.
    const a = inBackground("run", "runPage", { xml: other, timing: null, luckMarks: {} }, other);
    const b = inBackground("run", "runPage", { xml: other, timing: "GameTime", luckMarks: {} }, other);
    await Promise.all([a, b]);
    expect(FakeWorker.made.length).toBe(2);
  });

  it("run jobs on the page when a worker can't start", async () => {
    // Say, the worker's script is refused.
    class BrokenWorker extends FakeWorker {
      postMessage() {
        setTimeout(() => this.onerror?.({ preventDefault: () => {} }));
      }
    }
    FakeWorker.made = [];
    vi.stubGlobal("Worker", BrokenWorker);
    const { inBackground } = await import("../src/analysis/background");
    expect(await inBackground("files", "splitsFingerprint", sample)).toEqual(splitsFingerprint(sample));
    // Later jobs don't try a worker again.
    expect(await inBackground("live", "splitsFingerprint", sample)).toEqual(splitsFingerprint(sample));
    expect(FakeWorker.made.length).toBe(1);
  });
});
