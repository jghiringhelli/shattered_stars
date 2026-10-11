/**
 * EpicRaidCombat — specification tests for quick builds fighting the Boss
 * Raid capital ship: laser bonuses against the boss's armor and mitigation
 * of boss-ability damage.
 */

import { describe, it, expect } from "vitest";
import { CYCLE_DURATION_MS } from "../../../../src/config";
import { getModeCombatStats } from "../../../../src/data/ModeBalancing";
import { bossBroadsideDamage } from "../../../../src/systems/EpicBossRules";
import {
  BOSS_ABILITY_BASE_MS,
  BOSS_SHIELD_REGEN_POINTS,
} from "../../../../src/scenes/epicRaid/bossDefinitions";
import {
  BOSS_DAMAGE_SCALE,
  BOSS_HP_SCALE,
  BOSS_REGEN_SCALE,
  BOSS_TEMPO_SCALE,
  bossDamagePoints,
  bossDurability,
  bossRegenPoints,
  bossTempoMs,
  RAID_CLOCK_MS,
  MIN_BOSS_HIT_DAMAGE,
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
import {
  SQUAD_MARK_DAMAGE_BONUS,
  SQUAD_MARK_HIT_BONUS,
} from "../../../../src/arcade/systems/SquadMark";

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

describe("resolveBossShot — the boss as a marked target", () => {
  it("adds the squad mark's damage bonus before the armor", () => {
    expect(resolveBossShot(shot({ targetMarked: true }))).toBe(
      2 + SQUAD_MARK_DAMAGE_BONUS,
    );
  });

  it("raises the hit chance by the squad mark's bonus", () => {
    const roll = 0.4 + SQUAD_MARK_HIT_BONUS / 2;
    expect(resolveBossShot(shot({ hitChance: 0.4, roll }))).toBe(0);
    expect(
      resolveBossShot(shot({ hitChance: 0.4, roll, targetMarked: true })),
    ).toBeGreaterThan(0);
  });

  it("an unmarked boss keeps the bare dice odds (no position lever)", () => {
    expect(resolveBossShot(shot({ hitChance: 0.4, roll: 0.39 }))).toBe(2);
    expect(resolveBossShot(shot({ targetMarked: false }))).toBe(2);
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

describe("raid scales (decoupled from DURABILITY_SCALE)", () => {
  it("scales a boss pool by the difficulty, then by BOSS_HP_SCALE", () => {
    expect(bossDurability(90, 1)).toBe(90 * BOSS_HP_SCALE);
    expect(bossDurability(90, 1.5)).toBe(135 * BOSS_HP_SCALE);
  });

  it("floors the difficulty-scaled catalogue points before scaling", () => {
    expect(bossDurability(25, 0.75)).toBe(18 * BOSS_HP_SCALE);
  });

  it("scales broadside damage, shield regeneration and timers by their own scales", () => {
    expect(bossDamagePoints(3)).toBe(3 * BOSS_DAMAGE_SCALE);
    expect(bossRegenPoints(10)).toBe(10 * BOSS_REGEN_SCALE);
    expect(bossTempoMs(8_000)).toBe(8_000 * BOSS_TEMPO_SCALE);
  });

  it("gives a raid twelve minutes", () => {
    expect(RAID_CLOCK_MS).toBe(12 * 60_000);
  });
});

describe("raid calibration invariants", () => {
  const lightFighter = getModeCombatStats("confed_sparrow", "continuous");
  const lightFighterHp = lightFighter.maxHull + lightFighter.maxShields;

  it("a broadside hurts a full-health light fighter badly but never one-shots it", () => {
    const phase1 = bossDamagePoints(bossBroadsideDamage(1));
    const phase3 = bossDamagePoints(bossBroadsideDamage(3));
    expect(phase1 / lightFighterHp).toBeGreaterThanOrEqual(0.25);
    expect(phase3).toBeLessThan(lightFighterHp);
  });

  it("shield regeneration is slower than one ship landing a floor-damage hit every cycle", () => {
    const regenPerSecond =
      bossRegenPoints(BOSS_SHIELD_REGEN_POINTS) /
      (bossTempoMs(BOSS_ABILITY_BASE_MS.shieldRegen) / 1000);
    const oneShipFloorDps = MIN_BOSS_HIT_DAMAGE / (CYCLE_DURATION_MS / 1000);
    expect(regenPerSecond).toBeLessThan(oneShipFloorDps / 2);
  });

  it("the boss acts at most every few seconds, well inside the raid clock", () => {
    expect(bossTempoMs(BOSS_ABILITY_BASE_MS.tick)).toBeGreaterThanOrEqual(
      10_000,
    );
    expect(bossTempoMs(BOSS_ABILITY_BASE_MS.tick)).toBeLessThanOrEqual(30_000);
  });
});
