import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

const sample = readFileSync(resolve(__dirname, "../public/sample.lss"), "utf8");

afterEach(() => {
  cleanup();
  // Tabs live in the URL hash; start each test on the overview.
  history.replaceState(null, "", "/");
});

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
    expect(screen.getAllByText("40:01.51").length).toBeGreaterThan(0);
    expect(screen.getAllByText("gold ignored").length).toBeGreaterThan(0);

    // Switching to game time recomputes the PB.
    fireEvent.click(screen.getByRole("button", { name: "Game time" }));
    await waitFor(() => expect(screen.getAllByText("37:37.96").length).toBeGreaterThan(0));
  });

  it("shows session insights only where the data backs them", async () => {
    render(<App />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File([sample], "d.lss")] } });
    fireEvent.click(await screen.findByRole("tab", { name: "Sessions" }));
    const section = screen.getByRole("region", { name: "How your sessions go" });
    expect(section.textContent).toMatch(/188 sessions\s*from 1,788 attempts/);
    expect(section.textContent).toMatch(/After a near-PB\s*Not enough data/);
    // Checks that found nothing fold under one line.
    expect(section.querySelector("details.quiet-findings summary")?.textContent).toMatch(/need more sessions/);

    // Each check and chart explains itself in a tooltip, with a full entry in How it's calculated.
    fireEvent.click(screen.getByRole("button", { name: "How is Fatigue calculated?" }));
    expect(screen.getByRole("note").textContent).toMatch(/pace or reset rate/);
    expect(screen.getAllByRole("button", { name: "How is How long you'd been playing calculated?" }).length).toBe(1);
    expect(document.getElementById("how-fatigue")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Pace by how long you'd been playing" })).toBeTruthy();
  });

  it("lets the runner mark luck-based segments, saved per category", async () => {
    localStorage.clear();
    render(<App />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File([sample], "d.lss")] } });
    fireEvent.click(await screen.findByRole("tab", { name: "Segments" }));
    const box = screen.getByRole("checkbox", { name: "Luck decides RNG Roulette" }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    // Its name says RNG, so it's suggested; nothing else is.
    expect(screen.getAllByText("Looks like luck").length).toBe(1);

    fireEvent.click(box);
    await waitFor(() => expect(box.checked).toBe(true));
    expect(screen.queryByText("Looks like luck")).toBeNull();
    expect(screen.getByText(/Good luck \d+%/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("speedrunner.luck.v1")!)).toEqual({ "dishonored|any%": ["RNG Roulette"] });
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    expect(screen.getByText(/needing good luck in 1 segment \(\d+% of runs get it\)/)).toBeTruthy();

    // The mark comes back with the file.
    cleanup();
    render(<App />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File([sample], "d.lss")] } });
    fireEvent.click(await screen.findByRole("tab", { name: "Segments" }));
    expect((screen.getByRole("checkbox", { name: "Luck decides RNG Roulette" }) as HTMLInputElement).checked).toBe(true);
    localStorage.clear();
  });

  it("explains how each number is calculated", async () => {
    render(<App />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File([sample], "d.lss")] } });
    await screen.findByRole("heading", { name: /Dishonored/ });

    // The ? next to a metric opens a short explanation.
    // The first one is in the run totals at the top.
    fireEvent.click(screen.getAllByRole("button", { name: "How is Realistic target calculated?" })[0]);
    expect(screen.getByRole("note").textContent).toMatch(/good attempt/);

    // Every column of the segment table has its own explanation.
    fireEvent.click(screen.getByRole("tab", { name: "Segments" }));
    for (const label of ["Gold", "Typical", "Save to gold", "Good-day save", "Variability", "Reset rate"]) {
      expect(screen.getAllByRole("button", { name: `How is ${label} calculated?` }).length).toBeGreaterThan(0);
    }

    // The How it's calculated tab works the formula through with the loaded run.
    fireEvent.click(screen.getByRole("tab", { name: "How it's calculated" }));
    const how = screen.getByRole("region", { name: "How it's calculated" });
    expect(how.textContent).toMatch(/40:01\.51 − .* = 39:49\.37/);
    expect(how.textContent).toMatch(/latest half of your clean times \(at least 10, at most 50\)/);
  });

  it("highlights a segment picked on the route strip", async () => {
    Element.prototype.scrollIntoView = () => {};
    render(<App />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File([sample], "d.lss")] } });
    await screen.findByRole("heading", { name: /Dishonored/ });
    fireEvent.click(screen.getByRole("button", { name: /^Troubled Waters: / }));
    expect(screen.getByRole("tab", { name: "Segments" }).getAttribute("aria-selected")).toBe("true");
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

  it("opens ?sample on the run page only, once, without adding it to the profile", async () => {
    localStorage.clear();
    const fetchSample = vi.fn(async () => new Response(sample));
    vi.stubGlobal("fetch", fetchSample);
    history.replaceState(null, "", "/?sample#profile");
    render(<App />);
    await screen.findByRole("heading", { name: "Your runner profile" });
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSample).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("speedrunner.profile.v3") ?? "[]")).toEqual([]);

    fireEvent.click(screen.getByRole("link", { name: "Analyse a run" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /Dishonored/ })).toBeTruthy());
    expect(window.location.search).toBe("");

    // Going elsewhere and back doesn't open it again or touch the profile.
    fireEvent.click(screen.getByRole("link", { name: "Profile" }));
    fireEvent.click(screen.getByRole("link", { name: "Analyse a run" }));
    expect(fetchSample).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("speedrunner.profile.v3") ?? "[]")).toEqual([]);
    vi.unstubAllGlobals();
  });
});
