/**
 * DamageRules — the damage rules every battle mode shares, so a hit means
 * the same thing in Skirmish, the dice modes and every secondary weapon:
 *
 * - Armor: a ship-granted stat (`baseStats.armor`, boss-tier capitals only)
 *   removes a flat amount from every hit, never below
 *   {@link MIN_ARMORED_HIT_DAMAGE}. Upgrade cards never grant armor.
 * - Mitigation: the defender's own cards (damage taken, wingman
 *   protection) times its faction aura, floored at
 *   MIN_DAMAGE_TAKEN_MULTIPLIER — the same product for lasers (via
 *   resolveDiceAttack), ordnance, bombs and turrets.
 * - X-Wing has no "stressed pilots deal less damage" rule: nothing here
 *   penalises a stressed shooter.
 *
 * Pure: no Phaser.
 */

import {
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  type CombatModifiers,
} from "../../core/CombatModifiers";
import { getShipDefinition } from "../../data/ShipDefinitions";
import type { ActiveAura } from "../../systems/SupportAura";
import { incomingDamageMultiplier } from "../ShotConditions";

/** Armor never reduces a landed hit below this much damage. */
export const MIN_ARMORED_HIT_DAMAGE = 1;

/** Armor of a ship without the stat (every fighter). */
const NO_ARMOR = 0;

/**
 * Flat damage a ship's armor removes from every incoming hit.
 *
 * @param definitionId - The ship's definition id.
 * @returns Its armor (0 when it has none or the id is unknown).
 */
export function armorReductionOf(definitionId: string): number {
  const armor = getShipDefinition(definitionId)?.baseStats.armor ?? NO_ARMOR;
  return Math.max(NO_ARMOR, armor);
}

/**
 * A hit's damage after armor.
 *
 * @param damage - Damage of the hit (0 for a miss).
 * @param armor - Flat reduction per hit ({@link armorReductionOf}).
 * @returns The reduced damage: never below {@link MIN_ARMORED_HIT_DAMAGE}
 *   for a landed hit, never more than the hit itself (a miss stays 0).
 */
export function applyArmor(damage: number, armor: number): number {
  if (damage <= 0 || armor <= 0) return damage;
  return Math.max(Math.min(damage, MIN_ARMORED_HIT_DAMAGE), damage - armor);
}

/** Aura inputs of one shot (omitted fields = no aura). */
export interface ShotAuras {
  attackerAura?: ActiveAura;
  targetAura?: ActiveAura;
}

/**
 * The faction auras covering a shot's attacker and target, as
 * resolveDiceAttack takes them (every mode feeds its resolved auras here).
 *
 * @param auras - This frame's resolved auras by ship id.
 * @param attackerId - The firing ship.
 * @param targetId - The ship fired at.
 * @returns The auras covering each, omitted when none.
 */
export function shotAurasOf(
  auras: ReadonlyMap<string, ActiveAura>,
  attackerId: string,
  targetId: string,
): ShotAuras {
  const attackerAura = auras.get(attackerId);
  const targetAura = auras.get(targetId);
  return {
    ...(attackerAura ? { attackerAura } : {}),
    ...(targetAura ? { targetAura } : {}),
  };
}

/**
 * Multiplier on every hit a ship takes: its own cards (damage taken, and
 * wingman protection while a friendly flies near) times the faction aura
 * covering it, floored so stacking never makes a ship invulnerable.
 *
 * @param targetModifiers - The defender's modifier sheet.
 * @param targetHasWingman - Whether a friendly flies within wingman range.
 * @param targetAura - The aura covering the defender (omitted = none).
 * @returns The damage multiplier (1 = no mitigation).
 */
export function damageMitigationOf(
  targetModifiers: CombatModifiers,
  targetHasWingman: boolean,
  targetAura?: ActiveAura,
): number {
  const aura = targetAura?.damageTakenMultiplier ?? 1;
  return Math.max(
    MIN_DAMAGE_TAKEN_MULTIPLIER,
    aura * incomingDamageMultiplier(targetModifiers, targetHasWingman),
  );
}
