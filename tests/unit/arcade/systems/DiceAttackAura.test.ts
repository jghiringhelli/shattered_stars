/**
 * Faction aura buffs in the dice modes — specification tests: the
 * attacker's aura adds damage and hit chance, the target's aura mitigates,
 * and an aura raises stress relief; omitting the auras changes nothing.
 */

import { describe, it, expect } from "vitest";
import {
  resolveDiceAttack,
  type DiceAttackInput,
} from "../../../../src/arcade/systems/DiceAttack";
import { stressModifiersOf } from "../../../../src/arcade/systems/QuickBuildEquip";
import {
  MAX_STRESS_RELIEF_TIERS,
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  combineEffects,
  type RealtimeEffect,
} from "../../../../src/core/CombatModifiers";
import { INITIAL_STRESS } from "../../../../src/arcade/ArcadeStress";
import type { AbilityCombatant } from "../../../../src/arcade/PilotAbilityCombat";
import {
  NEUTRAL_AURA,
  type ActiveAura,
} from "../../../../src/systems/SupportAura";
import { LEVER_HIT_CHANCE_CEILING } from "../../../../src/arcade/ShotLevers";

function combatant(
  effect: RealtimeEffect,
  overrides: Partial<AbilityCombatant> = {},
): AbilityCombatant {
  return {
    id: "c",
    x: 1000,
    y: 1000,
    angle: 0,
    hull: 4,
    maxHull: 4,
    shields: 2,
    maxShields: 2,
    stress: INITIAL_STRESS,
    modifiers: combineEffects([effect]),
    frenzyUntilMs: 0,
    ...overrides,
  };
}

/** Target 300 px ahead, flying across the attacker's nose (no lever). */
const target = (effect: RealtimeEffect = {}) =>
  combatant(effect, { id: "t", y: 700, angle: 90 });

function shot(overrides: Partial<DiceAttackInput> = {}): DiceAttackInput {
  return {
    attacker: combatant({}),
    target: target(),
    hitChance: 0.6,
    baseDamage: 4,
    attackerHasWingman: false,
    targetHasWingman: false,
    nowMs: 0,
    roll: 0,
    ...overrides,
  };
}

const aura = (patch: Partial<ActiveAura>): ActiveAura => ({
  ...NEUTRAL_AURA,
  ...patch,
});

describe("resolveDiceAttack with faction auras", () => {
  it("omitted auras leave the shot unchanged", () => {
    expect(resolveDiceAttack(shot())).toEqual({
      hit: true,
      damage: 4,
      stressOnTarget: 0,
    });
  });

  it("neutral auras leave the shot unchanged", () => {
    expect(
      resolveDiceAttack(
        shot({ attackerAura: NEUTRAL_AURA, targetAura: NEUTRAL_AURA }),
      ),
    ).toEqual(resolveDiceAttack(shot()));
  });

  it("the attacker's aura damage bonus adds flat damage to a hit", () => {
    expect(
      resolveDiceAttack(shot({ attackerAura: aura({ damageBonus: 1 }) }))
        .damage,
    ).toBe(5);
  });

  it("the attacker's aura adds no damage to a miss", () => {
    expect(
      resolveDiceAttack(
        shot({ roll: 0.99, attackerAura: aura({ damageBonus: 1 }) }),
      ).damage,
    ).toBe(0);
  });

  it("the target's aura multiplies with its own mitigation", () => {
    const result = resolveDiceAttack(
      shot({
        baseDamage: 10,
        target: target({ damageTakenMultiplier: 0.8 }),
        targetAura: aura({ damageTakenMultiplier: 0.8 }),
      }),
    );
    expect(result.damage).toBe(Math.round(10 * 0.64));
  });

  it("aura and card mitigation never go below the stacking floor", () => {
    const result = resolveDiceAttack(
      shot({
        baseDamage: 10,
        target: target({ damageTakenMultiplier: 0.5 }),
        targetAura: aura({ damageTakenMultiplier: 0.5 }),
      }),
    );
    expect(result.damage).toBe(10 * MIN_DAMAGE_TAKEN_MULTIPLIER);
  });

  it("the attacker's aura hit-chance bonus turns a near miss into a hit", () => {
    const nearMiss = shot({ roll: 0.62 });
    expect(resolveDiceAttack(nearMiss).hit).toBe(false);
    expect(
      resolveDiceAttack({
        ...nearMiss,
        attackerAura: aura({ hitChanceBonus: 0.05 }),
      }).hit,
    ).toBe(true);
  });

  it("the aura hit-chance bonus never lowers a mode's odds above the ceiling", () => {
    const sure = shot({
      hitChance: 0.97,
      roll: 0.96,
      attackerAura: aura({ hitChanceBonus: 0.05 }),
    });
    expect(resolveDiceAttack(sure).hit).toBe(true);
  });

  it("the aura hit-chance bonus never makes a shot certain", () => {
    const sure = shot({
      hitChance: 0.95,
      roll: LEVER_HIT_CHANCE_CEILING,
      attackerAura: aura({ hitChanceBonus: 0.1 }),
    });
    expect(resolveDiceAttack(sure).hit).toBe(false);
  });
});

describe("resolveDiceAttack with target armor", () => {
  it("removes the armor from the hit before mitigation", () => {
    const result = resolveDiceAttack(
      shot({
        baseDamage: 6,
        targetArmor: 2,
        target: target({ damageTakenMultiplier: 0.5 }),
      }),
    );
    expect(result.damage).toBe((6 - 2) * 0.5);
  });

  it("never reduces a landed hit below 1", () => {
    expect(
      resolveDiceAttack(shot({ baseDamage: 2, targetArmor: 5 })).damage,
    ).toBe(1);
  });

  it("omitted armor changes nothing", () => {
    expect(resolveDiceAttack(shot({ targetArmor: 0 }))).toEqual(
      resolveDiceAttack(shot()),
    );
  });
});

describe("stressModifiersOf with a faction aura", () => {
  const sheet = combineEffects([{ stressReliefTiers: 1 }]);

  it("omitted aura keeps the sheet's relief", () => {
    expect(stressModifiersOf(sheet).reliefTiers).toBe(1);
  });

  it("adds the aura's stress-relief tiers", () => {
    expect(
      stressModifiersOf(combineEffects([]), aura({ stressReliefTiers: 1 }))
        .reliefTiers,
    ).toBe(1);
  });

  it("caps sheet + aura relief at MAX_STRESS_RELIEF_TIERS", () => {
    expect(
      stressModifiersOf(sheet, aura({ stressReliefTiers: 2 })).reliefTiers,
    ).toBe(MAX_STRESS_RELIEF_TIERS);
  });
});
