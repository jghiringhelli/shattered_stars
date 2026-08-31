/**
 * Support-ship auras — one unique power per faction.
 *
 * Pure, framework-free logic shared by the arcade scene (per-frame effect
 * application) and headless coverage telemetry. A support-role ship projects a
 * circular aura whose EFFECT depends on its faction, echoing the support
 * archetypes of X-Wing: The Miniatures Game (coordinate, reinforce, regen).
 *
 * Design intent:
 * - Each faction gets a distinct effect tied to its playstyle, so support ships
 *   are worth fielding in mid-sized squads (~4-6 ships) and scale into epic.
 * - Radii are deliberately modest: the aura rewards keeping formation, not
 *   parking one ship in the middle of the map. Shield regen is the most
 *   powerful effect, so it is the slowest and has the smallest radius.
 */

import type { FactionId } from "../config";
import type { ShipRole } from "../core/types";

/** Minimal ship shape needed to resolve auras (no Phaser/runtime coupling). */
export interface AuraShip {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly faction: FactionId;
  readonly role: ShipRole;
  readonly hull: number;
  readonly shields: number;
  readonly maxShields: number;
}

/** The distinct effect a faction aura applies to covered allies. */
export type AuraEffectType =
  | "damage" // flat bonus to outgoing damage
  | "damage_reduction" // flat fraction of incoming damage removed
  | "swarm_evade" // incoming-damage reduction scaling with nearby swarm size
  | "stress_relief" // maneuvers count as N difficulty tiers easier
  | "shield_regen"; // slow shield regeneration (rate per second)

/** A faction's signature aura definition. */
export interface FactionAura {
  readonly id: string;
  readonly name: string;
  readonly faction: FactionId;
  readonly effect: AuraEffectType;
  /** Coverage radius in pixels. */
  readonly radius: number;
  /** Effect strength; units depend on {@link effect}. */
  readonly magnitude: number;
  readonly description: string;
}

/** Per-ally reduction added by each nearby swarm member (synthetic). */
export const SWARM_EVADE_PER_ALLY = 0.06;
/** Maximum incoming-damage reduction the swarm aura can reach. */
export const SWARM_EVADE_CAP = 0.3;
/** Floor on the incoming-damage multiplier so stacked auras never invulnerable. */
export const MIN_DAMAGE_TAKEN_MULTIPLIER = 0.5;
/** Maximum number of stress-relief tiers a ship can benefit from at once. */
export const MAX_STRESS_RELIEF_TIERS = 2;

/**
 * The signature aura for each faction, tuned to its playstyle.
 *
 * - Terran Hegemony (elite/formation): coordinated offense.
 * - Free Confederation (balanced/versatile): reliable damage mitigation.
 * - Synthetic Collective (swarm/drones): mitigation that grows with the swarm.
 * - Void Corsairs (fast raiders): stress-free aggressive maneuvering.
 * - Ascendant Empire (heavy shields/support): slow, powerful shield regen.
 */
export const FACTION_AURAS: Record<FactionId, FactionAura> = {
  terran_hegemony: {
    id: "coordinated_fire",
    name: "Coordinated Fire",
    faction: "terran_hegemony",
    effect: "damage",
    radius: 260,
    magnitude: 1,
    description: "Allied ships in formation deal +1 damage.",
  },
  free_confederation: {
    id: "rallying_banner",
    name: "Rallying Banner",
    faction: "free_confederation",
    effect: "damage_reduction",
    radius: 280,
    magnitude: 0.2,
    description: "Allied ships take 20% less damage.",
  },
  synthetic_collective: {
    id: "hive_resilience",
    name: "Hive Resilience",
    faction: "synthetic_collective",
    effect: "swarm_evade",
    radius: 340,
    magnitude: SWARM_EVADE_PER_ALLY,
    description: "Allies take less damage, scaling with nearby swarm size.",
  },
  void_corsairs: {
    id: "raiders_cadence",
    name: "Raider's Cadence",
    faction: "void_corsairs",
    effect: "stress_relief",
    radius: 300,
    magnitude: 1,
    description: "Allied maneuvers build stress one tier slower.",
  },
  ascendant_empire: {
    id: "aegis_field",
    name: "Aegis Field",
    faction: "ascendant_empire",
    effect: "shield_regen",
    radius: 220,
    magnitude: 0.2,
    description: "Allied ships slowly regenerate shields (0.2/s).",
  },
};

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
}

/** A ship receiving no aura effects. */
export const NEUTRAL_AURA: ActiveAura = {
  damageBonus: 0,
  damageTakenMultiplier: 1,
  stressReliefTiers: 0,
  shieldRegenPerSecond: 0,
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
  readonly swarmReduction: number;
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
 * Build per-source aura info, precomputing swarm reduction where relevant.
 * @param ships - All ships in play.
 * @returns One entry per living support ship.
 */
function buildSources(ships: ReadonlyArray<AuraShip>): SourceInfo[] {
  const sources: SourceInfo[] = [];
  for (const ship of ships) {
    if (ship.role !== "support" || ship.hull <= 0) continue;
    const aura = FACTION_AURAS[ship.faction];
    const radiusSquared = aura.radius * aura.radius;
    const swarmReduction =
      aura.effect === "swarm_evade"
        ? Math.min(
            SWARM_EVADE_CAP,
            aura.magnitude * countAlliesWithin(ship, ships, radiusSquared),
          )
        : 0;
    sources.push({
      id: ship.id,
      x: ship.x,
      y: ship.y,
      faction: ship.faction,
      radiusSquared,
      aura,
      swarmReduction,
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
  const { aura, swarmReduction } = source;
  let damageBonus = acc.damageBonus;
  let damageTakenMultiplier = acc.damageTakenMultiplier;
  let stressReliefTiers = acc.stressReliefTiers;
  let shieldRegenPerSecond = acc.shieldRegenPerSecond;
  switch (aura.effect) {
    case "damage":
      damageBonus += aura.magnitude;
      break;
    case "damage_reduction":
      damageTakenMultiplier *= 1 - aura.magnitude;
      break;
    case "swarm_evade":
      damageTakenMultiplier *= 1 - swarmReduction;
      break;
    case "stress_relief":
      stressReliefTiers = Math.min(
        MAX_STRESS_RELIEF_TIERS,
        stressReliefTiers + aura.magnitude,
      );
      break;
    case "shield_regen":
      shieldRegenPerSecond += aura.magnitude;
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
    }
    if (covered) {
      coveredShipIds.add(ally.id);
      buffs.set(ally.id, aura);
    }
  }

  return { buffs, coveredShipIds };
}

/**
 * Coverage-only helper: allies within a fixed radius of any same-faction
 * support ship. Used by radius-sweep telemetry, independent of faction auras.
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
  const sources = ships.filter((s) => s.role === "support" && s.hull > 0);
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
