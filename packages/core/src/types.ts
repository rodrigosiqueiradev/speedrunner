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
  name: string;
  /** Cumulative split time in the personal best, or null if the PB skipped this split. */
  pbSplit: Ms | null;
  /** Best ever time for this segment as stored by LiveSplit (the "gold"). */
  gold: Ms | null;
  /**
   * Segment time per attempt id. A value of null means the split was skipped in
   * that attempt; a missing key means the attempt never reached this segment.
   */
  history: Map<number, Ms | null>;
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
