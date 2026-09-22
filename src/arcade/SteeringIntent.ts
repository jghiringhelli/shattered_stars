/**
 * SteeringIntent — maps raw steering input to the maneuver queued for the next cycle.
 *
 * The arcade flight model rides X-Wing's discrete cycle system: input queues a
 * maneuver, which commits at the cycle boundary. That model assumes a *fresh*
 * choice each cycle. A held key does the opposite — it re-queues the same
 * maneuver forever — so mapping "held left" straight onto a dial maneuver made
 * the ship trace a closed circle (90°/cycle × 4 cycles = 360°) and orbit its
 * spawn point instead of flying anywhere.
 *
 * This module is the single place that decides which maneuver a steering
 * intent produces. It is pure: no Phaser, no scene state, fully testable.
 */

import type { ManeuverDirection } from "../core/types";
import { SUSTAINED_TURN_DEGREES_PER_CYCLE } from "../config";

export { SUSTAINED_TURN_DEGREES_PER_CYCLE };

/** Which way the player is steering this frame. */
export type SteerInput = "none" | "left" | "right";

/**
 * Deflection thresholds for AI heading correction, as a fraction of the
 * maximum turn the ship can request. Below {@link AI_DEADBAND} the AI holds
 * course rather than dithering between left and right every cycle.
 */
export const AI_DEADBAND = 0.05;
/** Above this the AI escalates from a shallow drift to a 45° bank. */
export const AI_BANK_THRESHOLD = 0.3;
/** Above this the AI commits to a 90° dial turn. */
export const AI_TURN_THRESHOLD = 0.65;

/**
 * Resolves the maneuver a player's steering input should queue.
 *
 * A plain held key produces a sustained shallow turn so the ship keeps
 * advancing; the hard-turn gesture is what unlocks the 90° dial turn.
 *
 * @param input    - Steering direction held this frame.
 * @param hardTurn - True when the gesture system reported a hard-turn action.
 * @returns The maneuver to queue, or null to leave the queue untouched.
 */
export function resolveSteeringManeuver(
  input: SteerInput,
  hardTurn: boolean,
): ManeuverDirection | null {
  if (input === "none") return null;
  if (input === "left") return hardTurn ? "turn_left" : "drift_left";
  return hardTurn ? "turn_right" : "drift_right";
}

/**
 * Resolves the maneuver an AI ship should queue to correct its heading.
 *
 * Scales the response to the size of the error so pursuit reads as flying
 * rather than as a stack of hard turns: small errors get a shallow drift,
 * moderate errors a bank, and only a large error justifies a dial turn.
 *
 * @param deflectionRatio - Signed heading error, -1..1. Positive steers left.
 * @returns The maneuver to queue, or null when already on course.
 */
export function resolveAiSteeringManeuver(
  deflectionRatio: number,
): ManeuverDirection | null {
  const magnitude = Math.abs(deflectionRatio);
  if (magnitude < AI_DEADBAND) return null;

  const isLeft = deflectionRatio > 0;
  if (magnitude >= AI_TURN_THRESHOLD)
    return isLeft ? "turn_left" : "turn_right";
  if (magnitude >= AI_BANK_THRESHOLD)
    return isLeft ? "bank_left" : "bank_right";
  return isLeft ? "drift_left" : "drift_right";
}
