/**
 * PilotFlightControls — the player's flight inputs, shared by every battle
 * scene that flies the tabletop cycle engine.
 *
 * Turns one frame of input (held steering/throttle + edge intents) into
 * changes on the ship's motion and stress:
 * - Throttle up/down: one speed step.
 * - Steering: tap = 30° drift, hold = one 45° bank then drift
 *   (SteeringIntent), hard-turn gesture or Q/E = 90° turn at the nearest
 *   legal speed on the ship's dial. A human's new turn starts at once, cutting
 *   the running cycle (`interruptCycles`, src/core/cycleInterrupt); bots wait
 *   for the cycle boundary.
 * - Maneuver key (ManeuverKey): tap = Snap turn, hold + ←/→ = Hook Loop,
 *   double-tap then hold + ←/→ = Knife Roll — queued for the next cycle
 *   (atomic: never cut), with an instant stress spike (refused while stressed
 *   for the red ones).
 * - Boost (↑↑) and barrel roll (←← / →→): instant dashes that carry the
 *   cycle along (ShipActions.performAction).
 *
 * Pure: no Phaser. The scene reads the returned events to play effects.
 */

import type { ManeuverDefinition } from "../../core/types";
import { INITIAL_GESTURE_STATE } from "../ArcadeInputGestures";
import { INITIAL_MANEUVER_KEY } from "../ManeuverKey";
import {
  IDLE_STEERING,
  onSteeringCycleCommitted,
  steeringQueue,
} from "../SteeringIntent";
import { applyThrottle, IDLE_THROTTLE } from "./PilotThrottle";
import {
  applyDashes,
  applySoftRoll,
  applySpecials,
  type Flight,
} from "./PilotFlightSteps";
import { applySteering } from "./PilotSteeringStep";
import {
  applySteeringInput,
  hardTurnOf,
  hearInput,
  rollButtonsOf,
  specialRequestsOf,
  type FramePresses,
} from "./PilotFlightInputs";
import type {
  FlightControlResult,
  FlightInput,
  FlownShip,
  PilotControlState,
  PilotFlightOptions,
} from "./PilotFlightTypes";

export type {
  FlightControlResult,
  FlightEdge,
  FlightEvent,
  FlightInput,
  FlownShip,
  PilotControlState,
  PilotFlightOptions,
} from "./PilotFlightTypes";

/** A pilot with no input history. */
export const INITIAL_PILOT_CONTROL: PilotControlState = {
  gesture: INITIAL_GESTURE_STATE,
  maneuver: INITIAL_MANEUVER_KEY,
  steering: IDLE_STEERING,
  throttle: IDLE_THROTTLE,
  steerLatched: false,
  steerRequest: null,
};

/**
 * Apply one frame of the player's flight input to their ship.
 *
 * @param pilot - Input memory from the previous frame.
 * @param flown - The ship being flown.
 * @param input - This frame's input.
 * @param worldSize - Battlefield edge length (px).
 * @param options - `interruptCycles`: a human pilot's new turn cuts the running
 *   cycle (src/core/cycleInterrupt); off (bots) it waits for the boundary.
 * @returns Updated input memory, motion, stress and effect events.
 */
export function applyPilotFlightInput(
  pilot: PilotControlState,
  flown: FlownShip,
  input: FlightInput,
  worldSize: number,
  options: PilotFlightOptions = {},
): FlightControlResult {
  const flight: Flight = {
    motion: flown.motion,
    stress: flown.stress,
    events: [],
    refusals: [],
  };
  const { gestureState, key, pressed } = hearInput(pilot, flown, input);
  const throttle = applyThrottleInput(flight, pilot, pressed);
  const rolled = flySoftRoll(flown, flight, pressed, worldSize);
  const steered = applySteeringInput(pilot, input, key, rolled);
  const steerRequest = applySteering(
    flown,
    flight,
    steered.steering,
    hardTurnOf(pressed),
    {
      interrupts: options.interruptCycles === true,
      previousRequest: pilot.steerRequest,
      rolled,
    },
  );
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
      gesture: gestureState,
      maneuver: key.state,
      ...steered,
      throttle,
      steerRequest,
    },
    motion: flight.motion,
    stress: flight.stress,
    events: flight.events,
    refusals: flight.refusals,
  };
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
 * Tell the pilot controls a cycle committed (call when stepMotion reports a
 * completed cycle for the player's ship, boundary or cut).
 *
 * @param pilot - Input memory.
 * @param started - The maneuver the new cycle started.
 * @returns Updated input memory.
 */
export function onPilotCycleCommitted(
  pilot: PilotControlState,
  started: ManeuverDefinition["direction"],
): PilotControlState {
  const steering = onSteeringCycleCommitted(pilot.steering, started);
  // The key still held keeps asking for the same thing: not a new request.
  return { ...pilot, steering, steerRequest: steeringQueue(steering, false) };
}