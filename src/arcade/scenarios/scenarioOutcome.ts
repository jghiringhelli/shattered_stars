/**
 * scenarioOutcome — how a scenario match ends: the first side to the
 * threshold wins (both at once: the higher total, then destruction points);
 * a side with no ships left loses (a mutual wipe-out goes to the points);
 * at the time limit the higher total wins, destruction points break a tie,
 * else it is a draw.
 *
 * Pure.
 */

import type { ScenarioResult, ScenarioSide, SidePoints } from "./scenarioTypes";

/** What the outcome is decided from. */
export interface OutcomeInput {
  readonly points: Readonly<Record<ScenarioSide, SidePoints>>;
  readonly threshold: number;
  readonly elapsedMs: number;
  readonly timeLimitMs: number;
  /** Whether each side still has a living ship. */
  readonly alive: Readonly<Record<ScenarioSide, boolean>>;
  /** Rounds completed. */
  readonly rounds: number;
}

/**
 * @param points - A side's points.
 * @returns Its total score.
 */
export function totalPoints(points: SidePoints): number {
  return points.objective + points.destruction;
}

/**
 * @param points - Both sides' points.
 * @returns The side ahead on total, then destruction points, else "draw".
 */
export function leaderByPoints(
  points: Readonly<Record<ScenarioSide, SidePoints>>,
): ScenarioSide | "draw" {
  const player = totalPoints(points.player);
  const enemy = totalPoints(points.enemy);
  if (player !== enemy) return player > enemy ? "player" : "enemy";
  if (points.player.destruction !== points.enemy.destruction) {
    return points.player.destruction > points.enemy.destruction
      ? "player"
      : "enemy";
  }
  return "draw";
}

/**
 * @param input - Points, threshold, clock, survivors.
 * @returns How the match ended, or null while it goes on.
 */
export function decideOutcome(input: OutcomeInput): ScenarioResult | null {
  const end = (
    winner: ScenarioSide | "draw",
    reason: ScenarioResult["reason"],
  ): ScenarioResult => ({
    winner,
    reason,
    points: input.points,
    rounds: input.rounds,
    elapsedMs: input.elapsedMs,
  });
  const reached =
    totalPoints(input.points.player) >= input.threshold ||
    totalPoints(input.points.enemy) >= input.threshold;
  if (reached) return end(leaderByPoints(input.points), "threshold");
  if (!input.alive.player || !input.alive.enemy) {
    if (input.alive.player) return end("player", "annihilation");
    if (input.alive.enemy) return end("enemy", "annihilation");
    return end(leaderByPoints(input.points), "annihilation");
  }
  if (input.elapsedMs >= input.timeLimitMs) {
    return end(leaderByPoints(input.points), "time");
  }
  return null;
}
