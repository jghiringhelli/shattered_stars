/**
 * objectiveSet — mission-level rules over a set of objective states:
 * victory when every required goal is complete (required constraints merely
 * must not have failed; hidden required goals still block), defeat when any
 * required objective fails. Bonus (optional) objectives never decide the
 * outcome. Pure.
 */

import {
  finalizeObjectiveOnVictory,
  isConstraintObjective,
  type ObjectiveState,
} from "./objectiveRegistry";

/** Where the mission stands. */
export type MissionOutcome = "ongoing" | "victory" | "defeat";

/**
 * @param states - Every objective of the mission.
 * @returns The mission outcome.
 */
export function missionOutcome(
  states: readonly ObjectiveState[],
): MissionOutcome {
  const required = states.filter((s) => s.def.optional !== true);
  if (required.some((s) => s.status === "failed")) return "defeat";
  const goals = required.filter((s) => !isConstraintObjective(s.def));
  const goalsDone = goals.every((s) => s.status === "completed");
  return goals.length > 0 && goalsDone ? "victory" : "ongoing";
}

/**
 * @param states - Every objective of a won mission.
 * @returns States with holding constraints completed.
 */
export function finalizeOnVictory(
  states: readonly ObjectiveState[],
): ObjectiveState[] {
  return states.map(finalizeObjectiveOnVictory);
}

/**
 * @param states - Objective states.
 * @returns Ids of completed bonus objectives.
 */
export function completedBonusIds(states: readonly ObjectiveState[]): string[] {
  return states
    .filter((s) => s.def.optional === true && s.status === "completed")
    .map((s) => s.def.id);
}
