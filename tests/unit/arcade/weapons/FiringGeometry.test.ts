/**
 * FiringGeometry — torus-aware bearings, ranges and arcs, shared by every
 * weapon (primary, turret, missiles, torpedoes) and device drop.
 */

import { describe, it, expect } from "vitest";
import {
  bearingOffNoseDeg,
  headingTowardDeg,
  inArcEnvelope,
  pointAstern,
  torusRangePx,
} from "../../../../src/arcade/weapons/FiringGeometry";

const WORLD = 6000;
const NOSE_UP = { x: 3000, y: 3000, angle: 0 };

describe("bearingOffNoseDeg", () => {
  it("is 0 dead ahead and ±90 abeam", () => {
    expect(bearingOffNoseDeg(NOSE_UP, { x: 3000, y: 2900 }, WORLD)).toBeCloseTo(
      0,
    );
    expect(bearingOffNoseDeg(NOSE_UP, { x: 3100, y: 3000 }, WORLD)).toBeCloseTo(
      90,
    );
    expect(bearingOffNoseDeg(NOSE_UP, { x: 2900, y: 3000 }, WORLD)).toBeCloseTo(
      -90,
    );
  });

  it("measures across the map seam the short way", () => {
    const atTopEdge = { x: 3000, y: 20, angle: 0 };
    const acrossSeam = { x: 3000, y: WORLD - 60 };
    expect(bearingOffNoseDeg(atTopEdge, acrossSeam, WORLD)).toBeCloseTo(0);
    expect(torusRangePx(atTopEdge, acrossSeam, WORLD)).toBeCloseTo(80);
  });
});

describe("inArcEnvelope", () => {
  const envelope = { minRangePx: 100, maxRangePx: 300, arcDeg: 80 };

  it("accepts a target inside the band and the arc", () => {
    expect(inArcEnvelope(NOSE_UP, { x: 3000, y: 2800 }, envelope, WORLD)).toBe(
      true,
    );
  });

  it("rejects targets too close, too far or outside the arc", () => {
    expect(inArcEnvelope(NOSE_UP, { x: 3000, y: 2950 }, envelope, WORLD)).toBe(
      false,
    );
    expect(inArcEnvelope(NOSE_UP, { x: 3000, y: 2650 }, envelope, WORLD)).toBe(
      false,
    );
    expect(inArcEnvelope(NOSE_UP, { x: 3200, y: 2850 }, envelope, WORLD)).toBe(
      false,
    );
  });

  it("accepts a target across the seam", () => {
    const atEdge = { x: 10, y: 3000, angle: 270 };
    expect(
      inArcEnvelope(atEdge, { x: WORLD - 190, y: 3000 }, envelope, WORLD),
    ).toBe(true);
  });

  it("treats a 360° envelope as all-round", () => {
    const allRound = { maxRangePx: 300, arcDeg: 360 };
    expect(inArcEnvelope(NOSE_UP, { x: 3000, y: 3200 }, allRound, WORLD)).toBe(
      true,
    );
  });
});

describe("pointAstern", () => {
  it("lies behind the ship, wrapped onto the map", () => {
    const p = pointAstern({ x: 3000, y: WORLD - 10, angle: 0 }, 50, WORLD);
    expect(p.x).toBeCloseTo(3000);
    expect(p.y).toBeCloseTo(40);
  });
});

describe("headingTowardDeg", () => {
  it("points north-up headings at the target the short way", () => {
    expect(
      headingTowardDeg({ x: 10, y: 3000 }, { x: WORLD - 10, y: 3000 }, WORLD),
    ).toBeCloseTo(270);
    expect(
      headingTowardDeg({ x: 3000, y: 3000 }, { x: 3000, y: 3100 }, WORLD),
    ).toBeCloseTo(180);
  });
});

describe("inArcEnvelope with a large target", () => {
  const envelope = { maxRangePx: 400, arcDeg: 60 };
  it("counts a big hull whose centre is just outside the arc", () => {
    const beside = { x: 3200, y: 2700 };
    expect(inArcEnvelope(NOSE_UP, beside, envelope, WORLD)).toBe(false);
    expect(inArcEnvelope(NOSE_UP, beside, envelope, WORLD, 150)).toBe(true);
  });

  it("counts range to the hull's edge", () => {
    const far = { x: 3000, y: 2550 };
    expect(inArcEnvelope(NOSE_UP, far, envelope, WORLD)).toBe(false);
    expect(inArcEnvelope(NOSE_UP, far, envelope, WORLD, 100)).toBe(true);
  });
});
