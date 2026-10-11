/**
 * assassinateObjective — a named enemy target (with its own escorts in the
 * mission data). It fights under its pilot until badly hurt or a timer runs
 * out; then, if it has an escape route, it breaks off and flees along it
 * (the objective drives it). Destroy it to complete; let it escape and the
 * objective fails. Pure.
 */

import type { AssassinateDefinition } from "./objectiveDefinitions";
import {
  MS_PER_SECOND,
  activeMs,
  coreOf,
  percent,
  shipById,
  wasDestroyed,
  type ObjectiveStateCore,
} from "./objectiveCore";
import type { ObjectiveModel } from "./objectiveModel";
import { clamp01, pathLength, poseAlongPath } from "./objectiveGeometry";
import type { ObjectiveFrame, ObjectivePoint } from "./objectiveTypes";

/** Tag carried by every assassination target. */
export const ASSASSINATION_TAG = "assassination_target";
/** Default flee speed (px/s) — a little slower than a fighter. */
export const DEFAULT_FLEE_SPEED = 160;
/** Default hull multiplier of a named target. */
const DEFAULT_TARGET_HULL_SCALE = 2;
/** Radius drawn around the escape point. */
const EXIT_MARKER_RADIUS = 140;
/** Tracker word while the target runs. */
const FLEEING_LABEL = "FLEEING";

/** Assassination progress. */
export interface AssassinateState extends ObjectiveStateCore<AssassinateDefinition> {
  readonly targetId: string;
  readonly hullFraction: number;
  /** Escape route from where it broke off, once fleeing. */
  readonly route: readonly ObjectivePoint[] | null;
  readonly fled: number;
}

/**
 * @param def - Assassinate definition.
 * @returns Its target's ship id.
 */
export function targetIdOf(def: AssassinateDefinition): string {
  return `${def.id}_target`;
}

/**
 * @param state - Assassination state.
 * @param frame - The frame.
 * @returns Whether the target should start fleeing this frame.
 */
function shouldFlee(state: AssassinateState, frame: ObjectiveFrame): boolean {
  const { def } = state;
  if (!def.fleePath || def.fleePath.length === 0 || state.route) return false;
  const hurt =
    def.fleeAtHullFraction !== undefined &&
    state.hullFraction <= def.fleeAtHullFraction;
  const late =
    def.fleeAfterSeconds !== undefined &&
    activeMs(state, frame) >= def.fleeAfterSeconds * MS_PER_SECOND;
  return hurt || late;
}

/**
 * @param state - A fleeing state.
 * @param frame - The frame.
 * @returns The state after one more frame of flight.
 */
function flee(
  state: AssassinateState,
  frame: ObjectiveFrame,
): AssassinateState {
  if (!state.route) return state;
  const speed = state.def.fleeSpeed ?? DEFAULT_FLEE_SPEED;
  const fled = state.fled + (speed * frame.deltaMs) / MS_PER_SECOND;
  const escaped = fled >= pathLength(state.route);
  return { ...state, fled, status: escaped ? "failed" : "active" };
}

export const ASSASSINATE_MODEL: ObjectiveModel<
  AssassinateDefinition,
  AssassinateState
> = {
  create: (def) => ({
    ...coreOf(def),
    targetId: targetIdOf(def),
    hullFraction: 1,
    route: null,
    fled: 0,
  }),
  step(state, frame) {
    if (wasDestroyed(frame, state.targetId)) {
      return { ...state, hullFraction: 0, status: "completed" };
    }
    const target = shipById(frame, state.targetId);
    const hullFraction = target
      ? target.hull / target.maxHull
      : state.hullFraction;
    let next: AssassinateState = { ...state, hullFraction };
    if (target && shouldFlee(next, frame)) {
      next = {
        ...next,
        route: [{ x: target.x, y: target.y }, ...(state.def.fleePath ?? [])],
      };
    }
    return flee(next, frame);
  },
  readout: (state) => ({
    progressText: state.route
      ? FLEEING_LABEL
      : `${percent(state.hullFraction)}%`,
    fraction: clamp01(1 - state.hullFraction),
  }),
  markers(state) {
    const path = state.def.fleePath;
    const exit = path?.[path.length - 1];
    if (!exit) return [];
    return [
      {
        id: `${state.def.id}_escape`,
        kind: "exit",
        x: exit.x,
        y: exit.y,
        radius: EXIT_MARKER_RADIUS,
        progress: state.route
          ? clamp01(state.fled / pathLength(state.route))
          : 0,
        controller: "enemy",
      },
    ];
  },
  spawns: (def) => [
    {
      id: targetIdOf(def),
      shipId: def.targetShipId,
      side: "enemy",
      x: def.at.x,
      y: def.at.y,
      angle: 180,
      tags: [ASSASSINATION_TAG, def.id],
      hullScale: def.hullScale ?? DEFAULT_TARGET_HULL_SCALE,
      scripted: false,
      isBoss: def.isBoss,
    },
  ],
  poses(state) {
    if (!state.route) return [];
    return [{ id: state.targetId, ...poseAlongPath(state.route, state.fled) }];
  },
  isConstraint: () => false,
};
