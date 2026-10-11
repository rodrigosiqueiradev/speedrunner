import { useEffect, useState } from "react";

/**
 * The goal time the runner picked for each category (the profile's categoryKey), shared by the goal
 * planner and the live card's "vs goal", so setting it in one place sets it in the other.
 */
export type Goals = Record<string, number>;

const KEY = "speedrunner.goals.v1";
/** Fired on this window when a goal changes, since storage events only reach other windows. */
const EVENT = "speedrunner:goals";

export function loadGoals(): Goals {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Goals = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Saves one category's goal; null forgets it, so the suggested goal applies again. */
export function saveGoal(category: string, goal: number | null): void {
  const { [category]: _old, ...others } = loadGoals();
  const next = goal == null ? others : { ...others, [category]: goal };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be full or blocked; the goal still holds on this page until it's closed.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** The saved goals, kept in step with this window and others (the overlay follows the main window). */
export function useGoals(): Goals {
  const [goals, setGoals] = useState<Goals>(loadGoals);
  useEffect(() => {
    const reload = () => setGoals(loadGoals());
    const onStorage = (e: StorageEvent) => (e.key === KEY || e.key == null) && reload();
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, reload);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT, reload);
    };
  }, []);
  return goals;
}
