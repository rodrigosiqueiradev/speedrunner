import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";

const sample = readFileSync(resolve(__dirname, "../public/sample.lss"), "utf8");

afterEach(cleanup);

if (!Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise((ok) => {
      const reader = new FileReader();
      reader.onload = () => ok(reader.result as string);
      reader.readAsText(this);
    });
  };
}

const minutesIn = (plan: HTMLElement) =>
  within(plan)
    .getAllByText(/^\d+ min$/)
    .reduce((a, el) => a + parseInt(el.textContent!, 10), 0);

describe("practice plan", () => {
  it("plans a session and changes with its length", async () => {
    render(<App />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File([sample], "d.lss")] } });
    await screen.findByRole("heading", { level: 2, name: "Practice plan" });

    const plan = screen.getByRole("list", { name: "60 minute practice plan" });
    expect(minutesIn(plan)).toBe(60);
    const ranking = screen.getByRole("table", { name: "Time saved per hour of practice" });
    expect(within(ranking).getAllByRole("row").length).toBeGreaterThan(5);
    expect(screen.getByText(/takes about/).textContent).toMatch(/off a typical run/);

    fireEvent.click(screen.getByRole("button", { name: "120 min" }));
    expect(minutesIn(screen.getByRole("list", { name: "120 minute practice plan" }))).toBe(120);
  });

  it("explains each number in a tooltip and in How it's calculated", async () => {
    render(<App />);
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File([sample], "d.lss")] } });
    await screen.findByRole("heading", { level: 2, name: "Practice plan" });

    for (const label of ["Practice plan", "Expected save", "Per hour", "Gap to good day", "One rep", "Learning per doubling"]) {
      expect(screen.getAllByRole("button", { name: `How is ${label} calculated?` }).length).toBe(1);
    }
    fireEvent.click(screen.getByRole("button", { name: "How is One rep calculated?" }));
    expect(screen.getByRole("note").textContent).toMatch(/20 seconds/);
    expect(document.getElementById("how-practice-learning")).toBeTruthy();
  });
});
