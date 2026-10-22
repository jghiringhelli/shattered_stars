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
      ships: ["terran_centurion"],
      abilities: ["marksmanship", "lone_wolf"],
    },
    side2: {
      name: "Phoenix Commander",
      faction: "free_confederation",
      ships: ["confed_eagle"],
      // Predator + Tenacity (was + Fearless): the Centurion won 75 % at
      // average after the per-maneuver speed cap; now 63 %.
      abilities: ["predator", "tenacity"],
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
      // Tenacity instead of Predator (round 5): the Viper won 40-44 % at
      // average, 51 % at expert; now 49 / 53 %.
      abilities: ["supernatural_reflexes", "tenacity"],
    },
    side2: {
      name: "Vortex Ace",
      faction: "void_corsairs",
      ships: ["corsair_phantom"],
      // Evade Mastery + Predator (was Fearless + Outmaneuver): the Viper
      // won 67 % at expert once the bots stopped weaving; now 45 / 59 %.
      // Focus Mastery instead of Predator (round 5, see the Viper above).
      abilities: ["evade_mastery", "focus_mastery"],
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
      // Tenacity + Marksmanship (was Stealth Device + Marksmanship): the
      // Marauder won 75 % at average once stress cleared passively (round 5
      // stress rework); now 50 / 50 % at average / expert.
      abilities: ["tenacity", "marksmanship"],
    },
  },
  {
    id: "gunship_duel",
    name: "Gunship Showdown",
    description: "Collective Prime Node vs Empire Archon",
    flavorText:
      "Two siege gunships trade broadsides at point-blank range. The heavier guns win.",
    side1: {
      name: "Collective Prime Node",
      faction: "synthetic_collective",
      ships: ["synth_eradicator"],
      abilities: ["networked_aim"],
    },
    side2: {
      name: "Empire Archon",
      faction: "ascendant_empire",
      ships: ["ascendant_judgment"],
      // Fearless + Iron Discipline (was Tenacity + Fearless): the Eradicator
      // won 68 % at expert; now 46 / 47 %.
      abilities: ["fearless", "iron_discipline"],
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
      ships: ["terran_hammer", "terran_hammer"],
      abilities: ["marksmanship"],
    },
    side2: {
      name: "Confederation Strike Team",
      faction: "free_confederation",
      ships: ["confed_pelican", "confed_pelican"],
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
