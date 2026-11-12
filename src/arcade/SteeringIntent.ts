/**
 * SteeringIntent — maps raw steering input to the maneuver queued for the next cycle.
 *
 * The arcade flight model rides tabletop's discrete cycle system: input queues a
 * maneuver, which commits at the cycle boundary. That model assumes a *fresh*
 * choice each cycle. A held key does the opposite — it re-queues the same
 * maneuver forever — so mapping "held left" straight onto a dial maneuver made
 * the ship trace a closed circle (90°/cycle × 4 cycles = 360°) and orbit its
 * spawn point instead of flying anywhere.
 *
 * This module is the single place that decides which maneuver a steering
 * intent produces. It is pure: no Phaser, no scene state, fully testable.
 *
 * Bots commit what it queues at the cycle boundary; a human's NEW request
 * cuts the running cycle at once (src/core/cycleInterrupt).
 */

import type { ManeuverDirection } from "../core/types";
import { SUSTAINED_TURN_DEGREES_PER_CYCLE } from "../config";

export { SUSTAINED_TURN_DEGREES_PER_CYCLE };

/** Which way the player is steering this frame. */
export type SteerInput = "none" | "left" | "right";

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

// ============================================
// Player steering: tap = drift, hold = one bank, then drift
// ============================================

/** How long a key must be held before it commits a 45° bank instead of a drift (ms). */
export const BANK_HOLD_MS = 150;

/** What the player's steering keys have been doing. */
export interface HeldSteering {
  /** Direction currently held. */
  readonly side: SteerInput;
  /** How long that direction has been held (ms). */
  readonly heldMs: number;
  /** Cycles committed since the key went down. */
  readonly cyclesSincePress: number;
  /** Banks already flown during this hold. */
  readonly banksFlown: number;
  /** A tap released before any cycle committed — still owed one drift. */
  readonly tap: SteerInput;
}

/** No steering input. */
export const IDLE_STEERING: HeldSteering = {
  side: "none",
  heldMs: 0,
  cyclesSincePress: 0,
  banksFlown: 0,
  tap: "none",
};

/**
 * Track the steering keys for one frame.
 *
 * @param state - Steering state before the frame.
 * @param input - Direction held this frame.
 * @param deltaMs - Frame length (ms).
 * @returns Steering state after the frame.
 */
export function updateHeldSteering(
  state: HeldSteering,
  input: SteerInput,
  deltaMs: number,
): HeldSteering {
  if (input === state.side) {
    return input === "none"
      ? state
      : { ...state, heldMs: state.heldMs + deltaMs };
  }
  // Released (or switched) before any cycle committed: that was a tap.
  const tap =
    state.side !== "none" && state.cyclesSincePress === 0
      ? state.side
      : state.tap;
  return { side: input, heldMs: 0, cyclesSincePress: 0, banksFlown: 0, tap };
}

/**
 * Record that a maneuver cycle committed for the player's ship.
 *
 * @param state - Steering state.
 * @param committed - The maneuver that just started.
 * @returns Steering state with the hold's progress advanced.
 */
export function onSteeringCycleCommitted(
  state: HeldSteering,
  committed: ManeuverDirection,
): HeldSteering {
  return {
    ...state,
    cyclesSincePress: state.side === "none" ? 0 : state.cyclesSincePress + 1,
    banksFlown: committed.startsWith("bank")
      ? state.banksFlown + 1
      : state.banksFlown,
    tap: "none",
  };
}

/**
 * The maneuver the player's steering should queue for the next cycle.
 *
 * - Hard-turn gesture → 90° turn.
 * - Held long enough, no bank flown yet this hold → 45° bank.
 * - Otherwise held → 30° drift (keeps advancing, never orbits).
 * - A tap released before the cycle committed → one drift.
 *
 * @param state - Steering state.
 * @param hardTurn - True when the gesture system reported a hard turn.
 * @returns The maneuver to queue, or null to fall back to straight.
 */
export function steeringQueue(
  state: HeldSteering,
  hardTurn: boolean,
): ManeuverDirection | null {
  if (state.side === "none") {
    return state.tap === "none"
      ? null
      : resolveSteeringManeuver(state.tap, false);
  }
  if (!hardTurn && state.banksFlown === 0 && state.heldMs >= BANK_HOLD_MS) {
    return state.side === "left" ? "bank_left" : "bank_right";
  }
  return resolveSteeringManeuver(state.side, hardTurn);
}
