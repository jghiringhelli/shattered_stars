/**
 * simpleObjectives — objectives with no world presence: eliminate (kill
 * count, optionally by tag), survive (hold out a timer) and protect (keep
 * every ship with a tag alive — a constraint). Pure.
 */

import type {
  EliminateDefinition,
  ProtectDefinition,
  SurviveDefinition,
} from "./objectiveDefinitions";
import {
  MS_PER_SECOND,
  activeMs,
  anyPlayerAlive,
  coreOf,
  secondsLeft,
  type ObjectiveStateCore,
} from "./objectiveCore";
import { NO_WORLD_PRESENCE, type ObjectiveModel } from "./objectiveModel";
import { clamp01 } from "./objectiveGeometry";

/** Kills needed when an eliminate objective names no count. */
const DEFAULT_KILL_COUNT = 1;

/** Eliminate progress. */
export interface EliminateState extends ObjectiveStateCore<EliminateDefinition> {
  readonly kills: number;
}

/** Survive progress. */
export interface SurviveState extends ObjectiveStateCore<SurviveDefinition> {
  readonly heldMs: number;
}

/** Protect progress (none beyond its status). */
export type ProtectState = ObjectiveStateCore<ProtectDefinition>;

/**
 * @param def - Eliminate definition.
 * @returns Kills it needs.
 */
function killsNeeded(def: EliminateDefinition): number {
  return Math.max(1, def.count ?? DEFAULT_KILL_COUNT);
}

export const ELIMINATE_MODEL: ObjectiveModel<
  EliminateDefinition,
  EliminateState
> = {
  ...NO_WORLD_PRESENCE,
  create: (def) => ({ ...coreOf(def), kills: 0 }),
  step(state, frame) {
    const tag = state.def.tag;
    const kills =
      state.kills +
      frame.events.filter(
        (event) =>
          event.kind === "destroyed" &&
          event.side === "enemy" &&
          (tag === undefined || event.tags.includes(tag)),
      ).length;
    const done = kills >= killsNeeded(state.def);
    return { ...state, kills, status: done ? "completed" : "active" };
  },
  readout: (state) => ({
    progressText: `${Math.min(state.kills, killsNeeded(state.def))}/${killsNeeded(state.def)}`,
    fraction: clamp01(state.kills / killsNeeded(state.def)),
  }),
  isConstraint: () => false,
};

/**
 * @param def - Survive definition.
 * @returns How long it must be held (ms).
 */
function surviveMs(def: SurviveDefinition): number {
  return (def.timeLimit ?? 0) * MS_PER_SECOND;
}

export const SURVIVE_MODEL: ObjectiveModel<SurviveDefinition, SurviveState> = {
  ...NO_WORLD_PRESENCE,
  create: (def) => ({ ...coreOf(def), heldMs: 0 }),
  step(state, frame) {
    if (state.def.timeLimit === undefined) return state;
    const heldMs = activeMs(state, frame);
    if (heldMs < surviveMs(state.def)) return { ...state, heldMs };
    const status = anyPlayerAlive(frame) ? "completed" : "failed";
    return { ...state, heldMs, status };
  },
  readout: (state) => ({
    progressText: `${secondsLeft(surviveMs(state.def) - state.heldMs)}s`,
    fraction:
      surviveMs(state.def) > 0
        ? clamp01(state.heldMs / surviveMs(state.def))
        : 1,
  }),
  isConstraint: (def) => def.timeLimit === undefined,
};

export const PROTECT_MODEL: ObjectiveModel<ProtectDefinition, ProtectState> = {
  ...NO_WORLD_PRESENCE,
  create: (def) => coreOf(def),
  step(state, frame) {
    const lost = frame.events.some(
      (event) =>
        event.kind === "destroyed" &&
        event.side === "player" &&
        event.tags.includes(state.def.tag),
    );
    return lost ? { ...state, status: "failed" } : state;
  },
  readout: (state) => ({
    progressText: state.status === "failed" ? "LOST" : "",
    fraction: state.status === "failed" ? 0 : 1,
  }),
  isConstraint: () => true,
};
