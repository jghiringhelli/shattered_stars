/**
 * scenarioReadout — what a running scenario reports to tests and
 * telemetry: the scenario, round and clock, both sides' points, every
 * objective with its owner (and carrier), each AI ship's scenario role,
 * the scoreboard's text and the result.
 *
 * Pure: no Phaser.
 */

import {
  totalPoints,
  type ScenarioId,
  type ScenarioResult,
  type ScenarioSide,
  type ScenarioState,
  type SidePoints,
} from "../../arcade/scenarios";
import type { ScenarioDirector } from "./ScenarioDirector";
import {
  objectiveGlyphs,
  type ObjectiveGlyph,
  type ScoreboardView,
} from "./scenarioHudModel";

/** A running scenario, for tests and telemetry. */
export interface ScenarioReadout {
  readonly id: ScenarioId;
  readonly name: string;
  readonly round: number;
  readonly elapsedMs: number;
  readonly threshold: number;
  readonly points: Readonly<Record<ScenarioSide, SidePoints>>;
  readonly totals: Readonly<Record<ScenarioSide, number>>;
  readonly objectives: readonly ObjectiveGlyph[];
  /** AI ship id → its scenario role. */
  readonly roles: Readonly<Record<string, string>>;
  readonly board: Readonly<Record<keyof ScoreboardView, string>>;
  readonly result: ScenarioResult | null;
}

/**
 * @param state - The match.
 * @param director - The AI's objective play.
 * @param board - The scoreboard's text as shown.
 * @param ships - Every ship record (roles are read for living ones).
 * @returns The readout.
 */
export function buildReadout(
  state: ScenarioState,
  director: ScenarioDirector,
  board: Readonly<Record<keyof ScoreboardView, string>>,
  ships: Iterable<{ readonly id: string; readonly hull: number }>,
): ScenarioReadout {
  const roles: Record<string, string> = {};
  for (const ship of ships) {
    const role =
      ship.hull > 0 ? director.directiveFor(ship.id)?.role : undefined;
    if (role) roles[ship.id] = role;
  }
  return {
    id: state.definition.id,
    name: state.definition.name,
    round: state.round,
    elapsedMs: state.elapsedMs,
    threshold: state.definition.threshold,
    points: state.points,
    totals: {
      player: totalPoints(state.points.player),
      enemy: totalPoints(state.points.enemy),
    },
    objectives: objectiveGlyphs(state),
    roles,
    board,
    result: state.result,
  };
}
