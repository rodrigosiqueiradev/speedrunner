import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeSwitch } from "../src/components/ThemeSwitch";
import { savedTheme, startTheme } from "../src/theme";

const root = document.documentElement;

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete root.dataset.theme;
});

describe("theme", () => {
  it("follows the system until a theme is picked", () => {
    expect(savedTheme()).toBe("system");
    render(<ThemeSwitch />);
    expect(screen.getByRole("button", { name: "System" }).getAttribute("aria-pressed")).toBe("true");
    expect(root.dataset.theme).toBeUndefined();
  });

  it("forces dark or light whatever the system says, and remembers it", () => {
    render(<ThemeSwitch />);
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(root.dataset.theme).toBe("dark");
    expect(savedTheme()).toBe("dark");
    expect(screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(root.dataset.theme).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "System" }));
    expect(root.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("speedrunner.theme")).toBeNull();
  });

  it("applies the saved theme at start, and a change from another window", () => {
    localStorage.setItem("speedrunner.theme", "dark");
    startTheme();
    expect(root.dataset.theme).toBe("dark");

    localStorage.setItem("speedrunner.theme", "light");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "speedrunner.theme" }));
    });
    expect(root.dataset.theme).toBe("light");
  });

  it("ignores an odd saved value", () => {
    localStorage.setItem("speedrunner.theme", "purple");
    expect(savedTheme()).toBe("system");
  });
});
