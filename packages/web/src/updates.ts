/** Where new versions of the desktop app are published, and how the app finds out about them. */
const RELEASES = "rodrigosiqueiradev/speedrunner-releases";
const LATEST_API = `https://api.github.com/repos/${RELEASES}/releases/latest`;
/** Only pages under this address may be opened from the app (see the desktop app's capabilities). */
export const RELEASES_PAGE = `https://github.com/${RELEASES}/releases`;

const CHECK_KEY = "speedrunner.updates.check";
const DISMISSED_KEY = "speedrunner.updates.dismissed";

export interface Update {
  /** The newer version, without a leading "v", such as "0.3.0". */
  version: string;
  /** Its release page, where the downloads are. */
  url: string;
}

/** "v1.2.3" or "1.2.3" as numbers; null for anything else, such as a pre-release. */
export function parseVersion(text: string): number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
  return match ? match.slice(1).map(Number) : null;
}

/** True when `latest` is a later version than `current`. */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  const i = a.findIndex((n, k) => n !== b[k]);
  return i >= 0 && a[i] > b[i];
}

/**
 * Asks the releases repo for its latest release, and returns it when it's newer than `current`.
 * This is the app's only request to the internet: it sends nothing about the user or their splits.
 * Any failure (offline, rate limited, an odd answer) counts as no update.
 */
export async function findUpdate(current: string, fetcher: typeof fetch = fetch): Promise<Update | null> {
  try {
    const response = await fetcher(LATEST_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) return null;
    const release = (await response.json()) as { tag_name?: unknown; html_url?: unknown };
    const tag = typeof release.tag_name === "string" ? release.tag_name : "";
    const url = typeof release.html_url === "string" && release.html_url.startsWith(`${RELEASES_PAGE}/`) ? release.html_url : RELEASES_PAGE;
    return isNewer(tag, current) ? { version: tag.replace(/^v/, ""), url } : null;
  } catch {
    return null;
  }
}

/** Whether the app checks for new versions when it starts. On unless the user turned it off. */
export function checksForUpdates(): boolean {
  try {
    return localStorage.getItem(CHECK_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setChecksForUpdates(on: boolean): void {
  try {
    if (on) localStorage.removeItem(CHECK_KEY);
    else localStorage.setItem(CHECK_KEY, "off");
  } catch {
    // Without storage the choice lasts until the app closes.
  }
}

/** The version whose banner the user closed, so it isn't shown again; a later one still is. */
export function dismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

export function dismissVersion(version: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, version);
  } catch {
    // Without storage the banner comes back next time the app starts.
  }
}
