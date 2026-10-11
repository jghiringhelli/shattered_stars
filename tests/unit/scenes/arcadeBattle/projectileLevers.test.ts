/**
 * projectileLevers — specification: a projectile hit earns the ShotLevers
 * damage bonuses (squad mark, rear arc) and nothing for head-on or side hits.
 */

import { describe, it, expect } from "vitest";
import {
  PROJECTILE_MARK_DAMAGE_MULTIPLIER,
  PROJECTILE_ORIGIN_TRACE_PX,
  projectileLeverBonus,
  projectileOrigin,
} from "../../../../src/scenes/arcadeBattle/projectileLevers";
import { REAR_ARC_DAMAGE_BONUS } from "../../../../src/arcade/ShotLevers";

const WORLD = 6000;
/** A typical forward-laser bolt. */
const BASE_DAMAGE = 2;
/** What a mark adds to that bolt. */
const MARK_EXTRA = BASE_DAMAGE * (PROJECTILE_MARK_DAMAGE_MULTIPLIER - 1);
/** Facing north (angle 0): its tail is to the south (+y). */
const TARGET = { x: 1000, y: 1000, angle: 0 };
const FROM_TAIL = { x: 1000, y: 1005, angle: 0 };
const FROM_NOSE = { x: 1000, y: 995, angle: 180 };
const FROM_SIDE = { x: 995, y: 1000, angle: 90 };

const bonus = (
  projectile: { x: number; y: number; angle: number },
  marked = false,
  target = TARGET,
): number =>
  projectileLeverBonus({
    projectile,
    target,
    marked,
    worldSize: WORLD,
    baseDamage: BASE_DAMAGE,
  });

describe("projectileOrigin", () => {
  it("traces the projectile back along its track", () => {
    const origin = projectileOrigin(FROM_TAIL, TARGET, WORLD);
    expect(origin.x).toBeCloseTo(1000);
    expect(origin.y).toBeCloseTo(1005 + PROJECTILE_ORIGIN_TRACE_PX);
    expect(origin.angle).toBe(0);
  });

  it("unwraps across the torus edge onto the target's side", () => {
    const target = { x: 10, y: 1000, angle: 90 };
    const origin = projectileOrigin(
      { x: WORLD - 5, y: 1000, angle: 90 },
      target,
      WORLD,
    );
    expect(origin.x).toBeCloseTo(-5 - PROJECTILE_ORIGIN_TRACE_PX);
  });
});

describe("projectileLeverBonus", () => {
  it("adds the rear-arc damage bonus to a hit from the target's tail", () => {
    expect(bonus(FROM_TAIL)).toBe(REAR_ARC_DAMAGE_BONUS);
  });

  it("adds nothing to a head-on hit (the head-on lever is hit chance only)", () => {
    expect(bonus(FROM_NOSE)).toBe(0);
  });

  it("adds nothing to a hit from the side", () => {
    expect(bonus(FROM_SIDE)).toBe(0);
  });

  it("a marked target takes the bolt's damage times the mark multiplier", () => {
    expect(bonus(FROM_SIDE, true)).toBe(MARK_EXTRA);
  });

  it("stacks the mark and rear-arc bonuses", () => {
    expect(bonus(FROM_TAIL, true)).toBe(MARK_EXTRA + REAR_ARC_DAMAGE_BONUS);
  });

  it("reads the rear arc across the torus edge", () => {
    const target = { x: 10, y: 1000, angle: 90 };
    const wrapped = { x: WORLD - 5, y: 1000, angle: 90 };
    expect(bonus(wrapped, false, target)).toBe(REAR_ARC_DAMAGE_BONUS);
  });
});
