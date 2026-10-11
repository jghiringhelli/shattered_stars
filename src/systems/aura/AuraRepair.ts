/**
 * Repair-field rules for faction auras: which projectors also patch allied
 * hull, how fast, and which projector a covered ship credits for its repair
 * (the repair-drone VFX fly from that ship).
 *
 * Pure, framework-free.
 */

import type { AuraEffectType, ProjectionKind } from "./FactionAuras";

/**
 * Fraction of a shield-regen aura's rate that dedicated repair platforms
 * (support and capital projectors) also restore as hull — their drone crews
 * patch allied hulls slowly. Hero and crew-granted auras only regenerate
 * shields, so hull repair stays the job of real support ships.
 */
export const AURA_HULL_REPAIR_RATIO = 0.25;

/** Projector kinds whose shield-regen aura also repairs allied hull. */
export const HULL_REPAIR_PROJECTIONS: ReadonlySet<ProjectionKind> = new Set([
  "support",
  "capital",
]);

/**
 * Hull repair rate a projector grants to every covered ally.
 *
 * @param effect - The projector's faction aura effect.
 * @param kind - How the ship qualifies to project.
 * @param magnitude - The aura magnitude after class scaling.
 * @returns Miniature hull points per second (0 for non-repair fields).
 */
export function auraHullRepairRate(
  effect: AuraEffectType,
  kind: ProjectionKind,
  magnitude: number,
): number {
  if (effect !== "shield_regen" || !HULL_REPAIR_PROJECTIONS.has(kind)) return 0;
  return magnitude * AURA_HULL_REPAIR_RATIO;
}

/** What the repair-source pick needs to know about a covering projector. */
export interface RepairCandidate {
  readonly effect: AuraEffectType;
  readonly magnitude: number;
  readonly hullRepair: number;
}

/**
 * The repairing projector that contributes the most to a covered ship.
 *
 * @param current - The best candidate so far, or null.
 * @param candidate - Another covering projector.
 * @returns Whichever repairs more (only shield-regen fields repair).
 */
export function strongerRepairSource<T extends RepairCandidate>(
  current: T | null,
  candidate: T,
): T | null {
  if (candidate.effect !== "shield_regen") return current;
  if (current === null) return candidate;
  const currentPower = current.magnitude + current.hullRepair;
  const candidatePower = candidate.magnitude + candidate.hullRepair;
  return candidatePower > currentPower ? candidate : current;
}
