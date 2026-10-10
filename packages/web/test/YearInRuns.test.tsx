import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";

const sample = readFileSync(resolve(__dirname, "../public/sample.lss"), "utf8");
const kirby = readFileSync(resolve(__dirname, "../../core/test/fixtures/livesplit-core/livesplit1.5.lss"), "utf8");

// jsdom has no Blob.text() or canvas; browsers do.
if (!Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise((ok) => {
      const reader = new FileReader();
      reader.onload = () => ok(reader.result as string);
      reader.readAsText(this);
    });
  };
}
HTMLCanvasElement.prototype.getContext = (() => null) as never;
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

describe("year in runs", () => {
  it("recaps the newest year and switches to an earlier one", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: "Year in runs" }));
    expect(screen.getByRole("heading", { name: "Your year in runs" })).toBeTruthy();

    upload([sample, "dishonored.lss"]);
    await screen.findByRole("heading", { name: "Year in runs 2017" });
    const card = screen.getByRole("img");
    expect(card.getAttribute("aria-label")).toMatch(/^2017: Attempts \d+, Hours played \d+/);
    expect(card.getAttribute("aria-label")).toMatch(/Best gold: /);
    expect(screen.getByRole("button", { name: "Save as PNG" })).toBeTruthy();

    // Each number on the card is explained in a tooltip that links to its full entry.
    fireEvent.click(screen.getByRole("button", { name: "How is Golds calculated?" }));
    expect(screen.getByRole("note").textContent).toMatch(/once it has at least 5/);
    expect(document.getElementById("how-recap-golds")).toBeTruthy();

    // Saving hands the browser (or the desktop app's download handler) a PNG named after the year.
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob(["png"], { type: "image/png" }));
    };
    URL.createObjectURL = () => "blob:card";
    URL.revokeObjectURL = () => {};
    const saved: string[] = [];
    HTMLAnchorElement.prototype.click = function () {
      saved.push(this.download);
    };
    fireEvent.click(screen.getByRole("button", { name: "Save as PNG" }));
    expect(await screen.findByText("Saved as year-in-runs-2017.png in your downloads.")).toBeTruthy();
    expect(saved).toEqual(["year-in-runs-2017.png"]);

    fireEvent.click(screen.getByRole("button", { name: "2016" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Year in runs 2016");
    // 2016 has the first finished runs, so the recap names the PB rather than a time cut.
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/First finish: Dishonored Any%, PB /);
  });

  it("starts from the file open on the run page and says when no file has dates", async () => {
    render(<App />);
    upload([sample, "dishonored.lss"]);
    await screen.findByRole("heading", { name: /Dishonored/ });
    fireEvent.click(screen.getByRole("link", { name: "Year in runs" }));
    expect(screen.getByText("dishonored.lss")).toBeTruthy();

    // Kirby's file is from LiveSplit 1.5, which saved no attempt history; it adds nothing but is listed.
    upload([kirby, "kirby.lss"]);
    expect(await screen.findByText("kirby.lss")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Leave Dishonored Any% out of this recap" }));
    expect(screen.getByRole("alert").textContent).toMatch(/no dated attempts/);
    // A file left out can be put back.
    fireEvent.click(screen.getByRole("button", { name: "Put it back" }));
    await screen.findByRole("heading", { name: "Year in runs 2017" });
  });
});

describe("split files kept with the profile", () => {
  it("are recapped and open on the run page without choosing them again", async () => {
    const first = render(<App />);
    fireEvent.click(screen.getByRole("link", { name: "Profile" }));
    upload([sample, "dishonored.lss"]);
    await screen.findByRole("heading", { name: "Runner profile" });
    first.unmount();

    // After a restart, Year in runs starts from the profile's file.
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: "Year in runs" }));
    await screen.findByRole("heading", { name: "Year in runs 2017" });
    expect(screen.getByText("dishonored.lss")).toBeTruthy();
    // Leaving a profile file out of the recap keeps it in the profile, and it can be put back.
    fireEvent.click(screen.getByRole("button", { name: "Leave Dishonored Any% out of this recap" }));
    fireEvent.click(screen.getByRole("button", { name: "Put it back" }));
    await screen.findByRole("heading", { name: "Year in runs 2017" });

    // The profile opens the category on the run page.
    fireEvent.click(screen.getByRole("link", { name: "Profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyse this run" }));
    expect(await screen.findByRole("heading", { name: /Dishonored/, level: 1 })).toBeTruthy();
    expect(document.querySelector(".run-meta")?.textContent).toMatch(/^dishonored\.lss · /);
  });

  it("are offered on the run page before a file is chosen", async () => {
    const first = render(<App />);
    upload([sample, "dishonored.lss"]);
    fireEvent.click(await screen.findByRole("button", { name: "Add to your profile" }));
    first.unmount();

    render(<App />);
    const list = await screen.findByRole("region", { name: "Or open a run from your profile" });
    expect(list.textContent).toMatch(/PB \d/);
    fireEvent.click(within(list).getByRole("button", { name: "Open Dishonored Any%" }));
    expect(await screen.findByRole("heading", { name: /Dishonored/, level: 1 })).toBeTruthy();
  });

  it("asks for the file again for a category saved before files were kept", async () => {
    localStorage.setItem("speedrunner.profile.v3", JSON.stringify([await profileEntry()]));
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: "Profile" }));
    expect(screen.getByRole("button", { name: "Add old.lss again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Analyse this run" })).toBeNull();
  });
});

async function profileEntry() {
  const { parseLss, scoreRun } = await import("@speedrunner/core");
  const score = scoreRun(parseLss(sample));
  const { categoryKey } = await import("../src/profile");
  return { key: categoryKey(score), fileName: "old.lss", addedAt: "2026-01-01", score, typedReference: null };
}
