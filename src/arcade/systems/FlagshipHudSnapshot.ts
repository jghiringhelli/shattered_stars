/**
 * FlagshipHudSnapshot — builds the holographic BattleHud snapshot for squad
 * battle scenes (Survival, Campaign): the flagship is the player, its wing
 * mates are allies, every AI ship an enemy; the weapon bar is the
 * flagship's autofiring primary. Pure data in, plain snapshot out.
 */

import type { ShipSize } from "../../config";
import type { ManeuverDirection } from "../../core/types";
import { getShipDefinition } from "../../data/ShipDefinitions";
import type {
  BattleHudSnapshot,
  CameraViewSnapshot,
  ContactHudState,
  PlayerHudState,
  WeaponSlotDescriptor,
} from "../../ui/hud/types";
import type { CycleFlightState } from "./CycleFlight";

/** Size class used when a ship definition is unknown. */
const FALLBACK_SIZE: ShipSize = "small";
/** Boss / capital-system hulls read as large blips. */
const BOSS_SIZE: ShipSize = "large";
/** Weapon-bar id and key hint of the autofiring primary. */
const PRIMARY_SLOT_ID = "primary";
const PRIMARY_KEY_HINT = "1";

/** Short words for maneuver-name parts on the flight readout. */
const MANEUVER_WORDS: Readonly<Record<string, string>> = {
  left: "L",
  right: "R",
  kturn: "K-TURN",
};

/** The ship fields the HUD reads. */
export interface HudShipSource {
  readonly id: string;
  readonly definitionId: string;
  readonly owner: "player" | "ai";
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly flight: CycleFlightState;
  /** Present on boss hulls (drawn as large blips). */
  readonly capitalSystems?: unknown;
}

/** Everything the snapshot needs for one frame. */
export interface SquadHudInput {
  /** The player's flagship, or null when the squad is gone. */
  readonly flagship: HudShipSource | null;
  readonly ships: Iterable<HudShipSource>;
  /** The flagship's current target, if any. */
  readonly targetId: string | null;
  /** The enemy the player's side has marked (R), if any. */
  readonly markedId?: string | null;
  /** Primary-weapon cooldown remaining (ms). */
  readonly cooldownRemainingMs: number;
  /** Full primary-weapon interval (ms). */
  readonly attackIntervalMs: number;
  readonly camera: CameraViewSnapshot;
}

/**
 * Short readout label for a maneuver, e.g. "BANK L 3" or "K-TURN 4".
 *
 * @param maneuver - The maneuver being flown, or null.
 * @param speed - Its speed.
 * @returns The label, or null when no maneuver is flown.
 */
export function maneuverLabel(
  maneuver: ManeuverDirection | null,
  speed: number,
): string | null {
  if (maneuver === null) return null;
  const words = maneuver
    .split("_")
    .map((part) => MANEUVER_WORDS[part] ?? part.toUpperCase());
  return `${words.join(" ")} ${speed}`;
}

/**
 * @param ship - The flagship.
 * @returns Its HUD state (pose, durability, stress, speed, maneuver).
 */
export function playerHudStateOf(ship: HudShipSource): PlayerHudState {
  const { control } = ship.flight.motion;
  return {
    pose: { x: ship.x, y: ship.y, angle: ship.angle },
    hull: Math.max(0, ship.hull),
    maxHull: ship.maxHull,
    shields: Math.max(0, ship.shields),
    maxShields: ship.maxShields,
    stress: ship.flight.stress.level,
    isStressed: ship.flight.stress.isStressed,
    speed: control.speed,
    maxSpeed: control.maxSpeed,
    maneuver: maneuverLabel(control.currentManeuver, control.speed),
  };
}

/**
 * @param ship - Any ship.
 * @returns Its blip size class.
 */
export function hudSizeClassOf(ship: HudShipSource): ShipSize {
  if (ship.capitalSystems) return BOSS_SIZE;
  return getShipDefinition(ship.definitionId)?.baseStats.size ?? FALLBACK_SIZE;
}

/**
 * Every living ship other than the flagship, sided from the player's view,
 * with the flagship's target and the player's squad mark flagged.
 *
 * @param input - Ships, flagship, target and mark.
 * @returns HUD contacts.
 */
export function squadContacts(
  input: Pick<SquadHudInput, "flagship" | "ships" | "targetId" | "markedId">,
): ContactHudState[] {
  const markedId = input.markedId ?? null;
  const contacts: ContactHudState[] = [];
  for (const ship of input.ships) {
    if (ship.hull <= 0 || ship.id === input.flagship?.id) continue;
    contacts.push({
      id: ship.id,
      pose: { x: ship.x, y: ship.y, angle: ship.angle },
      side: ship.owner === "player" ? "ally" : "enemy",
      sizeClass: hudSizeClassOf(ship),
      isTarget: ship.id === input.targetId,
      isMarked: ship.id === markedId,
      alive: true,
    });
  }
  return contacts;
}

/**
 * The autofiring primary weapon slot.
 *
 * @param remainingMs - Cooldown left (ms).
 * @param intervalMs - Full interval between attacks (ms).
 * @returns The slot, its cooldown as a 0..1 fraction.
 */
export function primaryWeaponSlot(
  remainingMs: number,
  intervalMs: number,
): WeaponSlotDescriptor {
  const fraction = intervalMs > 0 ? remainingMs / intervalMs : 0;
  return {
    id: PRIMARY_SLOT_ID,
    kind: "primary",
    cooldown: Math.min(1, Math.max(0, fraction)),
    selected: true,
    keyHint: PRIMARY_KEY_HINT,
  };
}

/**
 * @param input - This frame's squad state.
 * @returns The BattleHud snapshot.
 */
export function squadHudSnapshot(input: SquadHudInput): BattleHudSnapshot {
  const { flagship } = input;
  const alive = flagship !== null && flagship.hull > 0;
  return {
    player: alive ? playerHudStateOf(flagship) : null,
    contacts: squadContacts(input),
    weapons: alive
      ? [primaryWeaponSlot(input.cooldownRemainingMs, input.attackIntervalMs)]
      : [],
    camera: input.camera,
  };
}
