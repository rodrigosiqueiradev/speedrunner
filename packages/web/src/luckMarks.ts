import { luckKey } from "@speedrunner/core";
import { useEffect, useState } from "react";

/**
 * Segments the runner marked as luck-based, per category (the profile's categoryKey), by segment
 * name so adding or reordering splits keeps them. Kept in the app rather than the split file,
 * because LiveSplit rewrites the file on every save.
 */
export type LuckMarks = Record<string, string[]>;

const KEY = "speedrunner.luck.v1";

export function loadLuckMarks(): LuckMarks {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: LuckMarks = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
    }
    return out;
  } catch {
    return {};
  }
}

export function saveLuckMarks(marks: LuckMarks): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(marks));
  } catch {
    // Storage can be full or blocked; the marks still apply until the app is closed.
  }
}

/** Marks or unmarks one segment of a category, returning the new marks. */
export function toggleLuck(marks: LuckMarks, category: string, segmentName: string, on: boolean): LuckMarks {
  const key = luckKey(segmentName);
  const rest = (marks[category] ?? []).filter((n) => luckKey(n) !== key);
  const names = on ? [...rest, segmentName.trim()] : rest;
  const { [category]: _old, ...others } = marks;
  return names.length ? { ...others, [category]: names } : others;
}

/** The saved marks, kept in step with other windows (the overlay follows the main window). */
export function useLuckMarks(): LuckMarks {
  const [marks, setMarks] = useState<LuckMarks>(loadLuckMarks);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key == null) setMarks(loadLuckMarks());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return marks;
}
