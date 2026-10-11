/**
 * defendObjective — a static player-side station (outpost, node, temple)
 * that must survive: for `timeLimit` seconds, or — untimed — until the rest
 * of the mission is won (a constraint). Pure.
 */

import type { DefendDefinition } from "./objectiveDefinitions";
import {
  MS_PER_SECOND,
  activeMs,
  coreOf,
  percent,
  secondsLeft,
  shipById,
  wasDestroyed,
  type ObjectiveStateCore,
} from "./objectiveCore";
import type { ObjectiveModel } from "./objectiveModel";
import { clamp01 } from "./objectiveGeometry";

/** Default hull multiplier of a station (stations are tough). */
export const DEFAULT_STATION_HULL_SCALE = 4;
/** Tag carried by every defended station. */
export const STATION_TAG = "station";

/** Defend progress. */
export interface DefendState extends ObjectiveStateCore<DefendDefinition> {
  readonly stationId: string;
  readonly heldMs: number;
  readonly hullFraction: number;
}

/**
 * @param def - Defend definition.
 * @returns Its station's ship id.
 */
export function stationIdOf(def: DefendDefinition): string {
  return `${def.id}_station`;
}

export const DEFEND_MODEL: ObjectiveModel<DefendDefinition, DefendState> = {
  create: (def) => ({
    ...coreOf(def),
    stationId: stationIdOf(def),
    heldMs: 0,
    hullFraction: 1,
  }),
  step(state, frame) {
    if (wasDestroyed(frame, state.stationId)) {
      return { ...state, hullFraction: 0, status: "failed" };
    }
    const station = shipById(frame, state.stationId);
    const hullFraction = station
      ? station.hull / station.maxHull
      : state.hullFraction;
    const heldMs = activeMs(state, frame);
    const limit = state.def.timeLimit;
    const held = limit !== undefined && heldMs >= limit * MS_PER_SECOND;
    return {
      ...state,
      heldMs,
      hullFraction,
      status: held ? "completed" : "active",
    };
  },
  readout(state) {
    const hull = `${percent(state.hullFraction)}%`;
    const limit = state.def.timeLimit;
    if (limit === undefined)
      return { progressText: hull, fraction: state.hullFraction };
    const totalMs = limit * MS_PER_SECOND;
    return {
      progressText: `${hull} · ${secondsLeft(totalMs - state.heldMs)}s`,
      fraction: clamp01(state.heldMs / totalMs),
    };
  },
  markers: () => [],
  spawns: (def) => [
    {
      id: stationIdOf(def),
      shipId: def.stationShipId,
      side: "player",
      x: def.at.x,
      y: def.at.y,
      angle: 0,
      tags: [STATION_TAG, def.id],
      hullScale: def.hullScale ?? DEFAULT_STATION_HULL_SCALE,
      scripted: true,
    },
  ],
  poses: (state) => [
    { id: state.stationId, x: state.def.at.x, y: state.def.at.y, angle: 0 },
  ],
  isConstraint: (def) => def.timeLimit === undefined,
};
