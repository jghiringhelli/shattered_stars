/**
 * shotPreference — specification tests: a ship shoots its squad's mark
 * when it is in reach, then its pilot's target, then the nearest.
 */

import { describe, expect, it } from "vitest";
import { pickShotTarget } from "../../../../src/scenes/battleUi/shotPreference";

describe("pickShotTarget", () => {
  it("shoots the marked target when it is in reach", () => {
    expect(pickShotTarget(["near", "marked"], ["marked", "near"])).toBe(
      "marked",
    );
  });

  it("falls back to the pilot's target when the mark is out of reach", () => {
    expect(pickShotTarget(["near", "pilot"], ["far_mark", "pilot"])).toBe(
      "pilot",
    );
  });

  it("shoots the nearest when no preference is in reach", () => {
    expect(pickShotTarget(["near", "other"], [null, "gone"])).toBe("near");
  });

  it("holds fire with nothing in reach", () => {
    expect(pickShotTarget([], ["marked"])).toBeNull();
  });
});
