/**
 * lobbyData — static lobby data and pure helpers: faction display names,
 * the faction cycle order and the default ships spawned for a faction when
 * the server supplies none.
 */

import type { FactionId } from "../../config";

/** Faction display names shown in player slots. */
export const FACTION_NAMES: Readonly<Record<FactionId, string>> = {
  terran_hegemony: "Terran Hegemony",
  free_confederation: "Free Confederation",
  synthetic_collective: "Synthetic Collective",
  void_corsairs: "Void Corsairs",
  ascendant_empire: "Ascendant Empire",
};

/** Order used by "Change Faction". */
export const ALL_FACTIONS: ReadonlyArray<FactionId> = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

/** Default squads per faction for local simulation / missing server data. */
const DEFAULT_FACTION_SHIPS: Readonly<
  Record<FactionId, ReadonlyArray<string>>
> = {
  terran_hegemony: ["terran_gladius", "terran_viper", "terran_viper"],
  free_confederation: ["confed_falcon", "confed_sparrow", "confed_sparrow"],
  synthetic_collective: [
    "synth_drone",
    "synth_drone",
    "synth_drone",
    "synth_drone",
  ],
  void_corsairs: ["corsair_raider", "corsair_raider", "corsair_cutlass"],
  ascendant_empire: ["ascendant_seraph", "ascendant_seraph"],
};

/**
 * Default ship ids for a faction.
 *
 * @param factionId - Faction, or null.
 * @returns Ship definition ids (empty for no faction).
 */
export function defaultShipsForFaction(factionId: FactionId | null): string[] {
  if (!factionId) return [];
  return [...(DEFAULT_FACTION_SHIPS[factionId] ?? [])];
}

/**
 * Resolve ship IDs for a player slot, preferring server-provided data over defaults.
 *
 * @param factionId - The player's chosen faction.
 * @param remoteShips - Ships supplied by the server (empty or absent for local sim).
 * @returns Array of ship definition IDs to spawn.
 */
export function resolveShips(
  factionId: string | null,
  remoteShips?: string[],
): string[] {
  if (remoteShips && remoteShips.length > 0) return remoteShips;
  return defaultShipsForFaction(factionId as FactionId | null);
}

/**
 * Next faction in the "Change Faction" cycle.
 *
 * @param current - Current faction id, or null.
 * @returns The following faction (wraps around).
 */
export function nextFaction(current: string | null): FactionId {
  const index = current ? ALL_FACTIONS.indexOf(current as FactionId) : -1;
  return ALL_FACTIONS[(index + 1) % ALL_FACTIONS.length] as FactionId;
}

/**
 * Display label for a room's game mode.
 *
 * @param gameMode - Room mode id ("arcade", "dogfight", …).
 * @returns Title-case label, e.g. "Arcade".
 */
export function gameModeLabel(gameMode: string | undefined): string {
  const mode = gameMode && gameMode.length > 0 ? gameMode : "arcade";
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}
