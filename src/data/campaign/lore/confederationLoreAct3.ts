/**
 * Confederation lore, Act III — Dawn (Days 121–200): slots 11–15
 * (docs/lore/campaigns/confederation.md).
 */

import { atTime, onObjective, onVictory, say } from "../designKit";
import {
  COMMAND,
  PHOENIX,
  SANTOS,
  VASQUEZ,
} from "../designs/confederationAct1";
import type { MissionLore } from "../loreTypes";
import {
  CDR_CHEN,
  debriefLine,
  IRONWING,
  KRONOS,
} from "./confederationLoreShared";

/** Set by the Hegemony campaign when Chen's ceasefire already took place. */
const CEASEFIRE_CALLED = [{ flag: "x14_ceasefire_called" }] as const;

/** Slots 11–15 of the Confederation campaign. */
export const CONFEDERATION_ACT3_LORE: Readonly<Record<string, MissionLore>> = {
  conf_3_1: {
    day: 128,
    location: "The Six Worlds",
    tagline: "The Six Worlds rise. Give them a sky.",
    briefing:
      "The Six Worlds rise on the same night. Clear the garrison ships from their orbitals so the uprising can broadcast, and hold the beacon long enough for every world to hear it.",
    variants: [
      {
        when: { flag: "asc_heretics_spared" },
        script: [
          onObjective(
            "beacon",
            "completed",
            say(
              VASQUEZ,
              "The Unbound Vaelith are on the channel. A whole chorus, singing under our broadcast. The Ascendant called them heretics. The Six Worlds call them neighbours.",
              "proud",
            ),
          ),
        ],
      },
    ],
    debriefAppend: [
      debriefLine(
        COMMAND,
        "Six garrisons have surrendered their orbits. The Assembly of Worlds is asking when we reach Halden.",
        "proud",
      ),
    ],
  },
  conf_3_2: {
    day: 141,
    location: "Halden",
    crossover: "X10",
    tagline: "The capital in chains. Break the orbit.",
    briefing:
      "Halden, the Confederation's capital, has sat under Hegemony garrison since the Charter. Take orbital control with Wildfire, and break the garrison. Civilian lifters are lifting off beneath the fight, and Rim Command's Bastions are not choosy.",
    script: [
      atTime(
        15,
        say(
          IRONWING,
          "Ironwing, strike group. Lena Chen. My brother flies a Hegemony wing, and I hope he is nowhere near Halden.",
          "solemn",
        ),
      ),
    ],
    variants: [
      {
        when: { flag: "x10_chen_held_fire" },
        briefing:
          "Halden, the Confederation's capital, has sat under Hegemony garrison since the Charter. Take orbital control with Wildfire, and break the garrison. Civilian lifters are breaking orbit beneath the fight, and Iron Fist is holding fire on them. Ironwing Chen, Marcus Chen's sister, flies in the strike group.",
        addAllies: [
          {
            shipId: "confed_crane",
            count: 2,
            tag: "lifters",
            name: "Evacuation Lifters",
          },
        ],
        script: [
          atTime(
            30,
            say(
              PHOENIX,
              "Iron Fist is holding fire on the lifters. Why?",
              "urgent",
            ),
          ),
          atTime(
            34,
            say(
              IRONWING,
              "That's my brother's wing. Marcus doesn't hold fire without a reason. Give him one to keep it.",
              "solemn",
            ),
          ),
        ],
      },
    ],
    debriefAppend: [
      debriefLine(
        COMMAND,
        "Halden's orbit is ours. Speaker Marchetti has the Assembly in session on the surface.",
        "proud",
      ),
    ],
  },
  conf_3_3: {
    day: 167,
    location: "Kronos's encirclement, double minefield",
    tagline: "Kronos closed the net. Mines are the knots.",
    briefing:
      "Admiral Kronos has closed the net around the fleet: Bulwarks behind, a double minefield ahead, and one thin edge to the west. Break the blockade, don't follow his herding into the mines, and get the cells out.",
    textSwaps: [["The Admiral's closing the gap!", "Kronos is closing the gap!"]],
    debriefAppend: [
      debriefLine(
        SANTOS,
        "Kronos set that trap for a fleet. He got a fleet that knows how to leave.",
        "grim",
      ),
    ],
  },
  conf_3_4: {
    day: 199,
    location: "Fort Brannoc",
    crossover: "X14",
    tagline: "Fort Brannoc. Their aces. Our everything.",
    briefing:
      "Fort Brannoc, Rim Command's seat, sits behind an ion screen and a defense fleet with its aces in front. Break the fleet, take down the aces if you can, and open the gate for the fleet behind you.",
    objectiveText: {
      fleet: "Destroy the Fort Brannoc defense fleet",
      aces: "Destroy Rim Command's aces",
    },
    textSwaps: [
      [
        "They've lit an ion screen around High Command. Shields will drain.",
        "They've lit an ion screen around Fort Brannoc. Shields will drain.",
      ],
    ],
    victoryFlags: { x14_ceasefire_called: true },
    script: [
      onVictory([
        say(
          CDR_CHEN,
          "Libre One, this is Iron Actual. I'm calling a ceasefire.",
          "solemn",
        ),
        say(SANTOS, "...Hold fire. All cells, hold fire.", "solemn"),
        say(
          COMMAND,
          "Chen's wing is standing down, and Rim Command's loyalists have gone dark. Brannoc is open.",
          "urgent",
        ),
      ]),
      onVictory(
        [
          say(
            PHOENIX,
            "The Hegemony side heard him too. He called it from his own gate.",
            "proud",
          ),
        ],
        { if: CEASEFIRE_CALLED },
      ),
    ],
    debriefAppend: [
      debriefLine(
        SANTOS,
        "Brannoc's guns are quiet. Somewhere out there a Hegemony commander just kept a promise.",
        "solemn",
      ),
    ],
  },
  conf_3_5: {
    day: 200,
    location: "Halden high orbit, flare front",
    crossover: "X15",
    tagline: "Kronos's flagship. The last chain. Break it.",
    briefing:
      "Halden high orbit. Admiral Kronos has refused the ceasefire and brought HNS Unbending out alone, venting its reactor behind him. Kronos falls. Halden is free.",
    objectiveText: {
      flagship: "Destroy HNS Unbending, Admiral Kronos's flagship",
      escorts: "Destroy Kronos's escorts",
    },
    textSwaps: [["The Hegemony falls", "Kronos falls. Halden is free"]],
    victoryFlags: { x15_breach_witnessed_confederation: true },
    script: [
      atTime(
        8,
        say(
          KRONOS,
          "Rim Command does not recognise a ceasefire. All batteries, fire.",
          "grim",
        ),
      ),
    ],
    replaceDebrief: [
      debriefLine(
        SANTOS,
        "Unbending is breaking up. Kronos with her. Halden is free.",
        "proud",
      ),
      debriefLine(
        COMMAND,
        "Brannoc Gate just died. Every gate on the Spine is going dark behind it, one after another.",
        "urgent",
      ),
      debriefLine(
        VASQUEZ,
        "Listen. Three notes, falling. That's the sound from Prometheus. It's here.",
        "solemn",
      ),
      debriefLine(
        PHOENIX,
        "Then the war was never the war.",
        "solemn",
      ),
      debriefLine(
        SANTOS,
        "Hold your lanes, all cells. We are not done.",
        "solemn",
      ),
    ],
  },
};
