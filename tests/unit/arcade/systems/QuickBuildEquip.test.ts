/**
 * QuickBuildEquip + DiceAttack — specification tests for equipping quick
 * builds in every mode and resolving dice-mode shots with equipment.
 */

import { describe, it, expect } from "vitest";
import {
  assignQuickBuilds,
  equipFlight,
  equipQuickBuild,
  regenerateShields,
  stressModifiersOf,
} from "../../../../src/arcade/systems/QuickBuildEquip";
import {
  absorbDamage,
  resolveDiceAttack,
  type DiceAttackInput,
} from "../../../../src/arcade/systems/DiceAttack";
import { createCycleFlight } from "../../../../src/arcade/systems/CycleFlight";
import { resolveLoadoutModifiers } from "../../../../src/arcade/ArcadeUpgradeEffects";
import { uniquePilotOf } from "../../../../src/data/squadRules";
import {
  combineEffects,
  NEUTRAL_MODIFIERS,
  type RealtimeEffect,
} from "../../../../src/core/CombatModifiers";
import { INITIAL_STRESS } from "../../../../src/arcade/ArcadeStress";
import type { AbilityCombatant } from "../../../../src/arcade/PilotAbilityCombat";
import {
  HEAD_ON_HIT_PENALTY,
  NO_SHOT_LEVERS,
  REAR_ARC_DAMAGE_BONUS,
  REAR_ARC_HIT_BONUS,
} from "../../../../src/arcade/ShotLevers";
import {
  SQUAD_MARK_DAMAGE_BONUS,
  SQUAD_MARK_HIT_BONUS,
} from "../../../../src/arcade/systems/SquadMark";

/** corsair_fang's first quick build is flown by a unique ace (Poison Fang). */
const FANG = "corsair_fang";

describe("assignQuickBuilds", () => {
  it("keeps a chosen loadout", () => {
    expect(assignQuickBuilds([FANG], ["fang_swarm"])).toEqual(["fang_swarm"]);
  });

  it("never fields the same unique ace twice", () => {
    const [first, second] = assignQuickBuilds([FANG, FANG]);
    expect(uniquePilotOf(first!)).not.toBeNull();
    expect(uniquePilotOf(second!)).not.toBe(uniquePilotOf(first!));
  });

  it("a chosen ace is not handed out again by default", () => {
    const [byDefault] = assignQuickBuilds([FANG, FANG], [null, "fang_raider"]);
    expect(byDefault).not.toBe("fang_raider");
  });

  it("a ship without quick builds flies bare", () => {
    expect(assignQuickBuilds(["no_such_ship"])).toEqual([null]);
  });
});

describe("equipQuickBuild", () => {
  it("returns the loadout's full modifier sheet", () => {
    const ship = {
      definitionId: FANG,
      hull: 3,
      maxHull: 3,
      shields: 1,
      maxShields: 1,
    };
    expect(equipQuickBuild(ship, "fang_raider")).toEqual(
      resolveLoadoutModifiers(FANG, "fang_raider"),
    );
  });

  it("a bare hull is neutral and keeps its stats", () => {
    const ship = {
      definitionId: FANG,
      hull: 3,
      maxHull: 3,
      shields: 1,
      maxShields: 1,
    };
    expect(equipQuickBuild(ship, null)).toEqual(NEUTRAL_MODIFIERS);
    expect(ship).toMatchObject({ hull: 3, shields: 1 });
  });
});

describe("equipFlight / stressModifiersOf / regenerateShields", () => {
  const sheet = combineEffects([
    {
      boostCooldownMultiplier: 0.5,
      maxSpeedBonus: 1,
      stressReliefTiers: 1,
      stressRateMultiplier: 0.8,
      shieldRegenPerSecond: 0.5,
    },
  ]);

  it("equipFlight speeds the boost recharge and raises top speed", () => {
    const bare = createCycleFlight("terran_viper", { x: 0, y: 0, angle: 0 });
    const equipped = equipFlight(bare, sheet);
    expect(equipped.motion.control.boostCooldownMax).toBe(
      bare.motion.control.boostCooldownMax * 0.5,
    );
    expect(equipped.motion.control.maxSpeed).toBe(
      bare.motion.control.maxSpeed + 1,
    );
  });

  it("stressModifiersOf carries relief tiers and stress rate", () => {
    expect(stressModifiersOf(sheet)).toEqual({
      reliefTiers: 1,
      rateMultiplier: 0.8,
    });
  });

  it("regenerateShields adds the per-second rate in real-time HP, capped", () => {
    expect(regenerateShields(4, 12, sheet, 1000)).toBeCloseTo(4 + 0.5);
    expect(regenerateShields(12, 12, sheet, 1000)).toBe(12);
    expect(regenerateShields(4, 12, NEUTRAL_MODIFIERS, 1000)).toBe(4);
  });
});

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

/**
 * Target 300 px ahead of the attacker, flying across its nose (the attacker
 * sits on its beam: no rear-arc or head-on lever applies).
 */
const ahead = (
  effect: RealtimeEffect = {},
  overrides: Partial<AbilityCombatant> = {},
) => combatant(effect, { id: "t", y: 700, angle: 90, ...overrides });

/** The same target flying away from the attacker (attacker on its tail). */
const fleeing = (effect: RealtimeEffect = {}) => ahead(effect, { angle: 0 });

/** The same target flying straight at the attacker (head-on). */
const oncoming = (effect: RealtimeEffect = {}) => ahead(effect, { angle: 180 });

function shot(overrides: Partial<DiceAttackInput>): DiceAttackInput {
  return {
    attacker: combatant({}),
    target: ahead(),
    hitChance: 0.6,
    baseDamage: 2,
    attackerHasWingman: false,
    targetHasWingman: false,
    nowMs: 0,
    roll: 0,
    ...overrides,
  };
}

describe("resolveDiceAttack", () => {
  it("misses when the roll is not under the hit chance", () => {
    expect(resolveDiceAttack(shot({ roll: 0.6 }))).toEqual({
      hit: false,
      damage: 0,
      stressOnTarget: 0,
    });
  });

  it("a bare attacker deals the dice damage", () => {
    expect(resolveDiceAttack(shot({})).damage).toBe(2);
  });

  it("adds the flat laser bonus", () => {
    expect(
      resolveDiceAttack(shot({ attacker: combatant({ laserDamageBonus: 1 }) }))
        .damage,
    ).toBe(3);
  });

  it("the calm bonus only applies to an unstressed pilot", () => {
    const calm = combatant({ calmLaserDamageBonus: 1 });
    const stressed = combatant(
      { calmLaserDamageBonus: 1 },
      { stress: { level: 0.9, isStressed: true } },
    );
    expect(resolveDiceAttack(shot({ attacker: calm })).damage).toBe(3);
    expect(resolveDiceAttack(shot({ attacker: stressed })).damage).toBe(2);
  });

  it("the unshielded bonus only applies once the target's shields are down", () => {
    const marksman = combatant({ bonusDamageVsUnshielded: 1 });
    expect(resolveDiceAttack(shot({ attacker: marksman })).damage).toBe(2);
    expect(
      resolveDiceAttack(
        shot({ attacker: marksman, target: ahead({}, { shields: 0 }) }),
      ).damage,
    ).toBe(3);
  });

  it("a rear-arc ability pays when shooting from behind", () => {
    expect(
      resolveDiceAttack(
        shot({
          attacker: combatant({ rearArcLaserBonus: 1 }),
          target: fleeing(),
          levers: NO_SHOT_LEVERS,
        }),
      ).damage,
    ).toBe(3);
  });

  it("the rear-arc lever adds odds and damage from the target's tail", () => {
    const fromTail = shot({
      target: fleeing(),
      roll: 0.6 + REAR_ARC_HIT_BONUS / 2,
    });
    expect(resolveDiceAttack(fromTail)).toMatchObject({
      hit: true,
      damage: 2 + REAR_ARC_DAMAGE_BONUS,
    });
  });

  it("the head-on lever lowers the odds of a joust", () => {
    const joust = shot({
      target: oncoming(),
      roll: 0.6 - HEAD_ON_HIT_PENALTY / 2,
    });
    expect(resolveDiceAttack(joust).hit).toBe(false);
    expect(resolveDiceAttack({ ...joust, target: ahead() }).hit).toBe(true);
  });

  it("the squad mark adds odds and damage only when the target is marked", () => {
    const marked = shot({
      targetMarked: true,
      roll: 0.6 + SQUAD_MARK_HIT_BONUS / 2,
    });
    expect(resolveDiceAttack(marked)).toMatchObject({
      hit: true,
      damage: 2 + SQUAD_MARK_DAMAGE_BONUS,
    });
    expect(resolveDiceAttack({ ...marked, targetMarked: false }).hit).toBe(
      false,
    );
  });

  it("omitted lever fields keep the old contract on a neutral shot", () => {
    expect(resolveDiceAttack(shot({ roll: 0.59 }))).toEqual({
      hit: true,
      damage: 2,
      stressOnTarget: 0,
    });
  });

  it("the target's wingman protection mitigates", () => {
    const guarded = ahead({ wingmanDamageTakenMultiplier: 0.5 });
    expect(
      resolveDiceAttack(
        shot({ baseDamage: 4, target: guarded, targetHasWingman: true }),
      ).damage,
    ).toBe(2);
  });

  it("carries the attacker's stress on hit", () => {
    expect(
      resolveDiceAttack(shot({ attacker: combatant({ stressOnHit: 0.1 }) }))
        .stressOnTarget,
    ).toBe(0.1);
  });
});

describe("absorbDamage", () => {
  it("shields soak damage first", () => {
    expect(absorbDamage({ shields: 2, hull: 3 }, 1)).toEqual({
      shields: 1,
      hull: 3,
    });
  });

  it("the overflow reaches the hull", () => {
    expect(absorbDamage({ shields: 1, hull: 3 }, 3)).toEqual({
      shields: 0,
      hull: 1,
    });
  });

  it("hull never goes below zero", () => {
    expect(absorbDamage({ shields: 0, hull: 1 }, 5)).toEqual({
      shields: 0,
      hull: 0,
    });
  });
});
