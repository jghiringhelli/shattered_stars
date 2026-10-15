/**
 * Progress summary — what the profile panel shows about a profile: its
 * level, XP towards the next one, and how much of the roster it unlocked.
 * Pure: derived from ProgressionData's unlock rules.
 */

import type { FactionId } from "../config";
import type { ShipDefinition } from "../core/types";
import {
  FACTION_UNLOCK_XP,
  STARTING_FACTIONS,
  isFactionUnlocked,
  isShipUnlocked,
  type ProgressionState,
} from "./ProgressionData";

/** XP needed for each profile level. */
export const XP_PER_LEVEL = 500;

/** What the panel shows. */
export interface ProgressSummary {
  readonly level: number;
  /** XP earned inside the current level. */
  readonly xpIntoLevel: number;
  readonly xpPerLevel: number;
  readonly unlockedShips: number;
  readonly totalShips: number;
  readonly unlockedFactions: number;
  readonly totalFactions: number;
}

/**
 * @param totalXp - A profile's global XP.
 * @returns Its level (starts at 1).
 */
export function levelOf(totalXp: number): number {
  return Math.floor(Math.max(0, totalXp) / XP_PER_LEVEL) + 1;
}

/**
 * @param state - The profile's progression state.
 * @param ships - Every ship in the game.
 * @returns Level, level progress and unlock counts.
 */
export function summarizeProgress(
  state: ProgressionState,
  ships: readonly ShipDefinition[],
): ProgressSummary {
  const factions: readonly FactionId[] = [
    ...STARTING_FACTIONS,
    ...(Object.keys(FACTION_UNLOCK_XP) as FactionId[]),
  ];
  return {
    level: levelOf(state.totalXp),
    xpIntoLevel: Math.max(0, state.totalXp) % XP_PER_LEVEL,
    xpPerLevel: XP_PER_LEVEL,
    unlockedShips: ships.filter((ship) => isShipUnlocked(ship, state)).length,
    totalShips: ships.length,
    unlockedFactions: factions.filter((f) => isFactionUnlocked(f, state)).length,
    totalFactions: factions.length,
  };
}
