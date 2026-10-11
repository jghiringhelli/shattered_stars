/**
 * objectiveModel — the contract every objective kind implements. Pure
 * functions over immutable states; the registry dispatches by kind.
 */

import type { ObjectiveDefinition } from "./objectiveDefinitions";
import type { ObjectiveStateCore } from "./objectiveCore";
import type {
  EntityPose,
  EntitySpawn,
  ObjectiveFrame,
  ObjectiveMarker,
  ObjectiveReadout,
} from "./objectiveTypes";

/** One objective kind's behaviour. */
export interface ObjectiveModel<
  D extends ObjectiveDefinition,
  S extends ObjectiveStateCore<D>,
> {
  /** Fresh state for a definition. */
  create(def: D): S;
  /** Advances an active, visible objective by one frame. */
  step(state: S, frame: ObjectiveFrame): S;
  /** Tracker suffix and progress fraction. */
  readout(state: S): ObjectiveReadout;
  /** World/radar markers to draw. */
  markers(state: S): ObjectiveMarker[];
  /** Ships the objective needs spawned at mission start. */
  spawns(def: D): EntitySpawn[];
  /** Poses imposed on scripted entities this frame. */
  poses(state: S): EntityPose[];
  /** Constraints (keep X alive, stay hidden) complete when the mission is won. */
  isConstraint(def: D): boolean;
}

/** A model with no markers, spawns or poses. */
export const NO_WORLD_PRESENCE = {
  markers: (): ObjectiveMarker[] => [],
  spawns: (): EntitySpawn[] => [],
  poses: (): EntityPose[] => [],
} as const;
