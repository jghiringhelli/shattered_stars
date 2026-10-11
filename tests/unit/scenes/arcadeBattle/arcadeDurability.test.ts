/**
 * Skirmish real-time durability — specification tests: card hull/shields,
 * floors, repairs and regeneration are all at DURABILITY_SCALE, and the
 * commander's main beam hits at ordnance scale.
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
} from "../../../../src/systems/ShipCrew";
import {
  DEFAULT_SQUAD_DURABILITY,
  EMERGENCY_HULL_REPAIR,
  EMERGENCY_SHIELD_REPAIR,
  ENGINE_REPAIR_PER_SECOND,
  MAIN_BEAM_HIT_DAMAGE,
  PLAYER_HULL_FLOOR,
  PLAYER_SHIELD_FLOOR,
  WINGMAN_HULL_FLOOR,
  realTimeDurability,
  regenerateScaledShields,
} from "../../../../src/scenes/arcadeBattle/arcadeDurability";
import { getShipDefinition } from "../../../../src/data/ShipDefinitions";

describe("realTimeDurability", () => {
  it("scales a card's hull and shields by DURABILITY_SCALE", () => {
    expect(realTimeDurability({ hull: 3, shields: 1 })).toEqual({
      hull: 3 * DURABILITY_SCALE,
      shields: 1 * DURABILITY_SCALE,
    });
  });

  it("gives the Kestrel its card points at the durability scale", () => {
    const card = getShipDefinition("confed_kestrel")!.baseStats;
    expect(realTimeDurability(card).hull).toBe(card.hull * DURABILITY_SCALE);
  });

  it("falls back to a scaled 4 hull / 2 shields for unknown ships", () => {
    expect(realTimeDurability(undefined)).toEqual({
      hull: 4 * DURABILITY_SCALE,
      shields: 2 * DURABILITY_SCALE,
    });
  });
});

describe("scene-local HP sources", () => {
  it("scale the player and wingman floors", () => {
    expect(PLAYER_HULL_FLOOR).toBe(6 * DURABILITY_SCALE);
    expect(PLAYER_SHIELD_FLOOR).toBe(3 * DURABILITY_SCALE);
    expect(WINGMAN_HULL_FLOOR).toBe(4 * DURABILITY_SCALE);
  });

  it("scale the demo squad", () => {
    expect(DEFAULT_SQUAD_DURABILITY.player).toEqual({
      hull: 8 * DURABILITY_SCALE,
      shields: 4 * DURABILITY_SCALE,
    });
    expect(DEFAULT_SQUAD_DURABILITY.wingman).toEqual({
      hull: 5 * DURABILITY_SCALE,
      shields: 3 * DURABILITY_SCALE,
    });
  });

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
  it("regenerates miniature points per second at DURABILITY_SCALE", () => {
    expect(regenerateScaledShields(0, 100, 1, 1000)).toBe(DURABILITY_SCALE);
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
