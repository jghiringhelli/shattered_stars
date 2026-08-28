/**
 * Unit tests for ArenaBoundary — the asteroid-belt containment curve.
 */

import { describe, it, expect } from "vitest";
import {
  beltIntensity,
  beltDamagePerSecond,
  beltDamageForFrame,
  beltDamagePerTurn,
  tightenBelt,
  MIN_SAFE_RADIUS,
  type BeltConfig,
} from "../../../../src/systems/arena/ArenaBoundary";

const BASE: BeltConfig = {
  safeRadius: 1000,
  wallRadius: 2000,
  maxDamagePerSecond: 4,
};

describe("beltIntensity", () => {
  it("is zero inside the safe zone", () => {
    expect(beltIntensity(0, BASE)).toBe(0);
    expect(beltIntensity(BASE.safeRadius, BASE)).toBe(0);
  });

  it("is full at and beyond the wall", () => {
    expect(beltIntensity(BASE.wallRadius, BASE)).toBe(1);
    expect(beltIntensity(BASE.wallRadius + 500, BASE)).toBe(1);
  });

  it("ramps quadratically between safe zone and wall", () => {
    // Halfway across the span → t=0.5 → intensity 0.25 (quadratic).
    const mid = (BASE.safeRadius + BASE.wallRadius) / 2;
    expect(beltIntensity(mid, BASE)).toBeCloseTo(0.25);
  });

  it("increases monotonically with distance", () => {
    const a = beltIntensity(1200, BASE);
    const b = beltIntensity(1600, BASE);
    expect(b).toBeGreaterThan(a);
  });
});

describe("beltDamagePerSecond", () => {
  it("scales intensity by max damage", () => {
    expect(beltDamagePerSecond(BASE.wallRadius, BASE)).toBe(
      BASE.maxDamagePerSecond,
    );
    expect(beltDamagePerSecond(0, BASE)).toBe(0);
  });
});

describe("beltDamageForFrame", () => {
  it("converts dps to per-frame damage by delta time", () => {
    // At the wall, 4 dps over 500ms → 2 damage.
    expect(beltDamageForFrame(BASE.wallRadius, BASE, 500)).toBeCloseTo(2);
  });
});

describe("beltDamagePerTurn", () => {
  it("deals max damage at the wall and none in the safe zone", () => {
    expect(beltDamagePerTurn(BASE.wallRadius, BASE)).toBe(
      BASE.maxDamagePerSecond,
    );
    expect(beltDamagePerTurn(0, BASE)).toBe(0);
  });

  it("scales quadratically with distance across the belt", () => {
    const mid = (BASE.safeRadius + BASE.wallRadius) / 2;
    expect(beltDamagePerTurn(mid, BASE)).toBeCloseTo(
      0.25 * BASE.maxDamagePerSecond,
    );
  });
});

describe("tightenBelt", () => {
  it("returns the base at step 0", () => {
    expect(tightenBelt(BASE, 0)).toEqual(BASE);
  });

  it("shrinks radii and raises damage as steps grow", () => {
    const t = tightenBelt(BASE, 2);
    expect(t.safeRadius).toBeLessThan(BASE.safeRadius);
    expect(t.wallRadius).toBeLessThan(BASE.wallRadius);
    expect(t.maxDamagePerSecond).toBeGreaterThan(BASE.maxDamagePerSecond);
  });

  it("floors the safe radius and keeps the wall outside it", () => {
    const t = tightenBelt(BASE, 100);
    expect(t.safeRadius).toBe(MIN_SAFE_RADIUS);
    expect(t.wallRadius).toBeGreaterThan(t.safeRadius);
  });

  it("treats negative steps as no tightening", () => {
    expect(tightenBelt(BASE, -5)).toEqual(BASE);
  });
});
