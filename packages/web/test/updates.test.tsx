import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findUpdate, isNewer, parseVersion, RELEASES_PAGE } from "../src/updates";

vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => "0.2.0") }));
const openUrl = vi.fn();
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: (url: string) => openUrl(url) }));

const { UpdateBanner, useUpdates, VersionNote } = await import("../src/components/UpdateBanner");

const release = (tag: string, url = `${RELEASES_PAGE}/tag/${tag}`) =>
  vi.fn(async () => new Response(JSON.stringify({ tag_name: tag, html_url: url }), { status: 200 })) as unknown as typeof fetch;

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  openUrl.mockReset();
});

describe("versions", () => {
  it("reads version tags and nothing else", () => {
    expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("0.10.0")).toEqual([0, 10, 0]);
    expect(parseVersion("v1.2.3-beta.1")).toBeNull();
    expect(parseVersion("latest")).toBeNull();
  });

  it("compares part by part, as numbers", () => {
    expect(isNewer("v0.10.0", "0.9.0")).toBe(true);
    expect(isNewer("v1.0.0", "0.99.99")).toBe(true);
    expect(isNewer("v0.2.0", "0.2.0")).toBe(false);
    expect(isNewer("v0.1.9", "0.2.0")).toBe(false);
    expect(isNewer("nightly", "0.2.0")).toBe(false);
  });
});

describe("findUpdate", () => {
  it("returns a newer release with its page", async () => {
    expect(await findUpdate("0.2.0", release("v0.3.0"))).toEqual({ version: "0.3.0", url: `${RELEASES_PAGE}/tag/v0.3.0` });
  });

  it("returns nothing when the app is up to date", async () => {
    expect(await findUpdate("0.3.0", release("v0.3.0"))).toBeNull();
  });

  it("falls back to the releases page for a link elsewhere", async () => {
    expect((await findUpdate("0.2.0", release("v0.3.0", "https://example.com/x")))?.url).toBe(RELEASES_PAGE);
  });

  it("treats a failed request as no update", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const limited = vi.fn(async () => new Response("{}", { status: 403 })) as unknown as typeof fetch;
    expect(await findUpdate("0.2.0", offline)).toBeNull();
    expect(await findUpdate("0.2.0", limited)).toBeNull();
  });
});

function Harness({ enabled = true }: { enabled?: boolean }) {
  const u = useUpdates(enabled);
  return (
    <>
      {u.update && u.version && <UpdateBanner update={u.update} current={u.version} onDismiss={u.dismiss} />}
      {u.version && <VersionNote version={u.version} checking={u.checking} onChange={u.setChecking} />}
    </>
  );
}

describe("update banner", () => {
  it("shows a newer version and opens its page", async () => {
    vi.stubGlobal("fetch", release("v0.3.0"));
    render(<Harness />);
    expect(await screen.findByText("Speedrunner 0.3.0 is out.")).toBeTruthy();
    expect(screen.getByText(/You have 0\.2\.0/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(openUrl).toHaveBeenCalledWith(`${RELEASES_PAGE}/tag/v0.3.0`);
  });

  it("doesn't show a version again once dismissed", async () => {
    vi.stubGlobal("fetch", release("v0.3.0"));
    const first = render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByText(/is out/)).toBeNull();
    first.unmount();

    render(<Harness />);
    await screen.findByText("Version 0.2.0");
    await act(async () => {});
    expect(screen.queryByText(/is out/)).toBeNull();
  });

  it("makes no request when the check is off, and remembers it", async () => {
    const fetcher = release("v0.3.0");
    vi.stubGlobal("fetch", fetcher);
    const first = render(<Harness />);
    await screen.findByText("Speedrunner 0.3.0 is out.");
    fireEvent.click(screen.getByLabelText("Check for new versions"));
    expect(screen.queryByText(/is out/)).toBeNull();
    first.unmount();
    vi.mocked(fetcher).mockClear();

    render(<Harness />);
    await screen.findByText("Version 0.2.0");
    await act(async () => {});
    expect((screen.getByLabelText("Check for new versions") as HTMLInputElement).checked).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does nothing outside the desktop app's main window", async () => {
    const fetcher = release("v0.3.0");
    vi.stubGlobal("fetch", fetcher);
    render(<Harness enabled={false} />);
    await act(async () => {});
    expect(screen.queryByText(/Version/)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
