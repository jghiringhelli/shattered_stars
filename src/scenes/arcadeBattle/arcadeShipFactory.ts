/**
 * arcadeShipFactory — the Skirmish scene's ship record and how one is made:
 * real-time durability, the mode's combat stats (dice, range, arc — the
 * same ModeBalancing every battle mode fires by), the cycle-engine control
 * state, crew/capital state, the equipped loadout (stats, modifier sheet;
 * its secondary weapons are armed by the shared runtime, BattleWeapons)
 * and the arcade durability floors of the player's ship and its wingmen. Shared by the opening deployment and
 * reinforcements so both make identical ships.
 *
 * Pure: no Phaser.
 */

import type { ShipControlState } from "../../core/ArcadeControls";
import { createShipControl } from "../../arcade/systems/CycleFlight";
import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
} from "../../core/CombatModifiers";
import type { ManeuverDefinition, ShipRole, ShipState } from "../../core/types";
import { INITIAL_STRESS, type StressState } from "../../arcade/ArcadeStress";
import {
  applyControlModifiers,
  loadoutUpgradeIds,
  resolveLoadoutModifiers,
} from "../../arcade/ArcadeUpgradeEffects";
import {
  getModeCombatStats,
  type ModeCombatStats,
} from "../../data/ModeBalancing";
import type { FactionId } from "../../config";
import { getShipDefinition, getShipDial } from "../../data/ShipDefinitions";
import { uniquePilotOf } from "../../data/squadRules";
import { applyLoadoutEffects } from "../../systems/BattleHelpers";
import {
  createCapitalSystems,
  type CapitalSystemsState,
} from "../../systems/CapitalSystems";
import {
  createCommanderOrders,
  type CommanderOrders,
  type CrewRole,
} from "../../systems/ShipCrew";
import {
  PLAYER_HULL_FLOOR,
  PLAYER_SHIELD_FLOOR,
  WINGMAN_HULL_FLOOR,
  realTimeDurability,
} from "./arcadeDurability";

/** A Skirmish ship record. */
export interface ArcadeShip extends ShipState {
  control: ShipControlState;
  /** The mode's dice, primary range/arc and weapon cooldown. */
  combatStats: ModeCombatStats;
  /** Time left before the primary weapon may attack again (ms). */
  weaponCooldown: number;
  /** 'pilot' flies the ship; 'gunner' controls the turret; 'commander' issues ship orders (capital only). */
  crewMode: CrewRole;
  /** Ship role cached from ShipDefinition — drives support auras. */
  role: ShipRole;
  /** Current pilot stress state — built from this ship's maneuver dial. */
  stress: StressState;
  /** Maneuver dial for this ship; drives stress classification each frame. */
  shipDial: readonly ManeuverDefinition[];
  /** Subsystem damage state (engines/turrets/bridge) — only set for capital-role ships. */
  capitalSystems: CapitalSystemsState | null;
  /** Commander order state (concentrate fire/power redirect/main beam/repair) — only set for capital-role ships. */
  commanderOrders: CommanderOrders | null;
  /** The quick-build loadout equipped, or null for the bare ship. */
  loadoutId: string | null;
  /** Upgrade ids equipped by this ship's loadout. */
  upgradeIds: ReadonlyArray<string>;
  /** Real-time effects of those upgrades, folded into one sheet. */
  modifiers: CombatModifiers;
  /** True when a named (unique) pilot flies this ship — projects a hero aura. */
  isUniquePilot: boolean;
  /** Scene time (ms) until which a kill-frenzy pilot ability is active. */
  frenzyUntilMs: number;
}

/** Where and what a new ship is. */
export interface ArcadeShipSpec {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  readonly x: number;
  readonly y: number;
  /** Heading in degrees, 0 = up, clockwise. */
  readonly angle: number;
}

/** Who flies a spawned ship (sets its durability floors). */
export type ArcadePilot = "player" | "wingman" | "ai";

/** A ship to spawn with its loadout and pilot. */
export interface ArcadeSpawnSpec extends Omit<ArcadeShipSpec, "owner"> {
  readonly loadoutId: string | null;
  readonly pilot: ArcadePilot;
}

/**
 * @param spec - Id, ship, faction, owner and pose.
 * @returns A bare ship record (no loadout) at real-time durability.
 */
export function createArcadeShip(spec: ArcadeShipSpec): ArcadeShip {
  const def = getShipDefinition(spec.definitionId);
  const durability = realTimeDurability(def?.baseStats);
  const baseShip: ShipState = {
    id: spec.id,
    definitionId: spec.definitionId,
    faction: spec.faction,
    owner: spec.owner,
    x: spec.x,
    y: spec.y,
    angle: spec.angle,
    hull: durability.hull,
    maxHull: durability.hull,
    shields: durability.shields,
    maxShields: durability.shields,
    isStressed: false,
    hasFocus: false,
    hasEvade: false,
    hasTargetLock: null,
    isCloaked: false,
    currentManeuver: null,
    maneuverProgress: 0,
    mobileArcDirection: "front",
    charges: 0,
    maxCharges: 0,
  };
  const isCapital = def?.role === "capital";
  return {
    ...baseShip,
    control: createShipControl(spec.definitionId, baseShip),
    combatStats: getModeCombatStats(spec.definitionId, "continuous"),
    weaponCooldown: 0,
    crewMode: "pilot",
    role: def?.role ?? "heavy_fighter",
    stress: INITIAL_STRESS,
    shipDial: getShipDial(spec.definitionId),
    capitalSystems: isCapital ? createCapitalSystems(baseShip.hull) : null,
    commanderOrders: isCapital ? createCommanderOrders() : null,
    loadoutId: null,
    upgradeIds: [],
    modifiers: NEUTRAL_MODIFIERS,
    isUniquePilot: false,
    frenzyUntilMs: 0,
  };
}

/**
 * Equip a loadout on a freshly created ship: stat bonuses (hull, shields,
 * dice), the real-time modifier sheet (upgrades + the pilot's ability) and
 * upgraded maneuver recharge times. Its secondary weapons are armed by the
 * scene's shared runtime from the same loadout.
 *
 * @param ship - The ship to equip (mutated in place, before first update).
 * @param loadoutId - Chosen loadout id, or undefined for the bare ship.
 */
export function equipLoadout(
  ship: ArcadeShip,
  loadoutId: string | undefined,
): void {
  applyLoadoutEffects(ship, loadoutId);
  const upgradeIds = loadoutUpgradeIds(ship.definitionId, loadoutId);
  const modifiers = resolveLoadoutModifiers(ship.definitionId, loadoutId);
  ship.loadoutId = loadoutId ?? null;
  ship.upgradeIds = upgradeIds;
  ship.modifiers = modifiers;
  ship.isUniquePilot = uniquePilotOf(loadoutId ?? null) !== null;
  ship.control = applyControlModifiers(ship.control, modifiers);
}

/**
 * A ship ready to fly: created, its arcade floors applied (the player's
 * hull and shields before the loadout; a wingman's hull after it, so
 * glass-cannon light fighters survive a hit) and its loadout equipped.
 *
 * @param spec - Id, ship, loadout, faction, pilot and pose.
 * @returns The ship record.
 */
export function spawnArcadeShip(spec: ArcadeSpawnSpec): ArcadeShip {
  const ship = createArcadeShip({
    ...spec,
    owner: spec.pilot === "player" ? "player" : "ai",
  });
  if (spec.pilot === "player") {
    ship.hull = ship.maxHull = Math.max(PLAYER_HULL_FLOOR, ship.maxHull);
    ship.shields = ship.maxShields = Math.max(
      PLAYER_SHIELD_FLOOR,
      ship.maxShields,
    );
  }
  equipLoadout(ship, spec.loadoutId ?? undefined);
  if (spec.pilot === "wingman")
    ship.hull = ship.maxHull = Math.max(WINGMAN_HULL_FLOOR, ship.maxHull);
  return ship;
}
