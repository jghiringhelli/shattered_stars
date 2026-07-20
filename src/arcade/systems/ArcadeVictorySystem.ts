/**
 * ArcadeVictorySystem — Pure win/loss condition check.
 * Extracted from ArcadeBattleScene.checkVictory() to eliminate
 * per-frame Array.from().filter() allocations.
 */

import type { FrameCache } from "./ArcadeFrameCache";

export type VictoryResult =
  { outcome: "none" } | { outcome: "victory" } | { outcome: "defeat" };

/**
 * Determines battle outcome from the frame cache.
 *
 * @param cache         - Precomputed alive-ship lists.
 * @param playerFaction - The player's faction ID.
 */
export function checkVictoryCondition(
  cache: FrameCache,
  playerFaction: string,
): VictoryResult {
  const allies = cache.aliveByFaction.get(playerFaction);
  const allyCount = allies?.length ?? 0;

  let enemyCount = 0;
  for (const [faction, list] of cache.aliveByFaction) {
    if (faction !== playerFaction) enemyCount += list.length;
  }

  if (enemyCount === 0 && allyCount > 0) return { outcome: "victory" };
  if (allyCount === 0) return { outcome: "defeat" };
  return { outcome: "none" };
}
