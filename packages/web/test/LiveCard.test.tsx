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

  it("says why nothing moves when LiveSplit isn't answering", () => {
    render(
      <LiveCard
        title="Dishonored · Any%"
        stats={liveStats(ctx, { phase: "NotRunning", splitIndex: -1, currentTime: null, splitTimes: [] })}
        session={EMPTY_SESSION}
        status={{ kind: "offline", reason: "LiveSplit isn't answering." }}
        choices={DEFAULT_CHOICES}
      />,
    );
    expect(screen.getByText("Not connected")).toBeTruthy();
    expect(screen.getByText("LiveSplit isn't answering.")).toBeTruthy();
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
