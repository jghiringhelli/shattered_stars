/**
 * LabShip — one ship flown the way a scene flies the PLAYER's ship: keys go
 * through the shared pilot controls (a human's turn cuts the running cycle in
 * the template engine), then the cycle engine moves it. The movement lab
 * compares the template and analog engines through this one path.
 *
 * Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../config";
import { startManeuver } from "../../core/ArcadeControls";
import type { SteeringMode } from "../../core/steeringMode";
import type { ManeuverDefinition } from "../../core/types";
import {
  SHIP_DEFINITIONS,
  getMovementProfile,
  getShipDial,
} from "../../data/ShipDefinitions";
import {
  createCycleFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../../arcade/systems/CycleFlight";
import { flightCapabilitiesOf } from "../../arcade/systems/FlightCapabilities";
import {
  applyPilotFlightInput,
  INITIAL_PILOT_CONTROL,
  onPilotCycleCommitted,
  type FlightEdge,
  type PilotControlState,
} from "../../arcade/systems/PilotFlightControls";
import { TICK_MS } from "../skill/ArenaSpec";

export { TICK_MS };

/** The keys a lab pilot presses in one tick. */
export interface LabKeys {
  readonly left: boolean;
  readonly right: boolean;
  readonly edges: ReadonlySet<FlightEdge>;
}

/** No key. */
export const NO_KEYS: LabKeys = {
  left: false,
  right: false,
  edges: new Set<FlightEdge>(),
};

/** What a lab ship is built from. */
export interface LabShipSetup {
  readonly definitionId: string;
  readonly pose: { readonly x: number; readonly y: number; readonly angle: number };
  readonly steering: SteeringMode;
  /** The set throttle. */
  readonly speed: number;
  /** Analog only: multiplier on the per-cycle turn rates (default 1). */
  readonly rateScale?: number;
}

/** A ship and its pilot's memory. */
export interface LabShip {
  readonly flight: CycleFlightState;
  readonly pilot: PilotControlState;
  readonly dial: readonly ManeuverDefinition[];
  /** Barrel rolls flown (taps that read as a double-tap included). */
  readonly rolls: number;
}

/**
 * The ship every lab run flies: the first fighter that has a barrel roll on
 * its card (so accidental roll gestures show) and a hard turn at speed 2.
 *
 * @returns A ship definition id.
 */
export function pickLabShip(): string {
  const id = Object.keys(SHIP_DEFINITIONS).find((candidate) => {
    const caps = flightCapabilitiesOf(candidate, "identity", "template");
    return (
      getMovementProfile(candidate) !== "capital" &&
      caps.barrelRoll &&
      (caps.dialSpeeds?.turn ?? []).includes(2)
    );
  });
  if (!id) throw new Error("no fighter with a barrel roll and a speed-2 turn");
  return id;
}

/**
 * @param setup - Ship, pose, engine, throttle and rate scale.
 * @returns A ship at the start of a straight cycle at the set throttle.
 */
export function createLabShip(setup: LabShipSetup): LabShip {
  const made = createCycleFlight(
    setup.definitionId,
    setup.pose,
    "identity",
    setup.steering,
  );
  const control = made.motion.control;
  const scaled =
    setup.rateScale !== undefined && control.capabilities
      ? {
          ...control,
          capabilities: {
            ...control.capabilities,
            analogRateScale: setup.rateScale,
          },
        }
      : control;
  const started = startManeuver(
    setup.pose,
    { ...scaled, speed: setup.speed },
    "straight",
  );
  return {
    flight: { ...made, motion: { ...made.motion, control: started } },
    pilot: INITIAL_PILOT_CONTROL,
    dial: getShipDial(setup.definitionId),
    rolls: 0,
  };
}

/**
 * Fly one tick: the keys through the pilot controls, then the cycle engine.
 *
 * @param ship - The ship before the tick.
 * @param keys - The keys pressed this tick.
 * @param nowMs - Lab time (ms).
 * @returns The ship after the tick.
 */
export function stepLabShip(
  ship: LabShip,
  keys: LabKeys,
  nowMs: number,
): LabShip {
  const { motion, stress } = ship.flight;
  const result = applyPilotFlightInput(
    ship.pilot,
    { ship: motion, motion, stress, dial: ship.dial },
    {
      left: keys.left,
      right: keys.right,
      up: false,
      down: false,
      edges: keys.edges,
      nowMs,
      deltaMs: TICK_MS,
    },
    BATTLEFIELD_SIZE,
    { interruptCycles: true },
  );
  const tick = tickCycleFlight(
    { motion: result.motion, stress: result.stress },
    {
      deltaMs: TICK_MS,
      worldSize: BATTLEFIELD_SIZE,
      dial: ship.dial,
      cycleMs: CYCLE_DURATION_MS,
    },
  );
  const started = tick.state.motion.control.currentManeuver ?? "straight";
  return {
    ...ship,
    flight: tick.state,
    pilot: tick.completed
      ? onPilotCycleCommitted(result.pilot, started)
      : result.pilot,
    rolls: ship.rolls + (result.events.includes("barrel_roll") ? 1 : 0),
  };
}
