/**
 * DamageRules — specification tests for the damage rules every mode shares:
 * flat armor per hit (never below 1) and the defender's mitigation (own
 * cards, wingman protection, faction aura) for any hit, dice or not.
 */

import { describe, it, expect } from "vitest";
import {
  MIN_ARMORED_HIT_DAMAGE,
  applyArmor,
  armorReductionOf,
  damageMitigationOf,
} from "../../../../src/arcade/systems/DamageRules";
import { SHIP_DEFINITIONS } from "../../../../src/data/ShipDefinitions";
import {
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  NEUTRAL_MODIFIERS,
  combineEffects,
} from "../../../../src/core/CombatModifiers";
import { NEUTRAL_AURA } from "../../../../src/systems/SupportAura";

const armored = Object.values(SHIP_DEFINITIONS).find(
  (def) => (def.baseStats.armor ?? 0) > 0,
)!;
const unarmored = Object.values(SHIP_DEFINITIONS).find(
  (def) => def.baseStats.armor === undefined,
)!;

describe("armorReductionOf", () => {
  it("reads the ship's printed armor", () => {
    expect(armorReductionOf(armored.id)).toBe(armored.baseStats.armor);
  });

  it("is 0 for a ship without armor", () => {
    expect(armorReductionOf(unarmored.id)).toBe(0);
  });

  it("is 0 for an unknown ship id", () => {
    expect(armorReductionOf("no_such_ship")).toBe(0);
  });
});

describe("applyArmor", () => {
  it("removes the armor from every hit", () => {
    expect(applyArmor(5, 2)).toBe(3);
  });

  it("never reduces a hit below 1", () => {
    expect(applyArmor(2, 3)).toBe(MIN_ARMORED_HIT_DAMAGE);
  });

  it("leaves a hit untouched without armor", () => {
    expect(applyArmor(4, 0)).toBe(4);
  });

  it("never turns a miss into damage, nor raises a sub-1 hit", () => {
    expect(applyArmor(0, 2)).toBe(0);
    expect(applyArmor(0.5, 1)).toBe(0.5);
  });
});

describe("damageMitigationOf", () => {
  it("is 1 for a bare target", () => {
    expect(damageMitigationOf(NEUTRAL_MODIFIERS, false)).toBe(1);
  });

  it("applies the target's own damage-taken knob", () => {
    const sheet = combineEffects([{ damageTakenMultiplier: 0.8 }]);
    expect(damageMitigationOf(sheet, false)).toBeCloseTo(0.8, 10);
  });

  it("applies wingman protection only with a wingman near", () => {
    const sheet = combineEffects([{ wingmanDamageTakenMultiplier: 0.9 }]);
    expect(damageMitigationOf(sheet, true)).toBeCloseTo(0.9, 10);
    expect(damageMitigationOf(sheet, false)).toBe(1);
  });

  it("multiplies the target's faction aura into the mitigation", () => {
    const sheet = combineEffects([{ damageTakenMultiplier: 0.8 }]);
    const aura = { ...NEUTRAL_AURA, damageTakenMultiplier: 0.8 };
    expect(damageMitigationOf(sheet, false, aura)).toBeCloseTo(0.64, 10);
  });

  it("never drops below the stacking floor", () => {
    const sheet = combineEffects([{ damageTakenMultiplier: 0.5 }]);
    const aura = { ...NEUTRAL_AURA, damageTakenMultiplier: 0.5 };
    expect(damageMitigationOf(sheet, false, aura)).toBe(
      MIN_DAMAGE_TAKEN_MULTIPLIER,
    );
  });
});

describe("shotAurasOf", () => {
  it("passes only the auras that cover the attacker or the target", async () => {
    const { shotAurasOf } =
      await import("../../../../src/arcade/systems/DamageRules");
    const { NEUTRAL_AURA } =
      await import("../../../../src/systems/SupportAura");
    const boosted = { ...NEUTRAL_AURA, damageBonus: 1 };
    const auras = new Map([["a", boosted]]);
    expect(shotAurasOf(auras, "a", "t")).toEqual({ attackerAura: boosted });
    expect(shotAurasOf(auras, "x", "a")).toEqual({ targetAura: boosted });
    expect(shotAurasOf(auras, "x", "y")).toEqual({});
  });
});
