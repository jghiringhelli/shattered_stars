/**
 * Ace Duel — preset iconic matchups (pure data, no Phaser, no I/O).
 *
 * Extracted from AceDuelScene so the matchup roster is unit-testable: a balance
 * guardrail can validate that every preset references real ships/abilities and
 * that no matchup is a hopeless stomp under a headless simulation.
 *
 * Factions/ships are translated from the classic Star Wars ace duels into the
 * Shattered Stars setting.
 */

import type { FactionId } from "../config";

/** One side of a preset duel: a named pilot flying one or more ships with abilities. */
export interface AceMatchupSide {
  readonly name: string;
  readonly faction: FactionId;
  readonly ships: readonly string[];
  readonly abilities: readonly string[];
}

/** A preset iconic 1v1 (or small-squad) duel between two named aces. */
export interface AceMatchup {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly flavorText: string;
  readonly side1: AceMatchupSide;
  readonly side2: AceMatchupSide;
}

/** The full roster of preset ace duels shown in the Ace Duel scene. */
export const ACE_MATCHUPS: readonly AceMatchup[] = [
  {
    id: "elite_fighters",
    name: "Elite Fighters",
    description: "Admiral Kronos vs Phoenix Commander",
    flavorText:
      "Two legendary aces clash in a battle of wits and reflexes. Only one will emerge victorious.",
    side1: {
      name: "Admiral Kronos",
      faction: "terran_hegemony",
      ships: ["terran_raptor"],
      abilities: ["marksmanship", "lone_wolf"],
    },
    side2: {
      name: "Phoenix Commander",
      faction: "free_confederation",
      ships: ["confed_falcon"],
      abilities: ["predator", "outmaneuver"],
    },
  },
  {
    id: "interceptor_duel",
    name: "Interceptor Duel",
    description: "Raptor Squadron vs Vortex Wing",
    flavorText:
      "Speed versus agility. These interceptors dance through space at impossible velocities.",
    side1: {
      name: "Raptor Squadron Leader",
      faction: "terran_hegemony",
      ships: ["terran_viper"],
      abilities: ["supernatural_reflexes", "predator"],
    },
    side2: {
      name: "Vortex Ace",
      faction: "void_corsairs",
      ships: ["corsair_fang"],
      abilities: ["fearless", "lone_wolf"],
    },
  },
  {
    id: "heavy_duel",
    name: "Heavy Ship Duel",
    description: "Corsair Captain vs Freighter Captain",
    flavorText:
      "Massive ships trade devastating broadsides. Hull plating groans under the assault.",
    side1: {
      name: "Corsair Captain Deathmark",
      faction: "void_corsairs",
      ships: ["corsair_marauder"],
      abilities: ["tenacity", "fearless"],
    },
    side2: {
      name: "Confederation Freighter Captain",
      faction: "free_confederation",
      ships: ["confed_hawk"],
      abilities: ["regenerative_shields", "stealth_device"],
    },
  },
  {
    id: "gunship_duel",
    name: "Gunship Showdown",
    description: "Collective Prime Node vs Empire Archon",
    flavorText:
      "Two capital-class vessels, each capable of leveling cities, face off in the void.",
    side1: {
      name: "Collective Prime Node",
      faction: "synthetic_collective",
      ships: ["synth_devastator"],
      abilities: ["networked_aim", "predatory_instinct"],
    },
    side2: {
      name: "Empire Archon",
      faction: "ascendant_empire",
      ships: ["ascendant_bastion"],
      abilities: ["regenerative_shields", "tenacity"],
    },
  },
  {
    id: "bomber_squadron",
    name: "Bomber Squadron",
    description: "Hegemony Bomber Wing vs Confederation Strike Team",
    flavorText:
      "Heavy ordnance fills the void as bomber squadrons clash in a devastating exchange.",
    side1: {
      name: "Hegemony Bomber Wing",
      faction: "terran_hegemony",
      ships: ["terran_thunderbolt", "terran_thunderbolt"],
      abilities: ["marksmanship"],
    },
    side2: {
      name: "Confederation Strike Team",
      faction: "free_confederation",
      ships: ["confed_condor", "confed_condor"],
      abilities: ["predator"],
    },
  },
  {
    id: "hunter_hunted",
    name: "Hunter vs Hunted",
    description: "Corsair Bounty Hunter vs Collective Assassin",
    flavorText:
      "A deadly game of cat and mouse. The hunter becomes the hunted.",
    side1: {
      name: "Corsair Bounty Hunter",
      faction: "void_corsairs",
      ships: ["corsair_talon"],
      abilities: ["predatory_instinct", "outmaneuver"],
    },
    side2: {
      name: "Collective Assassin Drone",
      faction: "synthetic_collective",
      ships: ["synth_interceptor_drone"],
      abilities: ["stealth_device", "tenacity"],
    },
  },
];
