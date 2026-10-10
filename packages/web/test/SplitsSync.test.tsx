import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileNameOf, type FeedStatus } from "../src/live/feeds";
import { useSplitsSync } from "../src/live/useSplitsSync";
import { putSplitFile, type StoredSplit } from "../src/splitFiles";

const tp: StoredSplit = { fileName: "Twilight Princess.lss", xml: "<Run>tp</Run>" };
const sample: StoredSplit = { fileName: "sample.lss", xml: "<Run>sample</Run>" };
const open = (path: string | null): FeedStatus => ({ kind: "connected", mismatch: null, splitsPath: path, timingMethod: null });

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
    expect(result.current.state).toBe("unknown");
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
