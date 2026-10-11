import { useEffect, useRef, useState } from "react";
import { parseLss, type Run } from "@speedrunner/core";
import { loadSplitFiles, type StoredSplit } from "../splitFiles";
import { LIVE_RUN_KEY } from "./config";
import { fileNameOf, type FeedStatus } from "./feeds";

/** Whether the live split file matches the splits LiveSplit has open. */
export type SplitsSync =
  | { state: "unknown" }
  | { state: "matched"; name: string }
  | { state: "switched"; name: string }
  | { state: "missing"; name: string }
  /** The runner chose another file; the profile has LiveSplit's, but it isn't switched back. */
  | { state: "different"; name: string; file: StoredSplit };

// The LiveSplit file the runner chose to move away from, shared by the page and the overlay so
// neither switches back to it until LiveSplit opens something else.
const KEPT_KEY = "speedrunner.live.kept-choice";

function keptFor(): string | null {
  try {
    return localStorage.getItem(KEPT_KEY);
  } catch {
    return null;
  }
}

function setKeptFor(path: string | null): void {
  try {
    if (path) localStorage.setItem(KEPT_KEY, path);
    else localStorage.removeItem(KEPT_KEY);
  } catch {
    // Storage blocked: the choice holds until the page is closed.
  }
}

/** How the page recognises the splits LiveSplit has open, and which saved files are them. */
interface OpenSplits {
  key: string;
  /** The file name, when LiveSplit's server says which file it is. */
  name: string | null;
  matches: (file: StoredSplit) => boolean;
  /** Whether several saved files may match (by name, the first is used); otherwise only a single match switches. */
  firstWins: boolean;
}

const parsed = new Map<string, Run | null>();
function runOf(file: StoredSplit): Run | null {
  if (!parsed.has(file.xml)) {
    let run: Run | null = null;
    try {
      run = parseLss(file.xml);
    } catch {
      // Not a split file the page can read: it never matches.
    }
    parsed.set(file.xml, run);
  }
  return parsed.get(file.xml) ?? null;
}

/**
 * Newer LiveSplit says which file it has open. Released versions don't, so the page goes by the
 * split names LiveSplit reports during an attempt, and between attempts by its attempt and finished
 * counts as they were when the splits were loaded, which match a saved copy that's up to date.
 */
export function openSplitsOf(status: FeedStatus | null): OpenSplits | null {
  if (status?.kind !== "connected") return null;
  const { splitsPath, runSplitNames, loadedCounts } = status;
  if (splitsPath) {
    const name = fileNameOf(splitsPath);
    return { key: `path:${splitsPath}`, name, matches: (f) => f.fileName.toLowerCase() === name.toLowerCase(), firstWins: true };
  }
  if (runSplitNames.some((n) => n != null)) {
    return {
      key: `run:${JSON.stringify(runSplitNames)}`,
      name: null,
      matches: (f) => {
        const segments = runOf(f)?.segments;
        return !!segments && runSplitNames.every((n, i) => n == null || segments[i]?.rawName === n);
      },
      firstWins: false,
    };
  }
  if (loadedCounts) {
    return {
      key: `counts:${loadedCounts.attempts}/${loadedCounts.completed}`,
      name: null,
      matches: (f) => {
        const run = runOf(f);
        return (
          !!run && run.attemptCount === loadedCounts.attempts && run.attempts.filter((a) => a.time != null).length === loadedCounts.completed
        );
      },
      firstWins: false,
    };
  }
  return null;
}

// Split names grow during an attempt; a choice kept for its first splits holds for the rest of it.
const keeps = (kept: string | null, key: string) => kept === key || (!!kept && kept.startsWith("run:") && key.startsWith(kept.slice(0, -1)));

/**
 * Follows the splits LiveSplit has open. When they differ from the live page's file and a saved
 * profile file is them, switches to it; otherwise says which file to choose when LiveSplit names it.
 * Files are matched by name, since the page can't read files from disk by itself, or by split names
 * and counts where LiveSplit can't name the file. A file the runner picks by hand afterwards stays:
 * it's never switched back while LiveSplit has the same splits.
 */
export function useSplitsSync(
  status: FeedStatus | null,
  current: StoredSplit | null,
  onSwitch: (file: StoredSplit) => void,
): SplitsSync {
  const open = openSplitsOf(status);
  const key = open?.key ?? null;
  // Reconnecting (the feed does whenever the file changes) keeps what was said.
  const connected = status?.kind === "connected" || status?.kind === "connecting";
  const [sync, setSync] = useState<SplitsSync>({ state: "unknown" });
  // The last splits looked up, and the profile's file for them (null when the profile hasn't got
  // them). Both outlive reconnects: the feed reconnects whenever the file changes.
  const handled = useRef<string | null>(null);
  const found = useRef<StoredSplit | null>(null);
  const switchedFor = useRef<string | null>(null);
  const switchTo = useRef(onSwitch);
  switchTo.current = onSwitch;
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const open = openRef.current;
    if (!open || !key) {
      // Between attempts on released LiveSplit there may be nothing to go by: keep what was said.
      if (!connected) setSync({ state: "unknown" });
      return;
    }
    const label = (file: StoredSplit | null) => open.name ?? file?.fileName ?? null;
    if (current && open.matches(current)) {
      if (handled.current !== key) found.current = current;
      handled.current = key;
      setKeptFor(null);
      // A switch just made shows as switched until LiveSplit opens other splits.
      if (keeps(switchedFor.current, key)) {
        setSync({ state: "switched", name: label(current)! });
      } else if (open.name) setSync({ state: "matched", name: open.name });
      // Matched by split names or counts: keep saying it was switched, if it was.
      else setSync((s) => (s.state === "switched" ? s : { state: "unknown" }));
      return;
    }
    if (handled.current === key) {
      // The runner chose another file by hand: keep it, and say LiveSplit has a different one.
      if (found.current) setKeptFor(key);
      const name = label(found.current);
      setSync(found.current && name ? { state: "different", name, file: found.current } : open.name ? { state: "missing", name: open.name } : { state: "unknown" });
      return;
    }
    let live = true;
    void loadSplitFiles().then((files) => {
      if (!live) return;
      handled.current = key;
      const matches = Object.entries(files).filter(([k, f]) => k !== LIVE_RUN_KEY && open.matches(f));
      const match = matches.length === 1 || (open.firstWins && matches.length > 0) ? matches[0][1] : null;
      found.current = match;
      // Without a file name, no match only means the saved copies differ (say, older): say nothing new.
      if (!match) return open.name ? setSync({ state: "missing", name: open.name }) : undefined;
      if (keeps(keptFor(), key)) return setSync({ state: "different", name: label(match)!, file: match });
      setKeptFor(null);
      switchedFor.current = key;
      switchTo.current(match);
      setSync({ state: "switched", name: label(match)! });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, current, connected]);

  return sync;
}
