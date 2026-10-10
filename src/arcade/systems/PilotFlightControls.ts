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

import { processCommand, type FlightCommand } from "../../core/ArcadeControls";
import type { ManeuverDefinition } from "../../core/types";
import {
  updateGestures,
  INITIAL_GESTURE_STATE,
  type GestureAction,
} from "../ArcadeInputGestures";
import {
  applyBoostStress,
  applyKturnStress,
  findBestTurnSpeed,
  type StressState,
} from "../ArcadeStress";
import {
  IDLE_STEERING,
  onSteeringCycleCommitted,
  steeringQueue,
  updateHeldSteering,
  type HeldSteering,
  type SteerInput,
} from "../SteeringIntent";
import { performAction, type MotionState } from "./ShipMotion";
import type {
  FlightControlResult,
  FlightEdge,
  FlightEvent,
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
};

/**
 * Queue a command on the motion state's control.
 * @param flown - Ship being flown.
 * @param motion - Current motion state.
 * @param command - Command to process.
 * @returns Motion state with the command applied.
 */
function command(
  flown: FlownShip,
  motion: MotionState,
  cmd: FlightCommand,
): MotionState {
  const ship = { ...flown.ship, x: motion.x, y: motion.y, angle: motion.angle };
  return { ...motion, control: processCommand(ship, motion.control, cmd) };
}

/**
 * Queue a 90° turn at the nearest speed the dial allows (red turns are
 * skipped while stressed). Speed is adjusted for the next cycle.
 * @param flown - Ship being flown.
 * @param motion - Current motion state.
 * @param stress - Current stress.
 * @param direction - Turn side.
 * @returns Motion state with the turn queued, unchanged if no speed allows it.
 */
function queueHardTurn(
  flown: FlownShip,
  motion: MotionState,
  stress: StressState,
  direction: "turn_left" | "turn_right",
): MotionState {
  const { control } = motion;
  const best = findBestTurnSpeed(
    flown.dial,
    control.speed,
    control.minSpeed,
    control.maxSpeed,
    stress.isStressed,
  );
  if (best === null) return motion;
  return command(
    flown,
    { ...motion, control: { ...control, speed: best } },
    direction,
  );
}

/** Motion and stress threaded through the per-frame helpers. */
interface Flight {
  motion: MotionState;
  stress: StressState;
  readonly events: FlightEvent[];
}

/**
 * Maneuvers the pilot committed to with a deliberate press (hard turn,
 * K-turn, Segnor, Tallon). They stay queued until their cycle flies them;
 * steering keys never overwrite them.
 */
const COMMITTED_MANEUVER = /^(turn_|kturn|segnor_|tallon_)/;

/**
 * Steering keys: tap = drift, hold = one bank then drift; Q/E = 90° turn.
 * @param flown - Ship being flown.
 * @param flight - Motion/stress being built this frame (mutated).
 * @param steering - Steering memory after this frame's input.
 * @param hard - Hard-turn side requested this frame, if any.
 */
function applySteering(
  flown: FlownShip,
  flight: Flight,
  steering: HeldSteering,
  hard: "left" | "right" | null,
): void {
  if (hard) {
    const side = hard === "left" ? "turn_left" : "turn_right";
    const turned = queueHardTurn(flown, flight.motion, flight.stress, side);
    if (turned.control.nextManeuver === side) {
      flight.motion = turned;
      flight.events.push("hard_turn");
      return;
    }
  }
  if (COMMITTED_MANEUVER.test(flight.motion.control.nextManeuver ?? "")) {
    return;
  }
  const queued = steeringQueue(steering, false);
  const control = queued
    ? command(flown, flight.motion, queued as FlightCommand).control
    : { ...flight.motion.control, nextManeuver: null };
  flight.motion = { ...flight.motion, control };
}

/**
 * K-turn (refused while stressed), Segnor and Tallon: queued red specials.
 * @param flown - Ship being flown.
 * @param flight - Motion/stress being built this frame (mutated).
 * @param wants - Which specials were requested this frame.
 */
function applySpecials(
  flown: FlownShip,
  flight: Flight,
  wants: ReadonlyArray<[boolean, FlightCommand, FlightEvent]>,
): void {
  for (const [requested, cmd, event] of wants) {
    if (!requested) continue;
    if (cmd === "kturn" && flight.stress.isStressed) continue;
    const before = flight.motion.control;
    flight.motion = command(flown, flight.motion, cmd);
    if (
      flight.motion.control !== before &&
      flight.motion.control.nextManeuver === cmd
    ) {
      flight.stress = applyKturnStress(flight.stress);
      flight.events.push(event);
    }
  }
}

/**
 * Boost and barrel roll: instant dashes that carry the cycle along.
 * @param flown - Ship being flown.
 * @param flight - Motion/stress being built this frame (mutated).
 * @param boost - Whether a boost was requested.
 * @param actions - Gesture actions this frame (barrel rolls).
 * @param worldSize - Battlefield edge length (px).
 */
function applyDashes(
  flown: FlownShip,
  flight: Flight,
  boost: boolean,
  actions: readonly GestureAction[],
  worldSize: number,
): void {
  if (boost) {
    const boosted = performAction(
      flight.motion,
      flown.ship,
      "boost",
      worldSize,
    );
    if (boosted.performed) {
      flight.motion = boosted.state;
      flight.stress = applyBoostStress(flight.stress);
      flight.events.push("boost");
    }
  }
  for (const roll of ["barrel_roll_left", "barrel_roll_right"] as const) {
    if (!actions.includes(roll)) continue;
    const rolled = performAction(flight.motion, flown.ship, roll, worldSize);
    if (rolled.performed) {
      flight.motion = rolled.state;
      flight.events.push("barrel_roll");
    }
  }
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
  };
  const edge = (e: FlightEdge): boolean => input.edges.has(e);

  if (edge("THRUST_UP"))
    flight.motion = command(flown, flight.motion, "thrust_increase");
  if (edge("THRUST_DOWN"))
    flight.motion = command(flown, flight.motion, "thrust_decrease");

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
  const has = (a: GestureAction): boolean => gestures.actions.includes(a);

  const side: SteerInput =
    input.left && !input.right
      ? "left"
      : input.right && !input.left
        ? "right"
        : "none";
  const steering = updateHeldSteering(pilot.steering, side, input.deltaMs);
  // Hold is a bank (SteeringIntent); only a deliberate Q/E press is a 90° turn.
  const hard = edge("SHARP_TURN_LEFT")
    ? "left"
    : edge("SHARP_TURN_RIGHT")
      ? "right"
      : null;
  applySteering(flown, flight, steering, hard);

  applySpecials(flown, flight, [
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
  ]);
  applyDashes(
    flown,
    flight,
    edge("BOOST") || has("boost"),
    gestures.actions,
    worldSize,
  );

  return {
    pilot: { gesture: gestures.state, steering },
    motion: flight.motion,
    stress: flight.stress,
    events: flight.events,
  };
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
