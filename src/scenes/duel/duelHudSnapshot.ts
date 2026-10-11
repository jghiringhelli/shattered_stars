/**
 * duelHudSnapshot — builds the holographic BattleHud snapshot for the duel
 * scenes (Dogfight, Ace Duel) from their ship records: the player's status
 * ring / readout, every other ship as a contact (ally or enemy, the player's
 * current target marked), and the autofiring primary weapon's cooldown.
 *
 * Pure: no Phaser.
 */

import type { CycleFlightState } from "../../arcade/systems/CycleFlight";
import {
  inPrimaryArc,
  primaryCooldownFraction,
  type PrimaryGunner,
} from "../../arcade/systems/DuelPrimaryFire";
import type { ManeuverDirection } from "../../core/types";
import { getShipDefinition } from "../../data/ShipDefinitions";
import { shortestDelta } from "../../ui/hud/hudMath";
import type {
  BattleHudSnapshot,
  CameraViewSnapshot,
  ContactHudState,
  HudSizeClass,
  PlayerHudState,
  WeaponSlotDescriptor,
} from "../../ui/hud/types";

/** A firing arc this wide or wider is a turret. */
const TURRET_ARC_DEG = 360;
/** Size class when a definition is missing. */
const FALLBACK_SIZE: HudSizeClass = "small";

/** What the HUD reads of a duel scene's ship record. */
export interface DuelHudShip extends PrimaryGunner {
  readonly definitionId: string;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly flight: CycleFlightState;
  /** Primary weapon cooldown remaining (ms). */
  readonly weaponCooldown: number;
}

/** One frame of duel state for the HUD. */
export interface DuelHudInput<T extends DuelHudShip> {
  readonly ships: Iterable<T>;
  /** The ship the human flies. */
  readonly playerId: string;
  /** Whether a ship flies on the player's side. */
  readonly isAlly: (ship: T) => boolean;
  readonly camera: CameraViewSnapshot;
  /** Torus side length for nearest-enemy distance. */
  readonly worldSize: number;
}

/**
 * Build the BattleHud snapshot for one frame.
 *
 * @param input - Ships, player id, side test, camera and world size.
 * @returns Player (null once destroyed), contacts and the primary weapon slot.
 */
export function buildDuelHudSnapshot<T extends DuelHudShip>(
  input: DuelHudInput<T>,
): BattleHudSnapshot {
  const ships = [...input.ships];
  const player = ships.find((ship) => ship.id === input.playerId);
  const alivePlayer = player !== undefined && player.hull > 0 ? player : null;
  const enemies = ships.filter((s) => s.hull > 0 && !input.isAlly(s));
  const targetId =
    alivePlayer === null
      ? null
      : duelTargetId(alivePlayer, enemies, input.worldSize);
  return {
    player: alivePlayer === null ? null : playerState(alivePlayer),
    contacts: ships
      .filter((ship) => ship.id !== input.playerId)
      .map((ship) => contactState(ship, input.isAlly(ship), targetId)),
    weapons: alivePlayer === null ? [] : [primarySlot(alivePlayer)],
    camera: input.camera,
  };
}

/**
 * The player's current target: the enemy its gun is on (in range and arc),
 * otherwise the nearest enemy.
 *
 * @param player - The player's ship.
 * @param enemies - Living enemy ships.
 * @param worldSize - Torus side length.
 * @returns The target's id, or null with no enemies.
 */
export function duelTargetId(
  player: PrimaryGunner,
  enemies: ReadonlyArray<Pick<DuelHudShip, "id" | "x" | "y">>,
  worldSize: number,
): string | null {
  const inSights = enemies.find((enemy) => inPrimaryArc(player, enemy));
  if (inSights) return inSights.id;
  let nearest: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const delta = shortestDelta(player, enemy, worldSize);
    const distance = Math.hypot(delta.x, delta.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = enemy.id;
    }
  }
  return nearest;
}

/**
 * Short maneuver label for the flight readout, e.g. "BANK L 3".
 *
 * @param maneuver - The maneuver flying (null = straight).
 * @param speed - Template speed.
 * @returns The label.
 */
export function maneuverLabel(
  maneuver: ManeuverDirection | null,
  speed: number,
): string {
  const [kind = "straight", side] = (maneuver ?? "straight").split("_");
  const name = kind === "kturn" ? "K-TURN" : kind.toUpperCase();
  const sideLetter = side === undefined ? "" : ` ${side[0]!.toUpperCase()}`;
  return `${name}${sideLetter} ${speed}`;
}

function playerState(ship: DuelHudShip): PlayerHudState {
  const { control } = ship.flight.motion;
  return {
    pose: { x: ship.x, y: ship.y, angle: ship.angle },
    hull: ship.hull,
    maxHull: ship.maxHull,
    shields: ship.shields,
    maxShields: ship.maxShields,
    stress: ship.flight.stress.level,
    isStressed: ship.flight.stress.isStressed,
    speed: control.speed,
    maxSpeed: control.maxSpeed,
    maneuver: maneuverLabel(control.currentManeuver, control.speed),
  };
}

function contactState(
  ship: DuelHudShip,
  isAlly: boolean,
  targetId: string | null,
): ContactHudState {
  return {
    id: ship.id,
    pose: { x: ship.x, y: ship.y, angle: ship.angle },
    side: isAlly ? "ally" : "enemy",
    sizeClass:
      getShipDefinition(ship.definitionId)?.baseStats.size ?? FALLBACK_SIZE,
    isTarget: ship.id === targetId,
    alive: ship.hull > 0,
  };
}

function primarySlot(ship: DuelHudShip): WeaponSlotDescriptor {
  return {
    id: "primary",
    kind: ship.combatStats.firingArc >= TURRET_ARC_DEG ? "turret" : "primary",
    cooldown: primaryCooldownFraction(
      ship.weaponCooldown,
      ship.combatStats.weaponCooldown,
    ),
    selected: true,
  };
}
