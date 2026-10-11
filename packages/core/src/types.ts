/** Times are in milliseconds throughout. `null` means "no time recorded". */
export type Ms = number;

export type TimingMethod = "RealTime" | "GameTime";

export interface Attempt {
  id: number;
  started?: string;
  ended?: string;
  /** Final time of the attempt, or null if it was reset before finishing. */
  time: Ms | null;
}

export interface Segment {
  /** The name to show, without LiveSplit's subsplit markers. */
  name: string;
  /**
   * The name as the split file has it. Subsplits mark a split inside a section "-Name" and the
   * split closing a section "{Section}Name"; LiveSplit's server reports names this way too.
   */
  rawName: string;
  /** Cumulative split time in the personal best, or null if the PB skipped this split. */
  pbSplit: Ms | null;
  /** Best ever time for this segment as stored by LiveSplit (the "gold"). */
  gold: Ms | null;
  /**
   * Segment time per attempt id. A value of null means the split was skipped in
   * that attempt; a missing key means the attempt never reached this segment.
   */
  history: Map<number, Ms | null>;
  /**
   * The runner marked this segment as luck-based (see luck.ts): its times split into a good and a
   * bad outcome they don't control. Never set by the parser; the app applies the runner's marks.
   */
  luck?: boolean;
}

export interface Run {
  game: string;
  category: string;
  timingMethod: TimingMethod;
  attemptCount: number;
  attempts: Attempt[];
  segments: Segment[];
  /** Custom comparisons saved in the file (such as "World Record"), with their final time. */
  comparisons: Comparison[];
}

export interface Comparison {
  name: string;
  /** The comparison's time at the last split, or null if it has none. */
  time: Ms | null;
}
