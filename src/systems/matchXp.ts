/**
 * matchXp — grants the active profile the XP of every match that ends with a
 * result, in any mode (PRG-6). Hooked into the match recorder's `onResult`,
 * which fires exactly once per finished match (never for a quit, a restart
 * or a rematch that replaces an unfinished one).
 */

import { matchXpReward, type XpMatchSummary } from "../data/ModeXp";
import { PlayerProfileManager } from "./PlayerProfile";

/**
 * @param summary - A match that ended with a result.
 * @returns Whether XP was granted.
 */
export function awardMatchXp(summary: XpMatchSummary): boolean {
  const reward = matchXpReward(summary);
  if (!reward) return false;
  try {
    const active = PlayerProfileManager.getActive();
    return PlayerProfileManager.awardMatchResult(active.id, reward) !== null;
  } catch (error) {
    console.error("Failed to award match XP:", error);
    return false;
  }
}
