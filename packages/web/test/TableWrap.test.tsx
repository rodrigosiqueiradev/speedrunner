import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TableWrap } from "../src/components/Layout";

// Vitest swaps CSS imports for empty strings, so read the stylesheet itself.
const css = readFileSync(join(__dirname, "../src/styles.css"), "utf8");

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`^${escaped} \\{([^}]*)\\}`, "m"))?.[1] ?? "";
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("sticky table headers", () => {
  // A table header can only stick to the window when no box between it and the page scrolls.
  it("keeps the table box from scrolling unless the table doesn't fit", () => {
    expect(rule(".table-wrap")).toMatch(/overflow-x:\s*clip/);
    expect(rule(".table-wrap")).not.toMatch(/overflow(-y)?:\s*(auto|scroll)/);
    expect(rule(".table-wrap")).not.toMatch(/max-height/);
    expect(rule(".table-wrap.overflowing")).toMatch(/overflow-x:\s*auto/);
    expect(rule("thead th")).toMatch(/position:\s*sticky/);
    expect(rule("thead th")).toMatch(/top:\s*var\(--sticky-top\)/);
  });

  it("scrolls sideways only when the table is wider than its box", () => {
    let report = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          report = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const { container } = render(
      <TableWrap>
        <table />
      </TableWrap>,
    );
    const wrap = container.querySelector<HTMLElement>(".table-wrap")!;
    const table = container.querySelector("table")!;
    Object.defineProperty(wrap, "clientWidth", { configurable: true, value: 800 });

    Object.defineProperty(table, "offsetWidth", { configurable: true, value: 780 });
    act(() => report());
    expect(wrap.classList.contains("overflowing")).toBe(false);

    Object.defineProperty(table, "offsetWidth", { configurable: true, value: 900 });
    act(() => report());
    expect(wrap.classList.contains("overflowing")).toBe(true);
  });
});
