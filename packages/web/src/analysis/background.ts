import { useEffect, useState } from "react";
import { JOBS, type JobName, type Jobs } from "./jobs";

/**
 * Runs the analysis jobs (./jobs.ts) in web workers, so reading a big split file doesn't freeze the
 * window. Each lane is one worker doing one job at a time: the run page and the live page have their
 * own, so neither waits behind the other, and everything else (profile scores, Year in runs, finding
 * LiveSplit's file) shares the third. Where workers aren't available, the same jobs run on the page.
 */
export type Lane = "run" | "live" | "files";

type Input<J extends JobName> = Parameters<Jobs[J]>[0];
type Output<J extends JobName> = ReturnType<Jobs[J]>;

/** Why a job's promise rejects when a newer job on its lane made it pointless. */
export class Superseded extends Error {}

interface Pending {
  job: JobName;
  input: unknown;
  /** Jobs with a different source on the run and live lanes replace this one. */
  source: unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

interface LaneState {
  worker: Worker | null;
  pending: Map<number, Pending>;
}

const lanes = new Map<Lane, LaneState>();
let nextId = 1;
/** Set once a worker fails to start, after which jobs run on the page. */
let noWorkers = typeof Worker === "undefined";

function runHere(p: Pending) {
  // A turn later, so the page can show that it's working first.
  setTimeout(() => {
    try {
      p.resolve(JOBS[p.job](p.input as never));
    } catch (e) {
      p.reject(e);
    }
  });
}

function start(lane: Lane): LaneState {
  const state: LaneState = { worker: null, pending: new Map() };
  lanes.set(lane, state);
  if (noWorkers) return state;
  try {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: `speedrunner-${lane}` });
    worker.onmessage = (e: MessageEvent<{ id: number; value?: unknown; failed?: string }>) => {
      const p = state.pending.get(e.data.id);
      if (!p) return;
      state.pending.delete(e.data.id);
      if (e.data.failed != null) p.reject(new Error(e.data.failed));
      else p.resolve(e.data.value);
    };
    worker.onerror = (e) => {
      // The worker couldn't load (or crashed outside a job): do this and every later job on the page.
      e.preventDefault();
      noWorkers = true;
      worker.terminate();
      state.worker = null;
      for (const p of state.pending.values()) runHere(p);
      state.pending.clear();
    };
    state.worker = worker;
  } catch {
    noWorkers = true;
  }
  return state;
}

/**
 * Runs a job on a lane and resolves with its result. On the run and live lanes, a job for a different
 * `source` (the file and clock it reads) stops the ones still running, which reject with Superseded:
 * nobody is waiting for the file the runner just moved away from.
 */
export function inBackground<J extends JobName>(lane: Lane, job: J, input: Input<J>, source: unknown = input): Promise<Output<J>> {
  let state = lanes.get(lane) ?? start(lane);
  if (lane !== "files" && state.worker && [...state.pending.values()].some((p) => p.source !== source)) {
    state.worker.terminate();
    for (const p of state.pending.values()) p.reject(new Superseded());
    state = start(lane);
  }
  return new Promise<Output<J>>((resolve, reject) => {
    const p: Pending = { job, input, source, resolve: resolve as (v: unknown) => void, reject };
    if (!state.worker) return runHere(p);
    const id = nextId++;
    state.pending.set(id, p);
    state.worker.postMessage({ id, job, input });
  });
}

/** The newest finished result of a job and the input it was for; null until the first one is done. */
export interface Done<I, O> {
  input: I;
  value: O;
}

/**
 * Runs a job in the background whenever `input` changes (keep it memoised) and returns the newest
 * result, with the input it answers, so the page can tell a result for the current input from an
 * older one it may keep showing meanwhile. A null input clears it.
 */
export function useBackground<J extends JobName>(
  lane: Lane,
  job: J,
  input: Input<J> | null,
  source?: (input: Input<J>) => unknown,
): Done<Input<J>, Output<J>> | null {
  const [done, setDone] = useState<Done<Input<J>, Output<J>> | null>(null);
  useEffect(() => {
    if (input == null) return setDone(null);
    let live = true;
    inBackground(lane, job, input, source ? source(input) : input).then(
      (value) => {
        if (live) setDone({ input, value });
      },
      (e) => {
        if (!(e instanceof Superseded)) console.error(e);
      },
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lane, job, input]);
  return done;
}
