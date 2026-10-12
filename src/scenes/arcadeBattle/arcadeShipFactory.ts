/**
 * arcadeShipFactory — the Skirmish scene's ship record and how one is made:
 * the mode's combat stats (hull, shields, dice, range, arc — the same
 * ModeBalancing path at DURABILITY_SCALE every battle mode spawns by, with
 * no Skirmish-only floors), the cycle-engine control state, crew/capital
 * state and the equipped loadout (stats, modifier sheet; its secondary
 * weapons are armed by the shared runtime, BattleWeapons). Shared by the
 * opening deployment and reinforcements so both make identical ships.
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
import type { TeamId } from "../../arcade/teams";
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
  /** The team it flies for: hostility, allies, marks and victory read this, never faction. */
  readonly team: TeamId;
  /** Index of the battle-config squad it belongs to (reinforcement sub-reserve, online seat). */
  readonly squad: number;
}

/** Where and what a new ship is. */
export interface ArcadeShipSpec {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  readonly team: TeamId;
  readonly squad: number;
  readonly x: number;
  readonly y: number;
  /** Heading in degrees, 0 = up, clockwise. */
  readonly angle: number;
}

/** Who flies a spawned ship (the player's own ship, an AI wingman or an enemy). */
export type ArcadePilot = "player" | "wingman" | "ai";

/** A ship to spawn with its loadout and pilot. */
export interface ArcadeSpawnSpec extends Omit<ArcadeShipSpec, "owner"> {
  readonly loadoutId: string | null;
  readonly pilot: ArcadePilot;
}

/**
 * @param spec - Id, ship, faction, owner and pose.
 * @returns A bare ship record (no loadout) at the mode-balanced durability
 *   every battle mode spawns with.
 */
export function createArcadeShip(spec: ArcadeShipSpec): ArcadeShip {
  const def = getShipDefinition(spec.definitionId);
  const combatStats = getModeCombatStats(spec.definitionId, "continuous");
  const baseShip: ShipState = {
    id: spec.id,
    definitionId: spec.definitionId,
    faction: spec.faction,
    owner: spec.owner,
    x: spec.x,
    y: spec.y,
    angle: spec.angle,
    hull: combatStats.hull,
    maxHull: combatStats.maxHull,
    shields: combatStats.shields,
    maxShields: combatStats.maxShields,
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
    combatStats,
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
    team: spec.team,
    squad: spec.squad,
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
 * A ship ready to fly: created and its loadout equipped — the same hull and
 * shields whoever flies it and in whichever mode it spawns.
 *
 * @param spec - Id, ship, loadout, faction, pilot and pose.
 * @returns The ship record.
 */
export function spawnArcadeShip(spec: ArcadeSpawnSpec): ArcadeShip {
  const ship = createArcadeShip({
    ...spec,
    owner: spec.pilot === "player" ? "player" : "ai",
  });
  equipLoadout(ship, spec.loadoutId ?? undefined);
  return ship;
}
