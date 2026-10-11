/**
 * Survival roguelite — faction display names (pure data).
 */

import type { FactionId } from "../../config";

/** Full faction names for headers and summaries. */
export const FACTION_NAMES_SHORT: Readonly<Record<FactionId, string>> = {
  terran_hegemony: "Terran Hegemony",
  free_confederation: "Free Confederation",
  synthetic_collective: "Synthetic Collective",
  void_corsairs: "Void Corsairs",
  ascendant_empire: "Ascendant Empire",
};
