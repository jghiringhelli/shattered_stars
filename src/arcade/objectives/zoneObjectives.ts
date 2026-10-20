/**
 * zoneObjectives — area objectives:
 * - capture: tabletop control — a side controls the zone while it has more
 *   ship weight in range than the other (medium/large count double); the
 *   player completes it after `holdSeconds` of control, and (optionally)
 *   fails if the enemy gets there first.
 * - sabotage: keep any player ship in range for `holdSeconds` (progress may
 *   decay while nobody is there).
 * Pure.
 */

import type {
  CaptureDefinition,
  SabotageDefinition,
} from "./objectiveDefinitions";
import {
  MS_PER_SECOND,
  coreOf,
  type ObjectiveStateCore,
} from "./objectiveCore";
import type { ObjectiveModel } from "./objectiveModel";
import { NO_WORLD_PRESENCE } from "./objectiveModel";
import { clamp01, withinRange } from "./objectiveGeometry";
import type {
  MarkerController,
  ObjectiveFrame,
  ObjectivePoint,
} from "./objectiveTypes";

/** Capture progress. */
export interface CaptureState extends ObjectiveStateCore<CaptureDefinition> {
  readonly playerMs: number;
  readonly enemyMs: number;
  readonly controller: MarkerController;
}

/** Sabotage progress. */
export interface SabotageState extends ObjectiveStateCore<SabotageDefinition> {
  readonly progressMs: number;
  readonly occupied: boolean;
}

/**
 * Who controls a zone this frame (tabletop: more weight in range wins).
 *
 * @param frame - The frame.
 * @param at - Zone centre.
 * @param radius - Zone radius.
 * @returns The controller.
 */
export function zoneController(
  frame: ObjectiveFrame,
  at: ObjectivePoint,
  radius: number,
): MarkerController {
  let player = 0;
  let enemy = 0;
  for (const ship of frame.ships) {
    if (!withinRange(ship, at, radius, frame.worldSize)) continue;
    if (ship.side === "player") player += ship.weight;
    else enemy += ship.weight;
  }
  if (player === 0 && enemy === 0) return "none";
  if (player === enemy) return "contested";
  return player > enemy ? "player" : "enemy";
}

export const CAPTURE_MODEL: ObjectiveModel<CaptureDefinition, CaptureState> = {
  ...NO_WORLD_PRESENCE,
  create: (def) => ({
    ...coreOf(def),
    playerMs: 0,
    enemyMs: 0,
    controller: "none",
  }),
  step(state, frame) {
    const controller = zoneController(frame, state.def.at, state.def.radius);
    const playerMs =
      state.playerMs + (controller === "player" ? frame.deltaMs : 0);
    const enemyMs =
      state.enemyMs + (controller === "enemy" ? frame.deltaMs : 0);
    const holdMs = state.def.holdSeconds * MS_PER_SECOND;
    const next = { ...state, controller, playerMs, enemyMs };
    if (playerMs >= holdMs) return { ...next, status: "completed" };
    if (state.def.enemyHoldFails && enemyMs >= holdMs) {
      return { ...next, status: "failed" };
    }
    return next;
  },
  readout: (state) => ({
    progressText: `${Math.floor(state.playerMs / MS_PER_SECOND)}/${state.def.holdSeconds}s`,
    fraction: clamp01(state.playerMs / (state.def.holdSeconds * MS_PER_SECOND)),
  }),
  markers: (state) => [
    {
      id: state.def.id,
      kind: "zone",
      x: state.def.at.x,
      y: state.def.at.y,
      radius: state.def.radius,
      progress: clamp01(
        state.playerMs / (state.def.holdSeconds * MS_PER_SECOND),
      ),
      controller: state.controller,
    },
  ],
  isConstraint: () => false,
};

export const SABOTAGE_MODEL: ObjectiveModel<SabotageDefinition, SabotageState> =
  {
    ...NO_WORLD_PRESENCE,
    create: (def) => ({ ...coreOf(def), progressMs: 0, occupied: false }),
    step(state, frame) {
      const occupied = frame.ships.some(
        (ship) =>
          ship.side === "player" &&
          withinRange(ship, state.def.at, state.def.radius, frame.worldSize),
      );
      const decay = (state.def.decayPerSecond ?? 0) * frame.deltaMs;
      const progressMs = occupied
        ? state.progressMs + frame.deltaMs
        : Math.max(0, state.progressMs - decay);
      const done = progressMs >= state.def.holdSeconds * MS_PER_SECOND;
      return {
        ...state,
        occupied,
        progressMs,
        status: done ? "completed" : "active",
      };
    },
    readout: (state) => ({
      progressText: `${Math.round(clamp01(state.progressMs / (state.def.holdSeconds * MS_PER_SECOND)) * 100)}%`,
      fraction: clamp01(
        state.progressMs / (state.def.holdSeconds * MS_PER_SECOND),
      ),
    }),
    markers: (state) => [
      {
        id: state.def.id,
        kind: "zone",
        x: state.def.at.x,
        y: state.def.at.y,
        radius: state.def.radius,
        progress: clamp01(
          state.progressMs / (state.def.holdSeconds * MS_PER_SECOND),
        ),
        controller: state.occupied ? "player" : "none",
      },
    ],
    isConstraint: () => false,
  };
