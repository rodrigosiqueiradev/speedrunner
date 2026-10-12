/**
 * "Nothing is uploaded" is this product's first rule, so it is checked rather than trusted. This
 * renders the whole app, drives the documented flow with a real .lss, and fails if any outbound
 * primitive is touched.
 *
 * The first cases assert an absence, which on its own would also pass if the recorder were simply
 * blind, so the last two are controls: they prove it does see a call when one happens. Keep them.
 * A test that asserts an absence without a control is the kind of test that quietly stops testing
 * anything.
 *
 * What it can't see — a remote font or a tracking pixel pulled in by a dependency, which never
 * reaches jsdom — is covered by scripts/check-no-upload.mjs over the built output.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

const sample = readFileSync(resolve(__dirname, "../public/sample.lss"), "utf8");

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

let calls: string[] = [];

/**
 * Records the call and answers like a dead endpoint, so the app's own error path runs instead of an
 * unhandled rejection masking the result.
 */
const note =
  (what: string) =>
  async (...args: unknown[]) => {
    calls.push(`${what} ${String(args[0])}`);
    return new Response("", { status: 503 });
  };

/** Records the attempt and then fails, which is what these constructors do with no server there. */
const noteThrowing = (what: string) =>
  class {
    constructor(...args: unknown[]) {
      calls.push(args.length ? `${what} ${String(args[0])}` : what);
      throw new Error("outbound");
    }
  };

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", note("fetch"));
  vi.stubGlobal("XMLHttpRequest", noteThrowing("XMLHttpRequest"));
  vi.stubGlobal("WebSocket", noteThrowing("WebSocket"));
  vi.stubGlobal("EventSource", noteThrowing("EventSource"));
  vi.stubGlobal("RTCPeerConnection", noteThrowing("RTCPeerConnection"));
  // jsdom has no sendBeacon, so it is defined here and taken off again after each test.
  Object.defineProperty(navigator, "sendBeacon", { value: note("sendBeacon"), configurable: true, writable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (navigator as { sendBeacon?: unknown }).sendBeacon;
  localStorage.clear();
  history.replaceState(null, "", "/");
});

const loadSampleFile = async () => {
  fireEvent.change(screen.getByTestId("file-input"), { target: { files: [new File([sample], "dishonored.lss")] } });
  await waitFor(() => expect(screen.getByRole("heading", { name: /Dishonored/ })).toBeTruthy());
};

describe("nothing is uploaded", () => {
  it("loads and analyses a run without touching the network", async () => {
    render(<App />);
    await loadSampleFile();
    expect(screen.getAllByText("40:01.51").length).toBeGreaterThan(0);
    expect(calls).toEqual([]);
  });

  it("visits every tab without touching the network", async () => {
    render(<App />);
    await loadSampleFile();
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent ?? "");
    expect(tabs.length).toBeGreaterThan(1);
    for (const tab of tabs) {
      fireEvent.click(screen.getByRole("tab", { name: tab }));
      await waitFor(() => expect(screen.getByRole("tab", { name: tab }).getAttribute("aria-selected")).toBe("true"));
    }
    expect(calls).toEqual([]);
  });

  // Live stats is left out on purpose: it dials LiveSplit on this machine, which the last control covers.
  it("visits the profile and the year in runs without touching the network", async () => {
    render(<App />);
    await loadSampleFile();
    for (const page of ["Profile", "Year in runs"]) {
      fireEvent.click(screen.getByRole("link", { name: page }));
      await waitFor(() => expect(screen.queryByRole("link", { name: page })).toBeNull());
    }
    expect(calls).toEqual([]);
  });
});

describe("the probe can see a call", () => {
  it("sees the same-origin sample-run fetch", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /sample/i }));
    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]).toBe("fetch /sample.lss");
  });

  it("sees the LiveSplit socket the live feed opens", async () => {
    const { connectLiveSplit, DEFAULT_LIVESPLIT_URL } = await import("../src/live/feeds");
    const feed = connectLiveSplit(DEFAULT_LIVESPLIT_URL, ["One"], () => {});
    expect(calls).toEqual([`WebSocket ${DEFAULT_LIVESPLIT_URL}`]);
    feed.stop();
  });
});
