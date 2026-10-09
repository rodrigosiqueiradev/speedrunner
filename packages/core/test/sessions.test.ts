import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeSessions, groupSessions, parseLiveSplitDate, parseLss, type Run } from "../src/index.js";

const utc = (ms: number) => ({ hour: new Date(ms).getUTCHours(), weekday: new Date(ms).getUTCDay() });

/** LiveSplit's timestamp format for a UTC epoch time. */
function stamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/** A deterministic pseudo-random number in [-1, 1). */
function jitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

interface PlannedAttempt {
  start: number;
  /** Multiplier on every segment time (1.05 = 5% slower), or one per segment. */
  slow?: number | ((segment: number) => number);
  /** Segments completed before resetting; omit to finish. */
  resetAfter?: number;
}

/** Builds a run (6 one-minute segments by default) from planned attempts, with ±2% noise per segment. */
function plannedRun(plan: PlannedAttempt[], base = [60_000, 60_000, 60_000, 60_000, 60_000, 60_000]): Run {
  const segments = base.map((_, i) => ({ name: `S${i + 1}`, pbSplit: null, gold: null, history: new Map<number, number | null>() }));
  const attempts = plan.map((p, k) => {
    const id = k + 1;
    const stop = p.resetAfter ?? base.length;
    let total = 0;
    for (let i = 0; i < stop; i++) {
      const slow = typeof p.slow === "function" ? p.slow(i) : (p.slow ?? 1);
      const t = Math.round(base[i] * slow * (1 + 0.02 * jitter(id * 7 + i)));
      segments[i].history.set(id, t);
      total += t;
    }
    const finished = stop === base.length;
    return { id, started: stamp(p.start), ended: stamp(p.start + total), time: finished ? total : null };
  });
  return { game: "Plan", category: "Any%", timingMethod: "RealTime", attemptCount: attempts.length, attempts, segments, comparisons: [] };
}

const DAY = 86_400_000;
const MIN = 60_000;
const T0 = Date.UTC(2026, 0, 5, 18, 0, 0); // a Monday, 18:00 UTC

/** `sessions` daily sessions of `perSession` attempts, 8 minutes apart. */
function daily(sessions: number, perSession: number, shape: (session: number, index: number) => Omit<PlannedAttempt, "start"> = () => ({})) {
  const plan: PlannedAttempt[] = [];
  for (let s = 0; s < sessions; s++) for (let i = 0; i < perSession; i++) plan.push({ start: T0 + s * DAY + i * 8 * MIN, ...shape(s, i) });
  return plan;
}

const finding = (run: Run, kind: string) => analyzeSessions(run, { localTime: utc }).findings.find((f) => f.kind === kind)!;

describe("groupSessions", () => {
  it("parses LiveSplit's UTC timestamps", () => {
    expect(parseLiveSplitDate("04/14/2016 22:35:33")).toBe(Date.UTC(2016, 3, 14, 22, 35, 33));
    expect(parseLiveSplitDate("13/14/2016 22:35:33")).toBeNull();
    expect(parseLiveSplitDate(undefined)).toBeNull();
  });

  it("starts a new session after a break longer than 30 minutes", () => {
    const at = (min: number, len = 5) => ({ id: min, started: stamp(T0 + min * MIN), ended: stamp(T0 + (min + len) * MIN), time: null });
    const sessions = groupSessions([at(0), at(10), at(44), at(90), { id: 999, time: null }]);
    expect(sessions.map((s) => s.attempts.map((a) => a.attempt.id))).toEqual([[0, 10, 44], [90]]);
    expect(sessions[0].attempts[2].minutesIn).toBe(44);
    expect(sessions[1].attempts[0].indexInSession).toBe(0);
  });
});

describe("analyzeSessions", () => {
  it("says so when the file has no attempt dates", () => {
    const run = plannedRun(daily(10, 5));
    run.attempts.forEach((a) => (a.started = a.ended = undefined));
    const r = analyzeSessions(run);
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/no attempt dates/);
  });

  it("finds a warm-up when the first minutes of each session are slower", () => {
    const run = plannedRun(daily(12, 8, (_, i) => ({ slow: i < 3 ? 1.05 : 1 })));
    const f = finding(run, "warm-up");
    expect(f.status).toBe("clear");
    expect(f.message).toMatch(/^In the first 20 minutes of a session you run [45]\.\d% slower/);
  });

  it("states no effect when sessions are steady", () => {
    const run = plannedRun(daily(12, 8));
    for (const kind of ["warm-up", "peak-window", "time-of-day"]) expect(finding(run, kind).status).not.toBe("clear");
    expect(finding(run, "warm-up").status).toBe("no-effect");
  });

  it("holds back with too few sessions", () => {
    const run = plannedRun(daily(5, 8));
    const r = analyzeSessions(run, { localTime: utc });
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/at least 8 sessions/);
  });

  it("finds the stretch of a session where runs go best", () => {
    const run = plannedRun(daily(12, 25, (_, i) => ({ slow: i * 8 >= 40 && i * 8 < 120 ? 0.96 : 1 })));
    const f = finding(run, "peak-window");
    expect(f.status).toBe("clear");
    expect(f.message).toMatch(/^You run best between 40 min and 2 hours into a session: \d\.\d% faster/);
  });

  it("finds fatigue when resets climb late in long sessions", () => {
    // 25 attempts 8 minutes apart: about 3h20 per session. After 2 hours most runs reset.
    const run = plannedRun(daily(12, 25, (s, i) => ({ resetAfter: i * 8 >= 120 ? (i % 5 === 0 ? undefined : 2) : i % 5 === 0 ? 2 : undefined })));
    const f = finding(run, "fatigue");
    expect(f.status).toBe("clear");
    expect(f.message).toMatch(/^After 2 hours, your reset rate goes from 20% to 80%/);
  });

  it("finds fatigue inside long runs with few attempts per session", () => {
    // Ten days of one 5-hour run (30 ten-minute segments). On odd days the run starts after an hour of
    // quick resets, so the same segments land at different times. Anything played after 2 hours is 5% slower.
    const plan: PlannedAttempt[] = [];
    for (let s = 0; s < 10; s++) {
      const warm = s % 2 === 1 ? 6 : 0;
      for (let k = 0; k < warm; k++) plan.push({ start: T0 + s * DAY + k * 10 * MIN, resetAfter: 0 });
      const offset = warm * 10;
      plan.push({ start: T0 + s * DAY + offset * MIN, slow: (i) => (offset + i * 10 >= 120 ? 1.05 : 1) });
    }
    const r = analyzeSessions(plannedRun(plan, Array(30).fill(600_000)), { localTime: utc });
    const f = r.findings.find((x) => x.kind === "fatigue")!;
    expect(f.status).toBe("clear");
    expect(f.message).toMatch(/^After (1.5|2|2.5) hours, your splits run \d\.\d% slower/);
  });

  it("can't see fatigue when every run plays each segment at the same time", () => {
    // Same runs, always started fresh: segment 13 is always slow, so it's just how long segment 13 takes.
    const plan = Array.from({ length: 10 }, (_, s) => ({ start: T0 + s * DAY, slow: (i: number) => (i >= 12 ? 1.05 : 1) }));
    const f = finding(plannedRun(plan, Array(30).fill(600_000)), "fatigue");
    expect(f.status).toBe("no-effect");
  });

  it("finds tilt when a late reset is followed by an early reset", () => {
    // Every 4th attempt resets at the last split; the attempt after it resets in the first segment.
    const run = plannedRun(daily(12, 8, (_, i) => ({ resetAfter: i % 4 === 1 ? 5 : i % 4 === 2 ? 1 : undefined })));
    const f = finding(run, "tilt-late-reset");
    expect(f.status).toBe("clear");
    expect(f.message).toMatch(/resets early 100% of the time, against 0% usually/);
  });

  it("finds a time-of-day effect from sessions, not single attempts", () => {
    // Alternate morning and evening sessions; evenings are 4% faster.
    const plan: PlannedAttempt[] = [];
    for (let s = 0; s < 20; s++) {
      const start = T0 + s * DAY - (s % 2 === 0 ? 9 * 60 * MIN : 0); // 9:00 or 18:00
      for (let i = 0; i < 5; i++) plan.push({ start: start + i * 8 * MIN, slow: s % 2 === 0 ? 1.04 : 1 });
    }
    const f = finding(plannedRun(plan), "time-of-day");
    expect(f.status).toBe("clear");
    expect(f.message).toMatch(/You run 4\.\d% (slower in sessions you start in the morning|faster in sessions you start in the evening)/);
  });

  it("stays honest on a real file", () => {
    const xml = readFileSync(resolve(__dirname, "fixtures/livesplit-core/livesplit1.6_gametime.lss"), "utf8");
    const r = analyzeSessions(parseLss(xml), { localTime: utc });
    expect(r.available).toBe(true);
    expect(r.sessions).toBe(185);
    expect(r.findings).toHaveLength(7);
    // Few runs get late in this file, so tilt can't be judged yet.
    expect(r.findings.find((f) => f.kind === "tilt-near-pb")!.status).toBe("not-enough-data");
    for (const f of r.findings) expect(f.message.length).toBeGreaterThan(10);
  });

  it("returns nothing for a file with no attempt history", () => {
    const xml = readFileSync(resolve(__dirname, "fixtures/livesplit-core/livesplit1.0.lss"), "utf8");
    expect(analyzeSessions(parseLss(xml)).available).toBe(false);
  });
});
