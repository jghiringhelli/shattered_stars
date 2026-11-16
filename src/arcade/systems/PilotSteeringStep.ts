/**
 * PilotSteeringStep — steering keys of the pilot flight controls: tap = drift,
 * hold = one bank then drift, Q/E = 90° turn, and the cycle cut a NEW human
 * request asks for (instant turns, src/core/cycleInterrupt).
 *
 * Pure: no Phaser. Orchestrated by PilotFlightControls.
 */

import {
  type FlightCommand,
  type ShipControlState,
} from "../../core/ArcadeControls";
import { queueInterrupt } from "../../core/cycleInterrupt";
import { holdSteer } from "../../core/analogCycle";
import { usesAnalogSteering } from "../../core/analogSteering";
import type { ManeuverDirection } from "../../core/types";
import type { StressState } from "../ArcadeStress";
import { hardTurnThrottle } from "../HardTurnThrottle";
import { steeringQueue, type HeldSteering } from "../SteeringIntent";
import { command, type Flight } from "./PilotFlightSteps";
import type { MotionState } from "./ShipMotion";
import type { FlownShip } from "./PilotFlightTypes";

/**
 * Queue a 90° turn. The throttle is kept (the turn is flown at the dial's
 * turn speed, see src/core/speedCap) unless a stressed pilot would fly it
 * red: then the nearest non-red speed is set for the next cycle.
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
  const best = hardTurnThrottle({
    dial: flown.dial,
    dialSpeeds: control.capabilities?.dialSpeeds,
    speed: control.speed,
    minSpeed: control.minSpeed,
    maxSpeed: control.maxSpeed,
    isStressed: stress.isStressed,
  });
  if (best === null) return motion;
  return command(
    flown,
    { ...motion, control: { ...control, speed: best } },
    direction,
  );
}

/**
 * Maneuvers the pilot committed to with a deliberate press (hard turn,
 * Snap turn, Hook, Knife). They stay queued until their cycle flies them;
 * steering keys never overwrite them.
 */
const COMMITTED_MANEUVER = /^(turn_|kturn|segnor_|tallon_)/;

/** What a frame's steering knows besides the keys. */
export interface SteeringContext {
  /** Human pilot: a new turn cuts the running cycle (src/core/cycleInterrupt). */
  readonly interrupts: boolean;
  /** The steering maneuver the arrows asked for last frame. */
  readonly previousRequest: ManeuverDirection | null;
  /** A double-tap roll flew this frame: it cancels the drift its first tap started. */
  readonly rolled: boolean;
}

/**
 * Flag (or retract) the cycle cut a steering request asks for. A request is
 * NEW when it differs from last frame's; an unchanged one (a held key) keeps
 * the boundary cadence. A roll cuts a running drift back to straight.
 *
 * @param control - Control with the steering already queued.
 * @param queued - The steering maneuver this frame asked for (null = none).
 * @param context - Interrupt option and last frame's request.
 * @returns The control with its interrupt flag set or cleared.
 */
function flagSteeringCut(
  control: ShipControlState,
  queued: ManeuverDirection | null,
  context: SteeringContext,
): ShipControlState {
  // A seat handed to a bot must not keep a human's stale request.
  if (!context.interrupts)
    return control.interruptQueued
      ? { ...control, interruptQueued: false }
      : control;
  if (context.rolled)
    return control.currentManeuver?.startsWith("drift")
      ? queueInterrupt(control, null)
      : { ...control, interruptQueued: false };
  if (queued === null)
    return context.previousRequest === null
      ? control
      : { ...control, interruptQueued: false };
  return queued === context.previousRequest
    ? control
    : { ...control, interruptQueued: true };
}

/**
 * Analog turn key: the held side steers the ship at once, at the dial's rate
 * (src/core/analogCycle). Nothing is queued: Q/E, bank holds and the cycle cut
 * of the template engine do not exist here; atomic specials queued by their
 * own keys stay queued.
 *
 * @param flight - Motion/stress being built this frame (mutated).
 * @param steering - Steering memory after this frame's input.
 */
function applyAnalogSteering(flight: Flight, steering: HeldSteering): void {
  const { motion, stress } = flight;
  flight.motion = {
    ...motion,
    control: holdSteer(motion, motion.control, steering.side, stress.isStressed),
  };
}

/**
 * Steering keys: tap = drift, hold = one bank then drift; Q/E = 90° turn.
 * In analog mode the one turn key bends the heading while held.
 * @param flown - Ship being flown.
 * @param flight - Motion/stress being built this frame (mutated).
 * @param steering - Steering memory after this frame's input.
 * @param hard - Hard-turn side requested this frame, if any.
 * @param context - Interrupt option and last frame's request.
 * @returns The steering maneuver asked for this frame (the next frame's previous request).
 */
export function applySteering(
  flown: FlownShip,
  flight: Flight,
  steering: HeldSteering,
  hard: "left" | "right" | null,
  context: SteeringContext,
): ManeuverDirection | null {
  if (usesAnalogSteering(flight.motion.control)) {
    applyAnalogSteering(flight, steering);
    return null;
  }
  if (hard) {
    const side = hard === "left" ? "turn_left" : "turn_right";
    const turned = queueHardTurn(flown, flight.motion, flight.stress, side);
    if (turned.control.nextManeuver === side) {
      const control = context.interrupts
        ? queueInterrupt(turned.control, side)
        : turned.control;
      flight.motion = { ...turned, control };
      flight.events.push("hard_turn");
      return context.previousRequest;
    }
  }
  if (COMMITTED_MANEUVER.test(flight.motion.control.nextManeuver ?? "")) {
    return context.previousRequest;
  }
  const queued = steeringQueue(steering, false);
  const control = queued
    ? command(flown, flight.motion, queued as FlightCommand).control
    : { ...flight.motion.control, nextManeuver: null };
  flight.motion = {
    ...flight.motion,
    control: flagSteeringCut(control, queued, context),
  };
  return queued;
}
