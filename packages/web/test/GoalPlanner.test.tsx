import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseLss } from "@speedrunner/core";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

const sample = readFileSync(resolve(__dirname, "../public/sample.lss"), "utf8");

afterEach(() => {
  cleanup();
  // Tabs live in the URL hash; start each test on the overview.
  history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

if (!Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise((ok) => {
      const reader = new FileReader();
      reader.onload = () => ok(reader.result as string);
      reader.readAsText(this);
    });
  };
}

async function loadSample() {
  render(<App />);
  fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File([sample], "dishonored.lss")] } });
  await screen.findByRole("heading", { name: /Dishonored/ });
  fireEvent.click(screen.getByRole("tab", { name: "Practise" }));
  return screen.getByRole("region", { name: "What does your goal take?" });
}

describe("Goal planner", () => {
  it("plans the next round time under the PB", async () => {
    const goal = await loadSample();
    expect(within(goal).getByLabelText("Goal: sub")).toHaveProperty("value", "40:00");
    expect(goal.textContent).toMatch(/Sub 40:00 needs 1\.52s: 1\.42s from Troubled Waters and 0\.11s from WatchYr<3Die\./);
    expect(goal.textContent).toMatch(/about 1 in 2 of your recent attempts/);
    expect(within(goal).getAllByRole("row")).toHaveLength(3);
  });

  it("says when a goal is beyond the sum of best", async () => {
    const goal = await loadSample();
    fireEvent.change(within(goal).getByLabelText("Goal: sub"), { target: { value: "39:00" } });
    expect(goal.textContent).toMatch(/Sub 39:00 is 6\.37s faster than every segment at its gold/);
    expect(within(goal).queryByRole("table")).toBeNull();
  });

  it("saves a copy of the splits with the comparisons", async () => {
    await loadSample();
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob) => ((blob = b), "blob:x"));
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("dishonored (with comparisons).lss");
    });

    const exportSection = screen.getByRole("region", { name: "Race these in LiveSplit" });
    fireEvent.click(within(exportSection).getByRole("checkbox", { name: /Recent golds/ }));
    fireEvent.click(within(exportSection).getByRole("button", { name: "Save a copy with these comparisons" }));

    expect(click).toHaveBeenCalledOnce();
    expect(within(exportSection).getByRole("status").textContent).toBe("Saved dishonored (with comparisons).lss.");
    const written = parseLss(await blob!.text());
    expect(written.comparisons.map((c) => c.name).slice(-2)).toEqual(["Realistic target", "Sub 40:00 (balanced)"]);
    // Game time gets the realistic target too, since the file has game times.
    const gameTime = parseLss(await blob!.text(), { timingMethod: "GameTime" });
    expect(gameTime.comparisons.find((c) => c.name === "Realistic target")?.time).not.toBeNull();
  });
});

describe("Goal planner explanations", () => {
  it("explains each part in a tooltip that links to How it's calculated", async () => {
    const goal = await loadSample();
    fireEvent.click(within(goal).getByRole("button", { name: "How is Goal plan calculated?" }));
    const note = within(goal).getByRole("note");
    expect(note.textContent).toMatch(/least demanding/);
    const exportSection = screen.getByRole("region", { name: "Race these in LiveSplit" });
    for (const label of ["Saving comparisons", "Realistic target", "Sub goal (balanced)", "Recent golds"]) {
      expect(within(exportSection).getByRole("button", { name: `How is ${label} calculated?` })).toBeTruthy();
    }

    // The link in the tooltip opens the How it's calculated tab at that entry.
    Element.prototype.scrollIntoView = () => {};
    fireEvent.click(within(note).getByRole("link", { name: "How it's calculated" }));
    expect(screen.getByRole("tab", { name: "How it's calculated" }).getAttribute("aria-selected")).toBe("true");
    const how = screen.getByRole("region", { name: "How it's calculated" });
    expect(how.querySelector<HTMLDetailsElement>("#how-goal-plan")?.open).toBe(true);
    expect(how.querySelector("#how-recent-golds")).not.toBeNull();
  });
});
