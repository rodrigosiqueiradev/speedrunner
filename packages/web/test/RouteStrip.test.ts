import { describe, expect, it } from "vitest";
import { saveLevel } from "../src/components/RouteStrip";

describe("saveLevel", () => {
  it("uses step 0 only when there is nothing to save", () => {
    expect(saveLevel(0, 8000)).toBe(0);
    expect(saveLevel(500, 0)).toBe(0);
  });

  it("splits saves into quarters of the biggest one", () => {
    expect(saveLevel(200, 8000)).toBe(1);
    expect(saveLevel(2200, 8000)).toBe(2);
    expect(saveLevel(4500, 8000)).toBe(3);
    expect(saveLevel(7000, 8000)).toBe(4);
    expect(saveLevel(8000, 8000)).toBe(4);
  });
});
