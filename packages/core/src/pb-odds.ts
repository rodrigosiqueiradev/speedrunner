import { attemptLimit, parseLiveSplitDate, playedMs } from "./sessions.js";
import {
  buildFormModel,
  buildSegmentModel,
  sampleRun,
  seededRandom,
  type SegmentModelOptions,
} from "./segment-model.js";
import type { Ms, Run } from "./types.js";

/**
 * Settings for PB odds and reset advice. Exported so the UI and docs can quote the real numbers.
 * None of them is a fixed time: they are counts of your own attempts or shares of your own spread,
 * so they fit a 5 minute category and a 6 hour one alike.
 */
export const PB_ODDS_SETTINGS = {
  /** Simulated runs. More is smoother but slower; 10,000 resolves odds down to about 1 in 5,000. */
  simulations: 10_000,
  /** Fixed seed so the same file always gives the same odds. */
  seed: 20_261_009,
  /** The grind rate is the attempts per day over this many days before your latest attempt. */
  grindWindowDays: 28,
  /** Your finish rate and attempt length come from this many of your latest attempts... */
  recentAttempts: 50,
  /**
   * ...but the finish rate reaches further back until it holds this many finished runs, so a
   * category where most attempts are reset doesn't read as never finishing.
   */
  minRecentFinishes: 5,
  /**
   * Odds from a split look at simulated runs that were near your time there. "Near" is this share
   * of how spread out the simulated times at that split are.
   */
  nearShare: 0.3,
  /** Reset points are searched for within this share of the PB's time at the split, ahead or behind. */
  searchShare: 0.2,
} as const;

export type ResetVerdict = "keep-going" | "reset";

/**
 * "behind": reset when further behind than `resetAfter`. "never": playing on stays the faster way
 * to a PB across the whole search range. "always": starting over is faster even well ahead of PB pace.
 */
export type ResetRule = "behind" | "never" | "always";

export interface SplitOdds {
  index: number;
  name: string;
  /** Your PB's time at this split, or null if the PB skipped it. */
  pbSplit: Ms | null;
  /** Chance of beating the target if you reach this split exactly on PB pace. */
  onPace: number | null;
  rule: ResetRule | null;
  /**
   * With rule "behind": how far behind PB pace you can be at this split before starting over finds a
   * PB sooner than playing on. Negative means you need to be ahead.
   */
  resetAfter: Ms | null;
  /** `resetAfter` as a share of the PB's time at this split, so it reads the same at any run length. */
  resetAfterShare: number | null;
  /** Average time left in a simulated run from this split. */
  meanRemaining: Ms;
  /** Chance a run that plays on from here reaches the end without a run-ending mistake. */
  survival: number;
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
  /** The time the odds are for: your PB unless a goal was given. */
  target: Ms;
  targetIsPb: boolean;
  simulations: number;
  /** Chance one attempt beats the target: the chance if you finish × your recent finish rate. */
  perAttempt: number;
  /** Chance a run played to the end beats the target. */
  ifFinished: number;
  /** Share of your recent attempts that finished. */
  finishRate: number;
  /** How many of your latest attempts the finish rate is taken from (0 without attempt history). */
  finishWindow: number;
  /** Your average attempt length, from attempt start and end times where the file has them. */
  meanAttemptLength: Ms;
  /** Your middle simulated finish time, and the time you'd beat 1 run in 10. */
  medianFinish: Ms;
  goodFinish: Ms;
  /** Log ratio the improvement trend takes off every simulated run (0 when there's no trend). */
  trend: number;
  /** Segments with too few clean times for the odds to be firm. */
  thinSegments: string[];
  /** One entry per split before the last. */
  splits: SplitOdds[];
  forecast: PbForecast | null;
  /** Simulated runs' times at each split, run by run: cumulative[run * segments + split]. */
  cumulative: Float64Array;
  /** Per split, how close a simulated run's time must be to count as "near" yours. */
  nearWidth: Float64Array;
  /** Per split, the chance of reaching the end with no run-ending mistake (see SplitOdds.survival). */
  survival: Float64Array;
  /**
   * Chance of no run-ending mistake from before the first split, including the first segment.
   * `survival[0]` starts only after that split.
   */
  survivalFromStart: number;
}

export interface PbOddsOptions extends SegmentModelOptions {
  /** A goal time to give the odds for instead of the PB. */
  target?: Ms;
  simulations?: number;
  seed?: number;
  /** "Today", for the forecast dates. Defaults to now. */
  now?: Date;
}

/**
 * Simulates thousands of runs from a model of your current form (see buildFormModel) and works out
 * how often they beat your PB or a goal, from the start and from every split. Returns null when there
 * is no PB or goal to beat.
 */
export function pbOdds(run: Run, options: PbOddsOptions = {}): PbOdds | null {
  const S = PB_ODDS_SETTINGS;
  const personalBest = [...run.segments].reverse().find((s) => s.pbSplit != null)?.pbSplit ?? null;
  const n = run.segments.length;
  const target = options.target ?? personalBest;
  if (personalBest == null || target == null || n === 0) return null;
  const form = buildFormModel(run, options);
  if (!form) return null;
  const segmentModels = buildSegmentModel(run, options);

  const sims = options.simulations ?? S.simulations;
  const random = seededRandom(options.seed ?? S.seed);
  const cumulative = new Float64Array(sims * n);
  const totals = new Float64Array(sims);
  const times = new Float64Array(n);
  let beat = 0;
  for (let s = 0; s < sims; s++) {
    const total = sampleRun(form, random, times);
    let acc = 0;
    for (let j = 0; j < n; j++) cumulative[s * n + j] = acc += times[j];
    totals[s] = total;
    if (total < target) beat++;
  }

  const ifFinished = beat / sims;
  const attempts = run.attempts.filter((a) => a.id > 0);
  const recent = attempts.slice(-S.recentAttempts);
  const lastSegment = run.segments[n - 1];
  const finished = (a: Run["attempts"][number]) => lastSegment.history.get(a.id) != null || a.time != null;
  // The latest attempts, widened back until they hold enough finished runs (or reach the first attempt).
  let start = Math.max(0, attempts.length - S.recentAttempts);
  let finishes = recent.filter(finished).length;
  while (start > 0 && finishes < S.minRecentFinishes) if (finished(attempts[--start])) finishes++;
  const finishWindow = attempts.length - start;
  // Without attempt history, fall back to the per-segment reset rates.
  const finishRate = finishWindow
    ? finishes / finishWindow
    : segmentModels.reduce((p, m) => p * (1 - m.resetRate), 1);
  const perAttempt = ifFinished * finishRate;
  const meanAttemptLength = attemptLength(run, recent) ?? modelledAttemptLength(form.segments.map((s) => s.typical), segmentModels);
  // Targets beaten per millisecond of play when every attempt is played until it finishes or resets.
  const freshRate = perAttempt / meanAttemptLength;

  // Survival from split i to the end: no run-ending mistake in any later segment.
  const survival = new Float64Array(n);
  survival[n - 1] = 1;
  for (let i = n - 2; i >= 0; i--) survival[i] = survival[i + 1] * (1 - segmentModels[i + 1].mistakeRate);
  // Before the first split the run is still in segment 0, so that segment's mistake rate counts too.
  const survivalFromStart = survival[0] * (1 - segmentModels[0].mistakeRate);

  const nearWidth = new Float64Array(n);
  const odds: PbOdds = {
    personalBest,
    target,
    targetIsPb: options.target == null,
    simulations: sims,
    perAttempt,
    ifFinished,
    finishRate,
    finishWindow,
    meanAttemptLength,
    medianFinish: 0,
    goodFinish: 0,
    trend: form.trend,
    thinSegments: segmentModels.filter((m) => m.thin).map((m) => m.name),
    splits: [],
    forecast: forecast(run, perAttempt, options.now ?? new Date()),
    cumulative,
    nearWidth,
    survival,
    survivalFromStart,
  };

  odds.splits = run.segments.slice(0, -1).map((segment, i) => {
    let sum = 0;
    let sumSq = 0;
    let remaining = 0;
    for (let s = 0; s < sims; s++) {
      const t = cumulative[s * n + i];
      sum += t;
      sumSq += t * t;
      remaining += totals[s] - t;
    }
    const mean = sum / sims;
    const sd = Math.sqrt(Math.max(0, sumSq / sims - mean * mean));
    nearWidth[i] = Math.max(S.nearShare * sd, mean * 1e-4, 1);
    const meanRemaining = remaining / sims;
    const pbSplit = segment.pbSplit;
    const base = { index: i, name: segment.name, pbSplit, meanRemaining, survival: survival[i] };
    if (pbSplit == null) return { ...base, onPace: null, rule: null, resetAfter: null, resetAfterShare: null };

    // Keep going while chance from here ÷ time left ≥ the rate fresh attempts beat the target.
    const needed = freshRate * meanRemaining;
    const chanceAt = (deficit: number) => pbChanceFrom(odds, i, pbSplit + deficit);
    const range = S.searchShare * pbSplit;
    let rule: ResetRule;
    let resetAfter: Ms | null = null;
    if (chanceAt(range) >= needed && (chanceAt(range) > 0 || needed === 0)) rule = "never";
    else if (chanceAt(-range) < needed || chanceAt(-range) === 0) rule = "always";
    else {
      rule = "behind";
      let lo = -range;
      let hi = range;
      for (let k = 0; k < 40 && hi - lo > 1; k++) {
        const mid = (lo + hi) / 2;
        if (chanceAt(mid) >= needed && chanceAt(mid) > 0) lo = mid;
        else hi = mid;
      }
      resetAfter = Math.round(lo);
    }
    return {
      ...base,
      onPace: chanceAt(0),
      rule,
      resetAfter,
      resetAfterShare: resetAfter == null ? null : resetAfter / pbSplit,
    };
  });

  const sorted = Float64Array.from(totals).sort();
  odds.medianFinish = Math.round(sorted[Math.floor(sims / 2)]);
  odds.goodFinish = Math.round(sorted[Math.floor(sims / 10)]);
  return odds;
}

/**
 * Chance of beating the target for a run that is at `split` with `timeAtSplit` on the clock. It
 * looks at the simulated runs that were near that time at that split (weighted by how near), so
 * being behind also says something about today's form, then counts how many of them still beat
 * the target, and allows for a run-ending mistake later on.
 */
export function pbChanceFrom(odds: PbOdds, split: number, timeAtSplit: Ms): number {
  const n = odds.survival.length;
  const sims = odds.simulations;
  const width = odds.nearWidth[split];
  const c = odds.cumulative;
  // Weights are relative to the nearest run, so a time far outside the simulated range still
  // leans on the closest runs instead of dividing by zero.
  let nearest = Infinity;
  for (let s = 0; s < sims; s++) nearest = Math.min(nearest, Math.abs(c[s * n + split] - timeAtSplit));
  let weight = 0;
  let hit = 0;
  for (let s = 0; s < sims; s++) {
    const at = c[s * n + split];
    const z1 = (at - timeAtSplit) / width;
    const z0 = nearest / width;
    const w = Math.exp(-0.5 * (z1 * z1 - z0 * z0));
    weight += w;
    if (timeAtSplit + (c[s * n + n - 1] - at) < odds.target) hit += w;
  }
  return weight > 0 ? (hit / weight) * odds.survival[split] : 0;
}

/**
 * The chance of a PB part way through a segment: the run reached `split` (-1 for the start) at
 * `timeAtSplit` and has spent `elapsed` in the segment after it. Among the simulated runs near that
 * split time (all of them at the start), only those whose next segment took longer than `elapsed`
 * still look like this run, so the chance falls as the segment runs long. With `elapsed` 0 it is
 * the chance at the split. Once no simulated run took that long it is 0: in the simulation, a run
 * this slow here never got a PB. `split` -1 is the start of the run, before any split, and the
 * survival factor then includes the first segment.
 */
export function pbChanceDuring(odds: PbOdds, split: number, timeAtSplit: Ms, elapsed: Ms): number {
  const n = odds.survival.length;
  const sims = odds.simulations;
  const c = odds.cumulative;
  const next = split + 1;
  const width = split < 0 ? 0 : odds.nearWidth[split];
  let nearest = Infinity;
  if (split >= 0) for (let s = 0; s < sims; s++) nearest = Math.min(nearest, Math.abs(c[s * n + split] - timeAtSplit));
  let weight = 0;
  let hit = 0;
  for (let s = 0; s < sims; s++) {
    const at = split < 0 ? 0 : c[s * n + split];
    if (c[s * n + next] - at <= elapsed) continue;
    let w = 1;
    if (split >= 0) {
      const z1 = (at - timeAtSplit) / width;
      const z0 = nearest / width;
      w = Math.exp(-0.5 * (z1 * z1 - z0 * z0));
    }
    weight += w;
    if (timeAtSplit + (c[s * n + n - 1] - at) < odds.target) hit += w;
  }
  const survive = split < 0 ? odds.survivalFromStart : odds.survival[split];
  return weight > 0 ? (hit / weight) * survive : 0;
}

/**
 * Odds of beating some other time (a goal, say) from the same simulated runs, without simulating
 * again: the chance if you finish, and per attempt at your recent finish rate.
 */
export function chanceOfBeating(odds: PbOdds, time: Ms): { ifFinished: number; perAttempt: number } {
  const n = odds.survival.length;
  let beat = 0;
  for (let s = 0; s < odds.simulations; s++) if (odds.cumulative[s * n + n - 1] < time) beat++;
  const ifFinished = beat / odds.simulations;
  return { ifFinished, perAttempt: ifFinished * odds.finishRate };
}

export interface ResetAdvice {
  verdict: ResetVerdict;
  /** Chance of beating the target from here. */
  chance: number;
  message: string;
}

/**
 * Whether to keep going or reset at `split` with `timeAtSplit` on the clock: keep going when playing
 * on beats the target at least as fast (per hour of play) as starting over does.
 */
export function resetAdvice(odds: PbOdds, split: number, timeAtSplit: Ms): ResetAdvice {
  const s = odds.splits[split];
  const chance = pbChanceFrom(odds, split, timeAtSplit);
  const freshRate = odds.perAttempt / odds.meanAttemptLength;
  const what = odds.targetIsPb ? "PB" : "beat your goal";
  const part = chance > 0 ? `${describeChance(chance)} of runs like this one still ${what}` : `no run like this one went on to ${what}`;
  if (chance > 0 && chance / s.meanRemaining >= freshRate) {
    return { verdict: "keep-going", chance, message: `Keep going: ${part}, better than starting over.` };
  }
  return { verdict: "reset", chance, message: `Reset: ${part}, and starting over gets you there sooner.` };
}

/**
 * Average length of the attempts that have start and end times, or null if none do. A timer left
 * running counts only for the time on its splits, by the same rule as hours played.
 */
function attemptLength(run: Run, attempts: Run["attempts"]): Ms | null {
  const limit = attemptLimit(run);
  const lengths = attempts.flatMap((a) => {
    const length = (parseLiveSplitDate(a.ended) ?? NaN) - (parseLiveSplitDate(a.started) ?? NaN);
    return length > 0 ? [playedMs(run, a, length, limit)] : [];
  });
  return lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null;
}

/** Expected attempt length from typical segment times and reset rates; a reset costs half its segment. */
function modelledAttemptLength(typical: Ms[], models: ReturnType<typeof buildSegmentModel>): Ms {
  let alive = 1;
  let length = 0;
  typical.forEach((t, i) => {
    const r = models[i].resetRate;
    length += alive * t * (1 - r / 2);
    alive *= 1 - r;
  });
  return Math.max(1, length);
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

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
