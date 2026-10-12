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

import { projectionScaleFor, type AuraShip } from "./aura/FactionAuras";
import { NEUTRAL_AURA, type ActiveAura } from "./aura/ActiveAura";
import {
  accumulate,
  buildSources,
  distanceSquared,
  type SourceInfo,
} from "./aura/AuraSources";
import { strongerRepairSource } from "./aura/AuraRepair";

export { NEUTRAL_AURA, type ActiveAura } from "./aura/ActiveAura";
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

/** Result of resolving all support auras for a single tick. */
export interface AuraResolution {
  /** Ship id -> combined active aura (only ships under at least one aura). */
  readonly buffs: ReadonlyMap<string, ActiveAura>;
  /** Ids of allied ships inside at least one support aura this tick. */
  readonly coveredShipIds: ReadonlySet<string>;
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
