/**
 * Support-ship auras — one unique power per faction, projected by class.
 *
 * Pure, framework-free logic shared by the arcade scene (per-frame effect
 * application) and headless coverage telemetry. Aura data, class-based scaling,
 * and projection eligibility live in {@link ./aura/FactionAuras}; this module
 * resolves the active buffs each tick and answers coverage queries.
 *
 * Design intent:
 * - Each faction gets a distinct effect tied to its playstyle, so support ships
 *   are worth fielding in mid-sized squads (~4-6 ships) and scale into epic.
 * - Radius and magnitude scale with hull class: capitals project a broad gentle
 *   field, heroes a tight full-strength one, so the aura rewards formation
 *   rather than parking one ship in the middle of the map.
 */

import type { FactionId } from "../config";
import {
  FACTION_AURAS,
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  MAX_STRESS_RELIEF_TIERS,
  SWARM_EVADE_CAP,
  auraRadiusBonusFor,
  projectionScaleFor,
  type AuraShip,
  type FactionAura,
} from "./aura/FactionAuras";
import { auraHullRepairRate, strongerRepairSource } from "./aura/AuraRepair";

export {
  FACTION_AURAS,
  SWARM_EVADE_PER_ALLY,
  SWARM_EVADE_CAP,
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  MAX_STRESS_RELIEF_TIERS,
  SIZE_RADIUS_MULTIPLIER,
  SIZE_MAGNITUDE_MULTIPLIER,
  HERO_RADIUS_SCALE,
  HERO_MAGNITUDE_SCALE,
  AURA_GRANTING_CREW,
  projectionScaleFor,
  type AuraShip,
  type AuraEffectType,
  type FactionAura,
  type ProjectionKind,
  type ProjectionScale,
} from "./aura/FactionAuras";

/** Combined aura effect a single ship receives this tick. */
export interface ActiveAura {
  /** Flat bonus added to the ship's outgoing damage. */
  readonly damageBonus: number;
  /** Multiplier (0-1) applied to incoming damage. 1 = no reduction. */
  readonly damageTakenMultiplier: number;
  /** Number of maneuver-difficulty tiers to ease when accruing stress. */
  readonly stressReliefTiers: number;
  /** Shield points regenerated per second. */
  readonly shieldRegenPerSecond: number;
  /** Miniature hull points repaired per second (support/capital repair fields). */
  readonly hullRepairPerSecond: number;
  /** Id of the strongest repairing projector covering the ship, if any. */
  readonly repairSourceId: string | null;
}

/** A ship receiving no aura effects. */
export const NEUTRAL_AURA: ActiveAura = {
  damageBonus: 0,
  damageTakenMultiplier: 1,
  stressReliefTiers: 0,
  shieldRegenPerSecond: 0,
  hullRepairPerSecond: 0,
  repairSourceId: null,
};

/** Result of resolving all support auras for a single tick. */
export interface AuraResolution {
  /** Ship id -> combined active aura (only ships under at least one aura). */
  readonly buffs: ReadonlyMap<string, ActiveAura>;
  /** Ids of allied ships inside at least one support aura this tick. */
  readonly coveredShipIds: ReadonlySet<string>;
}

interface SourceInfo {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly faction: FactionId;
  readonly radiusSquared: number;
  readonly aura: FactionAura;
  /** Faction magnitude after class-based scaling. */
  readonly magnitude: number;
  /** Precomputed swarm reduction (0 for non-swarm auras). */
  readonly swarmReduction: number;
  /** Aura effect kind (repair-source pick). */
  readonly effect: FactionAura["effect"];
  /** Hull repair rate this source grants (0 unless a repair platform). */
  readonly hullRepair: number;
}

/**
 * Squared distance between two points (avoids a sqrt in the hot loop).
 * @param ax - First point x.
 * @param ay - First point y.
 * @param bx - Second point x.
 * @param by - Second point y.
 * @returns The squared Euclidean distance.
 */
function distanceSquared(
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
 * Build per-source aura info, applying class scaling, command-upgrade radius
 * bonuses and swarm precomputation.
 * @param ships - All ships in play.
 * @returns One entry per living aura projector.
 */
function buildSources(ships: ReadonlyArray<AuraShip>): SourceInfo[] {
  const sources: SourceInfo[] = [];
  for (const ship of ships) {
    const projection = projectionScaleFor(ship);
    if (projection === null) continue;
    const aura = FACTION_AURAS[ship.faction];
    const radius =
      aura.radius *
      projection.radiusScale *
      (1 + auraRadiusBonusFor(ship.equippedUpgrades));
    const radiusSquared = radius * radius;
    const magnitude = aura.magnitude * projection.magnitudeScale;
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
    });
  }
  return sources;
}

/**
 * Fold one source's contribution into an accumulating aura.
 * @param acc - Accumulator aura.
 * @param source - The covering support ship info.
 * @returns The updated combined aura.
 */
function accumulate(acc: ActiveAura, source: SourceInfo): ActiveAura {
  const { aura, magnitude, swarmReduction } = source;
  let damageBonus = acc.damageBonus;
  let damageTakenMultiplier = acc.damageTakenMultiplier;
  let stressReliefTiers = acc.stressReliefTiers;
  let shieldRegenPerSecond = acc.shieldRegenPerSecond;
  let hullRepairPerSecond = acc.hullRepairPerSecond;
  switch (aura.effect) {
    case "damage":
      damageBonus += Math.round(magnitude);
      break;
    case "damage_reduction":
      damageTakenMultiplier *= 1 - magnitude;
      break;
    case "swarm_evade":
      damageTakenMultiplier *= 1 - swarmReduction;
      break;
    case "stress_relief":
      stressReliefTiers = Math.min(
        MAX_STRESS_RELIEF_TIERS,
        stressReliefTiers + Math.round(magnitude),
      );
      break;
    case "shield_regen":
      shieldRegenPerSecond += magnitude;
      hullRepairPerSecond += source.hullRepair;
      break;
  }
  return {
    damageBonus,
    damageTakenMultiplier: Math.max(
      MIN_DAMAGE_TAKEN_MULTIPLIER,
      damageTakenMultiplier,
    ),
    stressReliefTiers,
    shieldRegenPerSecond,
    hullRepairPerSecond,
    repairSourceId: acc.repairSourceId,
  };
}

/**
 * Resolve every faction aura against the current ship set for one tick.
 *
 * @param ships - All ships in play (players + allies + enemies).
 * @returns Combined per-ship aura buffs and the covered-ship id set.
 */
export function resolveSupportAuras(
  ships: ReadonlyArray<AuraShip>,
): AuraResolution {
  const buffs = new Map<string, ActiveAura>();
  const coveredShipIds = new Set<string>();
  const sources = buildSources(ships);
  if (sources.length === 0) {
    return { buffs, coveredShipIds };
  }

  for (const ally of ships) {
    if (ally.hull <= 0) continue;
    let aura = NEUTRAL_AURA;
    let covered = false;
    let repairSource: SourceInfo | null = null;
    for (const source of sources) {
      if (source.id === ally.id || source.faction !== ally.faction) continue;
      if (
        distanceSquared(source.x, source.y, ally.x, ally.y) >
        source.radiusSquared
      ) {
        continue;
      }
      covered = true;
      aura = accumulate(aura, source);
      repairSource = strongerRepairSource(repairSource, source);
    }
    if (covered) {
      coveredShipIds.add(ally.id);
      buffs.set(ally.id, { ...aura, repairSourceId: repairSource?.id ?? null });
    }
  }

  return { buffs, coveredShipIds };
}

/**
 * Coverage-only helper: allies within a fixed radius of any same-faction
 * aura projector. Used by radius-sweep telemetry, independent of scaling.
 *
 * @param ships - All ships in play.
 * @param radius - Coverage radius in pixels.
 * @returns The set of covered ally ids.
 */
export function alliesCoveredWithinRadius(
  ships: ReadonlyArray<AuraShip>,
  radius: number,
): ReadonlySet<string> {
  const radiusSquared = radius * radius;
  const sources = ships.filter((s) => projectionScaleFor(s) !== null);
  const covered = new Set<string>();
  for (const ally of ships) {
    if (ally.hull <= 0) continue;
    const isCovered = sources.some(
      (source) =>
        source.id !== ally.id &&
        source.faction === ally.faction &&
        distanceSquared(source.x, source.y, ally.x, ally.y) <= radiusSquared,
    );
    if (isCovered) covered.add(ally.id);
  }
  return covered;
}
