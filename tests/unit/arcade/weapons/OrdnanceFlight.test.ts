/**
 * OrdnanceFlight — missiles and torpedoes in flight: launched from the
 * nose, homing toward their locked target the short way across the seam
 * until their turn budget runs out, wrapping on the torus, and striking
 * the first hostile hull their path crosses.
 */

import { describe, it, expect } from "vitest";
import {
  flyShot,
  launchShot,
  shotImpact,
} from "../../../../src/arcade/weapons/OrdnanceFlight";
import {
  secondarySpecOf,
  type LauncherSpec,
} from "../../../../src/arcade/weapons/weaponSpecs";
import type { WeaponBody } from "../../../../src/arcade/weapons/weaponTypes";
import { RANGE_2, RANGE_3 } from "../../../../src/config";

const WORLD = 6000;
const TORPEDO = secondarySpecOf("proton_torpedo") as LauncherSpec;
const MISSILE = secondarySpecOf("concussion_missile") as LauncherSpec;

function body(overrides: Partial<WeaponBody> = {}): WeaponBody {
  return {
    id: "t",
    side: "b",
    x: 3000,
    y: 2700,
    angle: 0,
    hull: 10,
    agilityDice: 1,
    ...overrides,
  };
}

const SHOOTER = { id: "s", side: "a", x: 3000, y: 3000, angle: 0 };

describe("launchShot", () => {
  it("leaves the nose heading where the ship points when unguided", () => {
    const shot = launchShot(SHOOTER, TORPEDO, null, WORLD);
    expect(shot.y).toBeLessThan(3000);
    expect(shot.angle).toBe(0);
    expect(shot.damage).toBe(TORPEDO.damage);
    expect(shot.targetId).toBeNull();
  });

  it("leaves_the_nose_on_the_ships_heading_even_locked_off_boresight", () => {
    // 30° right of the nose, inside the launch arc: the pilot aims the
    // launcher, the warhead then tracks its target from the first frame.
    const target = body({ x: 3000 + 150, y: 3000 - 260 });
    const shot = launchShot(SHOOTER, TORPEDO, target, WORLD);
    expect(shot.targetId).toBe("t");
    expect(shot.angle).toBe(0);
    expect(shot.targetFix).toEqual({ x: target.x, y: target.y });
  });
});

describe("a locked launch against a manoeuvring fighter", () => {
  function chase(
    start: WeaponBody,
    velocity: { vx: number; vy: number },
    spec: LauncherSpec = TORPEDO,
  ): boolean {
    const frameMs = 16;
    let target = start;
    let shot = launchShot(SHOOTER, spec, target, WORLD);
    while (shot.lifetimeMs > 0) {
      target = {
        ...target,
        x: target.x + (velocity.vx * frameMs) / 1000,
        y: target.y + (velocity.vy * frameMs) / 1000,
      };
      const after = flyShot(shot, target, frameMs, WORLD);
      if (shotImpact(shot, after, [target], WORLD)) return true;
      shot = after;
    }
    return false;
  }

  it("hits_a_target_on_the_nose_closing_head_on", () => {
    expect(chase(body({ y: 3000 - RANGE_3 }), { vx: 0, vy: 300 })).toBe(true);
  });

  it("a_slow_tracking_torpedo_launched_well_off_the_nose_misses_a_head_on_pass", () => {
    // 200 px out, 35° off the nose, closing at 300 px/s: point the nose.
    const start = body({ x: 3000 + 115, y: 3000 - 164 });
    expect(chase(start, { vx: -170, vy: 250 })).toBe(false);
  });

  it("leads_a_crossing_target_and_intercepts_it", () => {
    // Range 2.5 ahead, crossing at 240 px/s (speed 3 on the dial): a missile
    // chasing where it is would trail it; steering for the intercept hits.
    const start = body({ y: 3000 - (RANGE_2 + RANGE_3) / 2 });
    expect(chase(start, { vx: 240, vy: 0 }, MISSILE)).toBe(true);
  });

  it("a_close_target_crossing_at_boost_speed_escapes_the_turn_rate", () => {
    // 80 px ahead, crossing at 500 px/s: the lead angle is more than a
    // torpedo can turn before it overflies — evasion still works.
    expect(chase(body({ y: 2920 }), { vx: 500, vy: 0 })).toBe(false);
  });
});

describe("flyShot", () => {
  it("turns toward its target and spends turn budget", () => {
    const shot = launchShot(SHOOTER, TORPEDO, null, WORLD);
    const flown = flyShot(shot, { x: 3300, y: 3000 }, 100, WORLD);
    expect(flown.angle).toBeGreaterThan(0);
    expect(flown.homingTurnBudget).toBeLessThan(shot.homingTurnBudget);
    expect(flown.lifetimeMs).toBe(shot.lifetimeMs - 100);
  });

  it("homes across the map seam the short way", () => {
    const atEdge = launchShot(
      { ...SHOOTER, x: 20, angle: 0 },
      TORPEDO,
      null,
      WORLD,
    );
    const flown = flyShot(atEdge, { x: WORLD - 100, y: atEdge.y }, 100, WORLD);
    expect(flown.angle).toBeGreaterThan(180);
  });

  it("flies straight once the budget is spent", () => {
    const spent = {
      ...launchShot(SHOOTER, TORPEDO, null, WORLD),
      homingTurnBudget: 0,
    };
    expect(flyShot(spent, { x: 3300, y: 3000 }, 100, WORLD).angle).toBe(0);
  });

  it("wraps onto the map", () => {
    const shot = { ...launchShot({ ...SHOOTER, y: 5 }, TORPEDO, null, WORLD) };
    const flown = flyShot(shot, null, 100, WORLD);
    expect(flown.y).toBeGreaterThan(WORLD - 100);
  });
});

describe("shotImpact", () => {
  it("strikes a hostile hull on its path, even between frames", () => {
    const shot = launchShot(SHOOTER, TORPEDO, body(), WORLD);
    const flown = flyShot(shot, null, 600, WORLD);
    expect(shotImpact(shot, flown, [body({ y: 2850 })], WORLD)?.id).toBe("t");
  });

  it("passes through friends and the destroyed", () => {
    const shot = launchShot(SHOOTER, TORPEDO, body(), WORLD);
    const flown = flyShot(shot, null, 600, WORLD);
    expect(
      shotImpact(shot, flown, [body({ y: 2850, side: "a" })], WORLD),
    ).toBeNull();
    expect(
      shotImpact(shot, flown, [body({ y: 2850, hull: 0 })], WORLD),
    ).toBeNull();
  });
});
