/**
 * routeObjectives — movement objectives:
 * - waypoints: fly the flagship through each point in order (timed races
 *   use `timeLimit`; `extraction` draws the last point as the exit);
 * - stealth: a constraint failed when any player ship lingers inside a
 *   sentry's sensor range for `graceSeconds` (exposure decays outside).
 * Pure.
 */

import type {
  StealthDefinition,
  WaypointsDefinition,
} from "./objectiveDefinitions";
import {
  MS_PER_SECOND,
  coreOf,
  shipById,
  type ObjectiveStateCore,
} from "./objectiveCore";
import { NO_WORLD_PRESENCE, type ObjectiveModel } from "./objectiveModel";
import { clamp01, withinRange } from "./objectiveGeometry";
import type { ObjectiveMarker } from "./objectiveTypes";

/** Tracker word once a stealth objective is blown. */
const DETECTED_LABEL = "DETECTED";

/** Waypoint progress. */
export interface WaypointsState extends ObjectiveStateCore<WaypointsDefinition> {
  readonly index: number;
}

/** Stealth progress. */
export interface StealthState extends ObjectiveStateCore<StealthDefinition> {
  readonly exposureMs: number;
}

export const WAYPOINTS_MODEL: ObjectiveModel<
  WaypointsDefinition,
  WaypointsState
> = {
  ...NO_WORLD_PRESENCE,
  create: (def) => ({ ...coreOf(def), index: 0 }),
  step(state, frame) {
    const point = state.def.points[state.index];
    const flagship = frame.flagshipId
      ? shipById(frame, frame.flagshipId)
      : undefined;
    if (!point || !flagship) return state;
    if (!withinRange(flagship, point, state.def.radius, frame.worldSize))
      return state;
    const index = state.index + 1;
    const done = index >= state.def.points.length;
    return { ...state, index, status: done ? "completed" : "active" };
  },
  readout: (state) => ({
    progressText: `${state.index}/${state.def.points.length}`,
    fraction: clamp01(state.index / Math.max(1, state.def.points.length)),
  }),
  markers(state): ObjectiveMarker[] {
    const point = state.def.points[state.index];
    if (!point) return [];
    const isLast = state.index === state.def.points.length - 1;
    return [
      {
        id: `${state.def.id}_${state.index}`,
        kind: isLast && state.def.extraction ? "exit" : "waypoint",
        x: point.x,
        y: point.y,
        radius: state.def.radius,
        progress: clamp01(state.index / state.def.points.length),
        controller: "none",
      },
    ];
  },
  isConstraint: () => false,
};

export const STEALTH_MODEL: ObjectiveModel<StealthDefinition, StealthState> = {
  ...NO_WORLD_PRESENCE,
  create: (def) => ({ ...coreOf(def), exposureMs: 0 }),
  step(state, frame) {
    const seen = frame.ships.some(
      (ship) =>
        ship.side === "player" &&
        state.def.sentries.some((sentry) =>
          withinRange(ship, sentry, state.def.radius, frame.worldSize),
        ),
    );
    const exposureMs = seen ? state.exposureMs + frame.deltaMs : 0;
    const detected = exposureMs >= state.def.graceSeconds * MS_PER_SECOND;
    return { ...state, exposureMs, status: detected ? "failed" : "active" };
  },
  readout: (state) => ({
    progressText: state.status === "failed" ? DETECTED_LABEL : "",
    fraction: state.status === "failed" ? 0 : 1,
  }),
  markers: (state) =>
    state.def.sentries.map((sentry, i) => ({
      id: `${state.def.id}_sentry${i}`,
      kind: "sentry" as const,
      x: sentry.x,
      y: sentry.y,
      radius: state.def.radius,
      progress: clamp01(
        state.exposureMs / (state.def.graceSeconds * MS_PER_SECOND),
      ),
      controller:
        state.status === "failed" ? ("enemy" as const) : ("none" as const),
    })),
  isConstraint: () => true,
};
