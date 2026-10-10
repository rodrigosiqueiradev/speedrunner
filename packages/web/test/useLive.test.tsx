import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLive } from "../src/live/useLive";

const xml = readFileSync(resolve(__dirname, "../public/sample.lss"), "utf8");

/** A LiveSplit server that sits before a run, using the given clock (null: an older server that doesn't say). */
function fakeLiveSplit(method: string | null) {
  return class FakeSocket {
    static OPEN = 1;
    readyState = 1;
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    constructor() {
      setTimeout(() => this.onopen?.());
    }
    send(command: string) {
      const answers: Record<string, string | null> = {
        getsplitspath: "C:\\Splits\\sample.lss",
        gettimingmethod: method,
        getcurrenttimerphase: "NotRunning",
        getcurrenttime: "0.00",
      };
      const answer = answers[command];
      if (answer != null) setTimeout(() => this.onmessage?.({ data: answer }));
    }
    close() {
      this.readyState = 3;
    }
  };
}

const config = { source: "livesplit" as const, url: "ws://localhost:16834/livesplit", speed: "fast" as const };

beforeEach(() => vi.unstubAllGlobals());
afterEach(cleanup);

describe("live stats timing method", () => {
  it("follows LiveSplit when it compares against game time", async () => {
    vi.stubGlobal("WebSocket", fakeLiveSplit("GameTime"));
    const { result } = renderHook(() => useLive(xml, { ...config, timing: "RealTime" }));
    await waitFor(() => expect(result.current.timing).toEqual({ method: "GameTime", fromLiveSplit: true, choice: true }));
    // The sample's game time PB is 37:37.96, its real time PB 40:01.51.
    expect(result.current.ctx?.personalBest).toBeLessThan(38 * 60_000);
  });

  it("uses the page's choice when LiveSplit can't say", async () => {
    vi.stubGlobal("WebSocket", fakeLiveSplit(null));
    const { result } = renderHook(() => useLive(xml, { ...config, timing: "GameTime" }));
    await waitFor(() => expect(result.current.status?.kind).toBe("connected"), { timeout: 4000 });
    expect(result.current.timing).toEqual({ method: "GameTime", fromLiveSplit: false, choice: true });
    expect(result.current.ctx?.personalBest).toBeLessThan(38 * 60_000);
  });

  it("reads files without game times in real time", () => {
    const realOnly = xml.replace(/<GameTime>[^<]*<\/GameTime>/g, "");
    const { result } = renderHook(() => useLive(realOnly, { ...config, source: "demo", timing: "GameTime" }));
    expect(result.current.timing).toEqual({ method: "RealTime", fromLiveSplit: false, choice: false });
    expect(result.current.ctx?.personalBest).toBeGreaterThan(40 * 60_000);
  });
});
