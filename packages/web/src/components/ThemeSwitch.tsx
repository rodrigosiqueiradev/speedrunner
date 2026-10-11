import { useEffect, useState } from "react";
import { savedTheme, saveTheme, THEME_OPTIONS, type Theme } from "../theme";
import { Toggle } from "./Controls";

/** The footer's choice of colour theme: System, Light or Dark. */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(savedTheme);
  useEffect(() => {
    const onStorage = () => setTheme(savedTheme());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return (
    <span className="theme-switch">
      <span id="theme-label">Theme</span>
      <Toggle
        small
        labelledBy="theme-label"
        options={THEME_OPTIONS}
        value={theme}
        onChange={(next) => {
          saveTheme(next);
          setTheme(next);
        }}
      />
    </span>
  );
}
