import { formatTime, pbImprovement, type YearRecap } from "@speedrunner/core";
import { formatSave } from "./format";
import type { RecapDocKey } from "./recap-explain";

/** The shareable image is a fixed 4:5 card, the shape most feeds show uncropped. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

// The card is an image, so it keeps one look whatever theme the app is in.
const C = {
  ground: "#0e1726",
  tile: "#16233a",
  line: "#25344d",
  ink: "#e8edf5",
  ink2: "#a3b0c2",
  accent: "#3987e5",
  gold: "#f0c25a",
};
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const nf = new Intl.NumberFormat("en");

export function hoursPlayed(ms: number): string {
  const h = ms / 3_600_000;
  return h >= 10 ? nf.format(Math.round(h)) : h.toFixed(1);
}

export const categoryName = (c: { game: string; category: string }) =>
  `${c.game || "Unknown game"} ${c.category}`.trim();

export interface CardStat {
  key: RecapDocKey;
  label: string;
  value: string;
}

export interface CardHighlight {
  key: RecapDocKey;
  label: string;
  title: string;
  detail: string;
  gold?: boolean;
}

/** The numbers on the card, shared by the image and the page so both say the same thing. */
export function cardStats(r: YearRecap): CardStat[] {
  return [
    { key: "attempts", label: "Attempts", value: nf.format(r.attempts) },
    { key: "hours", label: "Hours played", value: hoursPlayed(r.playMs) },
    { key: "finished", label: "Finished runs", value: nf.format(r.finished) },
    { key: "pbs", label: "Personal bests", value: nf.format(r.pbCount) },
    { key: "golds", label: "Golds", value: nf.format(r.goldCount) },
    {
      key: "streak",
      label: "Longest streak",
      value: r.longestStreak ? `${r.longestStreak.days} ${r.longestStreak.days === 1 ? "day" : "days"}` : "-",
    },
  ];
}

export function cardHighlights(r: YearRecap): CardHighlight[] {
  const out: CardHighlight[] = [];
  const pb = r.pbs[0];
  if (pb) {
    out.push({
      key: "biggestPb",
      label: pb.before == null ? "First finish" : "Biggest PB",
      title: categoryName(pb),
      detail:
        pb.before == null
          ? `PB ${formatTime(pb.after)}`
          : `${formatTime(pb.before)} to ${formatTime(pb.after)}, −${formatSave(pb.before - pb.after)} (${share(pbImprovement(pb))})`,
    });
  }
  if (r.bestGold) {
    out.push({
      key: "bestGold",
      label: "Best gold",
      title: r.bestGold.segment,
      detail: `${formatTime(r.bestGold.time)}, −${formatSave(r.bestGold.saved)} (${share(r.bestGold.fraction)}) on the old best · ${categoryName(r.bestGold)}`,
      gold: true,
    });
  }
  if (r.mostImproved) {
    const m = r.mostImproved;
    out.push({
      key: "mostImproved",
      label: "Most improved",
      title: m.segment,
      detail: `Typical time ${formatTime(m.early, 1)} to ${formatTime(m.late, 1)}, ${share(m.fraction)} faster · ${categoryName(m)}`,
    });
  }
  return out;
}

/** "12%", or "1.5%" under 10%: a share of a time, the way the card shows it. */
function share(x: number): string {
  const p = x * 100;
  return `${p >= 10 ? Math.round(p) : +p.toFixed(1)}%`;
}

/** "Dishonored Any%" or "Dishonored Any% and 2 more". */
export function categoriesLine(r: YearRecap): string {
  const [top, ...rest] = r.categories;
  if (!top) return "No attempts";
  return rest.length ? `${categoryName(top)} and ${rest.length} more` : categoryName(top);
}

/** Waits for the card's fonts so the first draw doesn't fall back to a system font. */
export async function loadCardFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  await Promise.all(
    [`600 40px ${SANS}`, `500 40px ${SANS}`, `400 40px ${SANS}`, `600 40px ${MONO}`, `500 40px ${MONO}`].map((f) =>
      document.fonts.load(f).catch(() => undefined),
    ),
  );
}

/** Draws the recap card at CARD_WIDTH × CARD_HEIGHT. */
export function drawRecapCard(ctx: CanvasRenderingContext2D, r: YearRecap): void {
  const W = CARD_WIDTH;
  const pad = 80;
  const inner = W - pad * 2;

  ctx.save();
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, 0, W, CARD_HEIGHT);
  ctx.textBaseline = "alphabetic";

  // Header: label, year, what was played.
  text(ctx, "YEAR IN RUNS", pad, 128, `600 26px ${SANS}`, C.accent, inner, 3);
  text(ctx, String(r.year), pad - 6, 270, `600 168px ${MONO}`, C.ink, inner);
  text(ctx, categoriesLine(r), pad, 326, `500 34px ${SANS}`, C.ink2, inner);

  // Six stat tiles in two rows.
  const gap = 20;
  const tileW = (inner - gap * 2) / 3;
  const tileH = 150;
  cardStats(r).forEach((s, i) => {
    const x = pad + (i % 3) * (tileW + gap);
    const y = 370 + Math.floor(i / 3) * (tileH + gap);
    roundRect(ctx, x, y, tileW, tileH, 16, C.tile);
    text(ctx, s.value, x + 28, y + 80, `600 58px ${SANS}`, C.ink, tileW - 56);
    text(ctx, s.label, x + 28, y + 122, `500 26px ${SANS}`, C.ink2, tileW - 56);
  });

  // Highlights.
  let y = 370 + tileH * 2 + gap + 70;
  for (const h of cardHighlights(r)) {
    ctx.fillStyle = h.gold ? C.gold : C.accent;
    ctx.fillRect(pad, y - 30, 6, 108);
    text(ctx, h.label.toUpperCase(), pad + 30, y, `600 22px ${SANS}`, h.gold ? C.gold : C.ink2, inner - 30, 2);
    text(ctx, h.title, pad + 30, y + 42, `600 34px ${SANS}`, C.ink, inner - 30);
    text(ctx, h.detail, pad + 30, y + 78, `400 25px ${SANS}`, C.ink2, inner - 30);
    y += 118;
  }

  // Attempts per month along the bottom.
  const chartTop = 1120;
  const chartH = 100;
  const barGap = 14;
  const barW = (inner - barGap * 11) / 12;
  const max = Math.max(1, ...r.monthly);
  r.monthly.forEach((n, i) => {
    const x = pad + i * (barW + barGap);
    const h = n ? Math.max(6, (n / max) * chartH) : 3;
    roundRect(ctx, x, chartTop + chartH - h, barW, h, 4, n ? C.accent : C.line);
    ctx.textAlign = "center";
    text(ctx, MONTHS[i], x + barW / 2, chartTop + chartH + 36, `500 22px ${SANS}`, C.ink2);
    ctx.textAlign = "left";
  });

  text(ctx, "Speedrunner · made offline from LiveSplit splits", pad, CARD_HEIGHT - 48, `400 22px ${SANS}`, C.ink2, inner);
  ctx.restore();
}

/** Fills text, shortening it with an ellipsis when it would be wider than maxWidth. */
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  font: string,
  color: string,
  maxWidth?: number,
  spacing = 0,
) {
  ctx.font = font;
  ctx.fillStyle = color;
  if ("letterSpacing" in ctx) (ctx as { letterSpacing: string }).letterSpacing = `${spacing}px`;
  let s = value;
  if (maxWidth != null && ctx.measureText(s).width > maxWidth) {
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
    s = `${s.trimEnd()}…`;
  }
  ctx.fillText(s, x, y);
  if ("letterSpacing" in ctx) (ctx as { letterSpacing: string }).letterSpacing = "0px";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
  ctx.fill();
}
