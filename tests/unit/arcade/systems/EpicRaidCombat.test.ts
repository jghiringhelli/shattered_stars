/**
 * EpicRaidCombat — specification tests for quick builds fighting the Boss
 * Raid capital ship: laser bonuses against the boss's armor and mitigation
 * of boss-ability damage.
 */

import { describe, it, expect } from "vitest";
import {
  mitigateBossDamage,
  resolveBossShot,
  type BossShotInput,
  type BossTarget,
} from "../../../../src/arcade/systems/EpicRaidCombat";
import {
  combineEffects,
  NEUTRAL_MODIFIERS,
  type RealtimeEffect,
} from "../../../../src/core/CombatModifiers";
import { INITIAL_STRESS } from "../../../../src/arcade/ArcadeStress";
import type { AbilityCombatant } from "../../../../src/arcade/PilotAbilityCombat";
import { CLOSE_RANGE_PX } from "../../../../src/arcade/ShotConditions";

const BOSS: BossTarget = { x: 0, y: 0, angle: 180, shields: 10, armor: 3 };

/** An attacker far from the boss (beyond range 1) with the given equipment. */
function attackerWith(effect: RealtimeEffect = {}): AbilityCombatant {
  return {
    id: "a",
    x: 0,
    y: CLOSE_RANGE_PX * 3,
    angle: 90,
    hull: 5,
    maxHull: 5,
    shields: 2,
    maxShields: 2,
    stress: INITIAL_STRESS,
    modifiers: combineEffects([effect]),
    frenzyUntilMs: 0,
  };
}

/** A sure-hit shot of 5 base damage with the given overrides. */
function shot(overrides: Partial<BossShotInput> = {}): BossShotInput {
  return {
    attacker: attackerWith(),
    boss: BOSS,
    hitChance: 1,
    baseDamage: 5,
    attackerHasWingman: false,
    nowMs: 0,
    roll: 0,
    ...overrides,
  };
}

describe("resolveBossShot", () => {
  it("a roll at or above the hit chance misses", () => {
    expect(resolveBossShot(shot({ hitChance: 0.4, roll: 0.4 }))).toBe(0);
  });

  it("a bare hull deals its dice damage minus the boss's armor", () => {
    expect(resolveBossShot(shot())).toBe(2);
  });

  it("armor never reduces a hit below one point", () => {
    expect(resolveBossShot(shot({ baseDamage: 1 }))).toBe(1);
  });

  it("adds the attacker's flat laser bonus", () => {
    const attacker = attackerWith({ laserDamageBonus: 2 });
    expect(resolveBossShot(shot({ attacker }))).toBe(4);
  });

  it("adds the bonus vs unshielded only once the boss's shields are down", () => {
    const attacker = attackerWith({ bonusDamageVsUnshielded: 2 });
    expect(resolveBossShot(shot({ attacker }))).toBe(2);
    const exposed = { ...BOSS, shields: 0 };
    expect(resolveBossShot(shot({ attacker, boss: exposed }))).toBe(4);
  });

  it("judges a range-1 ability against the boss's position", () => {
    const far = attackerWith({ closeRangeLaserBonus: 2 });
    const close = { ...far, y: CLOSE_RANGE_PX / 2 };
    expect(resolveBossShot(shot({ attacker: far }))).toBe(2);
    expect(resolveBossShot(shot({ attacker: close }))).toBe(4);
  });

  it("adds a wingman bonus only with a wingman near", () => {
    const attacker = attackerWith({ wingmanLaserBonus: 1 });
    expect(resolveBossShot(shot({ attacker }))).toBe(2);
    expect(resolveBossShot(shot({ attacker, attackerHasWingman: true }))).toBe(
      3,
    );
  });
});

describe("mitigateBossDamage", () => {
  it("a bare hull takes the full damage", () => {
    expect(mitigateBossDamage(6, NEUTRAL_MODIFIERS, false)).toBe(6);
  });

  it("damage reduction scales the hit", () => {
    const sheet = combineEffects([{ damageTakenMultiplier: 0.5 }]);
    expect(mitigateBossDamage(6, sheet, false)).toBe(3);
  });

  it("wingman protection applies only with an ally near", () => {
    const sheet = combineEffects([{ wingmanDamageTakenMultiplier: 0.5 }]);
    expect(mitigateBossDamage(6, sheet, false)).toBe(6);
    expect(mitigateBossDamage(6, sheet, true)).toBe(3);
  });

  it("a mitigated hit still deals at least one point", () => {
    const sheet = combineEffects([{ damageTakenMultiplier: 0.5 }]);
    expect(mitigateBossDamage(1, sheet, false)).toBe(1);
  });

  it("no damage stays no damage", () => {
    expect(mitigateBossDamage(0, NEUTRAL_MODIFIERS, false)).toBe(0);
  });
});
