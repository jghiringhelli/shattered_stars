/**
 * Squad Builder data types.
 * Defines the squad/ship hierarchy used by SquadBuilderScene and battle scenes.
 */

import type { FactionId } from "../config";
import type { AIDifficultyLevel } from "../ai/AIDifficulty";

export type GameMode = "arcade" | "continuous" | "survival" | "online" | "epic";

/**
 * A single squad — one faction's ships, controlled by one player or AI.
 * Squads with the same teamId fight on the same side.
 */
export interface SquadEntry {
  /** Team number 1–4. Squads sharing a teamId are allies. */
  teamId: number;
  factionId: FactionId | null;
  controller: "player" | "ai";
  ships: string[];
  /** loadoutId keyed by shipId — chosen via ShipPickerScene */
  loadoutChoices: Record<string, string>;
  pointsUsed: number;
}

/** Full battle setup written to registry and consumed by battle scenes */
export interface BattleConfig {
  factions: Array<{
    factionId: FactionId | null;
    controller: "player" | "ai";
    ships: string[];
    loadoutChoices: Record<string, string>;
    teamId: string;
  }>;
  gameMode: GameMode;
  pointLimit: number;
  aiDifficulty: AIDifficultyLevel;
}

export const TEAM_COLORS: readonly number[] = [
  0x2255cc, 0xcc3322, 0x22aa44, 0xcc8822,
];
export const TEAM_LABELS: readonly string[] = ["T1", "T2", "T3", "T4"];

/** Modes that allow the player to configure team structure */
export const MULTI_TEAM_MODES: readonly GameMode[] = [
  "arcade",
  "continuous",
  "epic",
];

const ALL_FACTIONS: FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

/**
 * Create a blank squad entry for the given team.
 * @param teamId - Team number 1–4 this squad belongs to.
 * @param index - Used to cycle the default faction assignment.
 * @param controller - Human player or AI.
 */
export function makeSquad(
  teamId: number,
  index: number,
  controller: "player" | "ai",
): SquadEntry {
  return {
    teamId,
    factionId: ALL_FACTIONS[index % ALL_FACTIONS.length] as FactionId,
    controller,
    ships: [],
    loadoutChoices: {},
    pointsUsed: 0,
  };
}

/**
 * Derive a human-readable battle format label from the current squad list.
 * Counts squads per team, sorts descending, joins with 'v'.
 *
 * @param squads - All squads in the builder.
 * @returns Label such as "1v1", "2v2", "2v1", "1v1v1v1".
 */
export function computeFormatLabel(squads: SquadEntry[]): string {
  const teamCounts = new Map<number, number>();
  for (const s of squads) {
    teamCounts.set(s.teamId, (teamCounts.get(s.teamId) ?? 0) + 1);
  }
  if (teamCounts.size === 0) return "—";
  return [...teamCounts.values()].sort((a, b) => b - a).join("v");
}
