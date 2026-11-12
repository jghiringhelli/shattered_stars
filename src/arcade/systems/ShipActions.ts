/**
 * ShipActions — the instant flight actions of a ship: boost, barrel roll and
 * the queued specials (Snap turn, Hook, Knife). The single path the scene,
 * the AI and the flight battery all use; they displace the ship and carry the
 * cycle in progress along (ShipMotion.shiftMotion).
 *
 * Pure: no Phaser.
 */

import {
  canBarrelRoll,
  canBoost,
  processCommand,
  useBarrelRoll,
  useBoost,
  type ShipPose,
} from "../../core/ArcadeControls";
import { BOOST_DISTANCE_PX } from "../ArcadeInputGestures";
import {
  barrelRollDistance,
  shiftMotion,
  type MotionState,
} from "./ShipMotion";

/**
 * Displace a ship along a direction relative to its heading.
 * @param state - Motion state before the dash.
 * @param relativeDeg - Direction relative to the heading (0 = ahead, +90 = right).
 * @param distancePx - Dash length in px.
 * @param worldSize - Battlefield edge length in px.
 * @returns The displaced motion state.
 */
function dash(
  state: MotionState,
  relativeDeg: number,
  distancePx: number,
  worldSize: number,
): MotionState {
  const rad = ((state.angle + relativeDeg) * Math.PI) / 180;
  return shiftMotion(
    state,
    Math.sin(rad) * distancePx,
    -Math.cos(rad) * distancePx,
    worldSize,
  );
}

/** Instant flight actions a pilot (or the AI) can trigger mid-cycle. */
export type MotionAction =
  | "boost"
  | "barrel_roll_left"
  | "barrel_roll_right"
  | "kturn"
  | "segnor_left"
  | "segnor_right"
  | "tallon_left"
  | "tallon_right";

/** Result of attempting an action. */
export interface ActionResult {
  readonly state: MotionState;
  /** False when the action was refused (on cooldown). */
  readonly performed: boolean;
}

/**
 * Perform a flight action — the single path the scene, the AI and the flight
 * battery all use. Cooldowns gate every action; stress is the caller's job.
 *
 * - Boost: dash forward BOOST_DISTANCE_PX, heading unchanged.
 * - Barrel roll: slide sideways one speed-2 template + base, heading unchanged.
 * - Snap turn / Hook / Knife: queue the special maneuver for the next cycle.
 *
 * @param state - Motion state when the action fires.
 * @param ship - The ship (identity fields).
 * @param action - The action requested.
 * @param worldSize - Battlefield edge length in px.
 * @returns The new motion state and whether the action happened.
 */
export function performAction(
  state: MotionState,
  ship: ShipPose,
  action: MotionAction,
  worldSize: number,
): ActionResult {
  const { control } = state;
  if (action === "boost") {
    if (!canBoost(control)) return { state, performed: false };
    const boosted = dash(state, 0, BOOST_DISTANCE_PX, worldSize);
    return {
      state: { ...boosted, control: useBoost(boosted.control) },
      performed: true,
    };
  }
  if (action === "barrel_roll_left" || action === "barrel_roll_right") {
    if (!canBarrelRoll(control)) return { state, performed: false };
    const side = action === "barrel_roll_left" ? -90 : 90;
    const rolled = dash(
      state,
      side,
      barrelRollDistance(control.baseSize),
      worldSize,
    );
    return {
      state: { ...rolled, control: useBarrelRoll(rolled.control) },
      performed: true,
    };
  }
  const queued = processCommand(
    { ...ship, x: state.x, y: state.y, angle: state.angle },
    control,
    action,
  );
  return {
    state: { ...state, control: queued },
    performed: queued !== control,
  };
}
