import type { CategoryScore, Ms } from "@speedrunner/core";

/** One game and category in the runner's profile, kept in local storage. */
export interface ProfileEntry {
  key: string;
  fileName: string;
  addedAt: string;
  score: CategoryScore;
  /** A reference time the runner typed in. It takes priority over one saved in the split file. */
  typedReference: Ms | null;
}

/** Bump when the score's shape or formulas change, so old saved scores aren't shown as current. */
const STORAGE_KEY = "speedrunner.profile.v2";

export function categoryKey(s: Pick<CategoryScore, "game" | "category">): string {
  return `${s.game.trim().toLowerCase()}|${s.category.trim().toLowerCase()}`;
}

export function loadProfile(): ProfileEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProfile(entries: ProfileEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage can be full or blocked; the profile still works for this session.
  }
}

/** Adds a scored file, replacing an earlier file for the same game and category but keeping its typed reference. */
export function upsertEntry(entries: ProfileEntry[], score: CategoryScore, fileName: string): ProfileEntry[] {
  const key = categoryKey(score);
  const previous = entries.find((e) => e.key === key);
  const entry: ProfileEntry = {
    key,
    fileName,
    addedAt: new Date().toISOString(),
    score,
    typedReference: previous?.typedReference ?? null,
  };
  return previous ? entries.map((e) => (e.key === key ? entry : e)) : [...entries, entry];
}

/** The reference time to use: typed in first, then a WR comparison from the file. */
export function referenceOf(e: ProfileEntry): { time: Ms; source: "typed" | "file"; name?: string } | null {
  if (e.typedReference != null) return { time: e.typedReference, source: "typed" };
  const f = e.score.fileReference;
  return f ? { time: f.time, source: "file", name: f.name } : null;
}
