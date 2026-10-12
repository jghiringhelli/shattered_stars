/**
 * FireControl — when FIRE_SECONDARY may launch or drop, the turret's
 * target and aim, and the damage a secondary hit deals.
 */

import { describe, it, expect } from "vitest";
import {
  CLOAKED_DAMAGE_FACTOR,
  checkSecondaryFire,
  pickTurretTarget,
  traverseTurret,
  weaponHitDamage,
} from "../../../../src/arcade/weapons/FireControl";
import { createArsenal } from "../../../../src/arcade/weapons/Arsenal";
import {
  LOCK_ACQUIRE_MS,
  NO_LOCK,
} from "../../../../src/arcade/weapons/TargetLock";
import type { WeaponBody } from "../../../../src/arcade/weapons/weaponTypes";
import { NEUTRAL_MODIFIERS } from "../../../../src/core/CombatModifiers";
import { RANGE_1, RANGE_3 } from "../../../../src/config";

const WORLD = 6000;
const SELF = { id: "s", side: "a", x: 3000, y: 3000, angle: 0 };

function body(overrides: Partial<WeaponBody> = {}): WeaponBody {
  return {
    id: "t",
    side: "b",
    x: 3000,
    y: 2800,
    angle: 180,
    hull: 10,
    agilityDice: 1,
    ...overrides,
  };
}

function loaded(upgradeIds: string[]) {
  return createArsenal({
    definitionId: "terran_viper",
    upgradeIds,
    modifiers: NEUTRAL_MODIFIERS,
  });
}

const LOCKED = { targetId: "t", heldMs: LOCK_ACQUIRE_MS };

describe("checkSecondaryFire — launchers", () => {
  const slot = () => loaded(["proton_torpedo"]).slots[0]!;

  it("launches at a locked target in arc and range", () => {
    expect(checkSecondaryFire(slot(), LOCKED, SELF, body(), WORLD)).toBe(
      "launched",
    );
  });

  it("refuses without a target, without a lock, or outside arc/range", () => {
    expect(checkSecondaryFire(slot(), LOCKED, SELF, null, WORLD)).toBe(
      "no_target",
    );
    expect(checkSecondaryFire(slot(), NO_LOCK, SELF, body(), WORLD)).toBe(
      "locking",
    );
    expect(
      checkSecondaryFire(slot(), LOCKED, SELF, body({ y: 3200 }), WORLD),
    ).toBe("out_of_arc");
    expect(
      checkSecondaryFire(
        slot(),
        LOCKED,
        SELF,
        body({ y: 3000 - RANGE_1 + 10 }),
        WORLD,
      ),
    ).toBe("out_of_range");
    expect(
      checkSecondaryFire(
        slot(),
        LOCKED,
        SELF,
        body({ y: 3000 - RANGE_3 - 10 }),
        WORLD,
      ),
    ).toBe("out_of_range");
  });

  it("refuses an empty or reloading rack", () => {
    const empty = { ...slot(), charges: 0 };
    const reloading = { ...slot(), cooldownMs: 100 };
    expect(checkSecondaryFire(empty, LOCKED, SELF, body(), WORLD)).toBe(
      "empty",
    );
    expect(checkSecondaryFire(reloading, LOCKED, SELF, body(), WORLD)).toBe(
      "reloading",
    );
  });
});

describe("checkSecondaryFire — devices", () => {
  it("drops with no target and no lock", () => {
    const bay = loaded(["proton_bomb"]).slots[0]!;
    expect(checkSecondaryFire(bay, NO_LOCK, SELF, null, WORLD)).toBe("dropped");
  });
});

describe("pickTurretTarget", () => {
  const turret = loaded(["light_laser_turret"]).turret!;

  it("tracks all round, preferring the pilot's target", () => {
    const behind = body({ id: "behind", y: 3100 });
    const wanted = body({ id: "wanted", x: 3120, y: 3000 });
    expect(pickTurretTarget(SELF, turret, [behind], null, WORLD)?.id).toBe(
      "behind",
    );
    expect(
      pickTurretTarget(SELF, turret, [behind, wanted], "wanted", WORLD)?.id,
    ).toBe("wanted");
  });

  it("sees across the map seam", () => {
    const atEdge = { ...SELF, x: 10 };
    const across = body({ x: WORLD - 60, y: 3000 });
    expect(pickTurretTarget(atEdge, turret, [across], null, WORLD)).toBe(
      across,
    );
  });

  it("ignores friends and targets out of range", () => {
    expect(
      pickTurretTarget(SELF, turret, [body({ side: "a" })], null, WORLD),
    ).toBeNull();
    expect(
      pickTurretTarget(SELF, turret, [body({ y: 2000 })], null, WORLD),
    ).toBeNull();
  });
});

describe("traverseTurret", () => {
  it("swings toward the bearing at its traverse rate, the short way", () => {
    expect(traverseTurret(350, 10, 1000)).toBe(10);
    const partial = traverseTurret(0, 90, 100);
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(90);
  });
});

describe("weaponHitDamage", () => {
  it("applies armour then mitigation, never below 1", () => {
    expect(weaponHitDamage(30, body(), false)).toBe(30);
    expect(
      weaponHitDamage(30, body({ armor: 2, damageTaken: 0.5 }), false),
    ).toBe(14);
    expect(weaponHitDamage(1, body({ damageTaken: 0.5 }), false)).toBe(1);
  });

  it("halves damage against a cloaked ship", () => {
    expect(weaponHitDamage(30, body(), true)).toBe(30 * CLOAKED_DAMAGE_FACTOR);
  });
});
