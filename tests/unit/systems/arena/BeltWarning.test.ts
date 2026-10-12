/**
 * BeltWarning — when the belt warning sounds its audio cue.
 */

import { describe, it, expect } from "vitest";
import {
  BELT_CUE_REPEAT_MS,
  BELT_PULSE_MIN_ALPHA,
  BELT_PULSE_PERIOD_MS,
  beltCue,
  beltPulseAlpha,
  beltWarningText,
  INITIAL_BELT_CUE,
} from "../../../../src/systems/arena/BeltWarning";

describe("beltCue", () => {
  it("stays silent while clear", () => {
    expect(beltCue(INITIAL_BELT_CUE, "clear", 0).play).toBe(false);
  });

  it("sounds once on approaching the belt", () => {
    const first = beltCue(INITIAL_BELT_CUE, "near", 100);
    expect(first.play).toBe(true);
    expect(
      beltCue(first.state, "near", 100 + 10 * BELT_CUE_REPEAT_MS).play,
    ).toBe(false);
  });

  it("sounds on entering the belt, even straight after the approach cue", () => {
    const near = beltCue(INITIAL_BELT_CUE, "near", 0).state;
    expect(beltCue(near, "inside", 50).play).toBe(true);
  });

  it("repeats while the ship stays inside the belt", () => {
    const entered = beltCue(INITIAL_BELT_CUE, "inside", 0).state;
    expect(beltCue(entered, "inside", BELT_CUE_REPEAT_MS - 1).play).toBe(false);
    const again = beltCue(entered, "inside", BELT_CUE_REPEAT_MS);
    expect(again.play).toBe(true);
    expect(beltCue(again.state, "inside", BELT_CUE_REPEAT_MS + 1).play).toBe(
      false,
    );
  });

  it("sounds again on a fresh approach after getting clear", () => {
    const near = beltCue(INITIAL_BELT_CUE, "near", 0).state;
    const clear = beltCue(near, "clear", 100).state;
    expect(beltCue(clear, "near", 200).play).toBe(true);
  });

  it("does not sound when retreating from inside back to near", () => {
    const inside = beltCue(INITIAL_BELT_CUE, "inside", 0).state;
    expect(beltCue(inside, "near", 100).play).toBe(false);
  });
});

describe("beltPulseAlpha", () => {
  it("is invisible while clear", () => {
    expect(beltPulseAlpha("clear", 123)).toBe(0);
  });

  it("pulses between a visible floor and full opacity", () => {
    for (const level of ["near", "inside"] as const) {
      const samples = Array.from({ length: 200 }, (_, i) =>
        beltPulseAlpha(level, i * 10),
      );
      expect(Math.min(...samples)).toBeGreaterThanOrEqual(BELT_PULSE_MIN_ALPHA);
      expect(Math.max(...samples)).toBeCloseTo(1, 1);
      expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.3);
    }
  });

  it("pulses faster inside the belt than on approach", () => {
    expect(BELT_PULSE_PERIOD_MS.inside).toBeLessThan(BELT_PULSE_PERIOD_MS.near);
  });
});

describe("beltWarningText", () => {
  it("tells the pilot what to do, not just a colour", () => {
    expect(beltWarningText("inside")).toMatch(/ASTEROID BELT/);
    expect(beltWarningText("inside")).toMatch(/TURN BACK/);
    expect(beltWarningText("near")).toMatch(/BELT/);
    expect(beltWarningText("clear")).toBe("");
  });
});
