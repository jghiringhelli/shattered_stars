/**
 * Survival roguelite — starting ships (pure data). Base flagship choices
 * per faction, plus the extra flagships unlocked through meta-progression.
 */

import type { FactionId } from "../../config";

/**
 * Default starter (and escort hull) per faction. terran_hegemony flies the
 * viper rather than the stiletto: self-play showed the stiletto (agility 3,
 * no boost) dying at wave 1 in 4/4 runs while every other starter reached
 * wave 2+; the viper (+1 hull, +1 attack, boost + target lock) evens it out.
 */
export const FACTION_STARTER_SHIPS: Readonly<Record<FactionId, string>> = {
  terran_hegemony: "terran_viper",
  free_confederation: "confed_sparrow",
  synthetic_collective: "synth_scout_drone",
  void_corsairs: "corsair_fang",
  ascendant_empire: "ascendant_herald",
};

/** The two base flagship choices per faction: one nimble, one tankier. */
export const SURVIVAL_STARTER_CHOICES: Readonly<
  Record<FactionId, readonly string[]>
> = {
  terran_hegemony: ["terran_viper", "terran_raptor"],
  free_confederation: ["confed_wasp", "confed_sparrow"],
  synthetic_collective: ["synth_scout_drone", "synth_drone"],
  void_corsairs: ["corsair_fang", "corsair_blade"],
  ascendant_empire: ["ascendant_herald", "ascendant_seraph"],
};

/** Heavy-fighter flagships unlocked by the "Heavy Flagships" meta unlock. */
export const HEAVY_STARTERS: Readonly<Record<FactionId, string>> = {
  terran_hegemony: "terran_gladius",
  free_confederation: "confed_falcon",
  synthetic_collective: "synth_hunter",
  void_corsairs: "corsair_marauder",
  ascendant_empire: "ascendant_templar",
};

/** Gunship flagships unlocked by the "Gunship Flagships" meta unlock. */
export const GUNSHIP_STARTERS: Readonly<Record<FactionId, string>> = {
  terran_hegemony: "terran_vindicator",
  free_confederation: "confed_phoenix",
  synthetic_collective: "synth_devastator",
  void_corsairs: "corsair_reaver",
  ascendant_empire: "ascendant_wrath",
};
