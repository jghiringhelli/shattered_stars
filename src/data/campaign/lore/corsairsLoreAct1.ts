/**
 * Corsair lore, Act I — New Blood (Days 1–40): slots 1–5
 * (docs/lore/campaigns/corsairs.md).
 */

import {
  atTime,
  banner,
  bonus,
  hold,
  kill,
  onObjective,
  onStart,
  salvage,
  say,
  setFlag,
  within,
} from "../designKit";
import { ADMIRAL, BLOODFANG, KIRA } from "../designs/corsairsAct1";
import type { MissionLore } from "../loreTypes";
import { debriefLine, DREAMER, HERALD } from "./corsairsLoreShared";

/** The Cinder Gate shard run: one shard, the Convergence, a drop point. */
const ECHO_RUN_OBJECTIVES = [
  salvage(
    "shard",
    "Haul the singing shard to the drop point (boost/roll drops it)",
    {
      crates: [[600, -900]],
      dropZone: [-700, -500],
      required: 1,
    },
  ),
  kill("kill", "Destroy the Convergence: cherubs, drones and the hunter", 6),
  bonus(
    hold(
      "beacon",
      "Hold the drop point for 20 seconds (medium hulls count double)",
      { at: [-700, -500], radius: 240, seconds: 20 },
    ),
    1,
    50,
  ),
  bonus(
    within(kill("fast", "Clear the Convergence within 90 seconds", 6), 90),
    1,
    40,
  ),
];

/** Slots 1–5 of the Corsair campaign. */
export const CORSAIRS_ACT1_LORE: Readonly<Record<string, MissionLore>> = {
  cors_1_1: {
    day: 2,
    location: "Brass Anchorage, the rock run",
    briefing:
      "Day 2 since the Broadcast. Blackmaw's crew wants a deckhand who can fly, so the Admiral sets you a rock run outside Brass Anchorage: six markers through a field of teeth. Corsairs don't brake, they bank. Boost the straights, roll the rocks.",
    script: [
      onObjective(
        "run",
        "completed",
        say(KIRA, "Heard a song in the rocks. Three notes. Down.", "grim"),
        say(
          ADMIRAL,
          "Take us home, Kira. Not a word of that to the crew.",
          "solemn",
        ),
      ),
    ],
  },
  cors_1_2: {
    day: 8,
    location: "Rim trade lane",
  },
  cors_1_3: {
    day: 14,
    location: "Rim lane, picket buoys",
  },
  cors_1_4: {
    title: "Echo Run",
    style: "salvage",
    day: 34,
    location: "Cinder Gate, Reach rim",
    crossover: "X3",
    tagline: "A singing rock. Double pay. Everyone else heard it too.",
    mood: "urgent",
    briefing:
      "The Admiral pays double for a singing rock that fell near Cinder Gate when the Broadcast hit. Everyone else heard it too: Ascendant cherubs and Collective drones are already converging on the shard. Fly the captured Marauder, grab the shard and haul it to the drop point.",
    replaceObjectives: ECHO_RUN_OBJECTIVES,
    replaceEnemies: [
      { shipId: "ascendant_cherub", count: 2, faction: "ascendant_empire" },
      { shipId: "synth_drone", count: 3, faction: "synthetic_collective" },
      { shipId: "synth_hunter", count: 1, faction: "synthetic_collective" },
    ],
    replaceScript: [
      onStart(
        say(
          ADMIRAL,
          "Double pay for a rock that sang the day the sky clicked. Everyone heard it. We get there first.",
        ),
        say(
          BLOODFANG,
          "The Marauder used to be Hegemony. Show it who owns it now.",
        ),
      ),
      atTime(15, say(HERALD, "Who invited the Corsairs?", "urgent")),
      atTime(
        35,
        say(DREAMER, "You hear it too, child.", "solemn"),
        say(KIRA, "Get out of my head.", "urgent"),
      ),
      atTime(
        60,
        say(
          ADMIRAL,
          "Heavier hull, slower turns. Let the guns do your arguing.",
        ),
      ),
      onObjective(
        "shard",
        "completed",
        setFlag("x3_shard_taken", true),
        say(
          ADMIRAL,
          "Shard's aboard. Not a word of what it is, to anyone.",
          "solemn",
        ),
      ),
      onObjective(
        "beacon",
        "completed",
        say(
          ADMIRAL,
          "Drop point's ours. A medium hull holds ground like two.",
          "proud",
        ),
      ),
      onObjective(
        "kill",
        "completed",
        banner("SHIP EVOLVED", "The Marauder answers to Kira"),
      ),
    ],
  },
  cors_1_5: {
    day: 37,
    location: "The Rookery",
    briefing:
      "Day 37. A Hegemony task force is on the Rookery's doorstep, flying our own lane schedule: Fleet Intelligence sold it to them. The families are boarding the evacuation frigate. Hold the lane until her drives spool. The Rookery will not outlive the night.",
    objectiveText: {
      rookery:
        "Hold the evacuation frigate until her drives spool (2½ minutes)",
    },
    textSwaps: [
      ["TERRITORY HELD", "THE ROOKERY BURNS"],
      ["This space belongs to the Corsairs", "Every family got out"],
    ],
    victoryFlags: { cors_rookery_burned: true },
    script: [
      atTime(
        75,
        say(
          ADMIRAL,
          "These aren't patrols. They know our lane schedule. Fleet Intelligence has a name behind it: Vance.",
          "grim",
        ),
      ),
    ],
    replaceDebrief: [
      debriefLine(
        ADMIRAL,
        "Frigate's clear and every family is aboard. The Rookery is ash behind us.",
        "solemn",
      ),
      debriefLine(
        KIRA,
        "They hit us on our own lane schedule. Someone sold us.",
        "grim",
      ),
      debriefLine(
        ADMIRAL,
        "A Fleet Intelligence officer named Vance signs for Hegemony dirty work. Remember the name.",
        "grim",
      ),
      debriefLine(BLOODFANG, "I'll remember it with a knife.", "urgent"),
    ],
  },
};
