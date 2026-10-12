/**
 * Appearance: a mode (system, light, dark) and a colour palette, saved on this computer.
 * styles.css reads the mode from data-theme and the palette from data-palette.
 * A custom palette sets the tokens on the document element.
 */
import { CUSTOM_PROPERTIES, deriveCustomTheme, type ColourScheme } from "./customTheme";

export type Theme = "system" | "light" | "dark";
export type Palette = "speedrunner" | "grove" | "violet" | "amber" | "contrast" | "custom";

const THEME_KEY = "speedrunner.theme";
const PALETTE_KEY = "speedrunner.palette";
const CUSTOM_KEY = "speedrunner.custom";

const HEX = /^#[0-9a-fA-F]{6}$/;

export const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Presets in swatch order. The light fill is the footer chip, in either mode. */
export const PALETTES: ReadonlyArray<{ id: Exclude<Palette, "custom">; label: string; lightFill: string; accent: string }> = [
  { id: "speedrunner", label: "Speedrunner", lightFill: "#256abf", accent: "#2a78d6" },
  { id: "grove", label: "Grove", lightFill: "#1b7342", accent: "#1f7a47" },
  { id: "violet", label: "Violet", lightFill: "#5e44ae", accent: "#684db6" },
  { id: "amber", label: "Amber", lightFill: "#8e5100", accent: "#995600" },
  { id: "contrast", label: "High contrast", lightFill: "#1656a4", accent: "#1656a4" },
];

export type CustomColours = { accent: string; tint: string | null };

const isTheme = (value: unknown): value is Theme => value === "system" || value === "light" || value === "dark";
const isPreset = (value: string): value is Exclude<Palette, "custom"> => PALETTES.some((palette) => palette.id === value);

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Without storage the choice lasts until the app closes.
  }
}

/** The saved mode; System when nothing (or something odd) is saved. */
export function savedTheme(): Theme {
  const value = storageGet(THEME_KEY);
  return isTheme(value) ? value : "system";
}

/** Saved custom colours, or null when the JSON is missing or the accent is not a hex. */
export function savedCustom(): CustomColours | null {
  const raw = storageGet(CUSTOM_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { accent?: unknown; tint?: unknown };
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.accent !== "string" || !HEX.test(parsed.accent)) return null;
    if (parsed.tint != null && (typeof parsed.tint !== "string" || !HEX.test(parsed.tint))) return null;
    return { accent: parsed.accent.toLowerCase(), tint: parsed.tint == null ? null : parsed.tint.toLowerCase() };
  } catch {
    return null;
  }
}

/** The saved palette. An unknown id, or a custom palette with bad colours, is Speedrunner. */
export function savedPalette(): Palette {
  const value = storageGet(PALETTE_KEY);
  if (value == null || value === "" || value === "speedrunner") return "speedrunner";
  if (isPreset(value)) return value;
  if (value === "custom") return savedCustom() ? "custom" : "speedrunner";
  return "speedrunner";
}

function mediaMatches(query: string): boolean {
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

/** The scheme the page is showing: the mode, or the system setting when the mode is System. */
export function activeScheme(): ColourScheme {
  const mode = savedTheme();
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return mediaMatches("(prefers-color-scheme: dark)") ? "dark" : "light";
}

function clearCustomProperties(): void {
  const style = document.documentElement.style;
  for (const name of CUSTOM_PROPERTIES) style.removeProperty(name);
}

/** Shows the page in the saved mode and palette. */
export function applyAppearance(): void {
  const mode = savedTheme();
  const root = document.documentElement;
  if (mode === "system") delete root.dataset.theme;
  else root.dataset.theme = mode;

  const palette = savedPalette();
  if (palette === "speedrunner") delete root.dataset.palette;
  else root.dataset.palette = palette;

  clearCustomProperties();
  if (palette !== "custom" || mediaMatches("(forced-colors: active)")) return;
  const custom = savedCustom();
  if (!custom) return;
  const derived = deriveCustomTheme(custom.accent, custom.tint, activeScheme());
  for (const [name, value] of Object.entries(derived.tokens)) root.style.setProperty(name, value);
}

export function saveTheme(theme: Theme): void {
  storageSet(THEME_KEY, theme === "system" ? null : theme);
  applyAppearance();
}

export function savePalette(palette: Palette): void {
  storageSet(PALETTE_KEY, palette === "speedrunner" ? null : palette);
  applyAppearance();
}

export function saveCustom(colours: CustomColours): void {
  storageSet(CUSTOM_KEY, JSON.stringify({ accent: colours.accent.toLowerCase(), tint: colours.tint?.toLowerCase() ?? null }));
  if (savedPalette() === "custom") applyAppearance();
}

let listening = false;

/** Applies the saved appearance, and follows changes made in another window, such as the desktop overlay. */
export function startTheme(): void {
  applyAppearance();
  if (listening) return;
  listening = true;
  window.addEventListener("storage", (event) => {
    if (event.key === THEME_KEY || event.key === PALETTE_KEY || event.key === CUSTOM_KEY || event.key === null) applyAppearance();
  });
  for (const query of ["(prefers-color-scheme: dark)", "(forced-colors: active)"]) {
    try {
      window.matchMedia(query).addEventListener("change", () => applyAppearance());
    } catch {
      // The page still follows the choice saved in this window.
    }
  }
}
