import { XMLParser } from "fast-xml-parser";
import { parseTime } from "./time.js";
import type { Attempt, Comparison, Ms, Run, Segment, TimingMethod } from "./types.js";

const ARRAY_TAGS = new Set(["Attempt", "Segment", "SplitTime", "Time"]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  parseAttributeValue: false,
  // Character references too (&#39;, &#x27;), which hand-edited files and other tools write.
  htmlEntities: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

export interface ParseOptions {
  /** Which clock to read. Defaults to RealTime, falling back to GameTime if RealTime is empty. */
  timingMethod?: TimingMethod;
}

/** Parses the contents of a LiveSplit .lss file. */
export function parseLss(xml: string, options: ParseOptions = {}): Run {
  const doc = parser.parse(xml);
  const run = doc?.Run;
  if (!run) throw new Error("Not a LiveSplit split file: missing <Run> element");

  const rawSegments: any[] = run.Segments?.Segment ?? [];
  const timingMethod = options.timingMethod ?? pickTimingMethod(rawSegments);
  // Files before LiveSplit 1.6 store a single real time directly as the element's text.
  const read = (node: any): Ms | null => {
    if (node == null) return null;
    if (typeof node !== "object" || !(timingMethod in node || "RealTime" in node || "GameTime" in node)) {
      return timingMethod === "RealTime" ? parseTime(text(node)) : null;
    }
    return parseTime(text(node[timingMethod]));
  };
  // One unreadable time in the attempt history is left out rather than rejecting the whole file;
  // the PB and golds still have to read.
  const readHistory = (node: any): Ms | null => {
    try {
      return read(node);
    } catch {
      return null;
    }
  };

  const attempts: Attempt[] = (run.AttemptHistory?.Attempt ?? []).map((a: any) => ({
    id: Number(a["@id"]),
    started: a["@started"],
    ended: a["@ended"],
    time: readHistory(a),
  }));

  const segments: Segment[] = rawSegments.map((s) => {
    const splitTimes: any[] = s.SplitTimes?.SplitTime ?? [];
    // LiveSplit 1.0-1.4 kept the PB in <PersonalBestSplitTime> instead of <SplitTimes>.
    const pb = splitTimes.find((t) => t["@name"] === "Personal Best") ?? s.PersonalBestSplitTime;
    const history = new Map<number, Ms | null>();
    for (const t of s.SegmentHistory?.Time ?? []) {
      const id = Number(t["@id"]);
      // LiveSplit stores non-positive ids for imported/merged history; they are not real attempts.
      if (id > 0) history.set(id, readHistory(t));
    }
    const rawName = text(s.Name) ?? "";
    return {
      name: segmentDisplayName(rawName),
      rawName,
      pbSplit: read(pb),
      gold: read(s.BestSegmentTime),
      history,
    };
  });

  // Custom comparisons live next to the PB in each segment's <SplitTimes>; the last split holds the final time.
  const lastSplitTimes: any[] = rawSegments.at(-1)?.SplitTimes?.SplitTime ?? [];
  const comparisons: Comparison[] = lastSplitTimes
    .filter((t) => t["@name"] && t["@name"] !== "Personal Best")
    .map((t) => ({ name: String(t["@name"]), time: read(t) }));

  return {
    game: text(run.GameName) ?? "",
    category: text(run.CategoryName) ?? "",
    timingMethod,
    attemptCount: Number(text(run.AttemptCount) ?? attempts.length),
    attempts,
    segments,
    comparisons,
  };
}

/** Uses GameTime only when the PB has game times and no real times (e.g. load-removed runs). */
function pickTimingMethod(segments: any[]): TimingMethod {
  const pbNode = (s: any) => (s.SplitTimes?.SplitTime ?? []).find((t: any) => t["@name"] === "Personal Best");
  const has = (m: TimingMethod) => segments.some((s) => text(pbNode(s)?.[m])?.trim());
  return !has("RealTime") && has("GameTime") ? "GameTime" : "RealTime";
}

function text(node: unknown): string | undefined {
  if (node == null) return undefined;
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in (node as any)) return String((node as any)["#text"]);
  return undefined;
}

/** True when the file has any game times, so a choice between real time and game time means something. */
export function hasGameTime(xml: string): boolean {
  return /<GameTime>\s*[\d-]/.test(xml);
}

/** A segment name without LiveSplit's subsplit markers: "-Name" and "{Section}Name" both read "Name". */
export function segmentDisplayName(name: string): string {
  return name.replace(/^-/, "").replace(/^\{[^}]*\}\s*/, "") || name;
}
