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
 * - K-turn, Segnor's Loop, Tallon Roll: queued for the next cycle, with an
 *   instant stress spike (refused while stressed for the K-turn).
 * - Boost and barrel roll: instant dashes that carry the cycle along
 *   (ShipMotion.performAction).
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
  IDLE_STEERING,
  onSteeringCycleCommitted,
  updateHeldSteering,
  type SteerInput,
} from "../SteeringIntent";
import { applyThrottle, IDLE_THROTTLE } from "./PilotThrottle";
import {
  applyDashes,
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
  steering: IDLE_STEERING,
  throttle: IDLE_THROTTLE,
  rollLatched: false,
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
  const gestures = updateGestures({
    state: pilot.gesture,
    leftDown: input.left,
    rightDown: input.right,
    upDown: input.up,
    downDown: input.down,
    nowMs: input.nowMs,
    deltaMs: input.deltaMs,
    allowChordBarrelRoll: input.allowChordBarrelRoll,
  });
  const pressed: FramePresses = {
    edge: (e) => input.edges.has(e),
    has: (a) => gestures.actions.includes(a),
  };
  const throttle = applyThrottleInput(flight, pilot, pressed);
  const steered = applySteeringInput(pilot, input, pressed);
  applySteering(flown, flight, steered.steering, hardTurnOf(pressed));
  applySpecials(flown, flight, specialRequestsOf(pressed));
  applyDashes(
    flown,
    flight,
    pressed.edge("BOOST") || pressed.has("boost"),
    [...gestures.actions, ...rollButtonsOf(input.edges)],
    worldSize,
  );
  return {
    pilot: { gesture: gestures.state, ...steered, throttle },
    motion: flight.motion,
    stress: flight.stress,
    events: flight.events,
    refusals: flight.refusals,
  };
}

/** This frame's presses: edge intents and recognised arrow gestures. */
interface FramePresses {
  readonly edge: (e: FlightEdge) => boolean;
  readonly has: (a: GestureAction) => boolean;
}

/**
 * Throttle keys and the throttle half of gestures (↑ for boost/Tallon,
 * ↓ for K-turn/Segnor) change the speed by one step.
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
    upGesture:
      has("boost") || has("tallon_roll_left") || has("tallon_roll_right"),
    downGesture:
      has("kturn_gesture") ||
      has("segnor_loop_left") ||
      has("segnor_loop_right"),
  });
  flight.motion = { ...flight.motion, control: throttled.control };
  return throttled.memory;
}

/**
 * Held steering, idled while a barrel-roll chord stays latched (until both
 * arrows are released) so the roll's keys do not also bank the ship.
 *
 * @param pilot - Input memory from the previous frame.
 * @param input - This frame's input.
 * @param pressed - This frame's presses.
 * @returns Steering memory and the roll latch after this frame.
 */
function applySteeringInput(
  pilot: PilotControlState,
  input: FlightInput,
  pressed: FramePresses,
): Pick<PilotControlState, "steering" | "rollLatched"> {
  const rolled =
    pressed.has("barrel_roll_left") || pressed.has("barrel_roll_right");
  const rollLatched =
    (pilot.rollLatched || rolled) && (input.left || input.right);
  const steering = rollLatched
    ? IDLE_STEERING
    : updateHeldSteering(pilot.steering, steerSide(input), input.deltaMs);
  return { steering, rollLatched };
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
 * @param pressed - This frame's presses.
 * @returns K-turn / Segnor / Tallon requests (key or gesture) for applySpecials.
 */
function specialRequestsOf(
  pressed: FramePresses,
): Parameters<typeof applySpecials>[2] {
  const { edge, has } = pressed;
  return [
    [edge("KTURN") || has("kturn_gesture"), "kturn", "kturn"],
    [edge("SEGNOR_LEFT") || has("segnor_loop_left"), "segnor_left", "segnor"],
    [
      edge("SEGNOR_RIGHT") || has("segnor_loop_right"),
      "segnor_right",
      "segnor",
    ],
    [edge("TALLON_LEFT") || has("tallon_roll_left"), "tallon_left", "tallon"],
    [
      edge("TALLON_RIGHT") || has("tallon_roll_right"),
      "tallon_right",
      "tallon",
    ],
  ];
}

/**
 * Gamepad roll buttons as the gesture actions the chord would produce. A
 * button is a press, not a held chord, so it never latches steering.
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
