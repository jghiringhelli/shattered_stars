/**
 * Flight cooldowns as the input layer shows them (the touch controls' rings
 * around the roll stick and the MANEUVER button). Pure data + one helper.
 */

import type { ShipControlState } from "../core/ArcadeControls";

/** Fraction of each recharge still to go: 0 = ready, 1 = just used. */
export interface FlightCooldowns {
  readonly roll: number;
  readonly snap: number;
}

/** Nothing recharging. */
export const READY_COOLDOWNS: FlightCooldowns = { roll: 0, snap: 0 };

/**
 * @param remainingMs - Recharge time left (ms).
 * @param maxMs - The full recharge (ms).
 * @returns The fraction left, 0–1 (0 when the recharge has no length).
 */
function fractionLeft(remainingMs: number, maxMs: number): number {
  if (maxMs <= 0) return 0;
  return Math.min(1, Math.max(0, remainingMs / maxMs));
}

/**
 * @param control - A ship's control state.
 * @returns How far its barrel roll and Snap turn (shared by Hook/Knife) have recharged.
 */
export function cooldownsOf(
  control: Pick<
    ShipControlState,
    | "barrelRollCooldown"
    | "barrelRollCooldownMax"
    | "kturnCooldown"
    | "kturnCooldownMax"
  >,
): FlightCooldowns {
  return {
    roll: fractionLeft(control.barrelRollCooldown, control.barrelRollCooldownMax),
    snap: fractionLeft(control.kturnCooldown, control.kturnCooldownMax),
  };
}