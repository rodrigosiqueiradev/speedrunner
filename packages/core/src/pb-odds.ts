import { quantile } from "./analyze.js";
import { buildSegmentModel, sampleSegment, seededRandom, type SegmentModel, type SegmentModelOptions } from "./segment-model.js";
import { parseLiveSplitDate } from "./sessions.js";
import type { Ms, Run } from "./types.js";

/** Settings for PB odds and reset advice. Exported so the UI and docs can quote the real numbers. */
export const PB_ODDS_SETTINGS = {
  /** Simulated attempts. More is smoother but slower; 20,000 resolves odds down to about 1 in 10,000. */
  simulations: 20_000,
  /** Fixed seed so the same file always gives the same odds. */
  seed: 20_261_009,
  /** The grind rate is the attempts per day over this many days before your latest attempt. */
  grindWindowDays: 28,
  /**
   * When a run can't PB any more, keep going for practice if the rest of the run holds at least
   * this many times as much room to improve per minute as the part you'd replay after a reset.
   */
  practiceBias: 1,
} as const;

export type ResetVerdict = "keep-going" | "keep-going-practice" | "reset";

export interface SplitOdds {
  index: number;
  name: string;
  /** Your PB's time at this split, or null if the PB skipped it. */
  pbSplit: Ms | null;
  /** PB chance if you reach this split exactly on PB pace. */
  onPace: number | null;
  /**
   * How far behind PB pace you can be at this split before resetting gets you a PB sooner than
   * playing on. Negative means you need to be ahead. Null when playing on from here is never
   * the faster way to a PB (or there is no PB chance at all).
   */
  resetAfter: Ms | null;
  /** The rest of the run has more room to improve per minute than the part before this split. */
  practiceLate: boolean;
  /** Average time left in an attempt from here, counting runs that end in a reset. */
  meanRemaining: Ms;
}

export interface PbForecast {
  /** Attempts until there's an even chance of a PB, and a 90% chance. */
  attemptsFor50: number;
  attemptsFor90: number;
  /** Your usual attempts per day, or null if the file has no attempt dates. */
  attemptsPerDay: number | null;
  /** ISO dates (YYYY-MM-DD) for those two chances at your grind rate, or null without one. */
  date50: string | null;
  date90: string | null;
}

export interface PbOdds {
  personalBest: Ms;
  simulations: number;
  /** Chance one attempt beats your PB, counting attempts that end in a reset. */
  perAttempt: number;
  /** Chance a run played to the end beats your PB. */
  ifFinished: number;
  /** Share of simulated attempts that reach the end without a reset. */
  finishRate: number;
  /** Average simulated attempt length, counting resets. */
  meanAttemptLength: Ms;
  /** Your median finish time in the simulation, and the time you'd beat 1 run in 10. */
  medianFinish: Ms;
  goodFinish: Ms;
  /** Segments with too few recent clean times for the odds to be firm. */
  thinSegments: string[];
  /** One entry per split before the last. */
  splits: SplitOdds[];
  forecast: PbForecast | null;
  /**
   * For each split, the sorted time it takes simulated runs to finish from there, only
   * counting runs that didn't reset. Used to answer "what are my odds from here?".
   */
  remaining: Float64Array[];
}

export interface PbOddsOptions extends SegmentModelOptions {
  simulations?: number;
  seed?: number;
  /** "Today", for the forecast dates. Defaults to now. */
  now?: Date;
}

/**
 * Simulates thousands of attempts by sampling each segment from your recent clean times, and
 * works out how often they beat your PB, from the start and from every split.
 * Returns null when the run has no PB to beat.
 */
export function pbOdds(run: Run, options: PbOddsOptions = {}): PbOdds | null {
  const personalBest = [...run.segments].reverse().find((s) => s.pbSplit != null)?.pbSplit ?? null;
  const n = run.segments.length;
  if (personalBest == null || n === 0) return null;
  const models = buildSegmentModel(run, options);
  if (models.some((m) => m.times.length === 0)) return null;

  const sims = options.simulations ?? PB_ODDS_SETTINGS.simulations;
  const random = seededRandom(options.seed ?? PB_ODDS_SETTINGS.seed);

  // remaining[j]: finishing times from the start of segment j for runs that didn't reset in j..n-1.
  // A fresh attempt (j = 0) resets as often as your attempts do. A run you've decided to play on
  // from a split only ends on a mistake, so later segments use the mistake rate instead.
  const remaining: number[][] = Array.from({ length: n }, () => []);
  const lengthFrom = new Float64Array(n);
  const finishes = new Float64Array(sims);
  let beatIfFinished = 0;
  const times = new Float64Array(n);
  const rolls = new Float64Array(n);

  for (let s = 0; s < sims; s++) {
    for (let j = 0; j < n; j++) {
      times[j] = sampleSegment(models[j], random);
      rolls[j] = random();
    }
    // Walk backwards so each segment j sees the run from j to the end.
    let total = 0;
    let length = 0;
    let alive = true;
    for (let j = n - 1; j >= 1; j--) {
      total += times[j];
      // A reset happens somewhere inside the segment; count half of it.
      if (rolls[j] < models[j].mistakeRate) [alive, length] = [false, times[j] / 2];
      else length += times[j];
      lengthFrom[j] += length;
      if (alive) remaining[j].push(total);
    }
    total += times[0];
    let freshLength = 0;
    let freshAlive = true;
    for (let j = 0; j < n && freshAlive; j++) {
      if (rolls[j] < models[j].resetRate) [freshAlive, freshLength] = [false, freshLength + times[j] / 2];
      else freshLength += times[j];
    }
    lengthFrom[0] += freshLength;
    if (freshAlive) remaining[0].push(total);
    finishes[s] = total;
    if (total < personalBest) beatIfFinished++;
  }

  const sorted = remaining.map((r) => Float64Array.from(r).sort());
  const perAttempt = countBelow(sorted[0], personalBest) / sims;
  const meanAttemptLength = lengthFrom[0] / sims;
  // PBs per millisecond of play when every attempt is played until it finishes or resets.
  const freshRate = perAttempt / meanAttemptLength;

  const room = models.map(roomToImprove);
  const typical = models.map((m) => quantile([...m.times].sort((a, b) => a - b), 0.5));
  const density = (from: number, to: number) => {
    const t = sum(typical, from, to);
    return t > 0 ? sum(room, from, to) / t : 0;
  };

  const splits: SplitOdds[] = run.segments.slice(0, -1).map((segment, i) => {
    const rest = sorted[i + 1];
    const meanRemaining = lengthFrom[i + 1] / sims;
    const pbSplit = segment.pbSplit;
    let resetAfter: Ms | null = null;
    if (pbSplit != null && perAttempt > 0) {
      // Keep going while chance from here ÷ time left ≥ the rate fresh attempts find PBs.
      const needed = Math.ceil(freshRate * meanRemaining * sims);
      const left = personalBest - pbSplit;
      // More than the surviving runs means even a perfect position here isn't worth playing on for.
      resetAfter = needed <= 0 || needed > rest.length ? null : left - rest[needed - 1];
    }
    return {
      index: i,
      name: segment.name,
      pbSplit,
      onPace: pbSplit == null ? null : countBelow(rest, personalBest - pbSplit) / sims,
      resetAfter,
      practiceLate: density(i + 1, n) >= density(0, i + 1) * PB_ODDS_SETTINGS.practiceBias,
      meanRemaining,
    };
  });

  const finishSorted = Float64Array.from(finishes).sort();
  return {
    personalBest,
    simulations: sims,
    perAttempt,
    ifFinished: beatIfFinished / sims,
    finishRate: sorted[0].length / sims,
    meanAttemptLength,
    medianFinish: Math.round(finishSorted[Math.floor(sims / 2)]),
    goodFinish: Math.round(finishSorted[Math.floor(sims / 10)]),
    thinSegments: models.filter((m) => m.thin).map((m) => m.name),
    splits,
    forecast: forecast(run, perAttempt, options.now ?? new Date()),
    remaining: sorted,
  };
}

/** PB chance for a run that is at `split` with `timeAtSplit` on the clock. */
export function pbChanceFrom(odds: PbOdds, split: number, timeAtSplit: Ms): number {
  return countBelow(odds.remaining[split + 1], odds.personalBest - timeAtSplit) / odds.simulations;
}

export interface ResetAdvice {
  verdict: ResetVerdict;
  /** PB chance from here. */
  chance: number;
  message: string;
}

/**
 * Whether to keep going or reset at `split` with `timeAtSplit` on the clock. Keeps going when
 * playing on finds PBs at least as fast as fresh attempts do. Otherwise keeps going for practice
 * when the rest of the run is where you have the most room to improve, and resets when the
 * early game is.
 */
export function resetAdvice(odds: PbOdds, split: number, timeAtSplit: Ms): ResetAdvice {
  const s = odds.splits[split];
  const chance = pbChanceFrom(odds, split, timeAtSplit);
  const freshRate = odds.perAttempt / odds.meanAttemptLength;
  const pbPart = chance > 0 ? `${describeChance(chance)} of runs from here still PB` : "no run from here beat your PB";
  if (chance > 0 && chance / s.meanRemaining >= freshRate) {
    return { verdict: "keep-going", chance, message: `Keep going: ${pbPart}, better than starting over.` };
  }
  if (s.practiceLate) {
    return {
      verdict: "keep-going-practice",
      chance,
      message: `${capitalize(pbPart)}, so a reset would find a PB sooner. But the rest of the run is where you have the most to gain, so keep going for the practice.`,
    };
  }
  return {
    verdict: "reset",
    chance,
    message: `Reset: ${pbPart}, and the early game is where you have the most to gain.`,
  };
}

/** "3%", "0.4%", "under 0.01%": a chance written the way a runner would say it. */
export function describeChance(p: number): string {
  if (p <= 0) return "0%";
  if (p < 0.0001) return "under 0.01%";
  if (p >= 0.995) return "over 99%";
  if (p >= 0.1) return `${Math.round(p * 100)}%`;
  if (p >= 0.01) return `${(p * 100).toFixed(1).replace(/\.0$/, "")}%`;
  return `${(p * 100).toFixed(2).replace(/0$/, "")}%`;
}

/** "1 in 40": odds per attempt as a whole number of attempts. */
export function oneIn(p: number): string {
  if (p <= 0) return "none";
  const n = 1 / p;
  if (n < 1.5) return "almost every";
  return `1 in ${(n < 20 ? Math.round(n) : Math.round(n / 5) * 5).toLocaleString("en-US")}`;
}

/** Attempts until the chance of at least one PB reaches `target`. */
export function attemptsUntil(p: number, target: number): number {
  if (p <= 0) return Infinity;
  if (p >= 1) return 1;
  return Math.max(1, Math.ceil(Math.log(1 - target) / Math.log(1 - p)));
}

function forecast(run: Run, p: number, now: Date): PbForecast | null {
  if (p <= 0) return null;
  const attemptsFor50 = attemptsUntil(p, 0.5);
  const attemptsFor90 = attemptsUntil(p, 0.9);
  const attemptsPerDay = grindRate(run);
  const date = (attempts: number) =>
    attemptsPerDay == null ? null : addDays(now, Math.ceil(attempts / attemptsPerDay)).toISOString().slice(0, 10);
  return { attemptsFor50, attemptsFor90, attemptsPerDay, date50: date(attemptsFor50), date90: date(attemptsFor90) };
}

/** Attempts per day over the last few weeks you ran, from LiveSplit's attempt start dates. */
export function grindRate(run: Run): number | null {
  const starts = run.attempts
    .filter((a) => a.id > 0)
    .map((a) => parseLiveSplitDate(a.started))
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b);
  if (starts.length < 2) return null;
  const day = 86_400_000;
  const latest = starts[starts.length - 1];
  const windowStart = Math.max(starts[0], latest - PB_ODDS_SETTINGS.grindWindowDays * day);
  const count = starts.filter((t) => t >= windowStart).length;
  return count / Math.max(1, (latest - windowStart) / day);
}

/** How much a segment typically gives away: median minus your best recent time. */
function roomToImprove(m: SegmentModel): number {
  const sorted = [...m.times].sort((a, b) => a - b);
  return quantile(sorted, 0.5) - sorted[0];
}

/** Number of values in an ascending array strictly below `limit`. */
function countBelow(sorted: Float64Array, limit: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < limit) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function sum(xs: number[], from: number, to: number): number {
  let total = 0;
  for (let i = from; i < to; i++) total += xs[i];
  return total;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
