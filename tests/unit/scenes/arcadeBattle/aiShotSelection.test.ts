/**
 * aiShotSelection — specification: an AI ship shoots its pilot's target when
 * it has a firing solution, else the nearest other enemy it has one on, and
 * launches ordnance only at its target inside the launch cone and reach.
 */

import { describe, it, expect } from "vitest";
import {
  AI_MAX_ORDNANCE_RANGE_PX,
  AI_ORDNANCE_CONE_DEG,
  ordnanceInReach,
  pickAiShot,
} from "../../../../src/scenes/arcadeBattle/aiShotSelection";
import {
  AI_AIM_CONE_DEG,
  AI_MAX_FIRE_RANGE_PX,
} from "../../../../src/scenes/arcadeBattle/aiFiringSolution";

const WORLD = 6000;
const ENVELOPE = { boltSpeed: 2500, worldSize: WORLD };
/** Facing north (angle 0 = up, -y). */
const SHOOTER = { x: 3000, y: 3000, angle: 0, speed: 0 };

/** A parked enemy at a bearing (° clockwise from north) and distance. */
function enemyAt(id: string, bearingDeg: number, distance: number) {
  const rad = ((bearingDeg - 90) * Math.PI) / 180;
  return {
    id,
    x: SHOOTER.x + Math.cos(rad) * distance,
    y: SHOOTER.y + Math.sin(rad) * distance,
    angle: 0,
    speed: 0,
  };
}

describe("pickAiShot", () => {
  it("shoots the pilot's target when it has a solution, even if another is nearer", () => {
    const near = enemyAt("near", 0, 300);
    const preferred = enemyAt("pref", 10, 800);
    const shot = pickAiShot(SHOOTER, [near, preferred], "pref", ENVELOPE);
    expect(shot?.target.id).toBe("pref");
    expect(shot?.aim).toBeCloseTo(10, 0);
  });

  it("takes the nearest other solution when the target is out of the cone", () => {
    const behind = enemyAt("pref", 180, 300);
    const far = enemyAt("far", 5, 900);
    const near = enemyAt("near", -5, 400);
    const shot = pickAiShot(SHOOTER, [behind, far, near], "pref", ENVELOPE);
    expect(shot?.target.id).toBe("near");
  });

  it("holds fire with no solution on anyone", () => {
    const wide = enemyAt("wide", AI_AIM_CONE_DEG + 10, 300);
    const far = enemyAt("far", 0, AI_MAX_FIRE_RANGE_PX + 100);
    expect(pickAiShot(SHOOTER, [wide, far], null, ENVELOPE)).toBeNull();
  });

  it("shoots any solution when the pilot has no target", () => {
    const ahead = enemyAt("ahead", 0, 500);
    expect(pickAiShot(SHOOTER, [ahead], null, ENVELOPE)?.target.id).toBe(
      "ahead",
    );
  });
});

describe("ordnanceInReach", () => {
  it("is true inside the launch cone and reach", () => {
    expect(ordnanceInReach(SHOOTER, enemyAt("t", 30, 1000), WORLD)).toBe(true);
  });

  it("is false outside the launch cone", () => {
    const wide = enemyAt("t", AI_ORDNANCE_CONE_DEG + 5, 500);
    expect(ordnanceInReach(SHOOTER, wide, WORLD)).toBe(false);
  });

  it("is false beyond the launch reach", () => {
    const far = enemyAt("t", 0, AI_MAX_ORDNANCE_RANGE_PX + 10);
    expect(ordnanceInReach(SHOOTER, far, WORLD)).toBe(false);
  });

  it("measures across the torus edge", () => {
    const shooter = { x: 3000, y: 100, angle: 0 };
    const acrossEdge = { x: 3000, y: WORLD - 300 };
    expect(ordnanceInReach(shooter, acrossEdge, WORLD)).toBe(true);
  });
});
