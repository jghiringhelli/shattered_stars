/**
 * CycleFlight — the tabletop cycle engine packaged for battle scenes that keep
 * their own ship records (dogfight, ace duel, survival, campaign, epic,
 * continuous tactical).
 *
 * A scene stores one {@link CycleFlightState} per ship and, every frame:
 * 1. Player ship: feeds input through PilotFlightControls.
 * 2. AI ships: their BotPilot presses the same controls (src/arcade/ai).
 * 3. Every ship: {@link tickCycleFlight} — cooldowns, motion along the
 *    template arc, stress accrued at each cycle boundary.
 *
 * Pure: no Phaser. Same code path the flight-telemetry battery measures.
 */

import {
  createControlState,
  updateCooldowns,
  type ShipControlState,
  type ShipPose,
} from "../../core/ArcadeControls";
import { SHIP_SIZES } from "../../config";
import type { ManeuverDefinition } from "../../core/types";
import {
  getMovementProfile,
  getShipDefinition,
} from "../../data/ShipDefinitions";
import {
  accrueCycleStress,
  INITIAL_STRESS,
  type StressState,
} from "../ArcadeStress";
import { flightCapabilitiesOf } from "./FlightCapabilities";
import type { TrickRule } from "../../core/flightCapabilityTypes";
import {
  stepMotion,
  type CompletedCycle,
  type MotionState,
} from "./ShipMotion";

/** Base size (px) used when a definition has no known size class. */
const FALLBACK_BASE_SIZE_PX = 32;

/** A ship flying the cycle engine. */
export interface CycleFlightState {
  readonly motion: MotionState;
  readonly stress: StressState;
}

/** Upgrade/aura effects on the stress a cycle adds. */
export interface StressModifiers {
  /** Difficulty tiers eased (1 = red flies as white). */
  readonly reliefTiers: number;
  /** Multiplier on stress gained (1 = unchanged). */
  readonly rateMultiplier: number;
}

/** No stress relief, normal gain. */
export const NO_STRESS_MODIFIERS: StressModifiers = {
  reliefTiers: 0,
  rateMultiplier: 1,
};

/** Result of one flight tick. */
export interface FlightTick {
  readonly state: CycleFlightState;
  /** The cycle that completed this tick, or null. */
  readonly completed: CompletedCycle | null;
}

/**
 * Control state for a ship definition: base size, movement profile and speed
 * bounds all come from the definition (capitals get the capital profile).
 *
 * @param definitionId - Ship definition id.
 * @param pose - Spawn pose.
 * @param trickRule - Ship specials rule; omitted = Settings (identity online).
 * @returns A fresh control state at the definition's cruise speed.
 */
export function createShipControl(
  definitionId: string,
  pose: ShipPose,
  trickRule?: TrickRule,
): ShipControlState {
  const def = getShipDefinition(definitionId);
  return createControlState(
    pose,
    SHIP_SIZES[def?.baseStats.size ?? "small"] ?? FALLBACK_BASE_SIZE_PX,
    getMovementProfile(definitionId),
    def?.baseStats.speed ?? { min: 1, max: 5 },
    flightCapabilitiesOf(definitionId, trickRule),
  );
}

/**
 * A newly spawned ship flying the cycle engine, unstressed.
 *
 * @param definitionId - Ship definition id.
 * @param pose - Spawn pose.
 * @param trickRule - Ship specials rule; omitted = Settings (identity online).
 * @returns The initial flight state.
 */
export function createCycleFlight(
  definitionId: string,
  pose: ShipPose,
  trickRule?: TrickRule,
): CycleFlightState {
  return {
    motion: {
      ...pose,
      control: createShipControl(definitionId, pose, trickRule),
    },
    stress: INITIAL_STRESS,
  };
}

/** Inputs for {@link tickCycleFlight}. */
export interface FlightTickInput {
  readonly deltaMs: number;
  readonly worldSize: number;
  /** The ship's dial, for classifying each completed cycle's stress. */
  readonly dial: readonly ManeuverDefinition[];
  readonly modifiers?: StressModifiers;
  /** Cycle length (ms) — the stress accrual window. */
  readonly cycleMs: number;
}

/**
 * Advance a ship one frame: drain action cooldowns, fly the template arc,
 * commit the queued maneuver at the boundary and accrue that cycle's stress.
 *
 * @param state - Flight state before the frame.
 * @param input - Frame length, world size, dial and stress modifiers.
 * @returns The new flight state and the cycle that completed, if any.
 */
export function tickCycleFlight(
  state: CycleFlightState,
  input: FlightTickInput,
): FlightTick {
  const control = updateCooldowns(state.motion.control, input.deltaMs);
  const motion = { ...state.motion, control };
  const step = stepMotion(motion, motion, input.deltaMs, input.worldSize);
  if (!step.completed) {
    return {
      state: { motion: step.state, stress: state.stress },
      completed: null,
    };
  }
  const modifiers = input.modifiers ?? NO_STRESS_MODIFIERS;
  const stress = accrueCycleStress({
    stress: state.stress,
    direction: step.completed.direction,
    speed: step.completed.speed,
    dial: input.dial,
    reliefTiers: modifiers.reliefTiers,
    rateMultiplier: modifiers.rateMultiplier,
    // A cycle a turn cut short counts for the share that was flown.
    cycleMs: input.cycleMs * step.completed.fraction,
  });
  return { state: { motion: step.state, stress }, completed: step.completed };
}
