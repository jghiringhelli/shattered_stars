/**
 * scenarioEndModel — the end screen of a scenario match as plain data:
 * outcome, how it ended and the score breakdown per side.
 *
 * Pure: no Phaser.
 */

import {
  totalPoints,
  type ScenarioDefinition,
  type ScenarioResult,
} from "../../arcade/scenarios";
import { formatMatchClock } from "../../systems/arena/MatchTimer";

/** One breakdown row: a label and each side's points. */
export interface EndRow {
  readonly label: string;
  readonly player: string;
  readonly enemy: string;
}

/** The end screen's content. */
export interface ScenarioEndSummary {
  readonly outcome: "victory" | "defeat" | "draw";
  readonly headline: string;
  readonly title: string;
  readonly scenarioName: string;
  readonly reason: string;
  readonly rows: readonly EndRow[];
  readonly footer: string;
}

/**
 * @param result - How the match ended.
 * @param definition - The scenario played.
 * @returns The end screen's content.
 */
export function endSummary(
  result: ScenarioResult,
  definition: ScenarioDefinition,
): ScenarioEndSummary {
  const outcome =
    result.winner === "draw"
      ? "draw"
      : result.winner === "player"
        ? "victory"
        : "defeat";
  const { player, enemy } = result.points;
  return {
    outcome,
    headline:
      outcome === "victory"
        ? "VICTORY"
        : outcome === "defeat"
          ? "DEFEATED"
          : "DRAW",
    title:
      outcome === "draw"
        ? "Scenario drawn"
        : outcome === "victory"
          ? "Scenario won"
          : "Scenario lost",
    scenarioName: definition.name,
    reason: reasonText(result, definition),
    rows: [
      {
        label: "OBJECTIVES",
        player: `${player.objective}`,
        enemy: `${enemy.objective}`,
      },
      {
        label: "DESTRUCTION",
        player: `${player.destruction}`,
        enemy: `${enemy.destruction}`,
      },
      {
        label: "TOTAL",
        player: `${totalPoints(player)}`,
        enemy: `${totalPoints(enemy)}`,
      },
    ],
    footer: `${result.rounds} ROUNDS  ·  ${formatMatchClock(result.elapsedMs)}`,
  };
}

/**
 * @returns Why the match ended, in words.
 */
function reasonText(
  result: ScenarioResult,
  definition: ScenarioDefinition,
): string {
  if (result.reason === "threshold")
    return `First to ${definition.threshold} points`;
  if (result.reason === "time") return "Time limit — highest score wins";
  if (result.winner === "player") return "Enemy fleet destroyed";
  if (result.winner === "enemy") return "Your fleet was destroyed";
  return "Both fleets destroyed";
}
