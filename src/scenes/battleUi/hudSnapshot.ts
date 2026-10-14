/**
 * hudSnapshot — pure builders that turn a battle scene's flying ships into
 * the holographic HUD's plain snapshot data (player state, contacts, weapon
 * slots). No Phaser: scenes call these each frame and hand the result to
 * BattleHud.
 */

import type { ManeuverDirection } from "../../core/types";
import type { CycleFlightState } from "../../arcade/systems/CycleFlight";
import { getShipDefinition } from "../../data/ShipDefinitions";
import type {
  ContactHudState,
  HudSizeClass,
  PlayerHudState,
  WeaponSlotDescriptor,
} from "../../ui/hud/types";
import { HOLO_PALETTE, type HoloSide } from "../../ui/theme/HoloTheme";

/** What the HUD reads from a flying ship. */
export interface HudShipSource {
  readonly id: string;
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly flight: CycleFlightState;
}

/** Short readout names per maneuver direction. */
const MANEUVER_SHORT_NAMES: Readonly<Record<ManeuverDirection, string>> = {
  straight: "STRAIGHT",
  drift_left: "DRIFT L",
  drift_right: "DRIFT R",
  bank_left: "BANK L",
  bank_right: "BANK R",
  turn_left: "TURN L",
  turn_right: "TURN R",
  kturn: "SNAP",
  segnor_left: "HOOK L",
  segnor_right: "HOOK R",
  tallon_left: "KNIFE L",
  tallon_right: "KNIFE R",
};

/** Hull size used when a definition is unknown. */
const FALLBACK_SIZE_CLASS: HudSizeClass = "small";

/** HUD id of the primary laser slot. */
export const PRIMARY_WEAPON_SLOT_ID = "primary";

/**
 * Readout label for a maneuver at a speed, e.g. "BANK R 3".
 *
 * @param maneuver - Maneuver direction, or null when none.
 * @param speed - Template speed.
 * @returns The label, or null without a maneuver.
 */
export function maneuverLabel(
  maneuver: ManeuverDirection | null,
  speed: number,
): string | null {
  if (maneuver === null) return null;
  return `${MANEUVER_SHORT_NAMES[maneuver]} ${speed}`;
}

/**
 * @param definitionId - Ship definition id.
 * @returns The ship's HUD size class (blip size).
 */
export function shipSizeClass(definitionId: string): HudSizeClass {
  return getShipDefinition(definitionId)?.baseStats.size ?? FALLBACK_SIZE_CLASS;
}

/** A standing maneuver order (Continuous Tactical's dial). */
export interface HudOrder {
  readonly direction: ManeuverDirection;
  readonly speed: number;
}

/**
 * The ship the HUD is centred on, flying its current maneuver — or, when an
 * order is given, the maneuver it has been ordered to fly.
 *
 * @param ship - The ship.
 * @param order - Ordered maneuver to show instead of the one in flight.
 * @returns Player HUD state.
 */
export function playerHudState(
  ship: HudShipSource,
  order?: HudOrder,
): PlayerHudState {
  const { control } = ship.flight.motion;
  return {
    pose: { x: ship.x, y: ship.y, angle: ship.angle },
    hull: ship.hull,
    maxHull: ship.maxHull,
    shields: ship.shields,
    maxShields: ship.maxShields,
    stress: ship.flight.stress.level,
    isStressed: ship.flight.stress.isStressed,
    speed: order?.speed ?? control.speed,
    maxSpeed: control.maxSpeed,
    maneuver: order
      ? maneuverLabel(order.direction, order.speed)
      : maneuverLabel(control.currentManeuver, control.speed),
  };
}

/** A ship as an HUD contact. */
export interface ContactSource {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
}

/**
 * @param ship - Any other ship.
 * @param side - Its allegiance relative to the HUD's ship.
 * @param sizeClass - Blip size.
 * @param isTarget - Whether the HUD's ship has it locked.
 * @returns Contact state.
 */
export function contactHudState(
  ship: ContactSource,
  side: HoloSide,
  sizeClass: HudSizeClass,
  isTarget: boolean,
): ContactHudState {
  return {
    id: ship.id,
    pose: { x: ship.x, y: ship.y, angle: ship.angle },
    side,
    sizeClass,
    isTarget,
    alive: ship.hull > 0,
  };
}

/**
 * Flags the squad's marked target among the HUD contacts.
 *
 * @param contacts - HUD contacts.
 * @param markedId - The player's side's marked target, or null.
 * @returns The contacts, the marked one with `isMarked: true`.
 */
export function markContacts(
  contacts: readonly ContactHudState[],
  markedId: string | null,
): ContactHudState[] {
  return contacts.map((contact) =>
    markedId !== null && contact.id === markedId
      ? { ...contact, isMarked: true }
      : contact,
  );
}

/**
 * The always-on primary laser slot.
 *
 * @param cooldownRemainingMs - Time until it may fire again.
 * @param intervalMs - Its full attack interval.
 * @returns Slot descriptor with cooldown as a 0..1 fraction.
 */
export function primaryWeaponSlot(
  cooldownRemainingMs: number,
  intervalMs: number,
): WeaponSlotDescriptor {
  const fraction =
    intervalMs > 0 && Number.isFinite(cooldownRemainingMs)
      ? Math.min(1, Math.max(0, cooldownRemainingMs / intervalMs))
      : 0;
  return {
    id: PRIMARY_WEAPON_SLOT_ID,
    kind: "primary",
    cooldown: fraction,
    selected: true,
  };
}

/** Remaining match time (ms) under which the clock turns to warning. */
export const MATCH_CLOCK_WARNING_MS = 60_000;
/** Remaining match time (ms) under which the clock turns to danger. */
export const MATCH_CLOCK_DANGER_MS = 30_000;

/**
 * @param remainingMs - Match time left.
 * @returns Clock colour: danger, warning or primary text.
 */
export function matchClockColor(remainingMs: number): number {
  if (remainingMs <= MATCH_CLOCK_DANGER_MS) return HOLO_PALETTE.danger;
  if (remainingMs <= MATCH_CLOCK_WARNING_MS) return HOLO_PALETTE.warning;
  return HOLO_PALETTE.textPrimary;
}

/** A ship that belongs to the player's side or the AI's. */
export interface OwnedShipSource extends ContactSource {
  readonly owner: "player" | "ai";
  readonly definitionId: string;
}

/**
 * Contacts for every living ship but the one the HUD is centred on: the
 * player's other ships as allies, the AI's as enemies.
 *
 * @param focusId - The HUD's ship (left out), or null.
 * @param ships - Every ship in the battle.
 * @param targetId - Id the HUD's ship has locked, or null.
 * @returns HUD contacts.
 */
export function ownerContacts(
  focusId: string | null,
  ships: Iterable<OwnedShipSource>,
  targetId: string | null,
): ContactHudState[] {
  const contacts: ContactHudState[] = [];
  for (const ship of ships) {
    if (ship.id === focusId || ship.hull <= 0) continue;
    contacts.push(
      contactHudState(
        ship,
        ship.owner === "player" ? "ally" : "enemy",
        shipSizeClass(ship.definitionId),
        ship.id === targetId,
      ),
    );
  }
  return contacts;
}
