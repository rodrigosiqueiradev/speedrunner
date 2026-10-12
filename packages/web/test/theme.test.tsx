import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Appearance } from "../src/components/Appearance";
import { deriveCustomTheme, type ColourScheme } from "../src/customTheme";
import { savePalette, savedCustom, savedPalette, savedTheme, startTheme } from "../src/theme";

const root = document.documentElement;
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../src/styles.css"), "utf8");
const tables = JSON.parse(readFileSync(join(here, "palette-tokens.json"), "utf8")) as Record<string, Array<[string, string]>>;

const media = { dark: false, forced: false, listeners: [] as Array<() => void> };

function installMatchMedia(): void {
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: query.includes("forced-colors") ? media.forced : query.includes("prefers-color-scheme") ? media.dark : false,
    addEventListener: (_type: string, listener: () => void) => {
      media.listeners.push(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      media.listeners = media.listeners.filter((item) => item !== listener);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
}

installMatchMedia();

beforeEach(() => {
  media.dark = false;
  media.forced = false;
  installMatchMedia();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete root.dataset.theme;
  delete root.dataset.palette;
  root.removeAttribute("style");
});

function openAppearance(): void {
  fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
}

function ruleBody(selector: string): string {
  const needle = `${selector} {`;
  const start = css.indexOf(needle);
  if (start < 0) throw new Error(`missing ${selector}`);
  const open = start + needle.length;
  const close = css.indexOf("}", open);
  return css.slice(open, close);
}

function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of body.replace(/\/\*[\s\S]*?\*\//g, "").split(";")) {
    const split = part.indexOf(":");
    if (split < 0) continue;
    const name = part.slice(0, split).trim();
    if (!name.startsWith("--")) continue;
    out[name.slice(2)] = part.slice(split + 1).trim();
  }
  return out;
}

function expectTokens(selector: string, pairs: Array<[string, string]>, exact: boolean): void {
  const got = declarations(ruleBody(selector));
  for (const [name, value] of pairs) expect(got[name], `${selector} ${name}`).toBe(value);
  if (exact) expect(Object.keys(got)).toHaveLength(pairs.length);
}

describe("theme", () => {
  it("follows the system until a mode is picked", () => {
    expect(savedTheme()).toBe("system");
    render(<Appearance />);
    openAppearance();
    expect(screen.getByRole("button", { name: "System" }).getAttribute("aria-pressed")).toBe("true");
    expect(root.dataset.theme).toBeUndefined();
    expect(root.dataset.palette).toBeUndefined();
  });

  it("forces dark or light whatever the system says, and remembers it", () => {
    render(<Appearance />);
    openAppearance();
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(root.dataset.theme).toBe("dark");
    expect(savedTheme()).toBe("dark");
    expect(screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(root.dataset.theme).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "System" }));
    expect(root.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("speedrunner.theme")).toBeNull();
  });

  it("applies a saved mode at start, and a change from another window", () => {
    localStorage.setItem("speedrunner.theme", "dark");
    startTheme();
    expect(root.dataset.theme).toBe("dark");

    localStorage.setItem("speedrunner.theme", "light");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "speedrunner.theme" }));
    });
    expect(root.dataset.theme).toBe("light");
  });

  it("ignores an odd saved mode", () => {
    localStorage.setItem("speedrunner.theme", "purple");
    expect(savedTheme()).toBe("system");
    startTheme();
    expect(root.dataset.theme).toBeUndefined();
  });

  it("stores a preset, and treats Speedrunner as the absent default", () => {
    render(<Appearance />);
    openAppearance();
    fireEvent.click(screen.getByRole("radio", { name: "Grove" }));
    expect(root.dataset.palette).toBe("grove");
    expect(localStorage.getItem("speedrunner.palette")).toBe("grove");
    expect(screen.getByText("Grove").textContent).toBe("Grove");

    fireEvent.click(screen.getByRole("radio", { name: "Speedrunner" }));
    expect(root.dataset.palette).toBeUndefined();
    expect(localStorage.getItem("speedrunner.palette")).toBeNull();
    expect(savedPalette()).toBe("speedrunner");
  });

  it("falls back to Speedrunner for an unknown palette or a broken custom value", () => {
    localStorage.setItem("speedrunner.palette", "purple");
    expect(savedPalette()).toBe("speedrunner");
    startTheme();
    expect(root.dataset.palette).toBeUndefined();

    localStorage.setItem("speedrunner.palette", "custom");
    localStorage.setItem("speedrunner.custom", "{");
    expect(savedCustom()).toBeNull();
    expect(savedPalette()).toBe("speedrunner");
    startTheme();
    expect(root.dataset.palette).toBeUndefined();

    localStorage.setItem("speedrunner.custom", JSON.stringify({ accent: "red", tint: null }));
    expect(savedCustom()).toBeNull();
    localStorage.setItem("speedrunner.custom", JSON.stringify({ accent: "#ff00ff", tint: "blue" }));
    expect(savedCustom()).toBeNull();
    localStorage.setItem("speedrunner.custom", JSON.stringify({ accent: "#AABBCC" }));
    expect(savedCustom()).toEqual({ accent: "#aabbcc", tint: null });
  });

  it("applies a palette or custom colours saved in another window", () => {
    startTheme();
    localStorage.setItem("speedrunner.palette", "violet");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "speedrunner.palette" }));
    });
    expect(root.dataset.palette).toBe("violet");
    expect(root.style.getPropertyValue("--accent")).toBe("");

    localStorage.setItem("speedrunner.palette", "custom");
    localStorage.setItem("speedrunner.custom", JSON.stringify({ accent: "#1f7a47", tint: null }));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(root.dataset.palette).toBe("custom");
    expect(root.style.getPropertyValue("--accent")).toBe("#1f7a48");
    expect(root.style.getPropertyValue("--ground")).toBe("#f1f3f6");

    localStorage.setItem("speedrunner.palette", "amber");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "speedrunner.palette" }));
    });
    expect(root.dataset.palette).toBe("amber");
    expect(root.style.getPropertyValue("--accent")).toBe("");
    expect(localStorage.getItem("speedrunner.custom")).toContain("#1f7a47");
  });

  it("skips inline colours while forced colours are on, and follows the system scheme", () => {
    localStorage.setItem("speedrunner.palette", "custom");
    localStorage.setItem("speedrunner.custom", JSON.stringify({ accent: "#ffe14a", tint: null }));
    media.forced = true;
    startTheme();
    expect(root.dataset.palette).toBe("custom");
    expect(root.style.getPropertyValue("--accent")).toBe("");

    media.forced = false;
    media.dark = true;
    act(() => {
      for (const listener of media.listeners) listener();
    });
    expect(root.dataset.theme).toBeUndefined();
    expect(root.style.getPropertyValue("--accent")).toBe("#ffe14e");

    media.dark = false;
    act(() => {
      for (const listener of media.listeners) listener();
    });
    expect(root.style.getPropertyValue("--accent")).toBe("#9e8700");
    expect(root.dataset.palette).not.toBe("contrast");
  });

  it("keeps the preset tokens in the stylesheet, with colour-scheme left to the mode", () => {
    expect(css).not.toContain('data-palette="speedrunner"');
    expect(css).not.toContain('data-palette="custom"');
    const presets: Record<string, string> = {
      Speedrunner: "",
      Grove: "grove",
      Violet: "violet",
      Amber: "amber",
      "High contrast": "contrast",
    };
    for (const [name, id] of Object.entries(presets)) {
      const light = tables[`${name}, light`];
      const dark = tables[`${name}, dark`];
      if (!light || !dark) throw new Error(name);
      if (name === "Speedrunner") {
        expectTokens(":root", light, false);
        expect(ruleBody(":root")).toContain("color-scheme: light");
        expectTokens(':root:not([data-theme="light"])', dark, false);
        expectTokens(':root[data-theme="dark"]', dark, false);
        expect(ruleBody(':root[data-theme="dark"]')).toContain("color-scheme: dark");
      } else {
        expectTokens(`:root[data-palette="${id}"]`, light, true);
        expect(ruleBody(`:root[data-palette="${id}"]`)).not.toContain("color-scheme");
        expectTokens(`:root[data-palette="${id}"]:not([data-theme="light"])`, dark, true);
        expectTokens(`:root[data-theme="dark"][data-palette="${id}"]`, dark, true);
      }
    }
  });

  it("uses Night Shell ink for the header focus ring, and keeps the page ring on the accent", () => {
    expect(ruleBody(":focus-visible")).toContain("outline: 2px solid var(--accent)");
    expect(ruleBody(".shell :focus-visible").trim()).toBe("outline-color: var(--shell-ink);");
  });

  it("uses the card ink for the live overlay focus ring, and keeps the page ring on the accent", () => {
    expect(ruleBody(":focus-visible")).toContain("outline: 2px solid var(--accent)");
    expect(ruleBody(".live-overlay :focus-visible").trim()).toBe("outline-color: var(--card-ink);");
  });
});

const EXAMPLES: Array<[string, string | null, ColourScheme, boolean, string, string, string, string, string, string]> = [
  ["#2a78d6", null, "light", false, "#2a78d6", "#115cb0", "#e7f1ff", "#2675d2", "#1166c1", "#ffffff"],
  ["#2a78d6", null, "dark", false, "#2a78d6", "#76adf6", "#12233a", "#2675d2", "#1467c3", "#ffffff"],
  ["#1f7a47", null, "light", false, "#1f7a48", "#0e703f", "#e6f5eb", "#1f7a48", "#036b3b", "#ffffff"],
  ["#1f7a47", null, "dark", true, "#257f4c", "#6bc08a", "#15281b", "#1f7a48", "#1f7a48", "#ffffff"],
  ["#ffe14a", null, "light", true, "#9e8700", "#6e5d00", "#f5f1dd", "#a99100", "#a99100", "#0d1420"],
  ["#ffe14a", null, "dark", true, "#ffe14e", "#f7e283", "#292303", "#ead15d", "#dbc24f", "#0d1420"],
  ["#c8c8c8", null, "light", true, "#3a79ca", "#1c5cab", "#e7f1ff", "#3676c6", "#2667b6", "#ffffff"],
  ["#c8c8c8", null, "dark", true, "#4888d9", "#76adf6", "#152337", "#3676c6", "#2868b7", "#ffffff"],
  ["#00ff66", null, "light", true, "#2a9c47", "#00722a", "#e4f6e7", "#37a651", "#37a651", "#0d1420"],
  ["#00ff66", null, "dark", true, "#85f197", "#9deba8", "#112915", "#8eea9c", "#7fdb8f", "#0d1420"],
  ["#6a45c4", "#916cba", "light", false, "#6a45c4", "#6148aa", "#f0eeff", "#6a45c4", "#5d35b3", "#ffffff"],
  ["#6a45c4", "#916cba", "dark", true, "#7855d6", "#ac9df1", "#231d3b", "#724fce", "#7d5cdc", "#ffffff"],
  ["#1f7a47", "#ffffff", "light", true, "#1f7a48", "#0e703f", "#e6f5eb", "#1f7a48", "#036b3b", "#ffffff"],
  ["#1f7a47", "#ffffff", "dark", true, "#257f4c", "#6bc08a", "#15281b", "#1f7a48", "#1f7a48", "#ffffff"],
];

function channelLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const r = channelLinear((n >> 16) & 255);
    const g = channelLinear((n >> 8) & 255);
    const bl = channelLinear(n & 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("custom theme", () => {
  it("matches the worked examples, including when the readable-text line is needed", () => {
    for (const [accent, tint, mode, adjusted, accentOut, ink, wash, fill, hover, on] of EXAMPLES) {
      const derived = deriveCustomTheme(accent, tint, mode);
      const label = `${accent} ${tint} ${mode}`;
      expect(derived.adjusted, label).toBe(adjusted);
      expect(derived.tokens["--accent"], label).toBe(accentOut);
      expect(derived.tokens["--accent-ink"], label).toBe(ink);
      expect(derived.tokens["--accent-wash"], label).toBe(wash);
      expect(derived.tokens["--accent-fill"], label).toBe(fill);
      expect(derived.tokens["--accent-fill-hover"], label).toBe(hover);
      expect(derived.tokens["--on-accent"], label).toBe(on);
    }
  });

  it("matches the violet tint neutrals in both schemes", () => {
    for (const mode of ["light", "dark"] as const) {
      const derived = deriveCustomTheme("#6a45c4", "#916cba", mode);
      const pairs = tables[`Violet tint, ${mode} (accent \`#6a45c4\`, tint \`#916cba\`)`];
      if (!pairs) throw new Error(mode);
      for (const [name, value] of pairs) expect(derived.tokens[`--${name}`], `${mode} ${name}`).toBe(value);
      expect(derived.adjusted).toBe(mode === "dark");
    }
  });

  it("keeps the accent at 3.1 on the wash, the surface and the ground", () => {
    const pinned: Array<[string, string | null, ColourScheme, string, string]> = [
      ["#006633", "#120d1c", "dark", "#297f4a", "#15281b"],
      ["#050208", null, "dark", "#736b79", "#271f2e"],
      ["#003366", null, "dark", "#4171a9", "#182432"],
      ["#00ff66", null, "light", "#2a9c47", "#e4f6e7"],
    ];
    for (const [accent, tint, mode, accentOut, wash] of pinned) {
      const derived = deriveCustomTheme(accent, tint, mode);
      const label = `${accent} ${tint} ${mode}`;
      expect(derived.tokens["--accent"], label).toBe(accentOut);
      expect(derived.tokens["--accent-wash"], label).toBe(wash);
      expect(contrastRatio(accentOut, wash), label).toBeGreaterThanOrEqual(3.1);
    }

    const steps = [0x00, 0x33, 0x66, 0x99, 0xcc, 0xff];
    const accents: string[] = [];
    for (const r of steps) {
      for (const g of steps) {
        for (const b of steps) accents.push("#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join(""));
      }
    }
    const tints = [null, "#000000", "#333333", "#666666", "#999999", "#cccccc", "#ffffff", "#120d1c"];
    for (const accent of accents) {
      for (const tint of tints) {
        for (const mode of ["light", "dark"] as const) {
          const derived = deriveCustomTheme(accent, tint, mode);
          const colour = derived.tokens["--accent"];
          for (const bg of ["--accent-wash", "--surface", "--ground"] as const) {
            const ratio = contrastRatio(colour, derived.tokens[bg]);
            expect(ratio + 1e-9, `${accent} ${tint} ${mode} ${bg} ${colour} on ${derived.tokens[bg]}`).toBeGreaterThanOrEqual(3.1);
          }
        }
      }
    }
  });

  it("shows the readable-text line for the scheme on screen, and keeps a custom colour when a swatch is chosen", () => {
    render(<Appearance />);
    openAppearance();
    fireEvent.click(screen.getByRole("button", { name: "Custom…" }));
    expect(screen.queryByText("Adjusted so text stays readable.")).toBeNull();
    expect(root.style.getPropertyValue("--accent-fill")).toBe("#2675d2");

    fireEvent.change(screen.getByRole("textbox", { name: "Accent hex" }), { target: { value: "#ffe14a" } });
    expect(screen.getByText("Adjusted so text stays readable.")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Accent hex" }), { target: { value: "nope" } });
    fireEvent.blur(screen.getByRole("textbox", { name: "Accent hex" }));
    expect((screen.getByRole("textbox", { name: "Accent hex" }) as HTMLInputElement).value).toBe("#ffe14a");

    fireEvent.click(screen.getByRole("radio", { name: "Grove" }));
    expect(root.dataset.palette).toBe("grove");
    expect(root.style.getPropertyValue("--accent")).toBe("");
    expect(localStorage.getItem("speedrunner.custom")).toContain("#ffe14a");

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom…" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Accent hex" }), { target: { value: "#6a45c4" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Tint the page" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tint hex" }), { target: { value: "#916cba" } });
    expect(screen.getByText("Adjusted so text stays readable.")).toBeTruthy();
    expect(root.style.getPropertyValue("--ground")).toBe("#120f17");

    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(screen.queryByText("Adjusted so text stays readable.")).toBeNull();
    expect(root.style.getPropertyValue("--ground")).toBe("#f4f1fa");
  });
});

describe("appearance control", () => {
  it("names the button, moves between themes with the arrow keys, and returns focus on Escape", () => {
    render(<Appearance />);
    const button = screen.getByRole("button", { name: "Appearance" });
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const dialog = screen.getByRole("dialog", { name: "Appearance" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "System" }));

    fireEvent.keyDown(screen.getByRole("radio", { name: "Speedrunner" }), { key: "ArrowRight" });
    expect(root.dataset.palette).toBe("grove");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Grove" }));
    fireEvent.keyDown(screen.getByRole("radio", { name: "Grove" }), { key: "End" });
    expect(root.dataset.palette).toBe("contrast");
    const chip = button.querySelector(".appearance-chip");
    expect(chip?.classList.contains("appearance-chip-contrast")).toBe(true);
    expect((chip as HTMLElement).style.background).toBe("");

    const custom = screen.getByRole("button", { name: "Custom…" });
    custom.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "System" }));

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("starts a custom theme from the current preset and does not reset one that is already open", () => {
    savePalette("violet");
    render(<Appearance />);
    openAppearance();
    fireEvent.click(screen.getByRole("button", { name: "Custom…" }));
    expect((screen.getByRole("textbox", { name: "Accent hex" }) as HTMLInputElement).value).toBe("#684db6");
    expect(screen.queryByRole("checkbox", { name: "Tint the page" })).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Tint the page" }) as HTMLInputElement).checked).toBe(false);

    fireEvent.change(screen.getByRole("textbox", { name: "Accent hex" }), { target: { value: "#112233" } });
    fireEvent.click(screen.getByRole("button", { name: "Custom…" }));
    expect((screen.getByRole("textbox", { name: "Accent hex" }) as HTMLInputElement).value).toBe("#112233");
  });
});
