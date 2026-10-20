/**
 * escortObjective — a convoy of transports flying a path (tabletop Alliance
 * escort archetype). Transports are player-side scripted ships the enemy
 * hunts; the objective fails as soon as more than `maxLosses` are lost and
 * completes when every surviving transport reaches the path's end. Never
 * more than {@link MAX_ESCORT_TARGETS} critical transports (readability).
 * Pure.
 */

import type { EscortDefinition } from "./objectiveDefinitions";
import {
  MS_PER_SECOND,
  coreOf,
  percent,
  shipById,
  type ObjectiveStateCore,
} from "./objectiveCore";
import type { ObjectiveModel } from "./objectiveModel";
import { clamp01, pathLength, poseAlongPath } from "./objectiveGeometry";
import type { EntityPose, EntitySpawn } from "./objectiveTypes";

/** Most simultaneous critical escort targets (research: XWA overload). */
export const MAX_ESCORT_TARGETS = 3;
/** Gap between consecutive transports along the path (px). */
export const ESCORT_SPACING_PX = 110;
/** Default transport hull multiplier. */
export const DEFAULT_TRANSPORT_HULL_SCALE = 2;
/** Tag carried by every convoy transport. */
export const TRANSPORT_TAG = "transport";
/** Tracker word for a lost transport. */
const LOST_LABEL = "LOST";
/** Tracker separator between transports. */
const SEPARATOR = " · ";

/** Escort progress. */
export interface EscortState extends ObjectiveStateCore<EscortDefinition> {
  readonly transportIds: readonly string[];
  /** Distance the lead transport has flown along the path. */
  readonly travelled: number;
  readonly lost: readonly string[];
  readonly hull: Readonly<Record<string, number>>;
}

/**
 * @param def - Escort definition.
 * @returns Its transport ship ids, capped at MAX_ESCORT_TARGETS.
 */
function transportIdsOf(def: EscortDefinition): string[] {
  const count = Math.min(MAX_ESCORT_TARGETS, Math.max(1, def.transports.count));
  return Array.from({ length: count }, (_, i) => `${def.id}_t${i}`);
}

/**
 * @param travelled - Distance the lead transport has flown.
 * @param index - Transport index (0 = lead).
 * @returns Distance flown by that transport.
 */
function transportDistance(travelled: number, index: number): number {
  return Math.max(0, travelled - index * ESCORT_SPACING_PX);
}

/**
 * @param def - Escort definition.
 * @returns Lead distance at mission start (the convoy fully on the path).
 */
function startTravelled(def: EscortDefinition): number {
  return (transportIdsOf(def).length - 1) * ESCORT_SPACING_PX;
}

/**
 * @param state - Escort state.
 * @returns Whether every surviving transport reached the end.
 */
function allArrived(state: EscortState): boolean {
  const length = pathLength(state.def.path);
  return state.transportIds.every(
    (id, i) =>
      state.lost.includes(id) ||
      transportDistance(state.travelled, i) >= length,
  );
}

/**
 * @param def - Escort definition.
 * @param travelled - Lead distance.
 * @param skip - Transport ids to leave out.
 * @returns Pose of every transport not skipped.
 */
function convoyPoses(
  def: EscortDefinition,
  travelled: number,
  skip: readonly string[],
): EntityPose[] {
  const length = pathLength(def.path);
  return transportIdsOf(def)
    .map((id, i) => {
      const pose = poseAlongPath(
        def.path,
        Math.min(length, transportDistance(travelled, i)),
      );
      return { id, ...pose };
    })
    .filter((pose) => !skip.includes(pose.id));
}

/**
 * @param state - Escort state.
 * @returns How far along the path the lead transport is (0..1).
 */
function escortFraction(state: EscortState): number {
  const length = pathLength(state.def.path);
  return length > 0 ? clamp01(state.travelled / length) : 1;
}

export const ESCORT_MODEL: ObjectiveModel<EscortDefinition, EscortState> = {
  create: (def) => ({
    ...coreOf(def),
    transportIds: transportIdsOf(def),
    travelled: startTravelled(def),
    lost: [],
    hull: {},
  }),
  step(state, frame) {
    const newlyLost = frame.events
      .filter(
        (e) => e.kind === "destroyed" && state.transportIds.includes(e.shipId),
      )
      .map((e) => e.shipId);
    const lost = [...new Set([...state.lost, ...newlyLost])];
    const hull = { ...state.hull };
    for (const id of state.transportIds) {
      const ship = shipById(frame, id);
      if (ship) hull[id] = ship.hull / ship.maxHull;
    }
    for (const id of lost) hull[id] = 0;
    const travelled =
      state.travelled + (state.def.speed * frame.deltaMs) / MS_PER_SECOND;
    const next: EscortState = { ...state, lost, hull, travelled };
    if (lost.length > state.def.maxLosses) return { ...next, status: "failed" };
    return allArrived(next) ? { ...next, status: "completed" } : next;
  },
  readout(state) {
    const parts = state.transportIds.map((id) =>
      state.lost.includes(id) ? LOST_LABEL : `${percent(state.hull[id] ?? 1)}%`,
    );
    return {
      progressText: parts.join(SEPARATOR),
      fraction: escortFraction(state),
    };
  },
  markers(state) {
    const end = state.def.path[state.def.path.length - 1] ?? { x: 0, y: 0 };
    return [
      {
        id: `${state.def.id}_exit`,
        kind: "exit",
        x: end.x,
        y: end.y,
        radius: ESCORT_SPACING_PX,
        progress: escortFraction(state),
        controller: "player",
      },
    ];
  },
  spawns: (def) =>
    convoyPoses(def, startTravelled(def), []).map((pose): EntitySpawn => ({
      ...pose,
      shipId: def.transports.shipId,
      side: "player",
      tags: [TRANSPORT_TAG, def.id],
      hullScale: def.hullScale ?? DEFAULT_TRANSPORT_HULL_SCALE,
      scripted: true,
    })),
  poses: (state) => convoyPoses(state.def, state.travelled, state.lost),
  isConstraint: () => false,
};
