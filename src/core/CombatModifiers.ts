/**
 * Combat modifiers — the real-time effect an upgrade or pilot ability (or a
 * stack of them) has on a ship during arcade combat. Conditional knobs
 * (range 1, rear arc, bullseye, wingman, stressed, damaged, kill frenzy)
 * are judged per hit by src/arcade/ShotConditions.ts.
 *
 * Pure data + combination rules, no framework imports. Each upgrade in the
 * catalog declares a partial {@link RealtimeEffect}; a ship's loadout folds
 * those into one {@link CombatModifiers} sheet at spawn time, and the battle
 * scene reads the sheet at its consumption points (firing, taking damage,
 * stress accrual, cooldowns, regeneration).
 *
 * Stat bonuses (hull, shields, attack dice, agility dice) are NOT here: they
 * live in `UpgradeEffects` because every mode, not just arcade, applies them.
 */

/** Every real-time knob an upgrade can turn. */
export interface CombatModifiers {
  /** Flat damage added to every forward-laser bolt. */
  readonly laserDamageBonus: number;
  /** Flat laser damage added only while the pilot is not stressed. */
  readonly calmLaserDamageBonus: number;
  /** Flat laser damage added when the target's shields are already down. */
  readonly bonusDamageVsUnshielded: number;
  /** Multiplier (≤1 is protective) applied to every incoming hit. */
  readonly damageTakenMultiplier: number;
  /** Shield points regenerated per second while below max shields. */
  readonly shieldRegenPerSecond: number;
  /**
   * Miniature hull points repaired per second while below max hull, paused
   * for a few seconds after the ship takes damage (src/arcade/systems/repair).
   */
  readonly hullRepairPerSecond: number;
  /** Multiplier on stress accrued from flying maneuvers (<1 = calmer pilot). */
  readonly stressRateMultiplier: number;
  /** Maneuver-difficulty tiers eased toward green when accruing stress. */
  readonly stressReliefTiers: number;
  /** Multiplier on the boost recharge time. */
  readonly boostCooldownMultiplier: number;
  /** Multiplier on the barrel-roll recharge time. */
  readonly barrelRollCooldownMultiplier: number;
  /** Multiplier on the K-turn / Segnor / Tallon recharge time. */
  readonly kturnCooldownMultiplier: number;
  /** Multiplier on every ordnance slot's reload time. */
  readonly ordnanceCooldownMultiplier: number;
  /** Extra charges added to every ordnance slot. */
  readonly ordnanceBonusCharges: number;
  /** Extra degrees of steering every homing projectile starts with. */
  readonly homingTurnBonus: number;
  /** Multiplier on the turret's time between shots. */
  readonly turretCooldownMultiplier: number;
  /** Stress (0–1 scale) inflicted on the target by each forward-laser hit. */
  readonly stressOnHit: number;
  /** Extra seconds the cloak lasts once activated. */
  readonly cloakDurationBonus: number;
  /** True when the ship projects its faction's support aura. */
  readonly projectsAura: boolean;
  /** Fractional increase to the radius of the aura this ship projects. */
  readonly auraRadiusBonus: number;

  // --- Conditional knobs (pilot abilities), read per hit -------------------
  /** Laser damage added when the target is at range 1. */
  readonly closeRangeLaserBonus: number;
  /** Laser damage added when firing from inside the target's rear arc. */
  readonly rearArcLaserBonus: number;
  /** Laser damage added when the target sits in the bullseye arc. */
  readonly bullseyeLaserBonus: number;
  /** Laser damage added while a friendly ship flies nearby. */
  readonly wingmanLaserBonus: number;
  /** Multiplier on incoming damage while a friendly ship flies nearby. */
  readonly wingmanDamageTakenMultiplier: number;
  /** Laser damage added while the pilot is stressed. */
  readonly stressedLaserBonus: number;
  /** Laser damage added once the hull has taken damage. */
  readonly damagedLaserBonus: number;
  /** Laser damage added for a short frenzy after each kill. */
  readonly killFrenzyLaserBonus: number;
  /** Shield points restored on each kill. */
  readonly shieldsPerKill: number;
  /** Extra notches on the ship's top speed. */
  readonly maxSpeedBonus: number;
  /** Damage dealt to every enemy nearby when this ship is destroyed. */
  readonly deathBlastDamage: number;
}

/** The partial sheet a single upgrade declares. */
export type RealtimeEffect = Partial<CombatModifiers>;

/** A ship with no upgrades. */
export const NEUTRAL_MODIFIERS: CombatModifiers = {
  laserDamageBonus: 0,
  calmLaserDamageBonus: 0,
  bonusDamageVsUnshielded: 0,
  damageTakenMultiplier: 1,
  shieldRegenPerSecond: 0,
  hullRepairPerSecond: 0,
  stressRateMultiplier: 1,
  stressReliefTiers: 0,
  boostCooldownMultiplier: 1,
  barrelRollCooldownMultiplier: 1,
  kturnCooldownMultiplier: 1,
  ordnanceCooldownMultiplier: 1,
  ordnanceBonusCharges: 0,
  homingTurnBonus: 0,
  turretCooldownMultiplier: 1,
  stressOnHit: 0,
  cloakDurationBonus: 0,
  projectsAura: false,
  auraRadiusBonus: 0,
  closeRangeLaserBonus: 0,
  rearArcLaserBonus: 0,
  bullseyeLaserBonus: 0,
  wingmanLaserBonus: 0,
  wingmanDamageTakenMultiplier: 1,
  stressedLaserBonus: 0,
  damagedLaserBonus: 0,
  killFrenzyLaserBonus: 0,
  shieldsPerKill: 0,
  maxSpeedBonus: 0,
  deathBlastDamage: 0,
};

/** Stacked damage reduction never makes a ship take less than half damage. */
export const MIN_DAMAGE_TAKEN_MULTIPLIER = 0.5;

/** Stacked cooldown reductions never drop a recharge below 40% of base. */
export const MIN_COOLDOWN_MULTIPLIER = 0.4;

/** Stacked stress reduction never drops maneuver stress below 50% of base. */
export const MIN_STRESS_RATE_MULTIPLIER = 0.5;

/** Stress relief never eases a maneuver by more than two tiers (red → green). */
export const MAX_STRESS_RELIEF_TIERS = 2;

/** Stacked command upgrades never widen an aura by more than 50%. */
export const MAX_AURA_RADIUS_BONUS = 0.5;

/** A ship's top speed never rises more than one notch above its dial. */
export const MAX_SPEED_BONUS = 1;

/** Additive fields: stacking two upgrades sums them. */
const ADDITIVE_KEYS = [
  "laserDamageBonus",
  "calmLaserDamageBonus",
  "bonusDamageVsUnshielded",
  "shieldRegenPerSecond",
  "hullRepairPerSecond",
  "stressReliefTiers",
  "ordnanceBonusCharges",
  "homingTurnBonus",
  "stressOnHit",
  "cloakDurationBonus",
  "auraRadiusBonus",
  "closeRangeLaserBonus",
  "rearArcLaserBonus",
  "bullseyeLaserBonus",
  "wingmanLaserBonus",
  "stressedLaserBonus",
  "damagedLaserBonus",
  "killFrenzyLaserBonus",
  "shieldsPerKill",
  "maxSpeedBonus",
  "deathBlastDamage",
] as const satisfies ReadonlyArray<keyof CombatModifiers>;

/** Multiplicative fields: stacking two upgrades multiplies them. */
const MULTIPLICATIVE_KEYS = [
  "damageTakenMultiplier",
  "stressRateMultiplier",
  "boostCooldownMultiplier",
  "barrelRollCooldownMultiplier",
  "kturnCooldownMultiplier",
  "ordnanceCooldownMultiplier",
  "turretCooldownMultiplier",
  "wingmanDamageTakenMultiplier",
] as const satisfies ReadonlyArray<keyof CombatModifiers>;

type MutableModifiers = {
  -readonly [K in keyof CombatModifiers]: CombatModifiers[K];
};

/**
 * Fold any number of upgrade effects into one modifier sheet, then clamp the
 * result so stacking can never produce a degenerate ship.
 *
 * @param effects - The real-time effects of every equipped upgrade.
 * @returns The combined, clamped modifier sheet.
 */
export function combineEffects(
  effects: ReadonlyArray<RealtimeEffect>,
): CombatModifiers {
  const sheet: MutableModifiers = { ...NEUTRAL_MODIFIERS };
  for (const effect of effects) {
    for (const key of ADDITIVE_KEYS) sheet[key] += effect[key] ?? 0;
    for (const key of MULTIPLICATIVE_KEYS) sheet[key] *= effect[key] ?? 1;
    sheet.projectsAura ||= effect.projectsAura ?? false;
  }
  return clampModifiers(sheet);
}

/**
 * Apply the stacking floors and caps to a modifier sheet.
 * @param sheet - The raw combined sheet.
 * @returns A sheet within the documented bounds.
 */
function clampModifiers(sheet: MutableModifiers): CombatModifiers {
  return {
    ...sheet,
    damageTakenMultiplier: Math.max(
      MIN_DAMAGE_TAKEN_MULTIPLIER,
      sheet.damageTakenMultiplier,
    ),
    stressRateMultiplier: Math.max(
      MIN_STRESS_RATE_MULTIPLIER,
      sheet.stressRateMultiplier,
    ),
    stressReliefTiers: Math.min(
      MAX_STRESS_RELIEF_TIERS,
      sheet.stressReliefTiers,
    ),
    auraRadiusBonus: Math.min(MAX_AURA_RADIUS_BONUS, sheet.auraRadiusBonus),
    maxSpeedBonus: Math.min(MAX_SPEED_BONUS, sheet.maxSpeedBonus),
    wingmanDamageTakenMultiplier: Math.max(
      MIN_DAMAGE_TAKEN_MULTIPLIER,
      sheet.wingmanDamageTakenMultiplier,
    ),
    boostCooldownMultiplier: Math.max(
      MIN_COOLDOWN_MULTIPLIER,
      sheet.boostCooldownMultiplier,
    ),
    barrelRollCooldownMultiplier: Math.max(
      MIN_COOLDOWN_MULTIPLIER,
      sheet.barrelRollCooldownMultiplier,
    ),
    kturnCooldownMultiplier: Math.max(
      MIN_COOLDOWN_MULTIPLIER,
      sheet.kturnCooldownMultiplier,
    ),
    ordnanceCooldownMultiplier: Math.max(
      MIN_COOLDOWN_MULTIPLIER,
      sheet.ordnanceCooldownMultiplier,
    ),
    turretCooldownMultiplier: Math.max(
      MIN_COOLDOWN_MULTIPLIER,
      sheet.turretCooldownMultiplier,
    ),
  };
}

/**
 * Forward-laser damage for one bolt, after upgrade bonuses.
 *
 * @param baseDamage - Damage before upgrades (stress penalty already applied).
 * @param modifiers - The firing ship's modifier sheet.
 * @param isStressed - Whether the firing pilot is currently stressed.
 * @returns Damage carried by the bolt.
 */
export function laserDamageWithModifiers(
  baseDamage: number,
  modifiers: CombatModifiers,
  isStressed: boolean,
): number {
  const calmBonus = isStressed ? 0 : modifiers.calmLaserDamageBonus;
  return baseDamage + modifiers.laserDamageBonus + calmBonus;
}
