import type { SegmentStats } from "@speedrunner/core";
import { describe, expect, it } from "vitest";
import { displayName, routeSections } from "../src/components/RouteStrip";

const seg = (index: number, name: string, pbTime: number) => ({ index, name, pbTime }) as SegmentStats;

describe("displayName", () => {
  it("drops LiveSplit's subsplit markers", () => {
    expect(displayName("-Forest gate")).toBe("Forest gate");
    expect(displayName("{Forest} Boss")).toBe("Boss");
    expect(displayName("Troubled Waters")).toBe("Troubled Waters");
  });
});

describe("routeSections", () => {
  it("returns nothing for runs without subsplits", () => {
    expect(routeSections([seg(0, "A", 10), seg(1, "B", 20)])).toBeNull();
  });

  it("groups subsplits into their sections, keeping plain splits on their own", () => {
    const sections = routeSections([
      seg(0, "Intro", 5),
      seg(1, "-Gate", 10),
      seg(2, "{Forest}Boss", 20),
      seg(3, "-Hall", 7),
      seg(4, "{Castle}King", 8),
    ]);
    expect(sections).toEqual([
      { name: "Intro", start: 0, time: 5 },
      { name: "Forest", start: 1, time: 30 },
      { name: "Castle", start: 3, time: 15 },
    ]);
  });
});
