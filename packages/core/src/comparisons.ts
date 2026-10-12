import type { AnalyzeOptions, RunAnalysis } from "./analyze.js";
import { recentSegmentTimes } from "./goal.js";
import { formatTime } from "./time.js";
import type { Ms, Run, TimingMethod } from "./types.js";

/** A comparison to write into a split file: cumulative split times per segment, per timing method. */
export interface ComparisonToWrite {
  name: string;
  /** One cumulative time per segment; null leaves that split empty. */
  splits: Partial<Record<TimingMethod, Array<Ms | null>>>;
}

export const COMPARISON_NAMES = {
  realisticTarget: "Realistic target",
  recentGolds: "Recent golds",
  balanced: (goal: Ms) => `Sub ${formatTime(goal, goal % 1000 === 0 ? 0 : 2)} (balanced)`,
} as const;

/**
 * Splits of the realistic target: each segment at its PB time or your good-day time, whichever is
 * faster (a stretch the PB skipped a split in counts as one piece, see analyze.ts).
 */
export function realisticTargetSplits(analysis: RunAnalysis): Ms[] | null {
  if (analysis.realisticTargetSegments == null) return null;
  return cumulative(analysis.realisticTargetSegments) as Ms[];
}

/**
 * Splits of the sum of recent golds: your best clean time in each segment over the latest half
 * of its times (10 to 50, see recency.ts). Splits after a segment with no recent times are left empty.
 */
export function recentGoldSplits(run: Run, options: AnalyzeOptions = {}): Array<Ms | null> {
  return cumulative(recentSegmentTimes(run, options).map((times) => (times.length ? Math.min(...times) : null)));
}

/**
 * Adds comparisons to the text of a LiveSplit split file and returns the new text.
 * Everything else in the file is kept byte for byte. A comparison that already exists
 * with the same name is replaced, so exporting twice doesn't duplicate it.
 */
export function addComparisons(xml: string, comparisons: ComparisonToWrite[]): string {
  const segmentsMatch = /<Segments>([\s\S]*?)<\/Segments>/.exec(xml);
  if (!segmentsMatch) throw new Error("Not a LiveSplit split file: missing <Segments> element");
  const names = new Set(comparisons.map((c) => c.name));
  let index = 0;
  let missingSplitTimes = false;

  const segmentsXml = segmentsMatch[1].replace(/<Segment>([\s\S]*?)<\/Segment>/g, (segment) => {
    const i = index++;
    const inner = /(<SplitTimes>)([\s\S]*?)([ \t]*)<\/SplitTimes>|<SplitTimes\s*\/>/.exec(segment);
    if (!inner) {
      missingSplitTimes = true;
      return segment;
    }
    // Match the indentation of the existing entries.
    const closeIndent = inner[3] ?? /\n([ \t]*)<SplitTimes/.exec(segment)?.[1] ?? "";
    const indent = closeIndent + "  ";
    const kept = (inner[2] ?? "\n").replace(
      /[ \t]*<SplitTime\s+name="([^"]*)"\s*(?:\/>|>[\s\S]*?<\/SplitTime>)\r?\n?/g,
      (entry, name) => (names.has(unescapeXml(name)) ? "" : entry),
    );
    const nl = segment.includes("\r\n") ? "\r\n" : "\n";
    const added = comparisons.map((c) => splitTimeXml(c, i, indent, nl)).join("");
    const body = (kept.endsWith("\n") ? kept : kept + nl) + added;
    return segment.slice(0, inner.index) + `<SplitTimes>${body}${closeIndent}</SplitTimes>` + segment.slice(inner.index + inner[0].length);
  });

  if (missingSplitTimes) {
    throw new Error("This split file is from an old LiveSplit version. Open it in LiveSplit and save it once, then try again.");
  }
  for (const c of comparisons) {
    for (const splits of Object.values(c.splits)) {
      if (splits && splits.length !== index) throw new Error(`Comparison "${c.name}" has ${splits.length} splits for ${index} segments`);
    }
  }
  return xml.slice(0, segmentsMatch.index) + `<Segments>${segmentsXml}</Segments>` + xml.slice(segmentsMatch.index + segmentsMatch[0].length);
}

function splitTimeXml(c: ComparisonToWrite, i: number, indent: string, nl: string): string {
  const times = (["RealTime", "GameTime"] as const)
    .map((m) => {
      const t = c.splits[m]?.[i];
      return t == null ? "" : `${indent}  <${m}>${formatLssTime(t)}</${m}>${nl}`;
    })
    .join("");
  const name = escapeXml(c.name);
  return times ? `${indent}<SplitTime name="${name}">${nl}${times}${indent}</SplitTime>${nl}` : `${indent}<SplitTime name="${name}" />${nl}`;
}

/** Formats milliseconds the way LiveSplit stores them: "00:03:11.2650000", or "1.02:03:04.5000000" past a day. */
export function formatLssTime(ms: Ms): string {
  const sign = ms < 0 ? "-" : "";
  let rest = Math.abs(Math.round(ms));
  const days = Math.floor(rest / 86_400_000);
  rest %= 86_400_000;
  const h = Math.floor(rest / 3_600_000);
  const m = Math.floor((rest % 3_600_000) / 60_000);
  const s = Math.floor((rest % 60_000) / 1000);
  const frac = String(rest % 1000).padStart(3, "0") + "0000";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${sign}${days ? `${days}.` : ""}${pad(h)}:${pad(m)}:${pad(s)}.${frac}`;
}

function cumulative(times: Array<Ms | null>): Array<Ms | null> {
  let acc: Ms | null = 0;
  return times.map((t) => (acc = acc == null || t == null ? null : acc + t));
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function unescapeXml(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
