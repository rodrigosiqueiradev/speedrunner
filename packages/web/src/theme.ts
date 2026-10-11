/** The colour theme: follow the system setting, or always light or dark. Saved per computer, in local storage. */
export type Theme = "system" | "light" | "dark";

const KEY = "speedrunner.theme";

export const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const isTheme = (value: unknown): value is Theme => value === "system" || value === "light" || value === "dark";

/** The saved theme; System when nothing (or something odd) is saved. */
export function savedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return isTheme(value) ? value : "system";
  } catch {
    return "system";
  }
}

/** Shows the page in the theme. styles.css picks its colours from data-theme, and from the system setting without it. */
export function applyTheme(theme: Theme): void {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function saveTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Without storage the choice lasts until the app closes.
  }
}

/** Applies the saved theme, and follows changes made in another window, such as the desktop overlay. */
export function startTheme(): void {
  applyTheme(savedTheme());
  window.addEventListener("storage", (e) => {
    if (e.key === KEY || e.key === null) applyTheme(savedTheme());
  });
}
