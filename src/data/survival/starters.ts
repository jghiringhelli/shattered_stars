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

/** What a starting flagship brings besides its hull (balance lever per hull). */
export interface StarterKit {
  /** Ship upgrade levels the flagship starts with (+1 damage and hull each). */
  readonly upgrades: number;
  /** Escort wingmen on top of the free one. */
  readonly escorts: number;
  /** Relic the run starts with, or null. */
  readonly relicId: string | null;
  /** Salvage added to the starting purse. */
  readonly salvage: number;
}

/** A starter that needs no help. */
export const NO_STARTER_KIT: StarterKit = {
  upgrades: 0,
  escorts: 0,
  relicId: null,
  salvage: 0,
};

/**
 * Starting kits by flagship id: the hulls that measure far below the
 * viper / herald get what their faction's identity trades in (tuned with
 * the run sim so every base starter wins roughly as often).
 */
export const STARTER_KITS: Readonly<Record<string, StarterKit>> = {
  // Riggers: two upgrade levels and a repair crew (Nanite Weave).
  confed_wasp: {
    upgrades: 2,
    escorts: 0,
    relicId: "nanite_weave",
    salvage: 0,
  },
  confed_sparrow: {
    upgrades: 2,
    escorts: 0,
    relicId: "nanite_weave",
    salvage: 0,
  },
  corsair_blade: {
    upgrades: 3,
    escorts: 0,
    relicId: "smugglers_hold",
    salvage: 0,
  },
  synth_drone: {
    upgrades: 3,
    escorts: 2,
    relicId: null,
    salvage: 0,
  },
  // Raiders: a fully refitted hull and a smuggler's hold.
  corsair_fang: {
    upgrades: 3,
    escorts: 0,
    relicId: "smugglers_hold",
    salvage: 0,
  },
  // Swarm: a refitted scout and two extra drone wingmen.
  synth_scout_drone: {
    upgrades: 3,
    escorts: 2,
    relicId: null,
    salvage: 0,
  },
};

/**
 * @param flagshipId - The starting flagship.
 * @returns Its starting kit (none for hulls that need no help).
 */
export function starterKitOf(flagshipId: string): StarterKit {
  return STARTER_KITS[flagshipId] ?? NO_STARTER_KIT;
}

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
