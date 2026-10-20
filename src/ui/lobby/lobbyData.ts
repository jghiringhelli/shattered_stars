/**
 * lobbyData — static lobby data: faction display names, the faction cycle
 * order and each faction's default online squad.
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
  void_corsairs: ["corsair_blade", "corsair_blade", "corsair_cutlass"],
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
