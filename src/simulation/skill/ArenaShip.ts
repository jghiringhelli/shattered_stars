/**
 * ArenaShip — a ship in the skill arena, built exactly like the dice-mode
 * scenes build theirs (DogfightScene.spawnShip): continuous-mode combat
 * stats (x DURABILITY_SCALE), the default quick build equipped (stats,
 * modifier sheet, flight), the ship's dial, and the cycle flight engine.
 * Flown by a BotPilot — the same adapter the scenes give their AI ships.
 *
 * The record is mutable simulation state, like a scene's ship record.
 */

import type { CombatModifiers } from "../../core/CombatModifiers";
import { NEUTRAL_MODIFIERS } from "../../core/CombatModifiers";
import type { ManeuverDefinition } from "../../core/types";
import {
  getModeCombatStats,
  type ModeCombatStats,
} from "../../data/ModeBalancing";
import { getShipDial } from "../../data/ShipDefinitions";
import {
  createCycleFlight,
  type CycleFlightState,
} from "../../arcade/systems/CycleFlight";
import {
  assignQuickBuilds,
  equipFlight,
  equipQuickBuild,
} from "../../arcade/systems/QuickBuildEquip";
import type { BotPilot } from "../../arcade/ai/BotPilot";
import type { Pose } from "../../arcade/ai/BotTypes";
import type { BotContact } from "../../arcade/ai/BotView";
import type { SideId } from "./ArenaSide";

/** A ship in the arena. */
export interface ArenaShip {
  readonly id: string;
  readonly side: SideId;
  readonly definitionId: string;
  readonly loadoutId: string | null;
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  readonly combatStats: ModeCombatStats;
  flight: CycleFlightState;
  readonly dial: readonly ManeuverDefinition[];
  modifiers: CombatModifiers;
  frenzyUntilMs: number;
  /** Time until the primary may attack again (ms). */
  weaponCooldownMs: number;
  alive: boolean;
  readonly pilot: BotPilot;
}

/** What spawning a ship needs. */
export interface ArenaShipSpec {
  readonly id: string;
  readonly side: SideId;
  readonly definitionId: string;
  readonly pose: Pose;
  readonly pilot: BotPilot;
  /** Quick build to equip; omitted = the default one (as the scenes pick it). */
  readonly loadoutId?: string | null;
}

/**
 * Build a ship the way the dice-mode scenes do.
 *
 * @param spec - Identity, side, hull, spawn pose and pilot.
 * @returns The equipped, flying ship.
 */
export function spawnArenaShip(spec: ArenaShipSpec): ArenaShip {
  const combatStats = {
    ...getModeCombatStats(spec.definitionId, "continuous"),
  };
  const loadoutId =
    spec.loadoutId !== undefined
      ? spec.loadoutId
      : (assignQuickBuilds([spec.definitionId])[0] ?? null);
  const ship: ArenaShip = {
    id: spec.id,
    side: spec.side,
    definitionId: spec.definitionId,
    loadoutId,
    ...spec.pose,
    hull: combatStats.hull,
    maxHull: combatStats.maxHull,
    shields: combatStats.shields,
    maxShields: combatStats.maxShields,
    combatStats,
    flight: createCycleFlight(spec.definitionId, spec.pose),
    dial: getShipDial(spec.definitionId),
    modifiers: NEUTRAL_MODIFIERS,
    frenzyUntilMs: 0,
    weaponCooldownMs: 0,
    alive: true,
    pilot: spec.pilot,
  };
  ship.modifiers = equipQuickBuild(ship, loadoutId);
  ship.flight = equipFlight(ship.flight, ship.modifiers);
  ship.alive = ship.hull > 0;
  return ship;
}

/**
 * Store a new flight state and mirror its pose onto the record.
 * @param ship - The ship.
 * @param flight - Its new flight state.
 */
export function setArenaFlight(
  ship: ArenaShip,
  flight: CycleFlightState,
): void {
  ship.flight = flight;
  ship.x = flight.motion.x;
  ship.y = flight.motion.y;
  ship.angle = flight.motion.angle;
}

/**
 * The ship as a scene describes it to the AI (BotPilot / SquadCommand).
 * @param ship - The ship.
 * @returns Its contact record.
 */
export function contactOf(ship: ArenaShip): BotContact {
  return {
    id: ship.id,
    side: ship.side,
    definitionId: ship.definitionId,
    x: ship.x,
    y: ship.y,
    angle: ship.angle,
    alive: ship.alive,
    hull: ship.hull,
    maxHull: ship.maxHull,
    shields: ship.shields,
    maxShields: ship.maxShields,
    firingArcDeg: ship.combatStats.firingArc,
    weaponRange: ship.combatStats.weaponRange,
    speed: ship.flight.motion.control.speed,
    isStressed: ship.flight.stress.isStressed,
  };
}
