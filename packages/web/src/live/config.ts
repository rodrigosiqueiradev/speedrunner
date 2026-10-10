import { DEFAULT_LIVESPLIT_URL, type DemoSpeed } from "./feeds";
import { normalizeChoices, type StatChoice } from "./stats";

/** The live page's settings, kept on this computer so the overlay window opens the same way. */
export interface LiveConfig {
  source: "livesplit" | "demo";
  url: string;
  speed: DemoSpeed;
  stats: StatChoice[];
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
    stats: normalizeChoices(saved.stats),
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

/** True when a storage event from another window is about the live settings. */
export const isLiveConfigKey = (key: string | null) => key === KEY;
