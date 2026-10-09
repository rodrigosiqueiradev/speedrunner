import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";

const sample = readFileSync(resolve(__dirname, "../public/sample.lss"), "utf8");

afterEach(cleanup);

// jsdom has no Blob.text(); browsers do.
if (!Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise((ok) => {
      const reader = new FileReader();
      reader.onload = () => ok(reader.result as string);
      reader.readAsText(this);
    });
  };
}

describe("App", () => {
  it("analyses an uploaded split file", async () => {
    render(<App />);
    const file = new File([sample], "dishonored.lss");
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole("heading", { name: /Dishonored/ })).toBeTruthy());
    expect(screen.getAllByText("40:01.52").length).toBeGreaterThan(0);
    expect(screen.getAllByText("gold ignored").length).toBeGreaterThan(0);

    // Switching to game time recomputes the PB.
    fireEvent.click(screen.getByRole("button", { name: "Game time" }));
    await waitFor(() => expect(screen.getAllByText("37:37.97").length).toBeGreaterThan(0));
  });

  it("shows session insights only where the data backs them", async () => {
    render(<App />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File([sample], "d.lss")] } });
    const section = await screen.findByRole("region", { name: "How your sessions go" });
    expect(section.textContent).toMatch(/185 sessions\s*from 1,788 attempts/);
    expect(section.textContent).toMatch(/After a near-PB\s*Not enough data/);

    // Each check and chart explains itself in a tooltip, with a full entry in How it's calculated.
    fireEvent.click(screen.getByRole("button", { name: "How is Fatigue calculated?" }));
    expect(screen.getByRole("note").textContent).toMatch(/pace or reset rate/);
    expect(screen.getAllByRole("button", { name: "How is How long you'd been playing calculated?" }).length).toBe(1);
    const how = screen.getByRole("region", { name: "How it's calculated" });
    expect(how.querySelector("#how-fatigue")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Pace by how long you'd been playing" })).toBeTruthy();
  });

  it("explains how each number is calculated", async () => {
    render(<App />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File([sample], "d.lss")] } });
    await screen.findByRole("heading", { name: /Dishonored/ });

    // The ? next to a metric opens a short explanation.
    fireEvent.click(screen.getByRole("button", { name: "How is Realistic target calculated?" }));
    expect(screen.getByRole("note").textContent).toMatch(/good attempt/);

    // Every column of the segment table has its own explanation.
    for (const label of ["Gold", "Typical", "Save to gold", "Good-day save", "Variability", "Reset rate"]) {
      expect(screen.getAllByRole("button", { name: `How is ${label} calculated?` }).length).toBeGreaterThan(0);
    }

    // The How it's calculated section works the formula through with the loaded run.
    const how = screen.getByRole("region", { name: "How it's calculated" });
    expect(how.textContent).toMatch(/40:01\.52 − .* = 39:50\.66/);
    expect(how.textContent).toMatch(/50 clean times/);
  });

  it("highlights a segment picked on the route strip", async () => {
    Element.prototype.scrollIntoView = () => {};
    render(<App />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File([sample], "d.lss")] } });
    await screen.findByRole("heading", { name: /Dishonored/ });
    fireEvent.click(screen.getByRole("button", { name: /^Troubled Waters: / }));
    expect(document.getElementById("segment-7")?.className).toBe("selected");
  });

  it("explains what to do when a file isn't valid splits", async () => {
    render(<App />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File(["<Layout/>"], "x.lss")] } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/saved from LiveSplit/));
  });

  it("rejects files that aren't .lss", async () => {
    render(<App />);
    const file = new File(["hello"], "notes.txt");
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/isn't a LiveSplit/));
  });
});
