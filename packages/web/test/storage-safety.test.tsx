import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { loadProfile } from "../src/profile";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("loadProfile", () => {
  it("drops saved entries the profile page can't read", () => {
    const good = {
      key: "game|any%",
      fileName: "game.lss",
      addedAt: "2026-10-12T00:00:00Z",
      score: { game: "Game", category: "Any%", efficiency: {}, consistency: {}, weights: {} },
    };
    localStorage.setItem("speedrunner.profile.v3", JSON.stringify([good, null, 3, { key: "x" }, { ...good, score: "broken" }]));
    expect(loadProfile()).toEqual([{ ...good, typedReference: null }]);
  });

  it("reads unreadable storage as an empty profile", () => {
    localStorage.setItem("speedrunner.profile.v3", "{not json");
    expect(loadProfile()).toEqual([]);
  });
});

describe("ErrorBoundary", () => {
  it("shows a way back instead of a blank page", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const Broken = () => {
      throw new Error("bad saved setting");
    };
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
    expect(screen.getByText("bad saved setting")).toBeTruthy();
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, pathname: "/", reload });
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
    quiet.mockRestore();
  });
});
