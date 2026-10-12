/**
 * arcadeHudModel — turns Skirmish scene state into the plain data the
 * holographic HUD draws: the player readout, radar/edge contacts and the
 * marked target (the weapon bar comes from the shared weapon HUD model,
 * battleUi/weaponHud; the side panels from arcadeStatusModel).
 *
 * Pure: no Phaser. The scene hands in read-only views of its ships.
 */

import type { ShipControlState } from "../../core/ArcadeControls";
import type { ManeuverDirection } from "../../core/types";
import type { StressState } from "../../arcade/ArcadeStress";
import type { ShipSize } from "../../config";
import type {
  BattleHudSnapshot,
  CameraViewSnapshot,
  ContactHudState,
  PlayerHudState,
  WeaponSlotDescriptor,
} from "../../ui/hud/types";
import { nearestInArc, type ArcCandidate } from "./arcTargeting";

/** Half-width of the forward arc in which the HUD picks the player's target (°). */
export const TARGET_ARC_HALF_DEG = 60;
/** What the HUD reads of a ship. */
export interface HudShipView extends ArcCandidate {
  readonly definitionId: string;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly isCloaked: boolean;
  readonly stress: StressState;
  readonly control: ShipControlState;
}

const MANEUVER_LABELS: Readonly<Record<ManeuverDirection, string>> = {
  straight: "STRAIGHT",
  drift_left: "DRIFT L",
  drift_right: "DRIFT R",
  bank_left: "BANK L",
  bank_right: "BANK R",
  turn_left: "TURN L",
  turn_right: "TURN R",
  kturn: "K-TURN",
  segnor_left: "SEGNOR L",
  segnor_right: "SEGNOR R",
  tallon_left: "TALLON L",
  tallon_right: "TALLON R",
};

/**
 * Short maneuver label: the queued maneuver if any (it flies next), else the
 * one in progress, followed by the speed.
 *
 * @param control - The ship's flight control state.
 * @returns e.g. "BANK R 3"; queued maneuvers are prefixed with "▸ ".
 */
export function maneuverHudLabel(control: ShipControlState): string {
  const queued = control.nextManeuver;
  const shown = queued ?? control.currentManeuver ?? "straight";
  const label = `${MANEUVER_LABELS[shown] ?? shown.toUpperCase()} ${control.speed}`;
  return queued ? `▸ ${label}` : label;
}

/**
 * The player's readout.
 *
 * @param ship - The player's ship.
 * @returns Pose, durability, stress, speed and maneuver.
 */
export function toPlayerHudState(ship: HudShipView): PlayerHudState {
  return {
    pose: { x: ship.x, y: ship.y, angle: ship.angle },
    hull: Math.max(0, ship.hull),
    maxHull: ship.maxHull,
    shields: Math.max(0, ship.shields),
    maxShields: ship.maxShields,
    stress: ship.stress.level,
    isStressed: ship.stress.isStressed,
    speed: ship.control.speed,
    maxSpeed: ship.control.maxSpeed,
    maneuver: maneuverHudLabel(ship.control),
  };
}

/** Who is looking at the contacts. */
export interface ContactPerspective {
  readonly playerId: string | null;
  readonly playerFaction: string;
  readonly targetId: string | null;
  /** The player's side's marked target (SquadMark); omitted/null = none. */
  readonly markedId?: string | null;
  readonly sizeOf: (definitionId: string) => ShipSize;
}

/**
 * Every other living ship as a radar / edge-arrow contact. Cloaked enemies
 * are hidden — the player can barely see them on screen either.
 *
 * @param ships - All ships in the battle.
 * @param view - Player id, side, locked target and marked target.
 * @returns Contacts, excluding the player's own ship.
 */
export function toContacts(
  ships: Iterable<HudShipView>,
  view: ContactPerspective,
): ContactHudState[] {
  const contacts: ContactHudState[] = [];
  for (const ship of ships) {
    if (ship.id === view.playerId || ship.hull <= 0) continue;
    const isAlly = ship.faction === view.playerFaction;
    if (!isAlly && ship.isCloaked) continue;
    contacts.push({
      id: ship.id,
      pose: { x: ship.x, y: ship.y, angle: ship.angle },
      side: isAlly ? "ally" : "enemy",
      sizeClass: view.sizeOf(ship.definitionId),
      isTarget: ship.id === view.targetId,
      isMarked: !isAlly && ship.id === (view.markedId ?? null),
      alive: true,
    });
  }
  return contacts;
}

/**
 * The player's target: the nearest visible enemy in the forward arc — the
 * same ship a homing missile fired now would lock.
 *
 * @param player - The player's ship.
 * @param ships - All ships.
 * @param worldSize - Torus side length.
 * @returns The target's id, or null when no enemy is in the arc.
 */
export function selectHudTargetId(
  player: HudShipView,
  ships: Iterable<HudShipView>,
  worldSize: number,
): string | null {
  const enemies = [...ships].filter(
    (s) => s.faction !== player.faction && s.hull > 0 && !s.isCloaked,
  );
  return (
    nearestInArc(player, player.angle, enemies, TARGET_ARC_HALF_DEG, worldSize)
      ?.id ?? null
  );
}

export interface HudSnapshotInput {
  /** The player's ship; null (or destroyed) hides player-centric widgets. */
  readonly player: HudShipView | null;
  readonly ships: ReadonlyArray<HudShipView>;
  readonly playerFaction: string;
  /** The player's weapon bar (primary + secondaries), left to right. */
  readonly weapons: ReadonlyArray<WeaponSlotDescriptor>;
  readonly camera: CameraViewSnapshot;
  readonly worldSize: number;
  readonly sizeOf: (definitionId: string) => ShipSize;
  /** The player's side's marked target (SquadMark); omitted/null = none. */
  readonly markedId?: string | null;
}

/** A BattleHud snapshot plus the target it marks. */
export interface HudFrameModel {
  readonly snapshot: BattleHudSnapshot;
  readonly targetId: string | null;
}

/**
 * Build the BattleHud snapshot for one frame.
 *
 * @param input - Ships, player, selection and camera.
 * @returns The snapshot and the marked target id.
 */
export function buildBattleHudSnapshot(input: HudSnapshotInput): HudFrameModel {
  const player = input.player && input.player.hull > 0 ? input.player : null;
  const targetId = player
    ? selectHudTargetId(player, input.ships, input.worldSize)
    : null;
  const contacts = toContacts(input.ships, {
    playerId: input.player?.id ?? null,
    playerFaction: input.playerFaction,
    targetId,
    markedId: input.markedId ?? null,
    sizeOf: input.sizeOf,
  });
  return {
    targetId,
    snapshot: {
      player: player ? toPlayerHudState(player) : null,
      contacts,
      weapons: player ? input.weapons : [],
      camera: input.camera,
    },
  };
}
