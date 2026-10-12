/**
 * ActiveAura — the combined faction-aura effect a single ship receives this
 * tick, and the neutral value for a ship under no aura. Pure data.
 */

/** Combined aura effect a single ship receives this tick. */
export interface ActiveAura {
  /** Flat bonus added to the ship's outgoing damage. */
  readonly damageBonus: number;
  /** Multiplier (0-1) applied to incoming damage. 1 = no reduction. */
  readonly damageTakenMultiplier: number;
  /** Number of maneuver-difficulty tiers to ease when accruing stress. */
  readonly stressReliefTiers: number;
  /** Hit-chance bonus (0-1) added to the ship's dice shots. */
  readonly hitChanceBonus: number;
  /** Real-time shield HP regenerated per second. */
  readonly shieldRegenPerSecond: number;
  /** Real-time hull HP repaired per second (support/capital repair fields). */
  readonly hullRepairPerSecond: number;
  /** Id of the strongest repairing projector covering the ship, if any. */
  readonly repairSourceId: string | null;
}

/** A ship receiving no aura effects. */
export const NEUTRAL_AURA: ActiveAura = {
  damageBonus: 0,
  damageTakenMultiplier: 1,
  stressReliefTiers: 0,
  hitChanceBonus: 0,
  shieldRegenPerSecond: 0,
  hullRepairPerSecond: 0,
  repairSourceId: null,
};
