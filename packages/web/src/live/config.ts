import type { TimingMethod } from "@speedrunner/core";
import { putSplitFile, type StoredSplit } from "../splitFiles";
import { DEFAULT_LIVESPLIT_URL, type DemoSpeed } from "./feeds";
import { normalizeChoices, type StatChoice } from "./stats";
import { normalizeStyle, type CardStyle } from "./style";

/** The live page's settings, kept on this computer so the overlay window opens the same way. */
export interface LiveConfig {
  source: "livesplit" | "demo";
  url: string;
  speed: DemoSpeed;
  /** The clock to compare with when LiveSplit can't say which one it uses, and for the demo. */
  timing: TimingMethod;
  stats: StatChoice[];
  style: CardStyle;
  /** Whether the desktop app's overlay window stays above other windows, such as LiveSplit or a game. */
  onTop: boolean;
}

const KEY = "speedrunner.live.v1";
/** The split file the live page uses, kept with the profile's files so the overlay can read it. */
export const LIVE_RUN_KEY = "live:run";
/** Fired on this window when the settings change, so a card in the same window can follow. */
export const LIVE_CONFIG_EVENT = "speedrunner:live-config";

export function loadLiveConfig(): LiveConfig {
  let saved: Partial<LiveConfig> = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    // Unreadable or blocked: start from the defaults.
  }
  return {
    source: saved.source === "livesplit" ? "livesplit" : "demo",
    url: typeof saved.url === "string" && saved.url ? saved.url : DEFAULT_LIVESPLIT_URL,
    speed: saved.speed === "real" || saved.speed === "faster" ? saved.speed : "fast",
    timing: saved.timing === "GameTime" ? "GameTime" : "RealTime",
    stats: normalizeChoices(saved.stats),
    style: normalizeStyle(saved.style),
    onTop: saved.onTop !== false,
  };
}

export function saveLiveConfig(config: LiveConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    // Storage blocked: the settings still hold until the page is closed.
  }
  window.dispatchEvent(new CustomEvent(LIVE_CONFIG_EVENT));
}

const RUN_CHANGED_KEY = "speedrunner.live.run-changed";

/** Tells other windows (and this one) that the live split file changed, so the overlay reloads it. */
/** Makes a split file the live run, for this window and any overlay window. */
export function saveLiveRun(file: StoredSplit): Promise<void> {
  return putSplitFile(LIVE_RUN_KEY, file).then(notifyRunChanged);
}

export function notifyRunChanged(): void {
  try {
    localStorage.setItem(RUN_CHANGED_KEY, String(Date.now()));
  } catch {
    // Storage blocked: other windows pick the file up when they next open.
  }
  window.dispatchEvent(new CustomEvent(LIVE_CONFIG_EVENT));
}

/** True when a storage event from another window is about the live settings or split file. */
export const isLiveConfigKey = (key: string | null) => key === KEY || key === RUN_CHANGED_KEY;
