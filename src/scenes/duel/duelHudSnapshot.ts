/**
 * duelHudSnapshot — builds the holographic BattleHud snapshot for the duel
 * scenes (Dogfight, Ace Duel) from their ship records: the player's status
 * ring / readout, every other ship as a contact (ally or enemy, the player's
 * current target locked, the side's squad-mark target marked), and the
 * autofiring primary weapon's cooldown.
 *
 * Pure: no Phaser.
 */

import { weaponBarSlots } from "../battleUi/sceneWeapons";
import type { CycleFlightState } from "../../arcade/systems/CycleFlight";
import {
  inPrimaryArc,
  primaryCooldownFraction,
  type PrimaryGunner,
} from "../../arcade/systems/DuelPrimaryFire";
import { SPECIAL_MANEUVER_WORDS } from "../../core/maneuverLabels";
import type { ManeuverDirection } from "../../core/types";
import { getShipDefinition } from "../../data/ShipDefinitions";
import { speedDistortionTarget } from "../../rendering/speedDistortion";
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
  /** The target the player's side has marked (SquadMark), or null/omitted. */
  readonly markedId?: string | null;
  /** Secondary weapons and turret of the player's ship (BattleWeapons). */
  readonly secondaryWeapons?: readonly WeaponSlotDescriptor[];
}

/** What picking the player's HUD target needs (a DuelHudInput without camera). */
export type DuelTargetInput<T extends DuelHudShip> = Pick<
  DuelHudInput<T>,
  "ships" | "playerId" | "isAlly" | "worldSize"
>;

/**
 * Build the BattleHud snapshot for one frame.
 *
 * @param input - Ships, player id, side test, camera, world size and the
 *   player's side mark.
 * @returns Player (null once destroyed), contacts and the primary weapon slot.
 */
export function buildDuelHudSnapshot<T extends DuelHudShip>(
  input: DuelHudInput<T>,
): BattleHudSnapshot {
  const ships = [...input.ships];
  const player = ships.find((ship) => ship.id === input.playerId);
  const alivePlayer = player !== undefined && player.hull > 0 ? player : null;
  const targetId = playerTargetId({ ...input, ships });
  return {
    player: alivePlayer === null ? null : playerState(alivePlayer),
    contacts: ships
      .filter((ship) => ship.id !== input.playerId)
      .map((ship) =>
        contactState(ship, input.isAlly(ship), {
          targetId,
          markedId: input.markedId ?? null,
        }),
      ),
    weapons:
      alivePlayer === null
        ? []
        : weaponBarSlots(
            primarySlot(alivePlayer),
            input.secondaryWeapons ?? [],
          ),
    camera: input.camera,
  };
}

/**
 * The HUD's current target for the player (what R marks).
 *
 * @param input - Ships, player id, side test and world size.
 * @returns The target's id, or null (player destroyed, or no enemies).
 */
export function playerTargetId<T extends DuelHudShip>(
  input: DuelTargetInput<T>,
): string | null {
  const ships = [...input.ships];
  const player = ships.find((ship) => ship.id === input.playerId);
  if (player === undefined || player.hull <= 0) return null;
  const enemies = ships.filter((s) => s.hull > 0 && !input.isAlly(s));
  return duelTargetId(player, enemies, input.worldSize);
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
  const inSights = enemies.find((enemy) =>
    inPrimaryArc(player, enemy, worldSize),
  );
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
  const name = SPECIAL_MANEUVER_WORDS[kind] ?? kind.toUpperCase();
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
    speedDistortion: speedDistortionTarget(control),
  };
}

/** The player's locked and marked targets. */
interface HudTargets {
  readonly targetId: string | null;
  readonly markedId: string | null;
}

function contactState(
  ship: DuelHudShip,
  isAlly: boolean,
  targets: HudTargets,
): ContactHudState {
  return {
    id: ship.id,
    pose: { x: ship.x, y: ship.y, angle: ship.angle },
    side: isAlly ? "ally" : "enemy",
    sizeClass:
      getShipDefinition(ship.definitionId)?.baseStats.size ?? FALLBACK_SIZE,
    isTarget: ship.id === targets.targetId,
    isMarked: ship.id === targets.markedId,
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
