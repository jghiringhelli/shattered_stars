/**
 * CycleFlight — the X-Wing cycle engine packaged for battle scenes that keep
 * their own ship records (dogfight, ace duel, survival, campaign, epic,
 * continuous tactical).
 *
 * A scene stores one {@link CycleFlightState} per ship and, every frame:
 * 1. Player ship: feeds input through PilotFlightControls.
 * 2. AI ships: {@link steerAiFlight} with the heading error to their target.
 * 3. Every ship: {@link tickCycleFlight} — cooldowns, motion along the
 *    template arc, stress accrued at each cycle boundary.
 *
 * Pure: no Phaser. Same code path the flight-telemetry battery measures.
 */

import {
  canKTurn,
  createControlState,
  processCommand,
  updateCooldowns,
  type ShipControlState,
  type ShipPose,
} from "../../core/ArcadeControls";
import { SHIP_SIZES } from "../../config";
import type { ManeuverDefinition, ManeuverDirection } from "../../core/types";
import {
  getMovementProfile,
  getShipDefinition,
} from "../../data/ShipDefinitions";
import {
  accrueCycleStress,
  applyKturnStress,
  INITIAL_STRESS,
  type StressState,
} from "../ArcadeStress";
import { resolveAiSteeringManeuver } from "../SteeringIntent";
import {
  stepMotion,
  type CompletedCycle,
  type MotionState,
} from "./ShipMotion";
import type { FlightEvent } from "./PilotFlightTypes";

/** Base size (px) used when a definition has no known size class. */
const FALLBACK_BASE_SIZE_PX = 32;

/**
 * Heading error (°) that maps to a full AI deflection. Errors at or above
 * this commit to a 90° turn; smaller errors scale down to a bank or drift
 * through resolveAiSteeringManeuver's thresholds.
 */
export const AI_FULL_DEFLECTION_DEG = 90;

/** Heading error (°) beyond which a target counts as behind: K-turn to face it. */
export const AI_KTURN_ERROR_DEG = 150;

/** Heading error (°) beyond which the AI slows down to turn tighter. */
export const AI_SLOW_TURN_ERROR_DEG = 60;

/** Specials stay queued until they fly; steering never overwrites them. */
const SPECIAL_MANEUVER = /^(kturn|segnor_|tallon_)/;

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
 * @returns A fresh control state at the definition's cruise speed.
 */
export function createShipControl(
  definitionId: string,
  pose: ShipPose,
): ShipControlState {
  const def = getShipDefinition(definitionId);
  return createControlState(
    pose,
    SHIP_SIZES[def?.baseStats.size ?? "small"] ?? FALLBACK_BASE_SIZE_PX,
    getMovementProfile(definitionId),
    def?.baseStats.speed ?? { min: 1, max: 5 },
  );
}

/**
 * A newly spawned ship flying the cycle engine, unstressed.
 *
 * @param definitionId - Ship definition id.
 * @param pose - Spawn pose.
 * @returns The initial flight state.
 */
export function createCycleFlight(
  definitionId: string,
  pose: ShipPose,
): CycleFlightState {
  return {
    motion: { ...pose, control: createShipControl(definitionId, pose) },
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
    cycleMs: input.cycleMs,
  });
  return { state: { motion: step.state, stress }, completed: step.completed };
}

/** What an AI pilot wants this frame. */
export interface AiSteerOrder {
  /** Signed heading error to the goal (°): positive = goal is to the right. */
  readonly headingErrorDeg: number;
  /** Speed the AI wants; stepped one notch per cycle. Null = keep speed. */
  readonly desiredSpeed: number | null;
  /** True on the frame a cycle committed — the only time speed may step. */
  readonly cycleCommitted: boolean;
  /** Whether this pilot may K-turn onto a target behind it. */
  readonly allowKTurn?: boolean;
}

/** Result of steering an AI ship for one frame. */
export interface AiSteerResult {
  readonly state: CycleFlightState;
  /** Effects to show (a K-turn afterimage). */
  readonly events: FlightEvent[];
}

/**
 * Queue the AI's next maneuver from its heading error: a drift for small
 * errors, a bank for moderate ones and a 90° turn only for large ones (a
 * stressed pilot banks instead of turning). A target behind triggers a
 * K-turn when allowed, off cooldown and unstressed. Queued specials are kept.
 *
 * @param state - The AI ship's flight state.
 * @param order - Heading error, wanted speed and cycle timing.
 * @returns Flight state with the next maneuver (and speed) queued.
 */
export function steerAiFlight(
  state: CycleFlightState,
  order: AiSteerOrder,
): AiSteerResult {
  const { motion } = state;
  let control = motion.control;
  let stress = state.stress;
  const events: FlightEvent[] = [];
  if (wantsKTurn(state, order)) {
    control = processCommand(motion, control, "kturn");
    stress = applyKturnStress(stress);
    events.push("kturn");
  } else if (!SPECIAL_MANEUVER.test(control.nextManeuver ?? "")) {
    const ratio = Math.max(
      -1,
      Math.min(1, -order.headingErrorDeg / AI_FULL_DEFLECTION_DEG),
    );
    const steer = resolveAiSteeringManeuver(ratio);
    control = {
      ...control,
      nextManeuver: steer ? calmIfStressed(steer, stress) : null,
    };
  }
  if (order.cycleCommitted && order.desiredSpeed !== null) {
    if (order.desiredSpeed > control.speed)
      control = processCommand(motion, control, "thrust_increase");
    else if (order.desiredSpeed < control.speed)
      control = processCommand(motion, control, "thrust_decrease");
  }
  return { state: { motion: { ...motion, control }, stress }, events };
}

/**
 * Whether the AI should K-turn now: allowed, target behind, unstressed,
 * off cooldown and no special already queued.
 * @param state - The AI ship's flight state.
 * @param order - This frame's order.
 * @returns True to queue a K-turn.
 */
function wantsKTurn(state: CycleFlightState, order: AiSteerOrder): boolean {
  const { control } = state.motion;
  return (
    order.allowKTurn === true &&
    Math.abs(order.headingErrorDeg) >= AI_KTURN_ERROR_DEG &&
    !state.stress.isStressed &&
    canKTurn(control) &&
    !SPECIAL_MANEUVER.test(control.nextManeuver ?? "")
  );
}

/**
 * Pursuit speed: slow down to turn tight when the goal is well off the nose,
 * cruise in the middle of the speed range when roughly lined up.
 *
 * @param control - The ship's speed bounds.
 * @param headingErrorDeg - Signed heading error to the goal (°).
 * @returns The speed the AI should aim for.
 */
export function pursuitSpeed(
  control: Pick<ShipControlState, "minSpeed" | "maxSpeed">,
  headingErrorDeg: number,
): number {
  if (Math.abs(headingErrorDeg) >= AI_SLOW_TURN_ERROR_DEG) {
    return control.minSpeed;
  }
  return Math.ceil((control.minSpeed + control.maxSpeed) / 2);
}

/**
 * A stressed pilot cannot commit to a 90° turn: it banks instead.
 * @param steer - Maneuver the AI wants.
 * @param stress - The pilot's stress.
 * @returns The maneuver it may actually fly.
 */
function calmIfStressed(
  steer: ManeuverDirection,
  stress: StressState,
): ManeuverDirection {
  if (!stress.isStressed) return steer;
  if (steer === "turn_left") return "bank_left";
  if (steer === "turn_right") return "bank_right";
  return steer;
}
