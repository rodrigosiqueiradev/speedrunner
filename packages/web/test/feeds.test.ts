import { afterEach, describe, expect, it, vi } from "vitest";
import { connectLiveSplit } from "../src/live/feeds";

/** A LiveSplit server mid-run that answers gettimingmethod only after the page stopped waiting. */
class SlowSocket {
  static OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor() {
    setTimeout(() => this.onopen?.());
  }
  send(command: string) {
    const answers: Record<string, string> = {
      getsplitspath: "C:\\Splits\\sample.lss",
      gettimingmethod: "RealTime",
      getcurrenttimerphase: "Running",
      getsplitindex: "1",
      getcurrenttime: "1:05.00",
      getlastsplittime: "40.00",
      getcurrentsplitname: "Second",
    };
    // Like LiveSplit, it answers in order, so a slow answer holds up the ones asked after it.
    // 2 s is past the page's wait for this optional command.
    const now = Date.now();
    this.free = Math.max(now, this.free) + (command === "gettimingmethod" ? 2000 : 10);
    setTimeout(() => this.onmessage?.({ data: answers[command] }), this.free - now);
  }
  private free = 0;
  close() {
    this.readyState = 3;
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("connectLiveSplit", () => {
  it("keeps answers matched up when an optional one arrives late", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", SlowSocket);
    const updates: Array<{ phase: string; splitIndex: number; currentTime: number | null }> = [];
    const feed = connectLiveSplit("ws://localhost:16834/livesplit", ["First", "Second"], (snap, status) => {
      if (status.kind === "connected") updates.push(snap);
    });
    await vi.advanceTimersByTimeAsync(5000);
    feed.stop();
    expect(updates.length).toBeGreaterThan(3);
    for (const u of updates) expect(u).toMatchObject({ phase: "Running", splitIndex: 1, currentTime: 65_000 });
  });
});
