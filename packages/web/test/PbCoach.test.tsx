import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pbOdds, parseLss } from "@speedrunner/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PbOddsSummary, ResetCoach } from "../src/components/PbCoach";

const sample = readFileSync(resolve(__dirname, "../public/sample.lss"), "utf8");
const odds = pbOdds(parseLss(sample))!;

afterEach(cleanup);

describe("PB odds and reset coach", () => {
  it("says when the PB is out of reach at current form", () => {
    render(<PbOddsSummary odds={odds} />);
    const table = screen.getByRole("table", { name: "PB odds" });
    expect(table.textContent).toMatch(/None of 20,000 simulated attempts/);
    expect(table.textContent).toMatch(/Typical finish 4\d:\d\d\.\d\d/);
    expect(screen.getByText(/faster than your typical finish today/)).toBeTruthy();
  });

  it("gives odds and advice for a split and a deficit", () => {
    render(<ResetCoach odds={odds} />);
    const split = odds.splits.find((s) => (s.onPace ?? 0) > 0.01)!;
    fireEvent.change(screen.getByLabelText("At split"), { target: { value: String(split.index) } });
    fireEvent.change(screen.getByLabelText("Seconds behind PB"), { target: { value: "-5" } });
    expect(screen.getByRole("status").textContent).toMatch(/^Keep going: .*% of runs from here still PB/);

    fireEvent.change(screen.getByLabelText("Seconds behind PB"), { target: { value: "120" } });
    expect(screen.getByRole("status").textContent).toMatch(/No run from here beat your PB/);

    fireEvent.change(screen.getByLabelText("Seconds behind PB"), { target: { value: "" } });
    expect(screen.getByRole("status").textContent).toMatch(/Type how many seconds/);
  });

  it("lists every split with its on-pace odds once asked", () => {
    render(<ResetCoach odds={odds} />);
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `Show the odds at each of the ${odds.splits.length} splits` }));
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(odds.splits.length + 1);
    for (const label of ["PB chance from a split", "Reset when behind by", "Practice value"]) {
      expect(screen.getByRole("button", { name: `How is ${label} calculated?` })).toBeTruthy();
    }
  });

  it("forecasts attempts and a date when a PB is within reach", () => {
    const run = parseLss(sample);
    // Pretend the PB is the typical finish so it's well within reach.
    const last = run.segments.at(-1)!;
    const slower = { ...run, segments: run.segments.map((s) => (s === last ? { ...s, pbSplit: odds.goodFinish } : s)) };
    const reachable = pbOdds(slower, { now: new Date("2026-10-09T00:00:00Z") })!;
    render(<PbOddsSummary odds={reachable} />);
    const table = screen.getByRole("table", { name: "PB odds" });
    expect(table.textContent).toMatch(/1 in \d+/);
    expect(table.textContent).toMatch(/\d+ attempts/);
    expect(table.textContent).toMatch(/a day, around/);
  });
});
