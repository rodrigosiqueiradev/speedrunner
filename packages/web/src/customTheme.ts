/**
 * Custom theme tokens, derived in OKLCH from an accent and an optional tint.
 * The blue row of the OKLab-to-sRGB matrix uses +0.0041960863. The worked
 * examples in the colour theme spec were generated with that conversion.
 */

export type ColourScheme = "light" | "dark";

export type DerivedTheme = {
  tokens: Record<string, string>;
  /** True when the page had to move a colour so text stays readable. */
  adjusted: boolean;
};

const TEXT = 4.6;
const UI = 3.1;
const DARK_TEXT = "#0d1420";

export const CUSTOM_PROPERTIES = [
  "--ground",
  "--surface",
  "--surface-sunk",
  "--hover",
  "--line",
  "--line-strong",
  "--ink",
  "--ink-2",
  "--ink-3",
  "--shell",
  "--shell-ink",
  "--shell-ink-2",
  "--accent",
  "--accent-ink",
  "--accent-wash",
  "--accent-fill",
  "--accent-fill-hover",
  "--on-accent",
  "--gold",
  "--gold-wash",
  "--gold-ink",
  "--error",
  "--error-wash",
  "--r0",
  "--shadow-pop",
] as const;

const SPEED_LIGHT: Record<string, string> = {
  "--ground": "#f1f3f6",
  "--surface": "#ffffff",
  "--surface-sunk": "#f6f7f9",
  "--hover": "#eef1f5",
  "--line": "#e1e5eb",
  "--line-strong": "#c9cfd8",
  "--ink": "#0d1420",
  "--ink-2": "#47505e",
  "--ink-3": "#5d6573",
  "--shell": "#0e1726",
  "--shell-ink": "#e8edf5",
  "--shell-ink-2": "#a3b0c2",
  "--r0": "#e7ebf0",
  "--shadow-pop": "0 6px 24px rgb(13 20 32 / 0.14), 0 1px 3px rgb(13 20 32 / 0.08)",
};

const SPEED_DARK: Record<string, string> = {
  "--ground": "#0d1117",
  "--surface": "#151a22",
  "--surface-sunk": "#11161d",
  "--hover": "#1c2330",
  "--line": "#252d39",
  "--line-strong": "#343e4d",
  "--ink": "#f2f5f9",
  "--ink-2": "#b9c2cf",
  "--ink-3": "#8b95a4",
  "--shell": "#080c12",
  "--shell-ink": "#e8edf5",
  "--shell-ink-2": "#8b97a8",
  "--r0": "#1f2733",
  "--shadow-pop": "0 8px 28px rgb(0 0 0 / 0.5)",
};

const GOLD_LIGHT: Record<string, string> = {
  "--gold": "#b8860b",
  "--gold-wash": "#fbf3dd",
  "--gold-ink": "#7a5600",
  "--error": "#b42323",
  "--error-wash": "#fdecec",
};

const GOLD_DARK: Record<string, string> = {
  "--gold": "#c98500",
  "--gold-wash": "#2a2210",
  "--gold-ink": "#f0c25a",
  "--error": "#ff8a8a",
  "--error-wash": "#2d1515",
};

const LIGHT_LADDER: Record<string, [number, number]> = {
  "--ground": [0.963, 0.012],
  "--surface-sunk": [0.976, 0.008],
  "--hover": [0.955, 0.014],
  "--line": [0.918, 0.016],
  "--line-strong": [0.848, 0.022],
  "--ink": [0.191, 0.02],
  "--ink-2": [0.429, 0.022],
  "--ink-3": [0.5, 0.02],
  "--r0": [0.936, 0.014],
  "--shell": [0.2, 0.03],
  "--shell-ink": [0.945, 0.012],
  "--shell-ink-2": [0.748, 0.028],
};

const DARK_LADDER: Record<string, [number, number]> = {
  "--ground": [0.176, 0.016],
  "--surface": [0.216, 0.02],
  "--surface-sunk": [0.198, 0.018],
  "--hover": [0.255, 0.028],
  "--line": [0.295, 0.028],
  "--line-strong": [0.361, 0.032],
  "--ink": [0.969, 0.008],
  "--ink-2": [0.811, 0.02],
  "--ink-3": [0.667, 0.024],
  "--r0": [0.271, 0.026],
  "--shell": [0.15, 0.02],
  "--shell-ink": [0.945, 0.01],
  "--shell-ink-2": [0.672, 0.028],
};

/** Python 3 round: halves go to the even integer. */
function roundHalfEven(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const floor = Math.floor(abs);
  const fraction = abs - floor;
  if (fraction === 0.5) return sign * (floor % 2 === 0 ? floor : floor + 1);
  return sign * Math.round(abs);
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToChannel(c: number): number {
  const clamped = Math.max(0, Math.min(1, c));
  const v = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, roundHalfEven(v * 255)));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map(srgbToLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function hexToOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const lmsL = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const lmsM = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const lmsS = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l = lmsL ** (1 / 3);
  const m = lmsM ** (1 / 3);
  const s = lmsS ** (1 / 3);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

function oklchToLinear(L: number, C: number, H: number): [number, number, number] {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  let l = L + 0.3963377774 * a + 0.2158037573 * b;
  let m = L - 0.1055613458 * a - 0.0638541728 * b;
  let s = L - 0.0894841775 * a - 1.291485548 * b;
  l = l ** 3;
  m = m ** 3;
  s = s ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function inGamut(rgb: [number, number, number]): boolean {
  return rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);
}

function oklchToHex(L: number, chroma: number, H: number): string {
  let C = Math.max(0, chroma);
  let rgb = oklchToLinear(L, C, H);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, H))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinear(L, lo, H);
  }
  return rgbToHex(linearToChannel(rgb[0]), linearToChannel(rgb[1]), linearToChannel(rgb[2]));
}

function shadowFromInk(ink: string, mode: ColourScheme): string {
  if (mode === "dark") return "0 8px 28px rgb(0 0 0 / 0.5)";
  const [r, g, b] = hexToRgb(ink);
  return `0 6px 24px rgb(${r} ${g} ${b} / 0.14), 0 1px 3px rgb(${r} ${g} ${b} / 0.08)`;
}

function neutrals(tint: string | null, mode: ColourScheme): Record<string, string> {
  if (!tint || hexToOklch(tint)[1] < 0.02) return { ...(mode === "light" ? SPEED_LIGHT : SPEED_DARK) };
  const hue = hexToOklch(tint)[2];
  const ladder = mode === "light" ? LIGHT_LADDER : DARK_LADDER;
  const out: Record<string, string> = {};
  for (const [key, [l, c]] of Object.entries(ladder)) out[key] = oklchToHex(l, c, hue);
  if (mode === "light") out["--surface"] = "#ffffff";
  out["--shadow-pop"] = shadowFromInk(out["--ink"], mode);
  return out;
}

function passesAll(hex: string, backgrounds: string[], target: number): boolean {
  return backgrounds.every((bg) => contrast(hex, bg) + 1e-9 >= target);
}

/** Lightness closest to the start that clears `target` on every background. */
function seek(L: number, C: number, H: number, backgrounds: string[], target: number, direction: -1 | 1): [string, boolean] {
  const start = oklchToHex(L, C, H);
  if (passesAll(start, backgrounds, target)) return [start, false];
  let lo = direction < 0 ? 0.2 : L;
  let hi = direction < 0 ? L : 0.94;
  let best: number | null = null;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    if (passesAll(oklchToHex(mid, C, H), backgrounds, target)) {
      best = mid;
      if (direction < 0) lo = mid;
      else hi = mid;
    } else if (direction < 0) hi = mid;
    else lo = mid;
  }
  if (best === null) best = direction < 0 ? 0.2 : 0.94;
  const step = direction < 0 ? -0.002 : 0.002;
  for (let i = 0; i < 50; i++) {
    const hex = oklchToHex(best, C, H);
    if (passesAll(hex, backgrounds, target)) return [hex, true];
    best += step;
    if (best < 0.18 || best > 0.96) break;
  }
  return [oklchToHex(best, C, H), true];
}

/** Every colour token for the active mode. Gold and error stay the Speedrunner pair. */
export function deriveCustomTheme(accentHex: string, tint: string | null, mode: ColourScheme): DerivedTheme {
  const notes: string[] = [];
  let [L, C, H] = hexToOklch(accentHex);
  if (C < 0.02) {
    notes.push("grey");
    H = 255.5;
    C = 0.14;
    L = mode === "light" ? 0.575 : 0.622;
  }
  if (C > 0.2) {
    notes.push("chroma");
    C = 0.16;
  }
  const neu = neutrals(tint, mode);
  if (tint && hexToOklch(tint)[1] < 0.02) notes.push("tint");
  const surface = neu["--surface"];
  const ground = neu["--ground"];
  let accent: string;
  let wash: string;
  let fill: string;
  let on: string;
  let hover: string;
  let ink: string;
  if (mode === "light") {
    wash = oklchToHex(0.955, Math.min(0.028, Math.max(0.012, C * 0.18)), H);
    let moved: boolean;
    [accent, moved] = seek(L, C, H, [surface, ground, wash], UI, -1);
    if (moved) notes.push("accent");
    const [whiteFill] = seek(L, C, H, ["#ffffff"], TEXT, -1);
    const wL = hexToOklch(whiteFill)[0];
    if (contrast("#ffffff", whiteFill) >= TEXT && L - wL <= 0.18 && contrast(whiteFill, surface) >= 3.1) {
      fill = whiteFill;
      on = "#ffffff";
      if (L - wL > 0.012) notes.push("fill");
    } else {
      [fill] = seek(L, C, H, [surface], 3.1, -1);
      if (contrast(DARK_TEXT, fill) < TEXT) {
        const fL = hexToOklch(fill)[0];
        [fill] = seek(fL, C, H, [DARK_TEXT], TEXT, 1);
      }
      on = DARK_TEXT;
      notes.push("dark-text");
    }
    const [fL, fC, fH] = hexToOklch(fill);
    if (on === "#ffffff") [hover] = seek(Math.max(0.28, fL - 0.05), fC, fH, ["#ffffff"], TEXT, -1);
    else {
      const [hoverD] = seek(Math.max(0.3, fL - 0.04), fC, fH, [DARK_TEXT, surface], TEXT, -1);
      hover = contrast(DARK_TEXT, hoverD) >= TEXT && contrast(hoverD, surface) >= 3 ? hoverD : fill;
    }
    const [aL, aC, aH] = hexToOklch(accent);
    [ink, moved] = seek(Math.min(aL, 0.48), Math.min(aC, 0.15), aH, [surface, ground, wash], TEXT, -1);
    if (moved) notes.push("ink");
  } else {
    wash = oklchToHex(0.255, Math.min(0.055, Math.max(0.03, C * 0.3)), H);
    let moved: boolean;
    // Ground is darker than the surface and the wash, so dark mode does not seek it.
    [accent, moved] = seek(L, C, H, [surface, wash], UI, 1);
    if (moved) notes.push("accent");
    if (L >= 0.7) {
      [fill] = seek(Math.min(Math.max(L, 0.72), 0.86), Math.min(C, 0.14), H, [DARK_TEXT], TEXT, 1);
      if (contrast(fill, surface) < 3.1) {
        const fL = hexToOklch(fill)[0];
        [fill] = seek(fL, Math.min(C, 0.14), H, [surface], 3.1, 1);
      }
      on = DARK_TEXT;
      notes.push("dark-text");
    } else {
      [fill] = seek(Math.min(L, 0.58), C, H, ["#ffffff"], TEXT, -1);
      if (contrast(fill, surface) < 3.1) {
        const [fL, fC, fH] = hexToOklch(fill);
        [fill] = seek(fL, fC, fH, [surface], 3.1, 1);
      }
      if (contrast("#ffffff", fill) >= TEXT && contrast(fill, surface) >= 3.1) {
        on = "#ffffff";
        if (Math.abs(hexToOklch(fill)[0] - L) > 0.012) notes.push("fill");
      } else {
        [fill] = seek(0.78, Math.min(C, 0.12), H, [DARK_TEXT], TEXT, 1);
        if (contrast(fill, surface) < 3.1) {
          const [fL, fC, fH] = hexToOklch(fill);
          [fill] = seek(fL, fC, fH, [surface], 3.1, 1);
        }
        on = DARK_TEXT;
        notes.push("dark-text");
      }
    }
    const [fL, fC, fH] = hexToOklch(fill);
    const bgText = on === "#ffffff" ? "#ffffff" : DARK_TEXT;
    const [hoverD] = seek(Math.max(0.3, fL - 0.045), fC, fH, [bgText], TEXT, -1);
    if (contrast(bgText, hoverD) >= TEXT && contrast(hoverD, surface) >= 3) hover = hoverD;
    else {
      const [hoverL] = seek(Math.min(0.9, fL + 0.04), fC, fH, [bgText], TEXT, 1);
      hover = contrast(bgText, hoverL) >= TEXT && contrast(hoverL, surface) >= 3 ? hoverL : fill;
    }
    const [aL, aC, aH] = hexToOklch(accent);
    [ink, moved] = seek(Math.max(aL, 0.74), Math.min(aC, 0.12), aH, [surface, ground, wash], TEXT, 1);
    if (moved) notes.push("ink");
  }
  const tokens: Record<string, string> = { ...neu, ...(mode === "light" ? GOLD_LIGHT : GOLD_DARK) };
  tokens["--accent"] = accent;
  tokens["--accent-ink"] = ink;
  tokens["--accent-wash"] = wash;
  tokens["--accent-fill"] = fill;
  tokens["--accent-fill-hover"] = hover;
  tokens["--on-accent"] = on;
  for (const [fg, bg] of [
    ["--ink", "--ground"],
    ["--ink", "--surface"],
    ["--ink-2", "--surface"],
    ["--ink-3", "--ground"],
    ["--ink-3", "--surface"],
    ["--shell-ink", "--shell"],
    ["--shell-ink-2", "--shell"],
  ] as const) {
    if (contrast(tokens[fg], tokens[bg]) < TEXT) {
      const [Ls, Cs, Hs] = hexToOklch(tokens[fg]);
      [tokens[fg]] = seek(Ls, Cs, Hs, [tokens[bg]], TEXT, mode === "light" ? -1 : 1);
      notes.push("neutral");
    }
  }
  return { tokens, adjusted: notes.some((note) => note !== "fill") };
}
