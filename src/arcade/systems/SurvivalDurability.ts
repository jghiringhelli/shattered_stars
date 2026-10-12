/**
 * SurvivalDurability — Survival's hit-point rules on the real-time scale.
 *
 * Drafted run bonuses (hull, shields, shield regen) and the asteroid belt
 * are authored in miniature points, so they are multiplied by
 * DURABILITY_SCALE once to keep their weight against x4 hulls. Elite and
 * boss multipliers apply to stats that are already scaled (getModeCombatStats
 * + loadout), so they are NOT scaled again.
 */

import { DURABILITY_SCALE } from "../../config";

/** Elite wave ships fly with this much of their equipped hull. */
export const ELITE_HULL_MULTIPLIER = 1.5;

/** Boss stat multiplier before its per-boss-wave growth. */
export const BOSS_BASE_MULTIPLIER = 1;

/**
 * Waves per extra boss multiplier step. Roguelite bosses use a boss wave of
 * sector × 5 (CombatNodePlan.bossWave), so all three sector bosses fly their
 * equipped hull (×1): ×3/×4/×5 bosses (and even ×2/×3 ones) were walls for
 * an average-tier 2-ship wing (ADR-0004 sweep). Bosses stand out through
 * their gunship hull, pilot tier, capital systems and phases instead.
 */
export const WAVES_PER_BOSS_STEP = 20;

/** A ship's durability caps. */
export interface DurabilityCaps {
  readonly maxHull: number;
  readonly maxShields: number;
}

/** The drafted run bonuses that add hit points (miniature points). */
export interface RunDurabilityBonuses {
  readonly maxHull: number;
  readonly maxShields: number;
  /** Shield points regenerated per second. */
  readonly shieldRegen: number;
}

/** Run bonuses converted to real-time hit points. */
export interface RealTimeRunBonuses {
  readonly maxHull: number;
  readonly maxShields: number;
  readonly shieldRegenPerSecond: number;
}

/**
 * @param bonuses - The run's drafted bonuses (miniature points).
 * @returns The same bonuses in real-time hit points.
 */
export function realTimeRunBonuses(
  bonuses: RunDurabilityBonuses,
): RealTimeRunBonuses {
  return {
    maxHull: bonuses.maxHull * DURABILITY_SCALE,
    maxShields: bonuses.maxShields * DURABILITY_SCALE,
    shieldRegenPerSecond: bonuses.shieldRegen * DURABILITY_SCALE,
  };
}

/**
 * @param miniatureDamage - Belt damage for a frame in miniature points.
 * @returns The damage in real-time hit points.
 */
export function realTimeBeltDamage(miniatureDamage: number): number {
  return miniatureDamage * DURABILITY_SCALE;
}

/**
 * @param equippedMaxHull - The elite's equipped (already scaled) hull.
 * @returns Its elite hull.
 */
export function eliteMaxHull(equippedMaxHull: number): number {
  return Math.floor(equippedMaxHull * ELITE_HULL_MULTIPLIER);
}

/**
 * @param wave - The boss wave number (roguelite: sector × 5).
 * @returns How many times its equipped stats a boss gets.
 */
export function bossMultiplier(wave: number): number {
  return BOSS_BASE_MULTIPLIER + Math.floor(wave / WAVES_PER_BOSS_STEP);
}

/**
 * @param equipped - The boss's equipped (already scaled) caps.
 * @param wave - The boss wave number (roguelite: sector × 5).
 * @returns Its boss caps.
 */
export function bossDurability(
  equipped: DurabilityCaps,
  wave: number,
): DurabilityCaps {
  const multiplier = bossMultiplier(wave);
  return {
    maxHull: equipped.maxHull * multiplier,
    maxShields: equipped.maxShields * multiplier,
  };
}
