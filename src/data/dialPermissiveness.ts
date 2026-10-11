/**
 * dialPermissiveness — how forgiving a ship's dial is in real-time play.
 *
 * The real-time stress model (src/arcade/ArcadeStress.ts) classifies every
 * cycle as straight, bank or turn at the current speed and looks the cell up
 * on the ship's dial (left/right collapse to left; a missing cell is red).
 * Those cells — and only those — are what a dial is worth in a match.
 *
 * Pure: no state.
 */

import type {
  ManeuverDefinition,
  ManeuverDifficulty,
  ShipStats,
} from "../core/types";

/** Stress steps a difficulty is worth (missing entries count as red). */
const DIFFICULTY_STEPS: Readonly<Record<ManeuverDifficulty, number>> = {
  red: 0,
  white: 1,
  green: 2,
};

/**
 * Dial directions the real-time stress model reads (left/right collapse to
 * left — see ArcadeStress.accrueCycleStress).
 */
export const STRESS_DIRECTIONS = [
  "straight",
  "bank_left",
  "turn_left",
] as const;

/** A dial direction the stress model reads. */
export type StressDirection = (typeof STRESS_DIRECTIONS)[number];

/** Lowest speed with a stress entry (speed 0 is a hover, never stressful). */
const LOWEST_STRESS_SPEED = 1;

/**
 * Difficulty the stress model reads for one dial cell.
 *
 * @param dial - The ship's maneuver dial.
 * @param direction - A stress-relevant direction.
 * @param speed - Speed setting.
 * @returns The entry's difficulty, or red when the dial has no such entry.
 */
export function stressDifficulty(
  dial: readonly ManeuverDefinition[],
  direction: StressDirection,
  speed: number,
): ManeuverDifficulty {
  const entry = dial.find(
    (m) => m.direction === direction && m.speed === speed,
  );
  return entry?.difficulty ?? "red";
}

/**
 * Dial permissiveness inside the ship's speed band: every stress-relevant
 * cell scores 2 for green, 1 for white, 0 for red or missing.
 *
 * @param dial - The ship's maneuver dial.
 * @param speed - The ship's speed bounds.
 * @returns Total dial steps.
 */
export function dialSteps(
  dial: readonly ManeuverDefinition[],
  speed: ShipStats["speed"],
): number {
  let steps = 0;
  for (let s = Math.max(LOWEST_STRESS_SPEED, speed.min); s <= speed.max; s++) {
    for (const direction of STRESS_DIRECTIONS) {
      steps += DIFFICULTY_STEPS[stressDifficulty(dial, direction, s)];
    }
  }
  return steps;
}
