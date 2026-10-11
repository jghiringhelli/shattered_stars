/**
 * CampaignDurability — Campaign's hit-point rules on the real-time scale.
 *
 * Pilot evolution bonuses are earned in miniature hull/shield points, so
 * they are multiplied by DURABILITY_SCALE once. Ace and boss multipliers
 * apply to stats that are already scaled (getModeCombatStats + loadout), so
 * they are NOT scaled again; a boss's capital systems split its final hull.
 */

import { DURABILITY_SCALE } from "../../config";

/** Ace enemies fly with this much of their equipped hull. */
export const ACE_HULL_MULTIPLIER = 1.5;
/** Extra attack dice an ace rolls. */
export const ACE_ATTACK_BONUS = 1;
/** Boss enemies fly with this much of their equipped hull... */
export const BOSS_HULL_MULTIPLIER = 3;
/** ...and this much of their equipped shields. */
export const BOSS_SHIELD_MULTIPLIER = 2;
/** Extra attack dice a boss rolls. */
export const BOSS_ATTACK_BONUS = 2;

/** A ship's durability caps. */
export interface DurabilityCaps {
  readonly maxHull: number;
  readonly maxShields: number;
}

/** A pilot's evolution stat bonuses (miniature points; any may be absent). */
export interface EvolutionDurabilityBonuses {
  readonly hull?: number | undefined;
  readonly shields?: number | undefined;
}

/**
 * @param equipped - The flagship's equipped (already scaled) caps.
 * @param bonuses - The protagonist's evolution bonuses (miniature points).
 * @returns The caps with the bonuses added in real-time hit points.
 */
export function withEvolutionBonuses(
  equipped: DurabilityCaps,
  bonuses: EvolutionDurabilityBonuses,
): DurabilityCaps {
  return {
    maxHull: equipped.maxHull + (bonuses.hull ?? 0) * DURABILITY_SCALE,
    maxShields: equipped.maxShields + (bonuses.shields ?? 0) * DURABILITY_SCALE,
  };
}

/**
 * @param equipped - The ace's equipped (already scaled) caps.
 * @returns Its ace caps.
 */
export function aceDurability(equipped: DurabilityCaps): DurabilityCaps {
  return {
    maxHull: Math.floor(equipped.maxHull * ACE_HULL_MULTIPLIER),
    maxShields: equipped.maxShields,
  };
}

/**
 * @param equipped - The boss's equipped (already scaled, ace-adjusted) caps.
 * @returns Its boss caps.
 */
export function bossDurability(equipped: DurabilityCaps): DurabilityCaps {
  return {
    maxHull: Math.floor(equipped.maxHull * BOSS_HULL_MULTIPLIER),
    maxShields: Math.floor(equipped.maxShields * BOSS_SHIELD_MULTIPLIER),
  };
}
