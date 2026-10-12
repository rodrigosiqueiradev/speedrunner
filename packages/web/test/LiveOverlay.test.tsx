import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveOverlay } from "../src/components/LiveOverlay";
import { contrast, DEFAULT_STYLE, lowContrast } from "../src/live/style";

const borderless = vi.hoisted(() => ({ current: false }));

vi.mock("../src/desktopWindows", () => ({
  isOverlayWindow: () => borderless.current,
  keepThisWindowOnTop: vi.fn(async () => {}),
  dragThisWindow: vi.fn(async () => {}),
  closeThisWindow: vi.fn(async () => {}),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  borderless.current = false;
  document.documentElement.classList.remove("overlay-mode");
});

function saveStyle(style: Record<string, unknown>) {
  localStorage.setItem("speedrunner.live.v1", JSON.stringify({ style }));
}

describe("live overlay style", () => {
  it("puts the card style on the overlay, so the empty-state link uses the chosen value colour", async () => {
    // A light background whose value colour already clears 4.5:1. The link sits beside the card,
    // so it only sees this colour when the overlay itself carries the variables.
    saveStyle({ background: "#ffffff", text: "#111111" });
    render(<LiveOverlay onBack={() => {}} />);
    const link = await screen.findByRole("link", { name: "Live stats" });
    const overlay = link.closest(".live-overlay") as HTMLElement;

    expect(link.closest(".live-card")).toBeNull();
    expect(overlay.style.getPropertyValue("--card-ink")).toBe("#111111");
    expect(overlay.style.getPropertyValue("--card-bg")).toBe("#ffffff");
    expect(overlay.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(contrast("#111111", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("puts the same colour on the desktop close button's overlay", async () => {
    borderless.current = true;
    saveStyle({ background: "#f0c25a", text: "#1a1208" });
    render(<LiveOverlay onBack={() => {}} />);
    const close = await screen.findByRole("button", { name: "Close overlay" });
    const overlay = close.closest(".live-overlay") as HTMLElement;

    expect(close.closest(".live-card")).toBeNull();
    expect(overlay.style.getPropertyValue("--card-ink")).toBe("#1a1208");
    expect(contrast("#1a1208", "#f0c25a")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a light background with the standard value colour on the warning the live page already shows", async () => {
    // Saving only a light background leaves the value colour at the standard near-white.
    // The ring follows that colour, and the live page already calls it hard to read.
    saveStyle({ background: "#ffffff" });
    render(<LiveOverlay onBack={() => {}} />);
    const link = await screen.findByRole("link", { name: "Live stats" });
    const overlay = link.closest(".live-overlay") as HTMLElement;
    const style = { ...DEFAULT_STYLE, background: "#ffffff" };

    expect(overlay.style.getPropertyValue("--card-ink")).toBe(style.text);
    expect(lowContrast(style)).toContain("Values");
    expect(contrast(style.text, style.background)).toBeLessThan(3);
    expect(contrast(DEFAULT_STYLE.text, DEFAULT_STYLE.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DEFAULT_STYLE.text, "#333333")).toBeGreaterThanOrEqual(4.5);
  });
});
