/**
 * Live stats reads LiveSplit on the runner's own computer, and the content security policy allows
 * no other WebSocket host (test/csp.test.ts). The page says so itself rather than leaving a remote
 * address to be refused in silence, so these check the message and that no socket is even opened.
 */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LIVESPLIT_URL, addressProblem } from "../src/live/feeds";
import { useLive } from "../src/live/useLive";

const xml = readFileSync(resolve(__dirname, "../public/sample.lss"), "utf8");
const config = { source: "livesplit" as const, speed: "fast" as const, timing: "RealTime" as const };

beforeEach(() => vi.unstubAllGlobals());
afterEach(cleanup);

describe("the LiveSplit address", () => {
  it("takes either name a computer has for itself, on any port", () => {
    expect(addressProblem(DEFAULT_LIVESPLIT_URL)).toBeNull();
    expect(addressProblem("ws://127.0.0.1:16834/livesplit")).toBeNull();
    expect(addressProblem("ws://localhost:9000/livesplit")).toBeNull();
    expect(addressProblem("ws://127.0.0.1:9000")).toBeNull();
  });

  it("says why another computer's address can't work", () => {
    expect(addressProblem("ws://example.com:16834/livesplit")).toMatch(/only reads LiveSplit on this computer/);
    expect(addressProblem("ws://192.168.0.5:16834/livesplit")).toMatch(/localhost or 127\.0\.0\.1/);
  });

  it("says when the address isn't a WebSocket address at all", () => {
    expect(addressProblem("https://localhost:16834/livesplit")).toMatch(/isn't a WebSocket address/);
    // "localhost:16834" reads as a scheme, not a host, which is the same mistake to the runner.
    expect(addressProblem("localhost:16834")).toMatch(/isn't a WebSocket address/);
    expect(addressProblem("16834")).toMatch(/isn't an address/);
  });

  it("opens no socket for an address off this computer, and doesn't keep trying", async () => {
    const opened: string[] = [];
    vi.stubGlobal(
      "WebSocket",
      class {
        constructor(url: string) {
          opened.push(url);
        }
        close() {}
      },
    );
    const { result } = renderHook(() => useLive(xml, { ...config, url: "ws://example.com:16834/livesplit" }));
    await waitFor(() => expect(result.current.status?.kind).toBe("offline"));
    expect(opened).toEqual([]);
    expect(result.current.status).toEqual({
      kind: "offline",
      reason: expect.stringMatching(/only reads LiveSplit on this computer/),
      retry: false,
    });
  });
});
