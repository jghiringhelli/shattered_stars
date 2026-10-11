/**
 * repairFeedbackModel — contracts and pure helpers of ShipRepairFeedback:
 * what a scene's ship must expose, the hooks a scene provides, how a ship's
 * own repairs are credited and how far drones orbit. No Phaser.
 */

import type Phaser from "phaser";
import { SHIP_SIZES } from "../../../config";
import type { CombatModifiers } from "../../../core/CombatModifiers";
import { getShipDefinition } from "../../../data/ShipDefinitions";
import { loadoutUpgradeIds } from "../../../arcade/ArcadeUpgradeEffects";
import type {
  RepairEvent,
  RepairSource,
} from "../../../arcade/systems/repair/RepairEvents";
import { selfRepairProfile } from "../../../arcade/systems/repair/SelfRepair";
import type { OverlayRepairNote } from "./overlayState";

/** Drones orbit at this fraction of the repaired ship's sprite size. */
export const ORBIT_RADIUS_FACTOR = 0.7;

/** What the helper needs from a scene's ship record. */
export interface RepairFeedbackShip {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly definitionId: string;
  readonly loadoutId?: string | null;
  readonly upgradeIds?: ReadonlyArray<string>;
  hull: number;
  shields: number;
  readonly maxHull: number;
  readonly maxShields: number;
  readonly modifiers: CombatModifiers;
}

/** Repair rates an allied field grants a ship this frame. */
export interface AuraRepairRates {
  readonly shieldRegenPerSecond: number;
  readonly hullRepairPerSecond: number;
  /** The projector credited for the repair (drones fly from it). */
  readonly repairSourceId: string | null;
}

/** The overlay calls the helper makes (HealthBar implements them). */
export interface RepairOverlay {
  update(hull: number, shields: number): void;
  showRepair(repair: OverlayRepairNote): void;
}

/** Scene hooks. */
export interface ShipRepairFeedbackOptions {
  readonly scene: Phaser.Scene;
  /** Live ship lookup (undefined once a ship is gone). */
  readonly shipOf: (shipId: string) => RepairFeedbackShip | undefined;
  /** The ship's overlay, if it has one. */
  readonly overlayOf: (shipId: string) => RepairOverlay | undefined;
  /** Performance particle multiplier (0–1); drones scale with it. */
  readonly particleScale?: () => number;
}

/** Inspectable state (e2e specs, debugging). */
export interface RepairFeedbackDebugState {
  readonly deliveredEvents: number;
  readonly lastEvent: RepairEvent | null;
  readonly activeDrones: number;
  readonly droneBudget: number;
}

/** A ship's own-repair sources, keyed by what they were derived from. */
export interface SelfRepairSources {
  /** The upgrade list or loadout id the sources came from (cache key). */
  readonly key: string | ReadonlyArray<string>;
  readonly shield: RepairSource;
  readonly hull: RepairSource;
}

/**
 * Cache key of a ship's own-repair sources (changes with its loadout).
 * @param ship - The ship.
 * @returns Its upgrade list, else its loadout id, else "".
 */
export function selfRepairKey(
  ship: RepairFeedbackShip,
): string | ReadonlyArray<string> {
  return ship.upgradeIds ?? ship.loadoutId ?? "";
}

/**
 * Which of a ship's cards is credited for its own repairs.
 *
 * @param ship - The ship (upgrade list, or definition + loadout).
 * @returns Credited sources per channel (no source ship: self-repair).
 */
export function selfRepairSourcesOf(
  ship: RepairFeedbackShip,
): SelfRepairSources {
  const upgradeIds =
    ship.upgradeIds ?? loadoutUpgradeIds(ship.definitionId, ship.loadoutId);
  const profile = selfRepairProfile(upgradeIds);
  return {
    key: selfRepairKey(ship),
    shield: { kind: profile.shield, sourceShipId: null },
    hull: { kind: profile.hull, sourceShipId: null },
  };
}

/**
 * Drone orbit radius around a ship, from its size class.
 *
 * @param definitionId - The ship's definition, if known.
 * @returns Radius in world px.
 */
export function droneOrbitRadius(definitionId: string | undefined): number {
  const size = definitionId
    ? (getShipDefinition(definitionId)?.baseStats.size ?? "small")
    : "small";
  return SHIP_SIZES[size] * ORBIT_RADIUS_FACTOR;
}
