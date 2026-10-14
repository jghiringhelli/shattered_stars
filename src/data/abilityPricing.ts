/**
 * abilityPricing — the ONE price scale of the game's equipment: an upgrade
 * card and a pilot ability with the same real-time effect cost the same.
 *
 * Calibrated with the real engine (2026-10-12): the skill arena flies two
 * identical hulls (Gladius, Viper, Falcon) at the Normal tier, one with the
 * effect and one without, 600 battles per effect on fixed seeds, both
 * seatings. Win odds convert to points at 0.285 logit per point — the slope
 * the two anchors share (+1 shield token = 4, +1 laser damage = 5).
 * Bots barely use boost / barrel roll / Snap turn recharges (they measure ~0),
 * so those are priced low for human play. Conditional bonuses are worth less
 * than unconditional ones, by how often they hold. Repair is real-time HP/s.
 *
 * Pure: no state.
 */

import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
  type RealtimeEffect,
} from "../core/CombatModifiers";
import type { UpgradeDefinition } from "../core/upgradeTypes";

/** Points per +1 hull or +1 shield token (measured equal: shields spill). */
export const STAT_TOKEN_POINTS = 4;

/** Points per unit of an additive knob. */
const ADDITIVE_POINTS: Partial<Record<keyof CombatModifiers, number>> = {
  laserDamageBonus: 5,
  calmLaserDamageBonus: 4,
  bonusDamageVsUnshielded: 3,
  closeRangeLaserBonus: 1.2,
  rearArcLaserBonus: 1.3,
  bullseyeLaserBonus: 0.8,
  // Wingman and kill-frenzy bonuses only hold in squads (1v1 reads 0).
  wingmanLaserBonus: 2,
  stressedLaserBonus: 1.6,
  damagedLaserBonus: 2.7,
  killFrenzyLaserBonus: 2,
  // Real-time HP: per HP restored on a kill, per HP/s of regen / repair.
  shieldsPerKill: 0.25,
  // Shield regen re-measured in 4-ship squads (2026-10-12, every faction's
  // auto-fill list in a mirror, 400 battles per rate, calibrated on +1
  // shield token = 4): 0.12 HP/s = 0.9 pts, 0.24 = 1.6, 0.48 = 2.4 per
  // ship. The old 34 came from pre-fix 1v1 duels, where a duelist's slow
  // fire let regen out-heal it.
  shieldRegenPerSecond: 7,
  hullRepairPerSecond: 5.5,
  // Ally regen from one projector (same mirror): 0.24 HP/s = 0.9 squad pts.
  auraShieldRegenPerSecond: 4,
  stressReliefTiers: 1.5,
  ordnanceBonusCharges: 2,
  homingTurnBonus: 0.005,
  stressOnHit: 13,
  cloakDurationBonus: 0.25,
  // Ally knobs, measured in 3v3 (one projector, two allies): projecting the
  // faction aura with a 25% wider radius is worth about half a shield token.
  auraRadiusBonus: 2,
  auraMagnitudeBonus: 2,
  auraStressReliefTiers: 1.5,
  auraHitChanceBonus: 10,
  maxSpeedBonus: 4,
  deathBlastDamage: 1.5,
};

/** Points per unit of reduction (1 − multiplier) of a multiplicative knob. */
const REDUCTION_POINTS: Partial<Record<keyof CombatModifiers, number>> = {
  damageTakenMultiplier: 16,
  wingmanDamageTakenMultiplier: 10,
  stressRateMultiplier: 2,
  boostCooldownMultiplier: 5,
  barrelRollCooldownMultiplier: 5,
  kturnCooldownMultiplier: 5,
  ordnanceCooldownMultiplier: 3,
  turretCooldownMultiplier: 5,
};

/** Points for projecting the faction aura (3v3: Tactical Officer ≈ 2). */
const AURA_POINTS = 1.5;

/** Every ability and every card is worth at least this much. */
const MIN_POINTS = 1;

/** Black-market gear sells one point under the same effect on a clean card. */
const ILLICIT_DISCOUNT = 1;

/**
 * Unrounded point value of a real-time effect. Drawbacks (a multiplier
 * above 1) subtract.
 * @param effect - A real-time effect.
 * @returns Its value in points (may be fractional or negative).
 */
function effectPoints(effect: RealtimeEffect): number {
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
  return points;
}

/**
 * Point value of a pilot ability's real-time effect.
 *
 * @param effect - The ability's real-time effect.
 * @returns Whole points, at least {@link MIN_POINTS}.
 */
export function abilityPointValue(effect: RealtimeEffect): number {
  return Math.max(MIN_POINTS, Math.round(effectPoints(effect)));
}

/**
 * Point value of a non-weapon upgrade card on the same scale: its hull and
 * shield tokens plus its real-time effect, one point off for illicit gear.
 * Weapon cards (turrets, ordnance) carry their own measured price.
 *
 * @param card - An upgrade card.
 * @returns Whole points, at least {@link MIN_POINTS}.
 */
export function cardPointValue(card: UpgradeDefinition): number {
  const stats =
    ((card.effects?.hullBonus ?? 0) + (card.effects?.shieldBonus ?? 0)) *
    STAT_TOKEN_POINTS;
  const discount = card.slotType === "illicit" ? ILLICIT_DISCOUNT : 0;
  const raw = stats + effectPoints(card.realtime ?? {}) - discount;
  return Math.max(MIN_POINTS, Math.round(raw));
}
