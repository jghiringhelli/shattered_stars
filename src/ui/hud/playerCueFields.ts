/**
 * playerCueFields — the optional PlayerHudState fields behind the maneuver
 * cue and the firing cue, built from the player's control state and primary
 * weapon stats. Pure and render-only; the snapshot builders of every battle
 * scene spread the result into the player's HUD state.
 */

import type { BattleHudSnapshot, PlayerHudState } from "./types";
import type { ShipControlState } from "../../core/ArcadeControls";

/** The control fields the cues read. */
export type CueControlSource = Pick<
  ShipControlState,
  "currentManeuver" | "boostCooldown" | "barrelRollCooldown"
>;

/** The primary weapon stats the firing cue reads. */
export interface CueWeaponStats {
  readonly weaponRange: number;
  readonly firingArc: number;
}

/** Fields {@link playerCueFields} fills. */
export type PlayerCueFields = Pick<
  PlayerHudState,
  "maneuverSignals" | "weaponRangePx" | "firingArcDeg"
>;

/** A ship the cues read: its control state and (optionally) its weapon stats. */
export interface CueShipSource {
  readonly control: CueControlSource;
  readonly combatStats?: CueWeaponStats | undefined;
}

/**
 * @param control - The player's control state.
 * @param combatStats - The player's primary weapon stats, when known.
 * @returns Maneuver signals plus the weapon envelope (omitted without stats).
 */
export function playerCueFields(
  control: CueControlSource,
  combatStats?: CueWeaponStats,
): PlayerCueFields {
  return {
    maneuverSignals: {
      currentManeuver: control.currentManeuver,
      boostCooldown: control.boostCooldown,
      barrelRollCooldown: control.barrelRollCooldown,
    },
    weaponRangePx: combatStats?.weaponRange,
    firingArcDeg: combatStats?.firingArc,
  };
}

/**
 * Adds the cue fields to a snapshot whose player was built without them (the
 * flagship builder shared by Survival and Campaign).
 *
 * @param snapshot - HUD snapshot.
 * @param ship - The player's ship, or null when none flies.
 * @returns The snapshot with the player's cue fields set.
 */
export function withPlayerCues<S extends BattleHudSnapshot>(
  snapshot: S,
  ship: CueShipSource | null,
): S {
  if (snapshot.player === null || ship === null) return snapshot;
  return {
    ...snapshot,
    player: {
      ...snapshot.player,
      ...playerCueFields(ship.control, ship.combatStats),
    },
  };
}
