/**
 * ArenaShip — a ship in the skill arena, built exactly like the dice-mode
 * scenes build theirs (DogfightScene.spawnShip): continuous-mode combat
 * stats (x DURABILITY_SCALE), the default quick build equipped (stats,
 * modifier sheet, flight), the ship's dial, and the cycle flight engine.
 * Plus the pilot flying it: a bot and its hands.
 *
 * The record is mutable simulation state, like a scene's ship record.
 */

import { canBarrelRoll, canBoost, canKTurn } from "../../core/ArcadeControls";
import type { CombatModifiers } from "../../core/CombatModifiers";
import { NEUTRAL_MODIFIERS } from "../../core/CombatModifiers";
import type { ManeuverDefinition } from "../../core/types";
import { CYCLE_DURATION_MS } from "../../config";
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
import { PilotHands } from "./PilotHands";
import type {
  OwnShipView,
  PilotBot,
  Pose,
  ShipSnapshot,
  SideId,
} from "./SkillTypes";

/** Who flies an arena ship. */
export interface ArenaPilot {
  readonly bot: PilotBot;
  readonly hands: PilotHands;
  /** Arena time of the pilot's next decision (ms). */
  nextDecisionMs: number;
}

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
  readonly pilot: ArenaPilot;
}

/** What spawning a ship needs. */
export interface ArenaShipSpec {
  readonly id: string;
  readonly side: SideId;
  readonly definitionId: string;
  readonly pose: Pose;
  readonly bot: PilotBot;
  /** First decision time (ms) — staggered so pilots do not act in lockstep. */
  readonly firstDecisionMs: number;
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
    pilot: {
      bot: spec.bot,
      hands: new PilotHands(),
      nextDecisionMs: spec.firstDecisionMs,
    },
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
 * @param ship - The ship.
 * @returns (hull + shields) over their maxima, 0–1.
 */
export function healthFraction(ship: ArenaShip): number {
  const max = ship.maxHull + ship.maxShields;
  return max > 0 ? (ship.hull + ship.shields) / max : 0;
}

/**
 * @param ship - The ship.
 * @returns What any pilot can see of it.
 */
export function snapshotOf(ship: ArenaShip): ShipSnapshot {
  return {
    id: ship.id,
    side: ship.side,
    definitionId: ship.definitionId,
    alive: ship.alive,
    x: ship.x,
    y: ship.y,
    angle: ship.angle,
    speed: ship.flight.motion.control.speed,
    healthFraction: healthFraction(ship),
    isStressed: ship.flight.stress.isStressed,
    firingArcDeg: ship.combatStats.firingArc,
    weaponRange: ship.combatStats.weaponRange,
  };
}

/**
 * @param ship - The pilot's own ship.
 * @returns Everything its pilot knows exactly about it.
 */
export function ownViewOf(ship: ArenaShip): OwnShipView {
  const control = ship.flight.motion.control;
  const end = control.maneuverTarget;
  return {
    ...snapshotOf(ship),
    minSpeed: control.minSpeed,
    maxSpeed: control.maxSpeed,
    baseSize: control.baseSize,
    stressLevel: ship.flight.stress.level,
    dial: ship.dial,
    msToCommit: (1 - control.maneuverProgress) * CYCLE_DURATION_MS,
    endPose: end
      ? { x: end.x, y: end.y, angle: end.angle }
      : { x: ship.x, y: ship.y, angle: ship.angle },
    kturnReady: canKTurn(control),
    boostReady: canBoost(control),
    barrelRollReady: canBarrelRoll(control),
  };
}
