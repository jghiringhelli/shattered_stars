/**
 * ArcTargeting — specification: a primary weapon fires at the nearest living
 * hostile inside its range and forward arc, skipping ineligible targets
 * (e.g. still immune to this attacker under the X-Wing round tempo).
 */

import { describe, it, expect } from "vitest";
import {
  angleBetweenRad,
  isInFiringArc,
  nearestTargetInArc,
  type ArcCandidate,
} from "../../../../src/arcade/systems/ArcTargeting";

/** Shooter at the origin facing up (angle 0 = up, screen y grows downward). */
const SHOOTER = { id: "s", faction: "a", x: 0, y: 0, angle: 0 };
const WEAPON = { rangePx: 250, arcDeg: 90 };

function foe(id: string, x: number, y: number, hull = 4): ArcCandidate {
  return { id, faction: "b", x, y, hull };
}

describe("angleBetweenRad", () => {
  it("folds a difference across the ±π seam onto the short way round", () => {
    expect(angleBetweenRad(Math.PI * 0.9, -Math.PI * 0.9)).toBeCloseTo(
      Math.PI * 0.2,
    );
  });

  it("handles differences larger than a full turn", () => {
    expect(angleBetweenRad(Math.PI * 2.5, 0)).toBeCloseTo(Math.PI / 2);
  });
});

describe("isInFiringArc", () => {
  it("accepts a point dead ahead within range", () => {
    expect(isInFiringArc(SHOOTER, { x: 0, y: -100 }, WEAPON)).toBe(true);
  });

  it("rejects a point behind the ship", () => {
    expect(isInFiringArc(SHOOTER, { x: 0, y: 100 }, WEAPON)).toBe(false);
  });

  it("rejects a point ahead but out of range", () => {
    expect(isInFiringArc(SHOOTER, { x: 0, y: -300 }, WEAPON)).toBe(false);
  });

  it("rejects a point just outside the half-arc", () => {
    expect(isInFiringArc(SHOOTER, { x: 100, y: -90 }, WEAPON)).toBe(false);
  });

  it("follows the ship's heading (facing right at 90°)", () => {
    const facingRight = { ...SHOOTER, angle: 90 };
    expect(isInFiringArc(facingRight, { x: 100, y: 0 }, WEAPON)).toBe(true);
  });

  it("works for headings past a full turn (no false hits behind)", () => {
    const wrapped = { ...SHOOTER, angle: 350 + 360 };
    expect(isInFiringArc(wrapped, { x: 0, y: 100 }, WEAPON)).toBe(false);
  });
});

describe("nearestTargetInArc", () => {
  it("picks the nearest hostile in arc", () => {
    const near = foe("near", 0, -80);
    const far = foe("far", 0, -200);
    expect(nearestTargetInArc(SHOOTER, [far, near], WEAPON)).toBe(near);
  });

  it("ignores ships of its own faction", () => {
    const friend = { ...foe("f", 0, -50), faction: "a" };
    expect(nearestTargetInArc(SHOOTER, [friend], WEAPON)).toBeNull();
  });

  it("ignores destroyed ships", () => {
    expect(
      nearestTargetInArc(SHOOTER, [foe("d", 0, -50, 0)], WEAPON),
    ).toBeNull();
  });

  it("skips an ineligible (immune) target for the next one in arc", () => {
    const immune = foe("immune", 0, -60);
    const other = foe("other", 20, -150);
    const target = nearestTargetInArc(SHOOTER, [immune, other], {
      ...WEAPON,
      isEligible: (candidate) => candidate.id !== "immune",
    });
    expect(target).toBe(other);
  });

  it("returns null when the only target in arc is ineligible", () => {
    const target = nearestTargetInArc(SHOOTER, [foe("immune", 0, -60)], {
      ...WEAPON,
      isEligible: () => false,
    });
    expect(target).toBeNull();
  });
});
