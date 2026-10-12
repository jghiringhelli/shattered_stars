/**
 * Skirmish real-time durability — specification tests: scene-local repairs
 * and regeneration are at DURABILITY_SCALE, and the commander's main beam
 * hits at ordnance scale. (Ship hull/shields: spawnDurabilityParity.test.ts.)
 */

import { describe, it, expect } from "vitest";
import {
  DURABILITY_SCALE,
  ORDNANCE_DAMAGE_SCALE,
} from "../../../../src/config";
import {
  EMERGENCY_REPAIR_HULL_AMOUNT,
  EMERGENCY_REPAIR_SHIELD_AMOUNT,
  MAIN_BEAM_DAMAGE,
  POWER_REDIRECT_ENGINE_REPAIR_PER_SEC,
  POWER_REDIRECT_SHIELD_REGEN_PER_SEC,
} from "../../../../src/systems/ShipCrew";
import {
  EMERGENCY_HULL_REPAIR,
  EMERGENCY_SHIELD_REPAIR,
  ENGINE_REPAIR_PER_SECOND,
  MAIN_BEAM_HIT_DAMAGE,
  POWER_SHIELD_REGEN_PER_SECOND,
  regenerateScaledShields,
} from "../../../../src/scenes/arcadeBattle/arcadeDurability";

describe("scene-local HP sources", () => {
  it("scale the commander's repairs", () => {
    expect(EMERGENCY_SHIELD_REPAIR).toBe(
      EMERGENCY_REPAIR_SHIELD_AMOUNT * DURABILITY_SCALE,
    );
    expect(EMERGENCY_HULL_REPAIR).toBe(
      EMERGENCY_REPAIR_HULL_AMOUNT * DURABILITY_SCALE,
    );
    expect(ENGINE_REPAIR_PER_SECOND).toBe(
      POWER_REDIRECT_ENGINE_REPAIR_PER_SEC * DURABILITY_SCALE,
    );
  });

  it("make the main beam hit at ordnance scale", () => {
    expect(MAIN_BEAM_HIT_DAMAGE).toBe(MAIN_BEAM_DAMAGE * ORDNANCE_DAMAGE_SCALE);
  });
});

describe("regenerateScaledShields", () => {
  it("regenerates real-time HP per second (rates are HP/s, never rescaled)", () => {
    expect(regenerateScaledShields(0, 100, 1, 1000)).toBe(1);
  });

  it("keeps the power-redirect shield regen at its old real-time strength", () => {
    expect(POWER_SHIELD_REGEN_PER_SECOND).toBe(
      POWER_REDIRECT_SHIELD_REGEN_PER_SEC * DURABILITY_SCALE,
    );
  });

  it("never exceeds the cap", () => {
    expect(regenerateScaledShields(11, 12, 2, 1000)).toBe(12);
  });

  it("does nothing at a zero rate or full shields", () => {
    expect(regenerateScaledShields(3, 12, 0, 1000)).toBe(3);
    expect(regenerateScaledShields(12, 12, 2, 1000)).toBe(12);
  });

  it("never lowers shields already above the cap", () => {
    expect(regenerateScaledShields(15, 12, 2, 1000)).toBe(15);
  });
});
