/**
 * CampaignLoadoutBonuses — applies the Armory/Research squad bonuses to a
 * freshly spawned player ship: hull/shield caps, attack, evasion, secondary
 * reloads, maneuver recharges, shield regeneration and damage taken (wingmen
 * also get the escort attack bonus). Pure: returns the changed fields.
 */

import type { CampaignShipBonuses } from "../../campaign/armory/bonusTypes";
import type { CombatModifiers } from "../../core/CombatModifiers";
import type { ModeCombatStats } from "../../data/ModeBalancing";

/** The ship fields bonuses change. */
export interface BonusTarget {
  readonly maxHull: number;
  readonly maxShields: number;
  readonly combatStats: ModeCombatStats;
  readonly modifiers: CombatModifiers;
}

/**
 * @param ship - A player ship's current caps, stats and modifiers.
 * @param bonuses - Bonuses in force.
 * @param isFlagship - Whether it is the hero's flagship (no escort bonus).
 * @returns Its caps, stats and modifiers with the bonuses applied.
 */
export function withCampaignBonuses(
  ship: BonusTarget,
  bonuses: CampaignShipBonuses,
  isFlagship: boolean,
): BonusTarget {
  const maxHull = Math.round(ship.maxHull * bonuses.hullMultiplier);
  const maxShields = Math.round(ship.maxShields * bonuses.shieldMultiplier);
  const attack =
    bonuses.attackBonus + (isFlagship ? 0 : bonuses.escortAttackBonus);
  const stats = ship.combatStats;
  return {
    maxHull,
    maxShields,
    combatStats: {
      ...stats,
      hull: maxHull,
      maxHull,
      shields: maxShields,
      maxShields,
      attackDice: stats.attackDice + attack,
      agilityDice: stats.agilityDice + bonuses.agilityBonus,
    },
    modifiers: {
      ...ship.modifiers,
      shieldRegenPerSecond:
        ship.modifiers.shieldRegenPerSecond + bonuses.shieldRegenPerSecond,
      damageTakenMultiplier:
        ship.modifiers.damageTakenMultiplier * bonuses.damageTakenMultiplier,
      ordnanceCooldownMultiplier:
        ship.modifiers.ordnanceCooldownMultiplier *
        bonuses.secondaryReloadMultiplier,
      turretCooldownMultiplier:
        ship.modifiers.turretCooldownMultiplier *
        bonuses.secondaryReloadMultiplier,
      boostCooldownMultiplier:
        ship.modifiers.boostCooldownMultiplier *
        bonuses.maneuverRechargeMultiplier,
      barrelRollCooldownMultiplier:
        ship.modifiers.barrelRollCooldownMultiplier *
        bonuses.maneuverRechargeMultiplier,
      kturnCooldownMultiplier:
        ship.modifiers.kturnCooldownMultiplier *
        bonuses.maneuverRechargeMultiplier,
    },
  };
}
