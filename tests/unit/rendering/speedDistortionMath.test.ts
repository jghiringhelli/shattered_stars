import { describe, expect, it } from "vitest";
import {
  BOW_ARC_COUNT,
  FADE_MS,
  FULL_INTENSITY_NOTCH,
  MIN_NOTCH_INTENSITY,
  bowArcsAt,
  createBowArcs,
  smoothSpeedDistortion,
  speedDistortionTarget,
  type SpeedDistortionSource,
} from "../../../src/rendering/speedDistortion/speedDistortionMath";

function control(
  patch: Partial<SpeedDistortionSource> = {},
): SpeedDistortionSource {
  return {
    cycleSpeed: 4,
    speedCap: 4,
    maxSpeed: 5,
    movementProfile: "fighter",
    ...patch,
  };
}

describe("speedDistortionTarget", () => {
  it("is 0 below the maneuver's dial cap", () => {
    expect(speedDistortionTarget(control({ cycleSpeed: 2 }))).toBe(0);
  });

  it("is on when a bank is flown at its own cap", () => {
    expect(
      speedDistortionTarget(control({ cycleSpeed: 3, speedCap: 3 })),
    ).toBeGreaterThan(0);
  });

  it("is on when a straight is flown above the dial's top (upgrade notch)", () => {
    expect(
      speedDistortionTarget(control({ cycleSpeed: 5, speedCap: 4 })),
    ).toBeGreaterThan(0);
  });

  it("falls back to the ship's top notch when no cap applies", () => {
    const uncapped = { speedCap: null, maxSpeed: 5 } as const;
    expect(speedDistortionTarget(control({ ...uncapped, cycleSpeed: 4 }))).toBe(
      0,
    );
    expect(
      speedDistortionTarget(control({ ...uncapped, cycleSpeed: 5 })),
    ).toBeGreaterThan(0);
  });

  it("grows with the speed notch", () => {
    const at = (speed: number) =>
      speedDistortionTarget(control({ cycleSpeed: speed, speedCap: speed }));
    expect(at(2)).toBeGreaterThan(at(1));
    expect(at(4)).toBeGreaterThan(at(3));
    expect(at(FULL_INTENSITY_NOTCH)).toBe(1);
    expect(at(1)).toBeCloseTo(MIN_NOTCH_INTENSITY);
  });

  it("stays within 0..1 for any notch", () => {
    for (const speed of [0, 1, 2, 3, 4, 5, 6, 9]) {
      const value = speedDistortionTarget(
        control({ cycleSpeed: speed, speedCap: Math.min(speed, 4) }),
      );
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("is 0 for huge ships", () => {
    expect(speedDistortionTarget(control({ movementProfile: "capital" }))).toBe(
      0,
    );
  });

  it("is 0 while hovering", () => {
    expect(speedDistortionTarget(control({ cycleSpeed: 0, speedCap: 0 }))).toBe(
      0,
    );
  });
});

describe("smoothSpeedDistortion", () => {
  it("fades in over FADE_MS", () => {
    expect(smoothSpeedDistortion(0, 1, FADE_MS / 2)).toBeCloseTo(0.5);
    expect(smoothSpeedDistortion(0, 1, FADE_MS)).toBe(1);
  });

  it("fades out at the same rate", () => {
    expect(smoothSpeedDistortion(1, 0, FADE_MS / 4)).toBeCloseTo(0.75);
  });

  it("never overshoots the target", () => {
    expect(smoothSpeedDistortion(0.9, 1, 1000)).toBe(1);
    expect(smoothSpeedDistortion(0.1, 0, 1000)).toBe(0);
    expect(smoothSpeedDistortion(0.4, 0.4, 16)).toBe(0.4);
  });

  it("holds when no time passed", () => {
    expect(smoothSpeedDistortion(0.3, 1, 0)).toBe(0.3);
    expect(smoothSpeedDistortion(0.3, 1, -5)).toBe(0.3);
  });
});

describe("bowArcsAt", () => {
  it("fills every slot deterministically in place", () => {
    const first = createBowArcs();
    const second = createBowArcs();
    const slots = [...first];
    bowArcsAt(3.21, first);
    bowArcsAt(3.21, second);
    expect(first).toEqual(second);
    expect(first).toHaveLength(BOW_ARC_COUNT);
    first.forEach((arc, index) => expect(arc).toBe(slots[index]));
  });

  it("keeps arcs ahead of the hull, fading, and drifting back over time", () => {
    const arcs = createBowArcs();
    bowArcsAt(0.1, arcs);
    const before = arcs.map((arc) => arc.ahead);
    bowArcsAt(0.2, arcs);
    arcs.forEach((arc, index) => {
      expect(arc.ahead).toBeGreaterThanOrEqual(0);
      expect(arc.fade).toBeGreaterThanOrEqual(0);
      expect(arc.fade).toBeLessThanOrEqual(1);
      // Drifting back = smaller distance ahead (unless the arc was reborn).
      if (before[index]! > 0.2) expect(arc.ahead).toBeLessThan(before[index]!);
    });
  });

  it("handles negative clocks", () => {
    const arcs = createBowArcs();
    bowArcsAt(-1.3, arcs);
    for (const arc of arcs) {
      expect(arc.ahead).toBeGreaterThanOrEqual(0);
      expect(arc.fade).toBeGreaterThanOrEqual(0);
    }
  });
});
