/**
 * AuraSources — every living aura projector as a resolved source (radius,
 * class-scaled magnitude, swarm reduction, repair rate and the pilot-sheet
 * extras it grants allies), and how one source's effect folds into the aura
 * a covered ally receives.
 *
 * A projector's radius / magnitude bonuses come from ONE place: the ship's
 * folded modifier sheet (upgrades + pilot ability) when the AuraShip carries
 * it (auraShipFacts), else its equipped command cards. Pure, framework-free.
 */

import {
  MAX_AURA_HIT_CHANCE_BONUS,
  MAX_STRESS_RELIEF_TIERS,
  MIN_DAMAGE_TAKEN_MULTIPLIER,
} from "../../core/CombatModifiers";
import type { FactionId } from "../../config";
import type { ActiveAura } from "./ActiveAura";
import { auraHullRepairRate } from "./AuraRepair";
import {
  FACTION_AURAS,
  SWARM_EVADE_CAP,
  auraRadiusBonusFor,
  projectionScaleFor,
  type AuraShip,
  type FactionAura,
} from "./FactionAuras";

/** One resolved aura projector. */
export interface SourceInfo {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly faction: FactionId;
  readonly radiusSquared: number;
  readonly aura: FactionAura;
  /** Faction magnitude after class scaling and the sheet's magnitude bonus. */
  readonly magnitude: number;
  /** Precomputed swarm reduction (0 for non-swarm auras). */
  readonly swarmReduction: number;
  /** Aura effect kind (repair-source pick). */
  readonly effect: FactionAura["effect"];
  /** Hull repair rate this source grants (0 unless a repair platform). */
  readonly hullRepair: number;
  /** Stress-relief tiers the projector's pilot grants allies (any faction). */
  readonly stressRelief: number;
  /** Hit-chance bonus the projector's pilot grants allies (any faction). */
  readonly hitChance: number;
  /** Shield HP/s the projector's pilot / cards restore to allies (any faction). */
  readonly allyShieldRegen: number;
}

/**
 * Squared distance between two points (avoids a sqrt in the hot loop).
 * @param ax - First point x.
 * @param ay - First point y.
 * @param bx - Second point x.
 * @param by - Second point y.
 * @returns The squared Euclidean distance.
 */
export function distanceSquared(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Count living same-faction allies within a radius of a support (excluding self).
 * @param source - The support ship at the centre.
 * @param ships - All ships in play.
 * @param radiusSquared - Squared coverage radius.
 * @returns The number of covered allies.
 */
function countAlliesWithin(
  source: AuraShip,
  ships: ReadonlyArray<AuraShip>,
  radiusSquared: number,
): number {
  let count = 0;
  for (const other of ships) {
    if (other.id === source.id || other.hull <= 0) continue;
    if (other.faction !== source.faction) continue;
    if (
      distanceSquared(source.x, source.y, other.x, other.y) <= radiusSquared
    ) {
      count++;
    }
  }
  return count;
}

/**
 * The projector's radius bonus: its folded sheet when known (upgrades and
 * pilot ability already summed and capped), else its command cards — never
 * both, so a card is never counted twice.
 * @param ship - The projector.
 * @returns Fractional radius increase.
 */
function radiusBonusOf(ship: AuraShip): number {
  return ship.auraRadiusBonus ?? auraRadiusBonusFor(ship.equippedUpgrades);
}

/**
 * Build per-source aura info: class scaling, the projector's radius and
 * magnitude bonuses, its pilot extras and the swarm precomputation.
 * @param ships - All ships in play.
 * @returns One entry per living aura projector.
 */
export function buildSources(ships: ReadonlyArray<AuraShip>): SourceInfo[] {
  const sources: SourceInfo[] = [];
  for (const ship of ships) {
    const projection = projectionScaleFor(ship);
    if (projection === null) continue;
    const aura = FACTION_AURAS[ship.faction];
    const radius =
      aura.radius * projection.radiusScale * (1 + radiusBonusOf(ship));
    const radiusSquared = radius * radius;
    const magnitude =
      aura.magnitude *
      projection.magnitudeScale *
      (1 + (ship.auraMagnitudeBonus ?? 0));
    const swarmReduction =
      aura.effect === "swarm_evade"
        ? Math.min(
            SWARM_EVADE_CAP,
            magnitude * countAlliesWithin(ship, ships, radiusSquared),
          )
        : 0;
    sources.push({
      id: ship.id,
      x: ship.x,
      y: ship.y,
      faction: ship.faction,
      radiusSquared,
      aura,
      magnitude,
      swarmReduction,
      effect: aura.effect,
      hullRepair: auraHullRepairRate(aura.effect, projection.kind, magnitude),
      stressRelief: ship.auraStressReliefTiers ?? 0,
      hitChance: ship.auraHitChanceBonus ?? 0,
      allyShieldRegen: ship.auraShieldRegenPerSecond ?? 0,
    });
  }
  return sources;
}

/**
 * The faction effect's part of one source's contribution.
 * @param acc - Accumulator aura.
 * @param source - The covering projector.
 * @returns The accumulator with the faction effect folded in.
 */
function withFactionEffect(acc: ActiveAura, source: SourceInfo): ActiveAura {
  const { magnitude } = source;
  switch (source.effect) {
    case "damage":
      return { ...acc, damageBonus: acc.damageBonus + Math.round(magnitude) };
    case "damage_reduction":
      return {
        ...acc,
        damageTakenMultiplier: acc.damageTakenMultiplier * (1 - magnitude),
      };
    case "swarm_evade":
      return {
        ...acc,
        damageTakenMultiplier:
          acc.damageTakenMultiplier * (1 - source.swarmReduction),
      };
    case "stress_relief":
      return {
        ...acc,
        stressReliefTiers: acc.stressReliefTiers + Math.round(magnitude),
      };
    case "shield_regen":
      return {
        ...acc,
        shieldRegenPerSecond: acc.shieldRegenPerSecond + magnitude,
        hullRepairPerSecond: acc.hullRepairPerSecond + source.hullRepair,
      };
  }
}

/**
 * Fold one source's contribution (faction effect plus its pilot's extras)
 * into an accumulating aura, then apply the stacking caps and floor.
 * @param acc - Accumulator aura.
 * @param source - The covering projector.
 * @returns The updated combined aura.
 */
export function accumulate(acc: ActiveAura, source: SourceInfo): ActiveAura {
  const next = withFactionEffect(acc, source);
  return {
    ...next,
    damageTakenMultiplier: Math.max(
      MIN_DAMAGE_TAKEN_MULTIPLIER,
      next.damageTakenMultiplier,
    ),
    stressReliefTiers: Math.min(
      MAX_STRESS_RELIEF_TIERS,
      next.stressReliefTiers + source.stressRelief,
    ),
    hitChanceBonus: Math.min(
      MAX_AURA_HIT_CHANCE_BONUS,
      next.hitChanceBonus + source.hitChance,
    ),
    shieldRegenPerSecond: next.shieldRegenPerSecond + source.allyShieldRegen,
  };
}
