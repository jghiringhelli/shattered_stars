/**
 * reinforcementOutcome — how a reinforced match ends: a side whose pool is
 * exhausted (no ship alive and none it can deploy) loses; if both run out
 * together, or the 3-minute limit is reached, the side that destroyed more
 * points wins, equal points is a draw.
 *
 * Pure.
 */

/** The two sides of a reinforced match (the player's and its opponents). */
export type ReinforcedSide = "player" | "enemy";

/** A side as the outcome reads it. */
export interface SideStanding {
  /** No ship alive and nothing left it can deploy. */
  readonly exhausted: boolean;
  /** Points of enemy ships this side destroyed. */
  readonly destroyedPoints: number;
}

/** Why a reinforced match ended. */
export type ReinforcedEndReason = "exhaustion" | "time";

/** How a reinforced match ended. */
export interface ReinforcedResult {
  readonly winner: ReinforcedSide | "draw";
  readonly reason: ReinforcedEndReason;
  readonly elapsedMs: number;
}

/** What the outcome is decided from. */
export interface ReinforcedOutcomeInput {
  readonly standings: Readonly<Record<ReinforcedSide, SideStanding>>;
  readonly elapsedMs: number;
  readonly timeLimitMs: number;
}

/**
 * @param input - Both sides, the clock and the limit.
 * @returns The result, or null while the match goes on.
 */
export function decideReinforcedOutcome(
  input: ReinforcedOutcomeInput,
): ReinforcedResult | null {
  const { player, enemy } = input.standings;
  const end = (
    winner: ReinforcedSide | "draw",
    reason: ReinforcedEndReason,
  ): ReinforcedResult => ({ winner, reason, elapsedMs: input.elapsedMs });
  if (player.exhausted && enemy.exhausted)
    return end(leaderByDestroyed(input.standings), "exhaustion");
  if (enemy.exhausted) return end("player", "exhaustion");
  if (player.exhausted) return end("enemy", "exhaustion");
  if (input.elapsedMs >= input.timeLimitMs)
    return end(leaderByDestroyed(input.standings), "time");
  return null;
}

/**
 * @param standings - Both sides.
 * @returns The side that destroyed more points, else "draw".
 */
export function leaderByDestroyed(
  standings: Readonly<Record<ReinforcedSide, SideStanding>>,
): ReinforcedSide | "draw" {
  const { player, enemy } = standings;
  if (player.destroyedPoints === enemy.destroyedPoints) return "draw";
  return player.destroyedPoints > enemy.destroyedPoints ? "player" : "enemy";
}
