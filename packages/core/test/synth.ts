import type { Run } from "../src/index.js";

/** Builds a synthetic run: each attempt plays segments with the given base times plus noise. */
export function synthRun(opts: {
  base: number[];
  noise: (segment: number, attempt: number) => number;
  resetAt?: (attempt: number) => number | undefined;
  attempts: number;
}): Run {
  const { base, noise, resetAt, attempts } = opts;
  const finals = new Map<number, number>();
  const segments = base.map((_, i) => ({
    name: `S${i + 1}`,
    rawName: `S${i + 1}`,
    pbSplit: null as number | null,
    gold: null,
    history: new Map<number, number | null>(),
  }));
  let pb: number[] | null = null;
  for (let id = 1; id <= attempts; id++) {
    const stop = resetAt?.(id) ?? base.length;
    const times: number[] = [];
    for (let i = 0; i < stop; i++) {
      const t = base[i] + noise(i, id);
      segments[i].history.set(id, t);
      times.push(t);
    }
    if (stop === base.length) {
      const total = times.reduce((x, y) => x + y, 0);
      finals.set(id, total);
      if (!pb || total < pb.reduce((x, y) => x + y, 0)) pb = times;
    }
  }
  let acc = 0;
  pb!.forEach((t, i) => (segments[i].pbSplit = acc += t));
  return {
    game: "Synth",
    category: "Any%",
    timingMethod: "RealTime",
    attemptCount: attempts,
    attempts: Array.from({ length: attempts }, (_, i) => ({ id: i + 1, time: finals.get(i + 1) ?? null })),
    segments,
    comparisons: [],
  };
}
