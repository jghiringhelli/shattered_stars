/**
 * ArcadeVictorySystem — Pure win/loss condition check, by team: the
 * player's team wins once no other team has a living ship, and loses once
 * it has none (a teammate of another faction keeps it in the fight; a
 * same-faction enemy never does).
 * Extracted from ArcadeBattleScene.checkVictory() to eliminate
 * per-frame Array.from().filter() allocations.
 */

import type { TeamId } from "../teams";
import type { ArcadeShipView, FrameCache } from "./ArcadeFrameCache";

export type VictoryResult =
  { outcome: "none" } | { outcome: "victory" } | { outcome: "defeat" };

/**
 * Determines battle outcome from the frame cache.
 *
 * @param cache      - Precomputed alive-ship lists.
 * @param playerTeam - The player's team.
 * @returns Victory, defeat or none (the battle goes on).
 */
export function checkVictoryCondition<T extends ArcadeShipView>(
  cache: FrameCache<T>,
  playerTeam: TeamId,
): VictoryResult {
  const allies = cache.aliveByTeam.get(playerTeam);
  const allyCount = allies?.length ?? 0;

  let enemyCount = 0;
  for (const [team, list] of cache.aliveByTeam) {
    if (team !== playerTeam) enemyCount += list.length;
  }

  if (enemyCount === 0 && allyCount > 0) return { outcome: "victory" };
  if (allyCount === 0) return { outcome: "defeat" };
  return { outcome: "none" };
}
