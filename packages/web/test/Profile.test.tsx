import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";

const sample = readFileSync(resolve(__dirname, "../public/sample.lss"), "utf8");
const kirby = readFileSync(resolve(__dirname, "../../core/test/fixtures/livesplit-core/livesplit1.5.lss"), "utf8");

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
Element.prototype.scrollIntoView = () => {};
window.scrollTo = () => {};

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
});
afterEach(cleanup);

const upload = (...files: Array<[string, string]>) =>
  fireEvent.change(screen.getByTestId("file-input"), {
    target: { files: files.map(([xml, name]) => new File([xml], name)) },
  });

describe("category score on the run page", () => {
  it("shows the score and adds the run to the profile", async () => {
    render(<App />);
    upload([sample, "dishonored.lss"]);
    const section = await screen.findByRole("region", { name: "How well you run this category" });
    expect(section.textContent).toMatch(/63\/100/);
    expect(section.textContent).toMatch(/Biggest drag: completion/);

    fireEvent.click(within(section).getByRole("button", { name: "Add to your profile" }));
    expect(section.textContent).toMatch(/This category is in your profile/);
    expect(JSON.parse(localStorage.getItem("speedrunner.profile.v1")!)).toHaveLength(1);
  });
});

describe("profile", () => {
  it("scores several files and averages the firm ones", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: "Profile" }));
    expect(screen.getByRole("heading", { name: "Your runner profile" })).toBeTruthy();

    upload([sample, "dishonored.lss"], [kirby, "kirby.lss"]);
    await screen.findByRole("heading", { name: "Runner profile" });
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(4));

    const scores = screen.getByRole("table", { name: "Profile scores" });
    // Kirby has no finished runs in its history, so it's provisional and left out of the overall score.
    expect(scores.textContent).toMatch(/Overall score.*63/);
    expect(screen.getByText("provisional")).toBeTruthy();

    // Kirby's file has a World Record comparison, so its pace shows without typing anything.
    fireEvent.click(screen.getByRole("button", { name: "Kirby's Dream Land Normal" }));
    const detail = screen.getByRole("region", { name: "Kirby's Dream Land Normal" });
    expect(detail.textContent).toMatch(/from your "World Record" comparison/);
  });

  it("uses a typed reference time and keeps it after a reload", async () => {
    const { unmount } = render(<App />);
    upload([sample, "dishonored.lss"]);
    fireEvent.click(await screen.findByRole("button", { name: "Add to your profile" }));
    fireEvent.click(screen.getByRole("link", { name: "Profile" }));

    fireEvent.change(screen.getByLabelText("Reference time"), { target: { value: "36:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    // 36:00 ÷ 40:01.52 = 89.9%.
    expect(screen.getByRole("region", { name: "Dishonored Any%" }).textContent).toMatch(/at 89\.9% of the reference pace/);

    unmount();
    render(<App />);
    expect(screen.getByRole("region", { name: "Dishonored Any%" }).textContent).toMatch(/36:00\.00, typed in/);
  });

  it("rejects a reference time it can't read", async () => {
    render(<App />);
    upload([sample, "dishonored.lss"]);
    fireEvent.click(await screen.findByRole("button", { name: "Add to your profile" }));
    fireEvent.click(screen.getByRole("link", { name: "Profile" }));
    fireEvent.change(screen.getByLabelText("Reference time"), { target: { value: "soon" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert").textContent).toMatch(/hours, minutes and seconds/);
  });
});
