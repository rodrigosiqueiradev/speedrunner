/// <reference lib="webworker" />
import { JOBS, type JobName } from "./jobs";

/** Runs the jobs ./background.ts sends, one at a time, and posts each result back. */
self.onmessage = (e: MessageEvent<{ id: number; job: JobName; input: never }>) => {
  const { id, job, input } = e.data;
  try {
    self.postMessage({ id, value: JOBS[job](input) });
  } catch (err) {
    self.postMessage({ id, failed: err instanceof Error ? err.message : String(err) });
  }
};
