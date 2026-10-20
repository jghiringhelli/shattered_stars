/**
 * PilotFlightControls — the player's flight inputs, shared by every battle
 * scene that flies the X-Wing cycle engine.
 *
 * Turns one frame of input (held steering/throttle + edge intents) into
 * changes on the ship's motion and stress:
 * - Throttle up/down: one speed step.
 * - Steering: tap = 30° drift, hold = one 45° bank then drift
 *   (SteeringIntent), hard-turn gesture or Q/E = 90° turn at the nearest
 *   legal speed on the ship's dial.
 * - Maneuver key (ManeuverKey): tap = Snap turn, hold + ←/→ = Hook Loop,
 *   double-tap then hold + ←/→ = Knife Roll — queued for the next cycle,
 *   with an instant stress spike (refused while stressed for the red ones).
 * - Boost (↑↑) and barrel roll (←← / →→): instant dashes that carry the
 *   cycle along (ShipMotion.performAction).
 *
 * Pure: no Phaser. The scene reads the returned events to play effects.
 */

import type { ManeuverDefinition } from "../../core/types";
import {
  updateGestures,
  INITIAL_GESTURE_STATE,
  type GestureAction,
} from "../ArcadeInputGestures";
import {
  INITIAL_MANEUVER_KEY,
  updateManeuverKey,
  type ManeuverKeyResult,
} from "../ManeuverKey";
import {
  IDLE_STEERING,
  onSteeringCycleCommitted,
  updateHeldSteering,
  type SteerInput,
} from "../SteeringIntent";
import { applyThrottle, IDLE_THROTTLE } from "./PilotThrottle";
import {
  applyDashes,
  applySoftRoll,
  applySpecials,
  applySteering,
  type Flight,
} from "./PilotFlightSteps";
import type {
  FlightControlResult,
  FlightEdge,
  FlightInput,
  FlownShip,
  PilotControlState,
} from "./PilotFlightTypes";

export type {
  FlightControlResult,
  FlightEdge,
  FlightEvent,
  FlightInput,
  FlownShip,
  PilotControlState,
} from "./PilotFlightTypes";

/** A pilot with no input history. */
export const INITIAL_PILOT_CONTROL: PilotControlState = {
  gesture: INITIAL_GESTURE_STATE,
  maneuver: INITIAL_MANEUVER_KEY,
  steering: IDLE_STEERING,
  throttle: IDLE_THROTTLE,
  steerLatched: false,
};

/**
 * Which way the arrows steer: one side held alone, otherwise none.
 * @param input - This frame's input.
 * @returns The steering side.
 */
function steerSide(input: FlightInput): SteerInput {
  if (input.left && !input.right) return "left";
  if (input.right && !input.left) return "right";
  return "none";
}

/**
 * Apply one frame of the player's flight input to their ship.
 *
 * @param pilot - Input memory from the previous frame.
 * @param flown - The ship being flown.
 * @param input - This frame's input.
 * @param worldSize - Battlefield edge length (px).
 * @returns Updated input memory, motion, stress and effect events.
 */
export function applyPilotFlightInput(
  pilot: PilotControlState,
  flown: FlownShip,
  input: FlightInput,
  worldSize: number,
): FlightControlResult {
  const flight: Flight = {
    motion: flown.motion,
    stress: flown.stress,
    events: [],
    refusals: [],
  };
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
  const pressed: FramePresses = {
    edge: (e) => input.edges.has(e),
    has: (a) => gestures.actions.includes(a),
  };
  const throttle = applyThrottleInput(flight, pilot, pressed);
  const rolled = flySoftRoll(flown, flight, pressed, worldSize);
  const steered = applySteeringInput(pilot, input, key, rolled);
  applySteering(flown, flight, steered.steering, hardTurnOf(pressed));
  applySpecials(flown, flight, specialRequestsOf(pressed, key));
  applyDashes(
    flown,
    flight,
    pressed.edge("BOOST") || pressed.has("boost"),
    rollButtonsOf(input.edges),
    worldSize,
  );
  return {
    pilot: {
      gesture: gestures.state,
      maneuver: key.state,
      ...steered,
      throttle,
    },
    motion: flight.motion,
    stress: flight.stress,
    events: flight.events,
    refusals: flight.refusals,
  };
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
function holdsManeuverKey(flown: FlownShip, input: FlightInput): boolean {
  if (!input.maneuver) return false;
  return flown.motion.control.capabilities?.canManeuver !== false;
}

/** This frame's presses: edge intents and recognised arrow gestures. */
interface FramePresses {
  readonly edge: (e: FlightEdge) => boolean;
  readonly has: (a: GestureAction) => boolean;
}

/**
 * Throttle keys and the throttle half of gestures (↑↑ boost, ↓↓ Snap turn)
 * change the speed by one step.
 *
 * @param flight - Motion being built this frame (mutated).
 * @param pilot - Input memory from the previous frame.
 * @param pressed - This frame's presses.
 * @returns The throttle memory after this frame.
 */
function applyThrottleInput(
  flight: Flight,
  pilot: PilotControlState,
  pressed: FramePresses,
): PilotControlState["throttle"] {
  const { edge, has } = pressed;
  const throttled = applyThrottle(flight.motion.control, pilot.throttle, {
    upPressed: edge("THRUST_UP"),
    downPressed: edge("THRUST_DOWN"),
    upGesture: has("boost"),
    downGesture: has("kturn_gesture"),
  });
  flight.motion = { ...flight.motion, control: throttled.control };
  return throttled.memory;
}

/**
 * A double-tapped arrow rolls the ship when it can (silently otherwise).
 *
 * @param flown - Ship being flown.
 * @param flight - Motion/stress being built this frame (mutated).
 * @param pressed - This frame's presses.
 * @param worldSize - Battlefield edge length (px).
 * @returns Whether a roll was flown.
 */
function flySoftRoll(
  flown: FlownShip,
  flight: Flight,
  pressed: FramePresses,
  worldSize: number,
): boolean {
  const side = pressed.has("barrel_roll_left")
    ? "left"
    : pressed.has("barrel_roll_right")
      ? "right"
      : null;
  return side !== null && applySoftRoll(flown, flight, side, worldSize);
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
function applySteeringInput(
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
function hardTurnOf(pressed: FramePresses): "left" | "right" | null {
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
function specialRequestsOf(
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
function rollButtonsOf(edges: ReadonlySet<FlightEdge>): GestureAction[] {
  const actions: GestureAction[] = [];
  if (edges.has("BARREL_ROLL_LEFT")) actions.push("barrel_roll_left");
  if (edges.has("BARREL_ROLL_RIGHT")) actions.push("barrel_roll_right");
  return actions;
}

/**
 * Tell the pilot controls a cycle committed (call when stepMotion reports a
 * completed cycle for the player's ship).
 *
 * @param pilot - Input memory.
 * @param started - The maneuver the new cycle started.
 * @returns Updated input memory.
 */
export function onPilotCycleCommitted(
  pilot: PilotControlState,
  started: ManeuverDefinition["direction"],
): PilotControlState {
  return {
    ...pilot,
    steering: onSteeringCycleCommitted(pilot.steering, started),
  };
}