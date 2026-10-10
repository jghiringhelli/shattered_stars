/**
 * AiPursuit — the pursuit rules every AI pilot on the cycle engine shares:
 * which hulls may K-turn, the heading error and speed to chase a point, and
 * how a sloppy pilot misjudges the line at lower difficulty.
 *
 * Pure: no Phaser. Scenes keep their own targeting; these turn a chosen
 * target into an {@link AiSteerOrder} for steerAiFlight.
 */

import type { ShipControlState, ShipPose } from "../../core/ArcadeControls";
import {
  getMovementProfile,
  getShipDefinition,
} from "../../data/ShipDefinitions";
import { headingDiffToTarget } from "../../systems/MovementSystem";
import { pursuitSpeed, type AiSteerOrder } from "./CycleFlight";

/** Duel difficulty levels (Dogfight, Ace Duel). */
export type DuelDifficulty = "easy" | "normal" | "hard" | "brutal";

/** Who flies a duel ship: the opposing AI or one of the player's escorts. */
export type DuelOwner = "player" | "ai";

/** Chance per frame that an opposing AI pilot flies the optimal line. */
export const AI_OPTIMAL_CHANCE: Readonly<Record<DuelDifficulty, number>> = {
  easy: 0.5,
  normal: 0.7,
  hard: 0.9,
  brutal: 1,
};

/** Chance per frame that a player-side escort flies the optimal line. */
export const ESCORT_OPTIMAL_CHANCE = 0.8;

/**
 * Heading errors (°) a sloppy pilot flies instead of the true one: hold
 * course, or veer one bank's worth either way.
 */
export const SUBOPTIMAL_HEADING_ERRORS_DEG: readonly number[] = [-40, 0, 40];

/** A point on the battlefield. */
export interface PlanePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Whether a hull may K-turn at all: capital hulls (capital movement profile
 * or capital role) never flip.
 *
 * @param definitionId - Ship definition id.
 * @returns False for capital hulls.
 */
export function canHullKTurn(definitionId: string): boolean {
  if (getMovementProfile(definitionId) === "capital") return false;
  return getShipDefinition(definitionId)?.role !== "capital";
}

/** What seeking needs of a ship's flight: its pose and speed bounds. */
export interface SeekingFlight {
  readonly motion: ShipPose & {
    readonly control: Pick<ShipControlState, "minSpeed" | "maxSpeed">;
  };
}

/** Inputs for {@link seekSteerOrder}. */
export interface SeekOrderInput {
  readonly flight: SeekingFlight;
  readonly target: PlanePoint;
  readonly cycleCommitted: boolean;
  readonly allowKTurn: boolean;
}

/**
 * Steer straight for a point: true heading error, pursuit speed.
 *
 * @param input - The chasing ship's flight, the point and cycle timing.
 * @returns The order for steerAiFlight.
 */
export function seekSteerOrder(input: SeekOrderInput): AiSteerOrder {
  const { motion } = input.flight;
  const headingErrorDeg = headingDiffToTarget(
    motion.x,
    motion.y,
    motion.angle,
    input.target.x,
    input.target.y,
  );
  return {
    headingErrorDeg,
    desiredSpeed: pursuitSpeed(motion.control, headingErrorDeg),
    cycleCommitted: input.cycleCommitted,
    allowKTurn: input.allowKTurn,
  };
}

/**
 * The heading error a pilot steers by: the true one when flying the optimal
 * line, otherwise one picked from a spread of misjudgements.
 *
 * @param trueErrorDeg - Signed heading error to the target (°).
 * @param flyOptimal - Whether the pilot flies the optimal line this time.
 * @param roll - Uniform random value in [0, 1) choosing the misjudgement.
 * @param spread - Misjudged errors to pick from (°).
 * @returns The heading error to steer by (°).
 */
export function chooseAiHeadingError(
  trueErrorDeg: number,
  flyOptimal: boolean,
  roll: number,
  spread: readonly number[] = SUBOPTIMAL_HEADING_ERRORS_DEG,
): number {
  if (flyOptimal) return trueErrorDeg;
  const index = Math.min(spread.length - 1, Math.floor(roll * spread.length));
  return spread[index] ?? 0;
}

/**
 * The nearest of several points (planar distance).
 *
 * @param from - Where the search starts.
 * @param candidates - Points to choose from.
 * @returns The closest candidate, or null when there are none.
 */
export function closestPoint<T extends PlanePoint>(
  from: PlanePoint,
  candidates: readonly T[],
): T | null {
  let closest: T | null = null;
  let closestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = Math.hypot(candidate.x - from.x, candidate.y - from.y);
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }
  return closest;
}

/** Inputs for {@link planDuelSteer}. */
export interface DuelSteerInput {
  readonly ship: ShipPose;
  readonly target: PlanePoint;
  readonly owner: DuelOwner;
  readonly difficulty: DuelDifficulty;
  /** Uniform random source in [0, 1). */
  readonly random: () => number;
}

/** What a duel pilot steers by this frame. */
export interface DuelSteerPlan {
  readonly headingErrorDeg: number;
  /** The real heading error (pursuit speed is judged on it). */
  readonly trueErrorDeg: number;
  readonly allowKTurn: boolean;
}

/**
 * Duel pilot judgement: difficulty sets how often the opposing AI flies the
 * optimal line (escorts fly it 80% of the time); easy AI never K-turns.
 *
 * @param input - Pose, target, side, difficulty and random source.
 * @returns Heading error to steer by, the true error, and K-turn permission.
 */
export function planDuelSteer(input: DuelSteerInput): DuelSteerPlan {
  const { ship, target } = input;
  const trueErrorDeg = headingDiffToTarget(
    ship.x,
    ship.y,
    ship.angle,
    target.x,
    target.y,
  );
  const optimalChance =
    input.owner === "ai"
      ? AI_OPTIMAL_CHANCE[input.difficulty]
      : ESCORT_OPTIMAL_CHANCE;
  const flyOptimal = input.random() < optimalChance;
  return {
    headingErrorDeg: chooseAiHeadingError(
      trueErrorDeg,
      flyOptimal,
      input.random(),
    ),
    trueErrorDeg,
    allowKTurn: input.owner === "player" || input.difficulty !== "easy",
  };
}
