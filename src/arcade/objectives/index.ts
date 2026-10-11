/**
 * Mission objectives — public API. Pure, Phaser-free models reusable by any
 * mode (Campaign now, an X-Wing 2.0 Scenario mode later): scenes build an
 * ObjectiveFrame per frame, step the states, spawn/move the entities the
 * objectives ask for and draw their markers.
 */

export type * from "./objectiveTypes";
export type * from "./objectiveDefinitions";
export {
  createObjectiveState,
  stepObjectiveState,
  revealObjectiveState,
  forceObjectiveStatus,
  isConstraintObjective,
  finalizeObjectiveOnVictory,
  objectiveReadout,
  objectiveMarkers,
  objectiveSpawns,
  objectivePoses,
  type ObjectiveState,
} from "./objectiveRegistry";
export {
  missionOutcome,
  finalizeOnVictory,
  completedBonusIds,
  type MissionOutcome,
} from "./objectiveSet";
export { zoneController } from "./zoneObjectives";
export { MAX_ESCORT_TARGETS, TRANSPORT_TAG } from "./escortObjective";
export { ASSASSINATION_TAG } from "./assassinateObjective";
export { STATION_TAG } from "./defendObjective";
