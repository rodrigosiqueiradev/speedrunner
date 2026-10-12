import {
  IDLE_SNAPSHOT,
  parseClock,
  replayAttempt,
  replayLength,
  replaySnapshot,
  replayableAttempts,
  type LiveContext,
  type Replay,
  type TimerPhase,
  type TimerSnapshot,
  type TimingMethod,
} from "@speedrunner/core";

/** Where a live feed is: shown under the stats so the runner knows why nothing moves. */
export type FeedStatus =
  | { kind: "connecting" }
  | {
      kind: "connected";
      mismatch: string | null;
      /** The splits file LiveSplit has open, when its server can say (newer LiveSplit versions). */
      splitsPath: string | null;
      /**
       * LiveSplit's attempt and finished counts as they were when its splits were loaded: read
       * between attempts, and only updated when they change with no attempt in between, which is
       * what opening other splits does. Released LiveSplit can't say which file is open, so these
       * and the split names below are how the page spots a switch there.
       */
      loadedCounts: { attempts: number; completed: number } | null;
      /** The split names LiveSplit reported during this attempt, by split index. Empty between attempts. */
      runSplitNames: (string | undefined)[];
      /** The clock LiveSplit compares against, when its server can say (newer LiveSplit versions). */
      timingMethod: TimingMethod | null;
    }
  /** `retry`: whether the feed is still trying, or has given up because the address can't work. */
  | { kind: "offline"; reason: string; retry: boolean }
  | { kind: "demo"; attempt: number };

export interface LiveFeed {
  stop(): void;
}

type Listener = (snap: TimerSnapshot, status: FeedStatus) => void;

/** LiveSplit's server listens on this port by default, and serves WebSocket clients at /livesplit. */
export const DEFAULT_LIVESPLIT_URL = "ws://localhost:16834/livesplit";

/** The names a computer has for itself. Any port on them is fine: LiveSplit's is a setting. */
const THIS_COMPUTER = ["localhost", "127.0.0.1"];

/**
 * Why an address can't be read from, or null when it can. Live stats only ever reads a LiveSplit on
 * the same computer, and both builds are held to that by their content security policy, which lists
 * these two hosts and nothing else. Saying so plainly beats a connection the engine refuses in
 * silence.
 */
export function addressProblem(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `"${url}" isn't an address. LiveSplit's is ${DEFAULT_LIVESPLIT_URL} unless you changed the port.`;
  }
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:")
    return `That address isn't a WebSocket address (it starts with ws://). LiveSplit's is ${DEFAULT_LIVESPLIT_URL} unless you changed the port.`;
  if (!THIS_COMPUTER.includes(parsed.hostname))
    return `Live stats only reads LiveSplit on this computer, so the address has to be localhost or 127.0.0.1, as in ${DEFAULT_LIVESPLIT_URL}.`;
  return null;
}

const POLL_MS = 250;
const ANSWER_TIMEOUT_MS = 3000;
const RETRY_MS = 3000;
/** How often to ask which splits file and timing method LiveSplit has, while the timer isn't running. */
const SPLITS_PATH_MS = 5000;
/** Older servers don't know getsplitspath or gettimingmethod and never answer them; give up on them after this long. */
const OPTIONAL_TIMEOUT_MS = 1500;
const PHASES: TimerPhase[] = ["NotRunning", "Running", "Paused", "Ended"];

/**
 * Reads LiveSplit's timer through its built-in server (Control › Start WebSocket Server). The
 * server only answers commands, so this asks for the timer phase, split index and time a few times
 * a second, and the time of each new split as it happens. It only reads: it never starts, splits
 * or resets the timer.
 */
export function connectLiveSplit(url: string, segmentNames: string[], onUpdate: Listener): LiveFeed {
  const problem = addressProblem(url);
  if (problem) {
    // Nothing to retry: the same address would be refused again.
    onUpdate(IDLE_SNAPSHOT, { kind: "offline", reason: problem, retry: false });
    return { stop: () => {} };
  }
  let stopped = false;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let snap: TimerSnapshot = IDLE_SNAPSHOT;
  let mismatch: string | null = null;
  let splitsPath: string | null = null;
  // null: not asked yet on this connection; false: the server doesn't know the command.
  let pathSupported: boolean | null = null;
  let pathAskedAt = 0;
  let timingMethod: TimingMethod | null = null;
  let methodSupported: boolean | null = null;
  let loadedCounts: { attempts: number; completed: number } | null = null;
  let lastCounts: { attempts: number; completed: number } | null = null;
  let countsSupported: boolean | null = null;
  // Whether an attempt ran since the counts were last read, so a change in them came from it.
  let ranSinceCounts = false;
  let runSplitNames: (string | undefined)[] = [];

  const open = () => {
    if (stopped) return;
    onUpdate(snap, { kind: "connecting" });
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      onUpdate(snap, {
        kind: "offline",
        reason: "The browser wouldn't open that address. Check it against LiveSplit's Settings.",
        retry: false,
      });
      return;
    }
    socket = ws;
    // The server answers in the order it was asked, so answers match the oldest waiting question.
    const waiting: Array<(answer: string) => void> = [];
    ws.onmessage = (e) => waiting.shift()?.(String(e.data));
    // Waits for the next answer; with a command, asks it first.
    const ask = (command?: string) =>
      new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), ANSWER_TIMEOUT_MS);
        waiting.push((answer) => {
          clearTimeout(timer);
          resolve(answer.trim());
        });
        if (command) ws.send(command);
      });
    // For a command older servers may not know: they send nothing back, so stop waiting for it
    // after a short while and take it off the queue, keeping later answers matched up.
    const askOptional = (command: string) =>
      new Promise<string | null>((resolve) => {
        const answer = (text: string) => {
          clearTimeout(timer);
          resolve(text.trim());
        };
        const timer = setTimeout(() => {
          const i = waiting.indexOf(answer);
          if (i >= 0) waiting.splice(i, 1);
          resolve(null);
        }, OPTIONAL_TIMEOUT_MS);
        waiting.push(answer);
        ws.send(command);
      });

    pathSupported = null;
    methodSupported = null;
    countsSupported = null;
    loadedCounts = null;
    lastCounts = null;
    const poll = async () => {
      while (!stopped && ws.readyState === WebSocket.OPEN) {
        // Between attempts, check which splits LiveSplit has open and which clock it compares
        // against, so the page can follow a switch of either.
        const idle = snap.phase === "NotRunning" || snap.phase === "Ended";
        const recheck = idle && Date.now() - pathAskedAt > SPLITS_PATH_MS;
        if (pathSupported === null || methodSupported === null || (pathSupported === false && countsSupported === null) || recheck) {
          pathAskedAt = Date.now();
        }
        if (pathSupported !== false && (pathSupported === null || recheck)) {
          const path = await askOptional("getsplitspath");
          pathSupported = path != null;
          if (path != null) splitsPath = path && path !== "-" ? path : null;
        }
        if (methodSupported !== false && (methodSupported === null || recheck)) {
          const method = await askOptional("gettimingmethod");
          methodSupported = method != null;
          timingMethod = method === "GameTime" || method === "RealTime" ? method : null;
        }
        // Only needed where the server can't name the file.
        if (pathSupported === false && countsSupported !== false && (countsSupported === null || recheck)) {
          const attempts = await askOptional("getattemptcount");
          const completed = attempts == null ? null : await askOptional("getcompletedcount");
          countsSupported = attempts != null && completed != null;
          const counts = countsSupported ? { attempts: Number(attempts), completed: Number(completed) } : null;
          if (counts && Number.isFinite(counts.attempts) && Number.isFinite(counts.completed)) {
            const changed = counts.attempts !== lastCounts?.attempts || counts.completed !== lastCounts?.completed;
            // The first reading, or a change no attempt explains: LiveSplit loaded these splits.
            if (!lastCounts || (changed && !ranSinceCounts)) loadedCounts = counts;
            lastCounts = counts;
          }
          ranSinceCounts = !idle;
        }
        let phaseText = await ask("getcurrenttimerphase");
        // An optional question the server answered after we stopped waiting leaves its answer in
        // front of this one. Take it as that late answer and read the next one as the phase, so
        // later answers stay matched up; if that isn't a phase either, start the connection over.
        if (!PHASES.some((p) => p === phaseText)) {
          phaseText = await ask();
          if (!PHASES.some((p) => p === phaseText)) throw new Error("answers out of step");
        }
        const phase = PHASES.find((p) => p === phaseText)!;
        const index = phase === "NotRunning" ? -1 : Number.parseInt(await ask("getsplitindex"), 10);
        const currentTime = parseClock(await ask("getcurrenttime"));
        let splitTimes = phase === "NotRunning" ? [] : snap.splitTimes.slice(0, Math.max(0, index));
        if (index > snap.splitTimes.length && index > 0 && phase !== "NotRunning") {
          // A new split (or several, if the feed missed some): only the latest one's time is known.
          splitTimes = [...splitTimes, ...new Array<null>(index - splitTimes.length).fill(null)];
          splitTimes[index - 1] = parseClock(await ask("getlastsplittime"));
        }
        if (phase !== "NotRunning") ranSinceCounts = true;
        else runSplitNames = [];
        if (index !== snap.splitIndex && index >= 0 && phase !== "Ended") {
          const name = await ask("getcurrentsplitname");
          if (name && name !== "-") {
            runSplitNames = [...runSplitNames];
            runSplitNames[index] = name;
          }
          mismatch =
            !name || name === "-"
              ? null
              : index >= segmentNames.length
                ? `LiveSplit is on split ${index + 1}, "${name}", but this split file has ${segmentNames.length} splits. Load the same splits in both.`
                : name !== segmentNames[index]
                  ? `LiveSplit is on "${name}" but this split file's split ${index + 1} is "${segmentNames[index]}". Load the same splits in both.`
                  : null;
        }
        snap = { phase, splitIndex: Number.isFinite(index) ? index : -1, currentTime, splitTimes };
        onUpdate(snap, { kind: "connected", mismatch, splitsPath, timingMethod, loadedCounts, runSplitNames });
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    };

    ws.onopen = () => {
      poll().catch(() => {
        onUpdate(snap, { kind: "offline", reason: "LiveSplit stopped answering.", retry: true });
        ws.close();
      });
    };
    ws.onclose = () => {
      if (stopped) return;
      onUpdate(snap, {
        kind: "offline",
        reason: "LiveSplit isn't answering. In LiveSplit, right-click › Control › Start WebSocket Server, and check the port in Settings.",
        retry: true,
      });
      retry = setTimeout(open, RETRY_MS);
    };
  };

  open();
  return {
    stop() {
      stopped = true;
      clearTimeout(retry);
      socket?.close();
    },
  };
}

export type DemoSpeed = "real" | "fast" | "faster";

/** Demo speeds as how long a whole run takes on screen, so a 6 hour category demos as fast as a 10 minute one. */
export const DEMO_SPEEDS: Record<DemoSpeed, { label: string; runMs: number | null }> = {
  real: { label: "Real time", runMs: null },
  fast: { label: "2 min per run", runMs: 120_000 },
  faster: { label: "30 s per run", runMs: 30_000 },
};

const PAUSE_AFTER_END_MS = 4000;
const PAUSE_AFTER_RESET_MS = 1500;

/**
 * A pretend LiveSplit that replays your own recent attempts from the split file, finishes and
 * resets included, so the stats can be tried without LiveSplit running.
 */
export function startDemo(ctx: LiveContext, speed: DemoSpeed, onUpdate: Listener): LiveFeed {
  const ids = replayableAttempts(ctx.run);
  const runMs = DEMO_SPEEDS[speed].runMs;
  const pb = ctx.personalBest ?? ctx.typicalFrom[0] ?? 0;
  const rate = runMs == null || pb <= 0 ? 1 : Math.max(1, pb / runMs);
  let replay: Replay | null = null;
  let started = 0;
  let pick = Math.floor(Math.random() * ids.length);

  const next = () => {
    if (!ids.length) return;
    pick = (pick + 1 + Math.floor(Math.random() * Math.min(3, ids.length))) % ids.length;
    replay = replayAttempt(ctx.run, ids[pick], ctx);
    started = performance.now();
  };
  next();

  const tick = () => {
    if (!replay) return onUpdate(IDLE_SNAPSHOT, { kind: "demo", attempt: 0 });
    const elapsed = (performance.now() - started) * rate;
    const length = replayLength(replay);
    const done = elapsed >= length;
    const hold = replay.resetAt == null ? PAUSE_AFTER_END_MS : PAUSE_AFTER_RESET_MS;
    if (done && performance.now() - started - length / rate > hold) next();
    onUpdate(replaySnapshot(replay, Math.min(elapsed, length)), { kind: "demo", attempt: replay.attemptId });
  };
  const timer = setInterval(tick, 100);
  tick();
  return { stop: () => clearInterval(timer) };
}

/** The file name at the end of a Windows or Unix path. */
export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
