import { describe, it, expect } from "vitest";
import { maneuverLerpAlpha } from "../../../src/rendering/ManeuverInterpolation";

describe("maneuverLerpAlpha", () => {
  it("never exceeds 1 even on a slow/dropped frame", () => {
    // 200ms is a plausible GC pause / alt-tab stall, not an edge case.
    expect(maneuverLerpAlpha(200, 280, 3)).toBeLessThanOrEqual(1);
    expect(maneuverLerpAlpha(1000, 280, 3)).toBeLessThanOrEqual(1);
  });

  it("reaches exactly 1 once enough time has elapsed to finish the maneuver", () => {
    expect(maneuverLerpAlpha(280 / 3, 280, 3)).toBeCloseTo(1, 5);
  });

  it("scales linearly with delta below the saturation point", () => {
    const half = maneuverLerpAlpha(280 / 6, 280, 3);
    expect(half).toBeCloseTo(0.5, 5);
  });

  it("returns 0 for a zero-length frame", () => {
    expect(maneuverLerpAlpha(0, 280, 3)).toBe(0);
  });
});
