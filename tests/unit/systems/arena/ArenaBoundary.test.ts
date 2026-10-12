/**
 * Unit tests for ArenaBoundary — the asteroid-belt containment curve.
 */

import { describe, it, expect } from "vitest";
import {
  BELT_AVOID_MARGIN_PX,
  beltAvoidMargin,
  beltRetreatPoint,
  beltWarningLevel,
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

describe("tightenBelt with a damage ramp", () => {
  const RAMP = { perStep: 0.5, maxPerSecond: 5 };

  it("raises damage by the ramp's step per squeeze", () => {
    expect(tightenBelt(BASE, 1, RAMP).maxDamagePerSecond).toBe(4.5);
  });

  it("never raises damage beyond the ramp's cap however tight the belt", () => {
    expect(tightenBelt(BASE, 100, RAMP).maxDamagePerSecond).toBe(5);
  });

  it("still squeezes the radii like the default ramp", () => {
    const ramped = tightenBelt(BASE, 3, RAMP);
    const plain = tightenBelt(BASE, 3);
    expect(ramped.safeRadius).toBe(plain.safeRadius);
    expect(ramped.wallRadius).toBe(plain.wallRadius);
  });
});

describe("beltWarningLevel", () => {
  const BELT = { safeRadius: 2000, wallRadius: 2400, maxDamagePerSecond: 3 };
  const CENTER = { x: 3000, y: 3000 };
  const at = (dist: number) => ({ x: CENTER.x, y: CENTER.y - dist });

  it("is clear well inside the safe zone", () => {
    expect(beltWarningLevel(at(1000), CENTER, BELT)).toBe("clear");
  });

  it("is near within the avoid margin of the belt", () => {
    expect(
      beltWarningLevel(at(2000 - BELT_AVOID_MARGIN_PX / 2), CENTER, BELT),
    ).toBe("near");
  });

  it("is inside once past the safe radius", () => {
    expect(beltWarningLevel(at(2100), CENTER, BELT)).toBe("inside");
  });

  it("warns exactly where an AI pilot starts its retreat", () => {
    const tight = { safeRadius: 300, wallRadius: 500, maxDamagePerSecond: 9 };
    expect(beltAvoidMargin(tight)).toBe(150);
    expect(beltWarningLevel(at(140), CENTER, tight)).toBe("clear");
    expect(beltWarningLevel(at(160), CENTER, tight)).toBe("near");
  });
});

describe("beltRetreatPoint", () => {
  const BELT = { safeRadius: 2000, wallRadius: 2400, maxDamagePerSecond: 3 };
  const CENTER = { x: 3000, y: 3000 };

  it("is null well inside the safe zone", () => {
    expect(beltRetreatPoint({ x: 3000, y: 2000 }, CENTER, BELT)).toBeNull();
  });

  it("sends a ship nearing the belt back to the arena centre", () => {
    const nearEdge = { x: 3000, y: 3000 - (2000 - BELT_AVOID_MARGIN_PX / 2) };
    expect(beltRetreatPoint(nearEdge, CENTER, BELT)).toEqual(CENTER);
  });

  it("sends a ship already in the belt back to the centre", () => {
    expect(beltRetreatPoint({ x: 5300, y: 3000 }, CENTER, BELT)).toEqual(
      CENTER,
    );
  });

  it("keeps half the safe zone open when the belt is tight", () => {
    const tight = { safeRadius: 300, wallRadius: 500, maxDamagePerSecond: 9 };
    expect(beltRetreatPoint({ x: 3000, y: 2860 }, CENTER, tight)).toBeNull();
    expect(beltRetreatPoint({ x: 3000, y: 2840 }, CENTER, tight)).toEqual(
      CENTER,
    );
  });
});
