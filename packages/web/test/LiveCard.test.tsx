import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EMPTY_SESSION, liveContext, liveStats, parseLss, pbOdds, replayAttempt, replayLength, replaySnapshot, replayableAttempts } from "@speedrunner/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveCard } from "../src/components/LiveCard";
import { DEFAULT_CHOICES, LIVE_STATS, normalizeChoices } from "../src/live/stats";

const run = parseLss(readFileSync(resolve(__dirname, "../public/sample.lss"), "utf8"));
const ctx = liveContext(run, pbOdds(run, { simulations: 1000 }));

afterEach(cleanup);

describe("live stats card", () => {
  it("says the PB chance before the first split includes a run-ending mistake", () => {
    const how = LIVE_STATS.find((s) => s.id === "pbChance")!.doc.how;
    expect(how).toContain(
      "Before the first split it's the chance a run you start now beats your PB and has no run-ending mistake, including in the first segment.",
    );
  });

  it("shows the chosen stats in the chosen order", () => {
    const replay = replayAttempt(run, replayableAttempts(run).at(-1)!, ctx);
    const stats = liveStats(ctx, replaySnapshot(replay, replayLength(replay) / 2));
    const choices = [
      { id: "likelyFinish", shown: true },
      { id: "split", shown: true },
      { id: "pbChance", shown: false },
    ];
    render(<LiveCard title="Dishonored · Any%" stats={stats} session={EMPTY_SESSION} status={{ kind: "demo", attempt: 1 }} choices={choices} />);
    const labels = screen.getAllByRole("term").map((t) => t.textContent);
    expect(labels).toEqual(["Likely finish", "Split"]);
    expect(screen.getByText(/ \/ 13$/)).toBeTruthy();
    expect(screen.getByText("Demo")).toBeTruthy();
  });

  it("shows the next segment and the run against the realistic target or a goal", () => {
    const pb = run.segments.map((s) => s.pbSplit!);
    const snap = { phase: "Running" as const, splitIndex: 2, currentTime: pb[1] + 1000, splitTimes: [pb[0], pb[1]] };
    const choices = [{ id: "next", shown: true }, { id: "goal", shown: true }];
    const card = (c = ctx) => (
      <LiveCard title="Dishonored · Any%" stats={liveStats(c, snap)} session={EMPTY_SESSION} status={{ kind: "demo", attempt: 1 }} choices={choices} />
    );
    render(card());
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual(["Up next", "vs goal"]);
    expect(screen.getByText(new RegExp(`^${run.segments[3].name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} · gold `))).toBeTruthy();
    expect(screen.getByText("realistic target · live")).toBeTruthy();
    cleanup();
    render(card(liveContext(run, ctx.odds, ctx.analysis, 2_400_000)));
    expect(screen.getByText("sub 40:00 · live")).toBeTruthy();
    cleanup();
    // A goal past every gold has no splits.
    render(card(liveContext(run, ctx.odds, ctx.analysis, 60_000)));
    expect(screen.getByText("Out of reach")).toBeTruthy();
    cleanup();
    // During a segment both tick with the timer.
    const late = { ...snap, currentTime: pb[2] + 5000 };
    render(
      <LiveCard
        title="Dishonored · Any%"
        stats={liveStats(ctx, late)}
        session={EMPTY_SESSION}
        status={{ kind: "demo", attempt: 1 }}
        choices={[{ id: "delta", shown: true }, { id: "goal", shown: true }]}
      />,
    );
    expect(screen.getByText("+5.00s")).toBeTruthy();
    expect(screen.getByText(`live · ${run.segments[2].name}`)).toBeTruthy();
    expect(screen.getByText("realistic target · live")).toBeTruthy();
  });

  it("says why nothing moves when LiveSplit isn't answering", () => {
    render(
      <LiveCard
        title="Dishonored · Any%"
        stats={liveStats(ctx, { phase: "NotRunning", splitIndex: -1, currentTime: null, splitTimes: [] })}
        session={EMPTY_SESSION}
        status={{ kind: "offline", reason: "LiveSplit isn't answering.", retry: true }}
        choices={DEFAULT_CHOICES}
      />,
    );
    expect(screen.getByText("Not connected")).toBeTruthy();
    expect(screen.getByText(/LiveSplit isn't answering. Trying again/)).toBeTruthy();
  });

  it("doesn't promise to try again when the address itself can't work", () => {
    render(
      <LiveCard
        title="Dishonored · Any%"
        stats={liveStats(ctx, { phase: "NotRunning", splitIndex: -1, currentTime: null, splitTimes: [] })}
        session={EMPTY_SESSION}
        status={{ kind: "offline", reason: "Live stats only reads LiveSplit on this computer.", retry: false }}
        choices={DEFAULT_CHOICES}
      />,
    );
    expect(screen.getByText("Live stats only reads LiveSplit on this computer.")).toBeTruthy();
    expect(screen.queryByText(/Trying again/)).toBeNull();
  });

  it("keeps a saved choice and adds new stats hidden at the end", () => {
    const saved = [{ id: "delta", shown: true }, { id: "gone", shown: true }, { id: "split", shown: false }];
    const out = normalizeChoices(saved);
    expect(out.slice(0, 2)).toEqual([{ id: "delta", shown: true }, { id: "split", shown: false }]);
    expect(out).toHaveLength(LIVE_STATS.length);
    expect(out.slice(2).every((c) => !c.shown)).toBe(true);
    expect(normalizeChoices(null)).toEqual(DEFAULT_CHOICES);
  });
});

describe("card style", () => {
  it("falls back to the standard look for anything missing or malformed", async () => {
    const { DEFAULT_STYLE, normalizeStyle } = await import("../src/live/style");
    expect(normalizeStyle(undefined)).toEqual(DEFAULT_STYLE);
    const s = normalizeStyle({ background: "#000000", text: "red", valueSize: 400, labelSize: "big" });
    expect(s.background).toBe("#000000");
    expect(s.text).toBe(DEFAULT_STYLE.text);
    expect(s.valueSize).toBe(48);
    expect(s.labelSize).toBe(DEFAULT_STYLE.labelSize);
  });

  it("warns about colours that are hard to read on the background", async () => {
    const { DEFAULT_STYLE, lowContrast } = await import("../src/live/style");
    expect(lowContrast(DEFAULT_STYLE)).toEqual([]);
    expect(lowContrast({ ...DEFAULT_STYLE, text: "#1a2333" })).toEqual(["Values"]);
  });

  it("applies the style to the card", () => {
    const stats = liveStats(ctx, { phase: "NotRunning", splitIndex: -1, currentTime: null, splitTimes: [] });
    const look = { background: "#00ff00", text: "#000000", labels: "#222222", ahead: "#0000ff", gold: "#aa8800", down: "#ff0000", valueSize: 30, labelSize: 16 };
    render(<LiveCard title="x" stats={stats} session={EMPTY_SESSION} status={null} choices={DEFAULT_CHOICES} look={look} />);
    const card = screen.getByRole("region", { name: "Live stats" });
    expect(card.style.getPropertyValue("--card-bg")).toBe("#00ff00");
    expect(card.style.getPropertyValue("--live-value-size")).toBe("30px");
  });
});
