/**
 * abilityPricing — the point value of a pilot ability, derived from its
 * real-time effect with the catalog's price rule (docs/specs/
 * upgrades-and-slots.md): +1 laser damage = 5, 15% less damage taken ≈ 5,
 * 40% faster recharge on one action = 3, aura projection = 4. Conditional
 * bonuses are worth less than unconditional ones, by how often they hold.
 *
 * Pure: no state.
 */

import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
  type RealtimeEffect,
} from "../core/CombatModifiers";

/** Points per unit of an additive knob. */
const ADDITIVE_POINTS: Partial<Record<keyof CombatModifiers, number>> = {
  laserDamageBonus: 5,
  calmLaserDamageBonus: 4,
  bonusDamageVsUnshielded: 3,
  closeRangeLaserBonus: 3,
  rearArcLaserBonus: 3,
  bullseyeLaserBonus: 2,
  wingmanLaserBonus: 3,
  stressedLaserBonus: 2,
  damagedLaserBonus: 2,
  killFrenzyLaserBonus: 3,
  shieldsPerKill: 3,
  shieldRegenPerSecond: 20,
  stressReliefTiers: 3,
  ordnanceBonusCharges: 3,
  stressOnHit: 30,
  cloakDurationBonus: 1.5,
  auraRadiusBonus: 8,
  maxSpeedBonus: 4,
  deathBlastDamage: 1.5,
};

/** Points per unit of reduction (1 − multiplier) of a multiplicative knob. */
const REDUCTION_POINTS: Partial<Record<keyof CombatModifiers, number>> = {
  damageTakenMultiplier: 35,
  wingmanDamageTakenMultiplier: 20,
  stressRateMultiplier: 10,
  boostCooldownMultiplier: 7.5,
  barrelRollCooldownMultiplier: 7.5,
  kturnCooldownMultiplier: 7.5,
  ordnanceCooldownMultiplier: 7.5,
  turretCooldownMultiplier: 7.5,
};

/** Points for projecting the faction aura. */
const AURA_POINTS = 4;

/** Every ability is worth at least this much. */
const MIN_ABILITY_POINTS = 1;

/**
 * Point value of a real-time effect. Drawbacks (a multiplier above 1)
 * subtract.
 *
 * @param effect - The ability's real-time effect.
 * @returns Whole points, at least {@link MIN_ABILITY_POINTS}.
 */
export function abilityPointValue(effect: RealtimeEffect): number {
  let points = effect.projectsAura ? AURA_POINTS : 0;
  for (const [key, perUnit] of Object.entries(ADDITIVE_POINTS)) {
    const value = effect[key as keyof CombatModifiers];
    if (typeof value === "number") points += value * perUnit;
  }
  for (const [key, perUnit] of Object.entries(REDUCTION_POINTS)) {
    const value = effect[key as keyof CombatModifiers];
    const neutral = NEUTRAL_MODIFIERS[key as keyof CombatModifiers] as number;
    if (typeof value === "number") points += (neutral - value) * perUnit;
  }
  return Math.max(MIN_ABILITY_POINTS, Math.round(points));
}
