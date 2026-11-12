/**
 * PilotFlightInputs — the pure readers of one frame of pilot input that
 * PilotFlightControls orchestrates: which side the arrows steer, the frame's
 * presses (edges + recognised gestures), and the requests derived from them.
 *
 * Pure: no Phaser.
 */

import {
  updateGestures,
  type GestureAction,
  type GestureState,
} from "../ArcadeInputGestures";
import { updateManeuverKey, type ManeuverKeyResult } from "../ManeuverKey";
import {
  IDLE_STEERING,
  updateHeldSteering,
  type SteerInput,
} from "../SteeringIntent";
import type { applySpecials } from "./PilotFlightSteps";
import type {
  FlightEdge,
  FlightInput,
  FlownShip,
  PilotControlState,
} from "./PilotFlightTypes";

/** This frame's presses: edge intents and recognised arrow gestures. */
export interface FramePresses {
  readonly edge: (e: FlightEdge) => boolean;
  readonly has: (a: GestureAction) => boolean;
}

/**
 * @param input - This frame's input.
 * @param actions - The gesture actions recognised this frame.
 * @returns This frame's presses.
 */
function pressesOf(
  input: FlightInput,
  actions: readonly GestureAction[],
): FramePresses {
  return {
    edge: (e) => input.edges.has(e),
    has: (a) => actions.includes(a),
  };
}

/**
 * Which way the arrows steer: one side held alone, otherwise none.
 * @param input - This frame's input.
 * @returns The steering side.
 */
export function steerSide(input: FlightInput): SteerInput {
  if (input.left && !input.right) return "left";
  if (input.right && !input.left) return "right";
  return "none";
}

/**
 * Huge ships have no maneuver key: it shares LT with commander order 1, so
 * for them it is not a flight input at all (no gesture, no refusal flash,
 * the arrows keep steering).
 *
 * @param flown - The ship being flown.
 * @param input - This frame's input.
 * @returns Whether the maneuver key counts as held for this ship.
 */
export function holdsManeuverKey(
  flown: FlownShip,
  input: FlightInput,
): boolean {
  if (!input.maneuver) return false;
  return flown.motion.control.capabilities?.canManeuver !== false;
}

/**
 * Held steering, idled while a roll or a Hook/Knife chord stays latched
 * (until both arrows are released) so the gesture's own keys do not also
 * bank the ship. A roll's double-tap cancels the drift its first tap queued.
 *
 * @param pilot - Input memory from the previous frame.
 * @param input - This frame's input.
 * @param key - What the maneuver key did this frame.
 * @param rolled - Whether a double-tap roll was flown this frame.
 * @returns Steering memory and the latch after this frame.
 */
export function applySteeringInput(
  pilot: PilotControlState,
  input: FlightInput,
  key: ManeuverKeyResult,
  rolled: boolean,
): Pick<PilotControlState, "steering" | "steerLatched"> {
  const chorded = key.special !== null && key.special !== "kturn";
  const steerLatched =
    (pilot.steerLatched || rolled || chorded) && (input.left || input.right);
  const steering = steerLatched
    ? IDLE_STEERING
    : updateHeldSteering(pilot.steering, steerSide(input), input.deltaMs);
  return { steering, steerLatched };
}

/**
 * Hold is a bank (SteeringIntent); only a deliberate Q/E press is a 90° turn.
 *
 * @param pressed - This frame's presses.
 * @returns The hard-turn side requested, or null.
 */
export function hardTurnOf(pressed: FramePresses): "left" | "right" | null {
  if (pressed.edge("SHARP_TURN_LEFT")) return "left";
  if (pressed.edge("SHARP_TURN_RIGHT")) return "right";
  return null;
}

/**
 * Snap turn, Hook and Knife — from the maneuver key, a direct key/button
 * edge or the ↓↓ gesture — as requests for applySpecials.
 *
 * @param pressed - This frame's presses.
 * @param key - What the maneuver key did this frame.
 * @returns The specials requested (key, direct edge or gesture), with their effect events.
 */
export function specialRequestsOf(
  pressed: FramePresses,
  key: ManeuverKeyResult,
): Parameters<typeof applySpecials>[2] {
  const { edge, has } = pressed;
  const is = (name: string): boolean => key.special === name;
  return [
    [edge("KTURN") || has("kturn_gesture") || is("kturn"), "kturn", "kturn"],
    [edge("SEGNOR_LEFT") || is("segnor_left"), "segnor_left", "segnor"],
    [edge("SEGNOR_RIGHT") || is("segnor_right"), "segnor_right", "segnor"],
    [edge("TALLON_LEFT") || is("tallon_left"), "tallon_left", "tallon"],
    [edge("TALLON_RIGHT") || is("tallon_right"), "tallon_right", "tallon"],
  ];
}

/**
 * Gamepad/extra-key roll buttons as the gesture actions a roll produces. A
 * button is a deliberate press: unlike a double-tap it reports refusals, and
 * it never latches steering.
 *
 * @param edges - This frame's flight edges.
 * @returns The barrel-roll actions pressed this frame.
 */
export function rollButtonsOf(edges: ReadonlySet<FlightEdge>): GestureAction[] {
  const actions: GestureAction[] = [];
  if (edges.has("BARREL_ROLL_LEFT")) actions.push("barrel_roll_left");
  if (edges.has("BARREL_ROLL_RIGHT")) actions.push("barrel_roll_right");
  return actions;
}

/** What the pilot's keys did this frame: gesture memory, maneuver key and presses. */
export interface HeardInput {
  readonly gestureState: GestureState;
  readonly key: ManeuverKeyResult;
  readonly pressed: FramePresses;
}

/**
 * Run the gesture and maneuver-key recognisers on this frame's keys.
 *
 * @param pilot - Input memory from the previous frame.
 * @param flown - The ship being flown.
 * @param input - This frame's input.
 * @returns Their updated memory and this frame's presses.
 */
export function hearInput(
  pilot: PilotControlState,
  flown: FlownShip,
  input: FlightInput,
): HeardInput {
  const maneuverHeld = holdsManeuverKey(flown, input);
  const gestures = updateGestures({
    state: pilot.gesture,
    leftDown: input.left,
    rightDown: input.right,
    upDown: input.up,
    downDown: input.down,
    nowMs: input.nowMs,
    deltaMs: input.deltaMs,
    allowChordBarrelRoll: input.allowChordBarrelRoll ?? false,
    maneuverHeld,
  });
  const key = updateManeuverKey(pilot.maneuver, {
    held: maneuverHeld,
    left: input.left,
    right: input.right,
    nowMs: input.nowMs,
  });
  return {
    gestureState: gestures.state,
    key,
    pressed: pressesOf(input, gestures.actions),
  };
}
