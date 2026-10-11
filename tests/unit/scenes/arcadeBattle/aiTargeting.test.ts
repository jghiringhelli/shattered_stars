/**
 * Arc targeting and the AI firing solution — specification tests.
 */

import { describe, it, expect } from "vitest";
import {
  bearingDeg,
  headingGapDeg,
  nearestInArc,
} from "../../../../src/scenes/arcadeBattle/arcTargeting";
import {
  AI_AIM_CONE_DEG,
  AI_MAX_FIRE_RANGE_PX,
  aiFiringSolution,
  groundSpeedPxPerSecond,
  LASER_BOLT_SPEED_PX_PER_S,
  leadIntercept,
} from "../../../../src/scenes/arcadeBattle/aiFiringSolution";
import { createProjectile } from "../../../../src/core/Projectile";
import { CYCLE_DURATION_MS, SPEED_SCALE_FACTOR } from "../../../../src/config";

const WORLD = 6000;
const ENVELOPE = { boltSpeed: LASER_BOLT_SPEED_PX_PER_S, worldSize: WORLD };

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

describe("leadIntercept", () => {
  it("aims straight at a stationary target", () => {
    const shooter = { x: 0, y: 0, angle: 0, speed: 3 };
    const target = { x: 0, y: -600, angle: 90, speed: 0 };
    const lead = leadIntercept(shooter, target, { ...ENVELOPE, worldSize: 0 });
    expect(lead.dx).toBeCloseTo(0);
    expect(lead.dy).toBeCloseTo(-600);
  });

  it("leads a crossing target along its heading", () => {
    const shooter = { x: 0, y: 0, angle: 0, speed: 3 };
    const target = { x: 0, y: -600, angle: 90, speed: 3 };
    const lead = leadIntercept(shooter, target, { ...ENVELOPE, worldSize: 0 });
    const flight = 600 / LASER_BOLT_SPEED_PX_PER_S;
    expect(lead.dx).toBeGreaterThan(groundSpeedPxPerSecond(3) * flight * 0.9);
    expect(lead.dy).toBeCloseTo(-600);
  });
});

describe("groundSpeedPxPerSecond", () => {
  it("is one template unit per speed point per cycle", () => {
    expect(groundSpeedPxPerSecond(2)).toBe(
      (2 * SPEED_SCALE_FACTOR * 1000) / CYCLE_DURATION_MS,
    );
  });
});

describe("aiFiringSolution", () => {
  const shooter = { x: 1000, y: 1000, angle: 0, speed: 3 };

  it("fires at a target dead ahead, aimed at it", () => {
    const aim = aiFiringSolution(
      shooter,
      { x: 1000, y: 500, angle: 0, speed: 3 },
      ENVELOPE,
    );
    expect(aim).not.toBeNull();
    expect(headingGapDeg(aim!, 0)).toBeLessThan(1);
  });

  it("holds fire when the intercept is outside the cone", () => {
    const off = AI_AIM_CONE_DEG + 15;
    const rad = ((off - 90) * Math.PI) / 180;
    const target = {
      x: 1000 + Math.cos(rad) * 500,
      y: 1000 + Math.sin(rad) * 500,
      angle: off,
      speed: 0,
    };
    expect(aiFiringSolution(shooter, target, ENVELOPE)).toBeNull();
  });

  it("holds fire beyond weapon range", () => {
    const target = {
      x: 1000,
      y: 1000 - AI_MAX_FIRE_RANGE_PX - 50,
      angle: 0,
      speed: 0,
    };
    expect(aiFiringSolution(shooter, target, ENVELOPE)).toBeNull();
  });

  it("uses the laser bolt speed the projectile system flies", () => {
    const bolt = createProjectile(0, 0, 0, "a", "f", 1);
    expect(bolt.speed).toBe(LASER_BOLT_SPEED_PX_PER_S);
  });
});
