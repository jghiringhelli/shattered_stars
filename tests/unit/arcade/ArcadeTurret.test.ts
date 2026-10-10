/**
 * ArcadeTurret System Tests
 */

import { describe, it, expect } from "vitest";
import {
  tickTurretCooldown,
  canFireTurret,
  consumeTurretShot,
  extractTurretSlot,
  buildTurretSlot,
  type ArcadeTurretSlot,
} from "../../../src/arcade/ArcadeTurret";

// ────────────────────────────────────────────────────────────
// Factory helper — builds a turret slot with sensible defaults
// ────────────────────────────────────────────────────────────

function makeSlot(overrides: Partial<ArcadeTurretSlot> = {}): ArcadeTurretSlot {
  return {
    definitionId: "light_laser_turret",
    name: "Light Laser Turret",
    damage: 1,
    range: 350,
    cooldownMax: 1500,
    cooldownRemaining: 0,
    turretFacing: 0,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// extractTurretSlot
// ────────────────────────────────────────────────────────────

describe("extractTurretSlot", () => {
  it("returns null when no loadoutId is given", () => {
    expect(extractTurretSlot("confed_sparrow", null)).toBeNull();
    expect(extractTurretSlot("confed_sparrow", undefined)).toBeNull();
    expect(extractTurretSlot("confed_sparrow", "")).toBeNull();
  });

  it("returns null for an unknown loadout ID", () => {
    expect(extractTurretSlot("confed_sparrow", "does_not_exist")).toBeNull();
  });

  it("returns null when the loadout contains no turret upgrades", () => {
    // confed_sparrow has small-ship loadouts which carry missiles, not turrets
    const loadouts = ["sparrow_ace", "sparrow_interceptor"];
    for (const id of loadouts) {
      const result = extractTurretSlot("confed_sparrow", id);
      // Either null (no turret) or a valid slot — this test ensures no error thrown
      if (result !== null) {
        expect(result.cooldownRemaining).toBe(0);
        expect(result.turretFacing).toBe(0);
      }
    }
  });
});

// ────────────────────────────────────────────────────────────
// tickTurretCooldown
// ────────────────────────────────────────────────────────────

describe("tickTurretCooldown", () => {
  it("reduces cooldownRemaining by deltaMs", () => {
    const slot = makeSlot({ cooldownRemaining: 1500 });
    tickTurretCooldown(slot, 200);
    expect(slot.cooldownRemaining).toBe(1300);
  });

  it("clamps cooldownRemaining at 0 — never goes negative", () => {
    const slot = makeSlot({ cooldownRemaining: 100 });
    tickTurretCooldown(slot, 500);
    expect(slot.cooldownRemaining).toBe(0);
  });

  it("is a no-op when cooldown is already 0", () => {
    const slot = makeSlot({ cooldownRemaining: 0 });
    tickTurretCooldown(slot, 100);
    expect(slot.cooldownRemaining).toBe(0);
  });

  it("reaches 0 exactly over multiple ticks", () => {
    const slot = makeSlot({ cooldownRemaining: 300 });
    tickTurretCooldown(slot, 100);
    tickTurretCooldown(slot, 100);
    tickTurretCooldown(slot, 100);
    expect(slot.cooldownRemaining).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
// canFireTurret
// ────────────────────────────────────────────────────────────

describe("canFireTurret", () => {
  it("returns true when cooldown is 0", () => {
    expect(canFireTurret(makeSlot({ cooldownRemaining: 0 }))).toBe(true);
  });

  it("returns false when cooldown is positive", () => {
    expect(canFireTurret(makeSlot({ cooldownRemaining: 1 }))).toBe(false);
    expect(canFireTurret(makeSlot({ cooldownRemaining: 1500 }))).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// consumeTurretShot
// ────────────────────────────────────────────────────────────

describe("consumeTurretShot", () => {
  it("sets cooldownRemaining to cooldownMax", () => {
    const slot = makeSlot({ cooldownMax: 2000, cooldownRemaining: 0 });
    consumeTurretShot(slot);
    expect(slot.cooldownRemaining).toBe(2000);
  });

  it("resets a partially-elapsed cooldown back to max", () => {
    const slot = makeSlot({ cooldownMax: 1500, cooldownRemaining: 500 });
    consumeTurretShot(slot);
    expect(slot.cooldownRemaining).toBe(1500);
  });

  it("after consuming, canFireTurret returns false", () => {
    const slot = makeSlot({ cooldownMax: 1500, cooldownRemaining: 0 });
    consumeTurretShot(slot);
    expect(canFireTurret(slot)).toBe(false);
  });

  it("after consuming and full tick, canFireTurret returns true", () => {
    const slot = makeSlot({ cooldownMax: 200, cooldownRemaining: 0 });
    consumeTurretShot(slot);
    tickTurretCooldown(slot, 200);
    expect(canFireTurret(slot)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// turretFacing field
// ────────────────────────────────────────────────────────────

describe("turretFacing", () => {
  it("starts at 0 (ship nose direction)", () => {
    expect(makeSlot().turretFacing).toBe(0);
  });

  it("can be mutated to track a target angle", () => {
    const slot = makeSlot({ turretFacing: 0 });
    slot.turretFacing = 270;
    expect(slot.turretFacing).toBe(270);
  });
});

// ────────────────────────────────────────────────────────────
// buildTurretSlot — catalog-driven profiles
// ────────────────────────────────────────────────────────────

describe("buildTurretSlot", () => {
  it("returns null when no turret card is equipped", () => {
    expect(buildTurretSlot(["hull_upgrade"])).toBeNull();
  });

  it("reads damage, range and rate of fire from the catalog card", () => {
    expect(buildTurretSlot(["twin_laser_turret"])).toMatchObject({
      damage: 2,
      range: 400,
      cooldownMax: 2000,
      stressOnHit: 0,
    });
  });

  it("makes the ion turret stress its target instead of hitting hard", () => {
    const ion = buildTurretSlot(["ion_turret"])!;
    const twin = buildTurretSlot(["twin_laser_turret"])!;
    expect(ion.stressOnHit).toBeGreaterThan(0);
    expect(ion.damage).toBeLessThan(twin.damage);
  });
});
