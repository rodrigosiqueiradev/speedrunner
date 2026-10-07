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
    expect(screen.getByText("Personal best")).toBeTruthy();
    expect(screen.getByText("40:01.52")).toBeTruthy();
    expect(screen.getAllByText("⚠ gold ignored", { exact: false }).length).toBeGreaterThan(0);

    // Switching to game time recomputes the PB.
    fireEvent.click(screen.getByRole("button", { name: "Game time" }));
    await waitFor(() => expect(screen.getByText("37:37.97")).toBeTruthy());
  });

  it("rejects files that aren't .lss", async () => {
    render(<App />);
    const file = new File(["hello"], "notes.txt");
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/isn't a LiveSplit/));
  });
});
