/**
 * Faction aura definitions, class-based scaling, and projection eligibility.
 *
 * Pure, framework-free data and rules shared by the aura resolver, the arcade
 * scene, and headless telemetry. A ship projects its faction's signature aura
 * as a circular field. WHO projects and HOW FAR depends on the ship's class:
 *
 * - Dedicated support ships project by role, radius scaling with hull size.
 * - Capital ships project a huge field at reduced strength (help, not break).
 * - Hero (unique-pilot) ships project a small field — useful in tight swarms.
 * - Any ship carrying a coordinator crew upgrade, or whose pilot ability
 *   projects the aura (its sheet's projectsAura), projects a size-scaled field.
 *
 * Radius and magnitude scale inversely with size so a capital's broad field is
 * gentle while a hero's tight field is full strength — total power stays even
 * across classes; only the SHAPE of the coverage changes.
 */

import type { FactionId, ShipSize } from "../../config";
import type { ShipRole } from "../../core/types";
import { UPGRADE_CATALOG } from "../../data/upgrades";
import { combineEffects } from "../../core/CombatModifiers";

/** Minimal ship shape needed to resolve auras (no Phaser/runtime coupling). */
export interface AuraShip {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly faction: FactionId;
  readonly role: ShipRole;
  /** Hull size class; scales aura radius and magnitude. */
  readonly size: ShipSize;
  /** True for named/ace pilots — grants a small hero aura. */
  readonly isUnique: boolean;
  /** Equipped upgrade ids; a coordinator crew grants a size-scaled aura. */
  readonly equippedUpgrades: ReadonlyArray<string>;
  readonly hull: number;
  readonly shields: number;
  readonly maxShields: number;
  /** False when a disabled subsystem (e.g. a capital's bridge) blocks projection. Defaults to online. */
  readonly systemsOnline?: boolean;
  // --- Pilot-sheet aura knobs (auraShipFacts / auraFactsOf). Omitted = the
  // ship's folded sheet is unknown: eligibility and radius fall back to its
  // equipped cards, and there is no magnitude bonus or pilot extra.
  /** The ship's sheet projects the aura (pilot ability or command card). */
  readonly projectsAura?: boolean;
  /** Fractional radius increase from the folded sheet (cards + pilot). */
  readonly auraRadiusBonus?: number;
  /** Fractional strength increase of the aura this ship projects. */
  readonly auraMagnitudeBonus?: number;
  /** Stress-relief tiers this ship's aura grants allies inside it. */
  readonly auraStressReliefTiers?: number;
  /** Hit-chance bonus this ship's aura grants allies inside it. */
  readonly auraHitChanceBonus?: number;
  /** Shield HP/s this ship's aura restores to allies inside it. */
  readonly auraShieldRegenPerSecond?: number;
}

/** The distinct effect a faction aura applies to covered allies. */
export type AuraEffectType =
  | "damage" // flat bonus to outgoing damage
  | "damage_reduction" // flat fraction of incoming damage removed
  | "swarm_evade" // incoming-damage reduction scaling with nearby swarm size
  | "stress_relief" // maneuvers count as N difficulty tiers easier
  | "shield_regen"; // slow shield regeneration (real-time HP per second)

/** A faction's signature aura definition. */
export interface FactionAura {
  readonly id: string;
  readonly name: string;
  readonly faction: FactionId;
  readonly effect: AuraEffectType;
  /** Base coverage radius in pixels (for a medium-size projector). */
  readonly radius: number;
  /** Base effect strength; units depend on {@link effect}. */
  readonly magnitude: number;
  readonly description: string;
}

/** Per-ally reduction added by each nearby swarm member (synthetic). */
export const SWARM_EVADE_PER_ALLY = 0.06;
/** Maximum incoming-damage reduction the swarm aura can reach. */
export const SWARM_EVADE_CAP = 0.3;
export {
  /** Floor on the incoming-damage multiplier so stacked auras never invulnerable. */
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  /** Maximum number of stress-relief tiers a ship can benefit from at once. */
  MAX_STRESS_RELIEF_TIERS,
} from "../../core/CombatModifiers";

/**
 * Radius multiplier per hull size, applied to a faction's base radius.
 * Medium is the 1.0 baseline; capitals project far, heroes project close.
 */
export const SIZE_RADIUS_MULTIPLIER: Record<ShipSize, number> = {
  tiny: 0.65,
  small: 0.65,
  medium: 1,
  large: 1.4,
  huge: 2.2,
};

/**
 * Magnitude multiplier per hull size. Larger hulls project a broader but
 * gentler field so an epic ship helps the fleet without breaking the game.
 */
export const SIZE_MAGNITUDE_MULTIPLIER: Record<ShipSize, number> = {
  tiny: 1,
  small: 1,
  medium: 1,
  large: 0.85,
  huge: 0.6,
};

/** Hero (unique-pilot) auras are tight but full strength. */
export const HERO_RADIUS_SCALE = 0.65;
/** Hero auras keep full magnitude — rewarding ordered swarms around an ace. */
export const HERO_MAGNITUDE_SCALE = 1;

/**
 * Upgrade ids that grant a coordinator aura to a non-support ship — every
 * catalog card whose real-time effect projects the aura (crew or talent).
 */
export const AURA_GRANTING_CREW: ReadonlySet<string> = new Set(
  Object.values(UPGRADE_CATALOG)
    .filter((upgrade) => upgrade.realtime?.projectsAura === true)
    .map((upgrade) => upgrade.id),
);

/**
 * How much a ship's command upgrades widen the aura it projects.
 *
 * @param upgradeIds - The projector's equipped upgrade ids.
 * @returns Fractional radius increase (0 = none), capped by the modifier rules.
 */
export function auraRadiusBonusFor(upgradeIds: ReadonlyArray<string>): number {
  const effects = upgradeIds.flatMap((id) => {
    const realtime = UPGRADE_CATALOG[id]?.realtime;
    return realtime ? [realtime] : [];
  });
  return combineEffects(effects).auraRadiusBonus;
}

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
    // Real-time shield HP per second. Regen accumulates over a whole battle
    // (a 3-minute reinforced match), so it is kept small: 2.4 HP/s made AE
    // lists win 80 % of reinforced battles, 0.3–0.4 HP/s ~50 % (balance report).
    magnitude: 0.4,
    description: "Allied ships slowly regenerate shields (0.4 HP/s).",
  },
};

/** How a ship qualifies to project an aura this tick. */
export type ProjectionKind = "support" | "capital" | "hero" | "crew";

/** Class-based radius/magnitude scaling for a projecting ship. */
export interface ProjectionScale {
  readonly kind: ProjectionKind;
  readonly radiusScale: number;
  readonly magnitudeScale: number;
}

/**
 * Determine whether and how a ship projects its faction aura.
 *
 * Priority: capital > dedicated support > coordinator crew or aura-projecting
 * pilot sheet > hero pilot.
 * A ship matches at most one kind so its aura is never double-counted.
 *
 * @param ship - The candidate projector.
 * @returns The projection scaling, or null if the ship projects no aura.
 */
export function projectionScaleFor(ship: AuraShip): ProjectionScale | null {
  if (ship.hull <= 0) return null;
  if (ship.systemsOnline === false) return null;
  if (ship.role === "capital") {
    return {
      kind: "capital",
      radiusScale: SIZE_RADIUS_MULTIPLIER.huge,
      magnitudeScale: SIZE_MAGNITUDE_MULTIPLIER.huge,
    };
  }
  if (ship.role === "support") {
    return {
      kind: "support",
      radiusScale: SIZE_RADIUS_MULTIPLIER[ship.size],
      magnitudeScale: SIZE_MAGNITUDE_MULTIPLIER[ship.size],
    };
  }
  if (
    ship.projectsAura === true ||
    ship.equippedUpgrades.some((id) => AURA_GRANTING_CREW.has(id))
  ) {
    return {
      kind: "crew",
      radiusScale: SIZE_RADIUS_MULTIPLIER[ship.size],
      magnitudeScale: SIZE_MAGNITUDE_MULTIPLIER[ship.size],
    };
  }
  if (ship.isUnique) {
    return {
      kind: "hero",
      radiusScale: HERO_RADIUS_SCALE,
      magnitudeScale: HERO_MAGNITUDE_SCALE,
    };
  }
  return null;
}
