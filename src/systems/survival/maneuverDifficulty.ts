/**
 * Survival roguelite — dial colour of a committed maneuver (pure), used to
 * fire "after a red maneuver" relics.
 */

import type {
  ManeuverDefinition,
  ManeuverDifficulty,
  ManeuverDirection,
} from "../../core/types";

/** Arcade drift templates are gentle sustained turns, never stressful. */
const DRIFT_DIFFICULTY: ManeuverDifficulty = "white";

/**
 * @param dial - The ship's dial.
 * @param direction - The maneuver flown this cycle.
 * @param speed - The throttle it was flown at.
 * @returns Its dial colour; a template missing from the dial (pushing the
 *   ship past its limits) counts as red.
 */
export function maneuverDifficultyOf(
  dial: readonly ManeuverDefinition[],
  direction: ManeuverDirection,
  speed: number,
): ManeuverDifficulty {
  if (direction === "drift_left" || direction === "drift_right") {
    return DRIFT_DIFFICULTY;
  }
  const entry = dial.find(
    (m) => m.direction === direction && m.speed === speed,
  );
  return entry?.difficulty ?? "red";
}
