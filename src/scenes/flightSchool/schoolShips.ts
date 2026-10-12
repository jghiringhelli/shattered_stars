/**
 * schoolShips — Flight School's ship records and factory. Ships are built
 * exactly like Dogfight's (mode combat stats, the shared cycle-flight
 * state, the ship's own dial), so the player learns the real handling.
 */

import Phaser from "phaser";
import { SHIP_SIZES, type FactionId } from "../../config";
import {
  createCycleFlight,
  type CycleFlightState,
} from "../../arcade/systems/CycleFlight";
import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
} from "../../core/CombatModifiers";
import type { ManeuverDefinition } from "../../core/types";
import { UNRESTRICTED_CAPABILITIES } from "../../core/flightCapabilityTypes";
import {
  getModeCombatStats,
  type ModeCombatStats,
} from "../../data/ModeBalancing";
import { getShipDefinition, getShipDial } from "../../data/ShipDefinitions";
import { addShipVisual } from "../../rendering/ShipVisual";

/** What a Flight School ship is for. */
export type SchoolRole = "player" | "drone" | "beacon" | "bot";

/** A Flight School ship (duel HUD / crew / dice-attack compatible). */
export interface SchoolShip {
  readonly id: string;
  readonly role: SchoolRole;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
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
  weaponCooldown: number;
  readonly modifiers: CombatModifiers;
  readonly frenzyUntilMs: number;
  sprite: Phaser.GameObjects.Container | null;
}

/** Ship definitions used by the course. */
export const SCHOOL_SHIPS = {
  player: { definitionId: "confed_falcon", faction: "free_confederation" },
  drone: { definitionId: "terran_viper", faction: "terran_hegemony" },
  beacon: { definitionId: "confed_sparrow", faction: "free_confederation" },
  bot: { definitionId: "terran_raptor", faction: "terran_hegemony" },
} as const satisfies Record<
  SchoolRole,
  { definitionId: string; faction: FactionId }
>;

/**
 * The trainee flies a simulator configuration with every special and dash
 * unlocked, so each lesson can be practised in one ship; every real ship
 * flies only what its dial and action bar list (FlightCapabilities).
 *
 * @param role - The ship's role in the course.
 * @param flight - Its flight state as built from its card.
 * @returns The flight state (unrestricted for the trainee).
 */
function trainerFlight(
  role: SchoolRole,
  flight: CycleFlightState,
): CycleFlightState {
  if (role !== "player") return flight;
  const control = {
    ...flight.motion.control,
    capabilities: UNRESTRICTED_CAPABILITIES,
  };
  return { ...flight, motion: { ...flight.motion, control } };
}

/** Sprite depth (above the background, below the HUD). */
const SHIP_DEPTH = 10;

/**
 * Create a ship of a role at a pose, with its sprite.
 *
 * @param scene - Flight School scene.
 * @param role - What it is for.
 * @param pose - Spawn pose (angle in degrees, 0 = north).
 * @returns The ship record.
 */
export function spawnSchoolShip(
  scene: Phaser.Scene,
  role: SchoolRole,
  pose: { readonly x: number; readonly y: number; readonly angle: number },
): SchoolShip {
  const { definitionId, faction } = SCHOOL_SHIPS[role];
  const stats = getModeCombatStats(definitionId, "continuous");
  const ship: SchoolShip = {
    id: role === "player" ? "player_0" : role,
    role,
    definitionId,
    faction,
    owner: role === "player" || role === "beacon" ? "player" : "ai",
    x: pose.x,
    y: pose.y,
    angle: pose.angle,
    hull: stats.hull,
    maxHull: stats.maxHull,
    shields: stats.shields,
    maxShields: stats.maxShields,
    combatStats: stats,
    flight: trainerFlight(role, createCycleFlight(definitionId, pose)),
    dial: getShipDial(definitionId),
    weaponCooldown: 0,
    modifiers: NEUTRAL_MODIFIERS,
    frenzyUntilMs: 0,
    sprite: null,
  };
  ship.sprite = createSprite(scene, ship);
  return ship;
}

function createSprite(
  scene: Phaser.Scene,
  ship: SchoolShip,
): Phaser.GameObjects.Container {
  const container = scene.add.container(ship.x, ship.y);
  const sizeName =
    getShipDefinition(ship.definitionId)?.baseStats.size ?? "medium";
  addShipVisual(scene, container, {
    definitionId: ship.definitionId,
    faction: ship.faction,
    fallbackSizeName: sizeName,
    size: SHIP_SIZES[sizeName] ?? SHIP_SIZES.medium,
    isPlayer: ship.role === "player",
  });
  return container.setAngle(ship.angle).setDepth(SHIP_DEPTH);
}

/**
 * Mirror a ship's flight pose onto its record and sprite.
 *
 * @param ship - The ship.
 * @param flight - Its new flight state.
 */
export function setSchoolFlight(
  ship: SchoolShip,
  flight: CycleFlightState,
): void {
  ship.flight = flight;
  ship.x = flight.motion.x;
  ship.y = flight.motion.y;
  ship.angle = flight.motion.angle;
  ship.sprite?.setPosition(ship.x, ship.y).setAngle(ship.angle);
}

/**
 * Remove a ship's sprite.
 *
 * @param ship - The ship.
 */
export function destroySchoolShip(ship: SchoolShip): void {
  ship.sprite?.destroy();
  ship.sprite = null;
}

/**
 * A pose `distance` px from the player along `bearingDeg` relative to its
 * nose (0 = dead ahead, 180 = behind), facing `facingDeg` relative too.
 *
 * @param player - The player ship.
 * @param distance - Distance (px).
 * @param bearingDeg - Relative bearing.
 * @param facingDeg - Relative facing.
 * @returns World pose.
 */
export function poseFromPlayer(
  player: Pick<SchoolShip, "x" | "y" | "angle">,
  distance: number,
  bearingDeg: number,
  facingDeg = 0,
): { x: number; y: number; angle: number } {
  const rad = Phaser.Math.DegToRad(player.angle + bearingDeg);
  return {
    x: player.x + Math.sin(rad) * distance,
    y: player.y - Math.cos(rad) * distance,
    angle: Phaser.Math.Angle.WrapDegrees(player.angle + facingDeg),
  };
}
