import type { CSSProperties } from "react";

/** How the live card looks: its colours and text sizes. The same style is used by the preview and the overlay. */
export interface CardStyle {
  background: string;
  text: string;
  labels: string;
  ahead: string;
  gold: string;
  down: string;
  /** Size of the values, in px. */
  valueSize: number;
  /** Size of the labels on the left, in px. Details under the values are a bit smaller. */
  labelSize: number;
}

/** The standard look: the Night Shell card from DESIGN.md. */
export const DEFAULT_STYLE: CardStyle = {
  background: "#0e1726",
  text: "#e8edf5",
  labels: "#a3b0c2",
  ahead: "#86b6ef",
  gold: "#f0c25a",
  down: "#ff8a8a",
  valueSize: 22,
  labelSize: 14,
};

export const STYLE_COLOURS: Array<{ key: keyof CardStyle; label: string }> = [
  { key: "background", label: "Background" },
  { key: "text", label: "Values" },
  { key: "labels", label: "Labels and details" },
  { key: "ahead", label: "Ahead and keep going" },
  { key: "gold", label: "Golds" },
  { key: "down", label: "PB chance falling" },
];

export const VALUE_SIZES = { min: 14, max: 48 };
export const LABEL_SIZES = { min: 11, max: 22 };

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (n: unknown, { min, max }: { min: number; max: number }, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;

/** A saved style with anything missing or malformed put back to the standard look. */
export function normalizeStyle(saved: unknown): CardStyle {
  const s = (saved && typeof saved === "object" ? saved : {}) as Partial<Record<keyof CardStyle, unknown>>;
  const colour = (k: keyof CardStyle) => (typeof s[k] === "string" && HEX.test(s[k] as string) ? (s[k] as string) : (DEFAULT_STYLE[k] as string));
  return {
    background: colour("background"),
    text: colour("text"),
    labels: colour("labels"),
    ahead: colour("ahead"),
    gold: colour("gold"),
    down: colour("down"),
    valueSize: clamp(s.valueSize, VALUE_SIZES, DEFAULT_STYLE.valueSize),
    labelSize: clamp(s.labelSize, LABEL_SIZES, DEFAULT_STYLE.labelSize),
  };
}

export const isDefaultStyle = (s: CardStyle) => (Object.keys(DEFAULT_STYLE) as Array<keyof CardStyle>).every((k) => s[k] === DEFAULT_STYLE[k]);

/** The style as CSS custom properties on the card. */
export function cardStyleVars(s: CardStyle): CSSProperties {
  return {
    "--card-bg": s.background,
    "--card-ink": s.text,
    "--card-ink-2": s.labels,
    "--card-ahead": s.ahead,
    "--card-gold": s.gold,
    "--card-down": s.down,
    "--card-line": `color-mix(in srgb, ${s.labels} 22%, ${s.background})`,
    "--live-value-size": `${s.valueSize}px`,
    "--live-label-size": `${s.labelSize}px`,
  } as CSSProperties;
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Colours that would be hard to read on the chosen background (under 4.5:1). */
export function lowContrast(s: CardStyle): string[] {
  return STYLE_COLOURS.filter((c) => c.key !== "background" && contrast(s[c.key] as string, s.background) < 4.5).map((c) => c.label);
}
