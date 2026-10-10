import { useEffect, useRef, useState } from "react";
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

/**
 * Follows the splits file LiveSplit has open. When it differs from the live page's file and a file
 * with that name is saved in the profile, switches to it; otherwise says which file to choose.
 * Files are matched by name, since the page can't read files from disk by itself. A file the
 * runner picks by hand afterwards stays: it's never switched back while LiveSplit has the same file.
 */
export function useSplitsSync(
  status: FeedStatus | null,
  current: StoredSplit | null,
  onSwitch: (file: StoredSplit) => void,
): SplitsSync {
  const path = status?.kind === "connected" ? status.splitsPath : null;
  const [sync, setSync] = useState<SplitsSync>({ state: "unknown" });
  // The last path looked up, and the profile's file for it (null when the profile hasn't got it).
  // Both outlive reconnects: the feed reconnects whenever the file changes.
  const handled = useRef<string | null>(null);
  const found = useRef<StoredSplit | null>(null);
  const switchedFor = useRef<string | null>(null);
  const switchTo = useRef(onSwitch);
  switchTo.current = onSwitch;

  useEffect(() => {
    if (!path) {
      setSync({ state: "unknown" });
      return;
    }
    const name = fileNameOf(path);
    const same = (f: StoredSplit) => f.fileName.toLowerCase() === name.toLowerCase();
    if (current && same(current)) {
      if (handled.current !== path) found.current = current;
      handled.current = path;
      setKeptFor(null);
      // A switch just made shows as switched until LiveSplit opens another file.
      setSync({ state: switchedFor.current === path ? "switched" : "matched", name });
      return;
    }
    if (handled.current === path) {
      // The runner chose another file by hand: keep it, and say LiveSplit has a different one.
      if (found.current) setKeptFor(path);
      setSync(found.current ? { state: "different", name, file: found.current } : { state: "missing", name });
      return;
    }
    let live = true;
    void loadSplitFiles().then((files) => {
      if (!live) return;
      handled.current = path;
      const match = Object.entries(files).find(([key, f]) => key !== LIVE_RUN_KEY && same(f))?.[1] ?? null;
      found.current = match;
      if (!match) return setSync({ state: "missing", name });
      if (keptFor() === path) return setSync({ state: "different", name, file: match });
      setKeptFor(null);
      switchedFor.current = path;
      switchTo.current(match);
      setSync({ state: "switched", name });
    });
    return () => {
      live = false;
    };
  }, [path, current]);

  return sync;
}
