/**
 * Arc targeting (the Skirmish HUD's target pick) — specification tests.
 */

import { describe, it, expect } from "vitest";
import {
  bearingDeg,
  headingGapDeg,
  nearestInArc,
} from "../../../../src/scenes/arcadeBattle/arcTargeting";

const WORLD = 6000;

describe("bearingDeg", () => {
  it("uses the ship convention: 0 = up, clockwise", () => {
    expect(bearingDeg(0, -1)).toBeCloseTo(0);
    expect(bearingDeg(1, 0)).toBeCloseTo(90);
    expect(bearingDeg(0, 1)).toBeCloseTo(180);
    expect(bearingDeg(-1, 0)).toBeCloseTo(270);
  });
});

describe("headingGapDeg", () => {
  it("takes the short way round", () => {
    expect(headingGapDeg(350, 10)).toBe(20);
    expect(headingGapDeg(10, 350)).toBe(20);
    expect(headingGapDeg(0, 180)).toBe(180);
  });
});

describe("nearestInArc", () => {
  const origin = { x: 1000, y: 1000 };
  const ship = (id: string, x: number, y: number) => ({
    id,
    x,
    y,
    faction: "e",
  });

  it("returns the nearest candidate inside the arc", () => {
    const pick = nearestInArc(
      origin,
      0,
      [ship("far", 1000, 300), ship("near", 1100, 700)],
      60,
      WORLD,
    );
    expect(pick?.id).toBe("near");
  });

  it("skips candidates outside the arc", () => {
    expect(
      nearestInArc(origin, 0, [ship("side", 1300, 1000)], 60, WORLD),
    ).toBeNull();
  });

  it("finds a target across the torus seam", () => {
    const edge = { x: 100, y: 3000 };
    const pick = nearestInArc(edge, 270, [ship("wrap", 5900, 3000)], 30, WORLD);
    expect(pick?.id).toBe("wrap");
  });
});
