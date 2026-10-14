/**
 * Confederation lore, Act I — Free Fall (Days 1–40): slots 1–5
 * (docs/lore/campaigns/confederation.md).
 */

import {
  atTime,
  onObjective,
  say,
  setFlag,
} from "../designKit";
import {
  COMMAND,
  PHOENIX,
  SANTOS,
  VASQUEZ,
} from "../designs/confederationAct1";
import type { MissionLore } from "../loreTypes";
import { debriefLine } from "./confederationLoreShared";

/** Slots 1–5 of the Confederation campaign. */
export const CONFEDERATION_ACT1_LORE: Readonly<Record<string, MissionLore>> = {
  conf_1_1: {
    day: 5,
    location: "Corrin's Drift, asteroid belt",
    tagline: "A stolen hull. A borrowed sky. Learn it fast.",
    briefing:
      "Two days ago you refused to fire on refugee lifters over Omega and ran, in a stolen Hegemony hull. The cell has repainted it Libre orange. Phoenix One has laid a smuggler's gate run through Corrin's Drift: learn the ship before the Registry finds you.",
    textSwaps: [
      [
        "Controls are sluggish. Hegemony scrap with a Libre paint job.",
        "Controls are sluggish. Hegemony iron under Libre paint.",
      ],
    ],
    script: [
      atTime(
        8,
        say(
          VASQUEZ,
          "Dr. Vasquez, your medic and rigger tech. I'm the reason those lifters were running. Fly anyway.",
          "solemn",
        ),
      ),
    ],
    debriefAppend: [
      debriefLine(
        PHOENIX,
        "You fly like someone who learned on rails. We'll fix that. Welcome to the cell, Libre One.",
        "proud",
      ),
      debriefLine(
        VASQUEZ,
        "The Registry has your name by now. Stay off the open channels.",
        "grim",
      ),
    ],
  },
  conf_1_2: {
    day: 9,
    location: "Rim census lane",
    tagline: "One census Viper. One shot. Make it count.",
    briefing:
      "A Registry census Viper is working the Rim lane, scanning for newly woken psions. If it reports, a Hegemony cordon follows within the hour. Stop it before it does.",
    objectiveText: {
      kill: "Destroy the Registry census Viper before it reports",
      quick: "Down the Viper within 60 seconds",
    },
    textSwaps: [
      [
        "Lone Viper on a census sweep. Show them the Confederation fights back.",
        "Registry census Viper, scanning for newly woken psions. Stop it before it reports.",
      ],
      [
        "Every second he breathes, he's broadcasting our position.",
        "Every second he breathes, he's logging a psion's name.",
      ],
    ],
  },
  conf_1_3: {
    day: 19,
    location: "Kessa Lane",
    crossover: "X1",
    tagline: "Burn the census cores. Vanish before the sirens.",
    briefing:
      "The convoy on Kessa Lane carries the Registry's census cores: the lists of every psion on the Rim. Burn them, stay clear of the sensor buoys, and vanish into the debris field before the reaction force arrives.",
    objectiveText: {
      convoy: "Destroy the Registry census-core convoy",
    },
    textSwaps: [
      [
        "Buoys tripped! Reaction force inbound!",
        "Buoys tripped! Hegemony Raptors — that's Chen's squadron!",
      ],
      [
        "Convoy's burning. Break south-west and go dark.",
        "Census cores are burning. Break south-west and go dark.",
      ],
    ],
    script: [
      onObjective(
        "convoy",
        "completed",
        setFlag("x1_census_burned", true),
        say(
          VASQUEZ,
          "No more lists. Every psion on this Rim just got a little safer.",
          "proud",
        ),
      ),
    ],
    variants: [
      {
        when: { flag: "x1_phoenix_wounded" },
        tagline: "Phoenix is hurt. Fly for two.",
        briefing:
          "The convoy on Kessa Lane carries the Registry's census cores: the lists of every psion on the Rim. Phoenix One flies hurt after Chen's squadron caught her at the lane, so the strike is yours to lead. Burn the cores, stay clear of the buoys, and vanish.",
        script: [
          atTime(
            12,
            say(
              PHOENIX,
              "Chen's squadron put two rounds through my canopy. I'm slow. Cover me, Libre One.",
              "grim",
            ),
          ),
        ],
      },
    ],
    debriefAppend: [
      debriefLine(
        SANTOS,
        "Hegemony Raptors answered the buoys in under a minute. That wing is trained, not conscripted.",
        "grim",
      ),
      debriefLine(
        PHOENIX,
        "Iron Fist. Chen's squadron. He's the one the Registry sends when it wants us dead.",
        "solemn",
      ),
    ],
  },
  conf_1_4: {
    day: 25,
    location: "Crash site, Rim",
    tagline: "A Fleet Intelligence wreck. Carry its secrets gently.",
    briefing:
      "A Fleet Intelligence courier has crashed on the Rim. Its logs carry convoy schedules, signed by a Vance cipher. Carry its tech cores to the drop zone, and hold the site long enough for Vasquez to pull the logs.",
    textSwaps: [
      [
        "Hegemony Raptor dropping in. They want their wreck back.",
        "Hegemony Raptor dropping in. Fleet Intelligence wants its courier back.",
      ],
      [
        "Crash logs downloaded. Convoy routes, shipping schedules — all of it.",
        "Crash logs downloaded. Convoy routes, shipping schedules, every page signed with the same Vance cipher.",
      ],
    ],
    debriefAppend: [
      debriefLine(
        VASQUEZ,
        "That cipher is Vance's. I've seen it before, on orders I wish I hadn't read.",
        "grim",
      ),
    ],
  },
  conf_1_5: {
    day: 36,
    location: "The Nest, Corrin's Drift",
    script: [
      onObjective(
        "evac",
        "completed",
        setFlag("conf_nest_evacuated", true),
        say(
          VASQUEZ,
          "Every family is at the jump point. Strand's hospital is aboard. The Nest can burn.",
          "proud",
        ),
      ),
    ],
    debriefAppend: [
      debriefLine(
        COMMAND,
        "The Nest is lost. The cells are not. Every ship that got out is a ship that fights.",
        "solemn",
      ),
    ],
  },
};
