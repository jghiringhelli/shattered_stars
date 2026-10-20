/**
 * PilotFlightSteps — the per-frame building blocks of the pilot flight
 * controls: steering (drift/bank/hard turn, committed maneuvers latch),
 * specials (Snap turn, Hook, Knife) and dashes (boost, barrel roll).
 *
 * Pure: no Phaser. Orchestrated by PilotFlightControls.
 */

import { processCommand, type FlightCommand } from "../../core/ArcadeControls";
import type { GestureAction } from "../ArcadeInputGestures";
import {
  applyBoostStress,
  applyKturnStress,
  findBestTurnSpeed,
  type StressState,
} from "../ArcadeStress";
import { steeringQueue, type HeldSteering } from "../SteeringIntent";
import { performAction, type MotionState } from "./ShipMotion";
import type { FlightEvent, FlownShip } from "./PilotFlightTypes";
import {
  UNRESTRICTED_CAPABILITIES,
  dashRefusal,
  specialRefusal,
  type FlightDash,
  type FlightRefusal,
  type SpecialManeuver,
} from "./FlightCapabilities";

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
export interface Flight {
  motion: MotionState;
  stress: StressState;
  readonly events: FlightEvent[];
  /** Specials and dashes the card or stress rules refused this frame. */
  readonly refusals: FlightRefusal[];
}

/**
 * @param flight - The flight being built.
 * @param action - What was requested.
 * @param reason - Why it was refused, or null when allowed.
 * @returns True when refused (and recorded on the flight).
 */
function refused(
  flight: Flight,
  action: FlightRefusal["action"],
  reason: FlightRefusal["reason"] | null,
): boolean {
  if (reason === null) return false;
  flight.refusals.push({ action, reason });
  return true;
}

/**
 * Maneuvers the pilot committed to with a deliberate press (hard turn,
 * Snap turn, Hook, Knife). They stay queued until their cycle flies them;
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
export function applySteering(
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
 * Snap turn, Hook and Knife: queued specials. Refused when not on the
 * ship's dial, or when red and the pilot is stressed (tabletop).
 * @param flown - Ship being flown.
 * @param flight - Motion/stress being built this frame (mutated).
 * @param wants - Which specials were requested this frame.
 */
export function applySpecials(
  flown: FlownShip,
  flight: Flight,
  wants: ReadonlyArray<[boolean, SpecialManeuver, FlightEvent]>,
): void {
  const capabilities =
    flight.motion.control.capabilities ?? UNRESTRICTED_CAPABILITIES;
  for (const [requested, cmd, event] of wants) {
    if (!requested) continue;
    const reason = specialRefusal(capabilities, cmd, flight.stress.isStressed);
    if (refused(flight, specialAction(event), reason)) continue;
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
 * @param event - The effect event of a special.
 * @returns The refusal label of that special.
 */
function specialAction(event: FlightEvent): FlightRefusal["action"] {
  if (event === "segnor" || event === "tallon") return event;
  return "kturn";
}

/**
 * @param flight - The flight being built.
 * @param dash - The dash requested.
 * @returns True when the card or stress refuses it (recorded).
 */
function dashRefused(flight: Flight, dash: FlightDash): boolean {
  const capabilities =
    flight.motion.control.capabilities ?? UNRESTRICTED_CAPABILITIES;
  return refused(
    flight,
    dash,
    dashRefusal(capabilities, dash, flight.stress.isStressed),
  );
}

/**
 * Boost and barrel roll: instant dashes that carry the cycle along.
 * Refused when not on the ship's action bar or while stressed (tabletop).
 * @param flown - Ship being flown.
 * @param flight - Motion/stress being built this frame (mutated).
 * @param boost - Whether a boost was requested.
 * @param actions - Gesture actions this frame (barrel rolls).
 * @param worldSize - Battlefield edge length (px).
 */
export function applyDashes(
  flown: FlownShip,
  flight: Flight,
  boost: boolean,
  actions: readonly GestureAction[],
  worldSize: number,
): void {
  if (boost && !dashRefused(flight, "boost")) {
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
    if (dashRefused(flight, "barrel_roll")) break;
    const rolled = performAction(flight.motion, flown.ship, roll, worldSize);
    if (rolled.performed) {
      flight.motion = rolled.state;
      flight.events.push("barrel_roll");
    }
  }
}

/**
 * A barrel roll from a double-tap of the steering arrows. Unlike a dedicated
 * roll button it never complains: rapid ordinary steering is full of double
 * taps, so while the roll is on its recharge, the card lacks it, the hull is
 * huge or the pilot is stressed, the taps simply steer.
 *
 * @param flown - Ship being flown.
 * @param flight - Motion/stress being built this frame (mutated).
 * @param side - Roll side.
 * @param worldSize - Battlefield edge length (px).
 * @returns Whether the roll was flown (the arrows are then spent on it).
 */
export function applySoftRoll(
  flown: FlownShip,
  flight: Flight,
  side: "left" | "right",
  worldSize: number,
): boolean {
  const capabilities =
    flight.motion.control.capabilities ?? UNRESTRICTED_CAPABILITIES;
  if (dashRefusal(capabilities, "barrel_roll", flight.stress.isStressed))
    return false;
  const rolled = performAction(
    flight.motion,
    flown.ship,
    `barrel_roll_${side}`,
    worldSize,
  );
  if (!rolled.performed) return false;
  flight.motion = rolled.state;
  flight.events.push("barrel_roll");
  return true;
}
