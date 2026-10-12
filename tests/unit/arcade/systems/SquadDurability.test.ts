/**
 * Durability scaling in Survival and Campaign — specification: hit points
 * authored in miniature points (drafted run bonuses, belt damage, pilot
 * evolutions) are scaled to real-time HP exactly once; elite / ace / boss
 * multipliers act on already-scaled stats and are never scaled again.
 */

import { describe, it, expect } from "vitest";
import { DURABILITY_SCALE } from "../../../../src/config";
import {
  BOSS_BASE_MULTIPLIER,
  ELITE_HULL_MULTIPLIER,
  bossDurability as survivalBoss,
  bossMultiplier,
  eliteMaxHull,
  realTimeBeltDamage,
  realTimeRunBonuses,
  WAVES_PER_BOSS_STEP,
} from "../../../../src/arcade/systems/SurvivalDurability";
import {
  ACE_HULL_MULTIPLIER,
  BOSS_HULL_MULTIPLIER,
  BOSS_SHIELD_MULTIPLIER,
  aceDurability,
  bossDurability as campaignBoss,
  withEvolutionBonuses,
} from "../../../../src/arcade/systems/CampaignDurability";
import { getModeCombatStats } from "../../../../src/data/ModeBalancing";

describe("Survival run bonuses", () => {
  it("a drafted +4 hull adds four miniature hull points of real-time HP", () => {
    const real = realTimeRunBonuses({
      maxHull: 4,
      maxShields: 0,
      shieldRegen: 0,
    });
    expect(real.maxHull).toBe(4 * DURABILITY_SCALE);
  });

  it("drafted shields scale like hull", () => {
    const real = realTimeRunBonuses({
      maxHull: 0,
      maxShields: 2,
      shieldRegen: 0,
    });
    expect(real.maxShields).toBe(2 * DURABILITY_SCALE);
  });

  it("shield regen keeps its weight against scaled shields", () => {
    const real = realTimeRunBonuses({
      maxHull: 0,
      maxShields: 0,
      shieldRegen: 0.5,
    });
    expect(real.shieldRegenPerSecond).toBe(0.5 * DURABILITY_SCALE);
  });

  it("a hull bonus keeps its share of a starter's hull", () => {
    const starter = getModeCombatStats("confed_sparrow", "survival");
    const miniature = getModeCombatStats("confed_sparrow", "survival", 1);
    const bonus = realTimeRunBonuses({
      maxHull: 2,
      maxShields: 0,
      shieldRegen: 0,
    });
    expect(bonus.maxHull / starter.maxHull).toBeCloseTo(2 / miniature.maxHull);
  });
});

describe("Survival belt", () => {
  it("belt damage bites scaled hulls as hard as it bit miniature hulls", () => {
    expect(realTimeBeltDamage(1.5)).toBe(1.5 * DURABILITY_SCALE);
  });
});

describe("Survival elites and bosses", () => {
  it("an elite's hull is its equipped hull times the elite multiplier, once", () => {
    const equipped = getModeCombatStats("terran_viper", "survival").maxHull;
    expect(eliteMaxHull(equipped)).toBe(
      Math.floor(equipped * ELITE_HULL_MULTIPLIER),
    );
  });

  it("the roguelite's three sector bosses (waves 5/10/15) fly their equipped hull; a step every 20 waves", () => {
    expect(bossMultiplier(5)).toBe(1);
    expect(bossMultiplier(10)).toBe(1);
    expect(bossMultiplier(15)).toBe(1);
    expect(bossMultiplier(WAVES_PER_BOSS_STEP)).toBe(BOSS_BASE_MULTIPLIER + 1);
  });

  it("a boss multiplies already-scaled hull and shields (no double scaling)", () => {
    const caps = survivalBoss({ maxHull: 16, maxShields: 8 }, 20);
    expect(caps).toEqual({
      maxHull: 16 * bossMultiplier(20),
      maxShields: 8 * bossMultiplier(20),
    });
    expect(bossMultiplier(20)).toBe(2);
  });
});

describe("Campaign evolutions, aces and bosses", () => {
  it("evolution hull/shield bonuses are miniature points, scaled once", () => {
    const caps = withEvolutionBonuses(
      { maxHull: 8, maxShields: 4 },
      { hull: 1, shields: 2 },
    );
    expect(caps).toEqual({
      maxHull: 8 + DURABILITY_SCALE,
      maxShields: 4 + 2 * DURABILITY_SCALE,
    });
  });

  it("missing evolution bonuses add nothing", () => {
    expect(withEvolutionBonuses({ maxHull: 8, maxShields: 4 }, {})).toEqual({
      maxHull: 8,
      maxShields: 4,
    });
  });

  it("an ace multiplies already-scaled hull and keeps its shields", () => {
    expect(aceDurability({ maxHull: 8, maxShields: 4 })).toEqual({
      maxHull: Math.floor(8 * ACE_HULL_MULTIPLIER),
      maxShields: 4,
    });
  });

  it("a boss multiplies already-scaled hull and shields", () => {
    expect(campaignBoss({ maxHull: 8, maxShields: 4 })).toEqual({
      maxHull: 8 * BOSS_HULL_MULTIPLIER,
      maxShields: 4 * BOSS_SHIELD_MULTIPLIER,
    });
  });
});
