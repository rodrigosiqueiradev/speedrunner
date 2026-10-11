import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseLss } from "@speedrunner/core";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileNameOf, type FeedStatus } from "../src/live/feeds";
import { useSplitsSync } from "../src/live/useSplitsSync";
import { putSplitFile, type StoredSplit } from "../src/splitFiles";

const tp: StoredSplit = { fileName: "Twilight Princess.lss", xml: "<Run>tp</Run>" };
const sample: StoredSplit = { fileName: "sample.lss", xml: "<Run>sample</Run>" };
const open = (path: string | null): FeedStatus => ({ kind: "connected", mismatch: null, splitsPath: path, timingMethod: null, loadedCounts: null, runSplitNames: [] });

beforeEach(() => localStorage.clear());
afterEach(cleanup);

/** The live page in miniature: a file, LiveSplit's status, and the sync switching the file. */
function setup(status: FeedStatus | null, file: StoredSplit | null) {
  const onSwitch = vi.fn();
  const hook = renderHook(({ status, file }) => useSplitsSync(status, file, onSwitch), { initialProps: { status, file } });
  return { ...hook, onSwitch };
}

describe("following LiveSplit's splits file", () => {
  it("reads the file name from Windows and Unix paths", () => {
    expect(fileNameOf("C:\\Users\\me\\Splits\\Twilight Princess.lss")).toBe("Twilight Princess.lss");
    expect(fileNameOf("/home/me/splits/tp.lss")).toBe("tp.lss");
    expect(fileNameOf("tp.lss")).toBe("tp.lss");
  });

  it("matches the open file by name, ignoring case", () => {
    const { result } = setup(open("C:\\Splits\\twilight princess.LSS"), tp);
    expect(result.current).toEqual({ state: "matched", name: "twilight princess.LSS" });
  });

  it("switches to the profile's file when LiveSplit has another open", async () => {
    await putSplitFile("tp", tp);
    const { result, onSwitch } = setup(open("C:\\Splits\\Twilight Princess.lss"), sample);
    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith(tp));
    expect(result.current).toEqual({ state: "switched", name: "Twilight Princess.lss" });
  });

  it("says which file to choose when the profile hasn't got it", async () => {
    const { result, onSwitch } = setup(open("C:\\Splits\\Twilight Princess.lss"), sample);
    await waitFor(() => expect(result.current.state).toBe("missing"));
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("keeps a file chosen by hand after a switch, through reconnects", async () => {
    await putSplitFile("tp", tp);
    const path = "C:\\Splits\\Twilight Princess.lss";
    const { result, onSwitch, rerender } = setup(open(path), sample);
    await waitFor(() => expect(onSwitch).toHaveBeenCalledTimes(1));
    rerender({ status: open(path), file: tp });
    // The runner picks another file; the feed reconnects for it.
    rerender({ status: { kind: "connecting" }, file: sample });
    rerender({ status: open(path), file: sample });
    expect(result.current).toEqual({ state: "different", name: "Twilight Princess.lss", file: tp });
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it("doesn't switch a newly opened window back from the runner's choice", async () => {
    await putSplitFile("tp", tp);
    const path = "C:\\Splits\\Twilight Princess.lss";
    const page = setup(open(path), sample);
    await waitFor(() => expect(page.onSwitch).toHaveBeenCalledTimes(1));
    page.rerender({ status: open(path), file: tp });
    page.rerender({ status: open(path), file: sample });
    // The overlay opens now, with the runner's file.
    const overlay = setup(open(path), sample);
    await waitFor(() => expect(overlay.result.current.state).toBe("different"));
    expect(overlay.onSwitch).not.toHaveBeenCalled();
  });

  it("says nothing when the server can't tell which file is open", async () => {
    const { result } = setup(open(null), sample);
    await act(async () => {});
    expect(result.current).toEqual({ state: "unknown" });
  });
});

// Released LiveSplit can't say which file is open: the page goes by split names and counts.
describe("following LiveSplit's splits without a file path", () => {
  const read = (path: string): StoredSplit => ({ fileName: path.split("/").pop()!, xml: readFileSync(resolve(__dirname, path), "utf8") });
  const dishonored = read("../public/sample.lss");
  const small = read("../../core/test/fixtures/small.lss");
  const run = parseLss(dishonored.xml);
  const names = run.segments.map((s) => s.rawName);
  const counts = { attempts: run.attemptCount, completed: run.attempts.filter((a) => a.time != null).length };
  const connected = (more: Partial<Extract<FeedStatus, { kind: "connected" }>>): FeedStatus => ({
    ...open(null),
    ...(more as object),
  }) as FeedStatus;

  it("switches when the split names LiveSplit reports belong to one saved file", async () => {
    await putSplitFile("dishonored", dishonored);
    await putSplitFile("small", small);
    const { result, onSwitch } = setup(connected({ runSplitNames: [names[0]] }), small);
    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith(dishonored));
    expect(result.current).toEqual({ state: "switched", name: "sample.lss" });
  });

  it("switches when LiveSplit loads splits whose counts match a saved file", async () => {
    await putSplitFile("dishonored", dishonored);
    const { onSwitch } = setup(connected({ loadedCounts: counts }), small);
    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith(dishonored));
  });

  it("doesn't guess between saved files that match equally", async () => {
    await putSplitFile("one", dishonored);
    await putSplitFile("two", { ...dishonored, fileName: "copy.lss" });
    const { result, onSwitch } = setup(connected({ loadedCounts: counts }), small);
    await act(async () => {});
    expect(onSwitch).not.toHaveBeenCalled();
    expect(result.current).toEqual({ state: "unknown" });
  });

  it("keeps a file chosen by hand for the rest of the attempt", async () => {
    await putSplitFile("dishonored", dishonored);
    const { result, onSwitch, rerender } = setup(connected({ runSplitNames: [names[0]] }), small);
    await waitFor(() => expect(onSwitch).toHaveBeenCalledTimes(1));
    rerender({ status: connected({ runSplitNames: [names[0]] }), file: dishonored });
    rerender({ status: connected({ runSplitNames: [names[0]] }), file: small });
    rerender({ status: connected({ runSplitNames: [names[0], names[1]] }), file: small });
    await act(async () => {});
    expect(result.current.state).toBe("different");
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });
});
