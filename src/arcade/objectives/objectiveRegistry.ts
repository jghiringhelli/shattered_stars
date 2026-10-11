/**
 * objectiveRegistry — dispatches every objective kind to its model and adds
 * the rules shared by all kinds: hidden objectives freeze until revealed,
 * finished objectives stop stepping, deadlines fail late objectives, and
 * constraints complete when the mission is won. Pure.
 */

import type {
  ObjectiveDefinition,
  ObjectiveType,
} from "./objectiveDefinitions";
import { MS_PER_SECOND, activeMs } from "./objectiveCore";
import type { ObjectiveModel } from "./objectiveModel";
import {
  ELIMINATE_MODEL,
  PROTECT_MODEL,
  SURVIVE_MODEL,
  type EliminateState,
  type ProtectState,
  type SurviveState,
} from "./simpleObjectives";
import { DEFEND_MODEL, type DefendState } from "./defendObjective";
import { ESCORT_MODEL, type EscortState } from "./escortObjective";
import {
  ASSASSINATE_MODEL,
  type AssassinateState,
} from "./assassinateObjective";
import {
  CAPTURE_MODEL,
  SABOTAGE_MODEL,
  type CaptureState,
  type SabotageState,
} from "./zoneObjectives";
import {
  STEALTH_MODEL,
  WAYPOINTS_MODEL,
  type StealthState,
  type WaypointsState,
} from "./routeObjectives";
import { SALVAGE_MODEL, type SalvageState } from "./salvageObjective";
import type {
  EntityPose,
  EntitySpawn,
  ObjectiveFrame,
  ObjectiveMarker,
  ObjectiveReadout,
} from "./objectiveTypes";

/** Any objective's state. */
export type ObjectiveState =
  | EliminateState
  | SurviveState
  | ProtectState
  | DefendState
  | EscortState
  | AssassinateState
  | CaptureState
  | SabotageState
  | WaypointsState
  | StealthState
  | SalvageState;

/** Kinds whose `timeLimit` is a hold duration rather than a deadline. */
const DURATION_KINDS: ReadonlySet<ObjectiveType> = new Set([
  "survive",
  "defend",
]);

const MODELS = {
  eliminate: ELIMINATE_MODEL,
  survive: SURVIVE_MODEL,
  protect: PROTECT_MODEL,
  defend: DEFEND_MODEL,
  escort: ESCORT_MODEL,
  assassinate: ASSASSINATE_MODEL,
  capture: CAPTURE_MODEL,
  sabotage: SABOTAGE_MODEL,
  waypoints: WAYPOINTS_MODEL,
  stealth: STEALTH_MODEL,
  salvage: SALVAGE_MODEL,
} as const;

/** The model of a kind, widened for dispatch. */
type AnyModel = ObjectiveModel<ObjectiveDefinition, ObjectiveState>;

/**
 * @param kind - Objective kind.
 * @returns Its model.
 */
function modelFor(kind: ObjectiveType): AnyModel {
  return MODELS[kind] as unknown as AnyModel;
}

/**
 * @param def - Objective definition.
 * @returns Its fresh state.
 */
export function createObjectiveState(def: ObjectiveDefinition): ObjectiveState {
  return modelFor(def.type).create(def);
}

/**
 * @param state - Objective state.
 * @param frame - The frame.
 * @returns Whether its deadline (non-duration kinds) has passed.
 */
function pastDeadline(state: ObjectiveState, frame: ObjectiveFrame): boolean {
  const limit = state.def.timeLimit;
  if (limit === undefined || DURATION_KINDS.has(state.kind)) return false;
  return activeMs(state, frame) >= limit * MS_PER_SECOND;
}

/**
 * Advances one objective by one frame.
 *
 * @param state - Objective state.
 * @param frame - The frame.
 * @returns Its next state (unchanged while hidden or finished).
 */
export function stepObjectiveState(
  state: ObjectiveState,
  frame: ObjectiveFrame,
): ObjectiveState {
  if (state.hidden || state.status !== "active") return state;
  const started =
    state.startedAtMs === null
      ? { ...state, startedAtMs: frame.elapsedMs }
      : state;
  const next = modelFor(started.kind).step(started, frame);
  if (next.status === "active" && pastDeadline(next, frame)) {
    return { ...next, status: "failed" };
  }
  return next;
}

/**
 * @param state - A hidden objective.
 * @returns It visible; its clock starts on its next step.
 */
export function revealObjectiveState(state: ObjectiveState): ObjectiveState {
  if (!state.hidden) return state;
  return { ...state, hidden: false, startedAtMs: null };
}

/**
 * @param state - Objective state.
 * @param status - Forced status (scripted outcome).
 * @returns It with that status.
 */
export function forceObjectiveStatus(
  state: ObjectiveState,
  status: "completed" | "failed",
): ObjectiveState {
  return { ...state, hidden: false, status };
}

/**
 * @param def - Objective definition.
 * @returns Whether it is a constraint (completes on victory, never blocks it).
 */
export function isConstraintObjective(def: ObjectiveDefinition): boolean {
  return modelFor(def.type).isConstraint(def);
}

/**
 * @param state - Objective state.
 * @returns A still-active constraint completed (others unchanged).
 */
export function finalizeObjectiveOnVictory(
  state: ObjectiveState,
): ObjectiveState {
  if (state.status !== "active" || state.hidden) return state;
  return isConstraintObjective(state.def)
    ? { ...state, status: "completed" }
    : state;
}

/**
 * @param state - Objective state.
 * @returns Its tracker readout.
 */
export function objectiveReadout(state: ObjectiveState): ObjectiveReadout {
  return modelFor(state.kind).readout(state);
}

/**
 * @param state - Objective state.
 * @returns Its world markers (none while hidden or finished).
 */
export function objectiveMarkers(state: ObjectiveState): ObjectiveMarker[] {
  if (state.hidden || state.status !== "active") return [];
  return modelFor(state.kind).markers(state);
}

/**
 * @param def - Objective definition.
 * @returns Ships it needs spawned.
 */
export function objectiveSpawns(def: ObjectiveDefinition): EntitySpawn[] {
  return modelFor(def.type).spawns(def);
}

/**
 * @param state - Objective state.
 * @returns Poses it imposes on its scripted entities this frame.
 */
export function objectivePoses(state: ObjectiveState): EntityPose[] {
  return modelFor(state.kind).poses(state);
}
