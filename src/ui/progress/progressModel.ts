/**
 * progressModel — the rows of the profile / progress panel (pure: no DOM).
 */

import type { ShipDefinition } from "../../core/types";
import { summarizeProgress } from "../../data/progressSummary";
import type { PlayerProfile } from "../../systems/PlayerProfile";

/** One label / value line of the panel. */
export interface ProgressRow {
  readonly label: string;
  readonly value: string;
}

/**
 * @param profile - The active profile.
 * @param ships - Every ship in the game.
 * @returns The panel's rows, top to bottom.
 */
export function progressRows(
  profile: PlayerProfile,
  ships: readonly ShipDefinition[],
): ProgressRow[] {
  const summary = summarizeProgress(profile, ships);
  const { stats } = profile;
  return [
    { label: "Pilot", value: profile.name },
    { label: "Level", value: String(summary.level) },
    {
      label: "XP",
      value: `${summary.xpIntoLevel} / ${summary.xpPerLevel} to next level (${profile.totalXp} total)`,
    },
    {
      label: "Ships unlocked",
      value: `${summary.unlockedShips} / ${summary.totalShips}`,
    },
    {
      label: "Factions unlocked",
      value: `${summary.unlockedFactions} / ${summary.totalFactions}`,
    },
    {
      label: "Battles",
      value: `${stats.battles} (${stats.wins} won, ${stats.losses} lost, ${stats.kills} kills)`,
    },
  ];
}
