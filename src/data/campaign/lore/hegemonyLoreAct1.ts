/**
 * Hegemony lore, Act I — Quarantine (Days 1–40): slots 1–5
 * (docs/lore/campaigns/hegemony.md).
 */

import {
  atTime,
  banner,
  bonus,
  music,
  onObjective,
  salvage,
  say,
  setFlag,
} from "../designKit";
import {
  COMMAND,
  HEGEMONY_ACT1_DESIGNS,
  STRIKER,
  WHISPER,
} from "../designs/hegemonyAct1";
import type { MissionLore } from "../loreTypes";
import {
  CDR_CHEN,
  CHEN_RANK_SWAP,
  withoutObjective,
} from "./hegemonyLoreShared";

const RELAY_BLACK_BOX = bonus(
  salvage("relay", "Recover the relay's black box", {
    crates: [[-900, -300]],
    dropZone: [0, 350],
    required: 1,
  }),
  2,
  60,
);

/** Slots 1–5 of the Hegemony campaign. */
export const HEGEMONY_ACT1_LORE: Readonly<Record<string, MissionLore>> = {
  heg_1_1: {
    title: "Tycho Trial",
    day: 1,
    location: "Tycho Academy range, Luna",
    tagline: "Final trial. Clean gates. The cadets are watching.",
    mood: "neutral",
    briefing:
      "Final trial course over Tycho, Luna. Commander Chen, recalled to instruct, flies it beside his cadet class: Cadet Reyes (callsign Striker) on the wing, Fleet Intelligence's Cdr. Vasile grading from the observer ship. Fly it clean. The dial forgives nothing.",
    objectiveText: {
      course: "Fly the Tycho trial gate course",
      fast: "Beat the course record: clear it in 75 seconds",
    },
    textSwaps: [["Report to Delta Station", "All instructors to Station Omega"]],
    script: [
      atTime(
        35,
        music("broadcast"),
        banner("NEXUS BROADCAST", "Every channel clicks. The gate beacons go dark."),
        say(WHISPER, "That wasn't us.", "grim"),
      ),
      atTime(40, say(CDR_CHEN, "Beacons are back. Finish the course, cadets.")),
    ],
    replaceDebrief: [
      {
        speaker: COMMAND.name,
        portraitKey: COMMAND.portraitKey,
        text: "Recall order from Fleet. All instructors report to Station Omega. Trial results suspended.",
        mood: "urgent",
      },
      {
        speaker: WHISPER.name,
        portraitKey: WHISPER.portraitKey,
        text: "That tone ran on every channel: relays, civilian, military. Nobody in Fleet Intelligence is claiming it.",
        mood: "grim",
      },
      {
        speaker: STRIKER.name,
        portraitKey: STRIKER.portraitKey,
        text: "Every gate beacon on the range went dark mid-run. I have never had a course do that.",
        mood: "neutral",
      },
      {
        speaker: CDR_CHEN.name,
        portraitKey: CDR_CHEN.portraitKey,
        text: "Reyes, you're with me. Omega is a day's jump. Pack light.",
        mood: "solemn",
      },
      {
        speaker: WHISPER.name,
        portraitKey: WHISPER.portraitKey,
        text: "I'll file my observer's report on the way. Twice.",
        mood: "neutral",
      },
    ],
  },
  heg_1_2: {
    day: 6,
    location: "Omega approach",
    tagline: "One raider. Live rounds. Don't hesitate.",
    mood: "urgent",
    briefing:
      "Day 6 of the quarantine. A lone Corsair raider sits on Omega's approach lane, engines cold, as if it knew we would come by. First live fire for the new wing. Down it.",
    objectiveText: { kill: "Destroy the Corsair raider" },
    textSwaps: [CHEN_RANK_SWAP],
  },
  heg_1_3: {
    day: 10,
    location: "Omega cordon",
    tagline: "Two ships. One will. Hold formation.",
    mood: "proud",
    briefing:
      "Corsair blades are probing the quarantine cordon in packs. You fly with a wingman: press R to mark a target and your wing fires on what you mark. The Line holds when the wing does.",
    objectiveText: {
      kill: "Destroy the Corsair blades",
      survive: "Keep your wingman alive",
    },
    textSwaps: [CHEN_RANK_SWAP, ["The pirates adjusted", "The Corsairs adjusted"]],
  },
  heg_1_3b: {
    day: 10,
    location: "Omega cordon",
    tagline: "Dark running. No transponder. No witnesses.",
    briefing:
      "Fleet Intelligence wants the Corsairs' coordination pattern logged before they go dark. Fly alone, transponder off, past two sensor buoys, and silence the scouts that hold the pattern.",
    objectiveText: { kill: "Eliminate the Corsair scouts" },
    victoryFlags: { heg_path_covert: true },
    textSwaps: [CHEN_RANK_SWAP],
  },
  heg_1_4: {
    day: 19,
    location: "Kessa Lane, Rim",
    crossover: "X1",
    tagline: "A Confederation ace. Ground her before she runs.",
    mood: "urgent",
    briefing:
      "A Confederation cell burned a Registry convoy on Kessa Lane. Its leader is a known ace in a Hawk: Phoenix One. Ground her before she reaches the lane. Win, and Command gives Chen Iron Fist.",
    objectiveText: {
      ace: "Shoot down Phoenix One before she escapes",
      patrol: "Destroy the cell's wing",
    },
    textSwaps: [
      CHEN_RANK_SWAP,
      [
        "Patrol leader is a known ace. He runs when hurt. Don't let him reach the jump lane.",
        "The cell leader is a known ace, Phoenix One. She runs when hurt. Don't let her reach the jump lane.",
      ],
      ["He jumped. Damn it.", "She jumped. Damn it."],
    ],
    script: [
      atTime(20, say(STRIKER, "That's no militia flying.", "urgent")),
      onObjective("ace", "completed", setFlag("x1_phoenix_wounded", true)),
    ],
    variants: [
      {
        when: { flag: "x1_census_burned" },
        briefing:
          "A Confederation cell burned a Registry convoy on Kessa Lane, and the census cores aboard are ash. Its leader is Phoenix One, a known ace in a Hawk. Ground her before she reaches the lane. Win, and Command gives Chen Iron Fist.",
      },
    ],
    replaceDebrief: [
      {
        speaker: COMMAND.name,
        portraitKey: COMMAND.portraitKey,
        text: "Congratulations, Commander Chen. The cell leader is down. Iron Fist is yours, with the Mark IV Centurion, effective immediately.",
        mood: "proud",
      },
      {
        speaker: CDR_CHEN.name,
        portraitKey: CDR_CHEN.portraitKey,
        text: "Understood, Admiral. The team has earned it.",
        mood: "proud",
      },
      {
        speaker: STRIKER.name,
        portraitKey: STRIKER.portraitKey,
        text: "Phoenix One. Did you see how she flew? That wasn't standard doctrine.",
        mood: "neutral",
      },
      {
        speaker: WHISPER.name,
        portraitKey: WHISPER.portraitKey,
        text: "Fleet records: four combat tours, decorated three times. Her Hawk is dead in the lane, but her wing towed her out before we could close.",
        mood: "neutral",
      },
      {
        speaker: CDR_CHEN.name,
        portraitKey: CDR_CHEN.portraitKey,
        text: "She was studying how we fight. She could have ended this differently.",
        mood: "solemn",
      },
      {
        speaker: STRIKER.name,
        portraitKey: STRIKER.portraitKey,
        text: "Great. An ace with a grudge. Not terrifying at all.",
        mood: "neutral",
      },
      {
        speaker: CDR_CHEN.name,
        portraitKey: CDR_CHEN.portraitKey,
        text: "Stay sharp. She'll be back.",
        mood: "solemn",
      },
    ],
  },
  heg_1_5: {
    day: 38,
    location: "Tessaly Junction, asteroid field",
    crossover: "X2",
    tagline: "The border runs through a rock field. So do we.",
    mood: "grim",
    briefing:
      "Confederation and Collective contacts have converged on Tessaly Junction, where the 2362 massacre happened. The Collective strikes both sides at once. Break the contacts, and hold the border relay if you can.",
    objectiveText: { kill: "Destroy the contacts" },
    textSwaps: [
      CHEN_RANK_SWAP,
      ["The Senate takes notice.", "The Directorate takes notice."],
      [
        "The Confederation and Corsairs were coordinating their timing.",
        "The Collective hit both sides at once, and timed it to our exchange of fire.",
      ],
    ],
    variants: [
      {
        when: { flag: "x2_junction_collective" },
        briefing:
          "The Collective already took Tessaly Junction and held it against both borders. Break what is left of the contacts and recover the relay's black box from the wreckage.",
        objectives: [
          ...withoutObjective(HEGEMONY_ACT1_DESIGNS.heg_1_5?.objectives, "relay"),
          RELAY_BLACK_BOX,
        ],
        script: [
          onObjective(
            "relay",
            "completed",
            say(
              CDR_CHEN,
              "Black box recovered. Whatever hit this junction hit it clean.",
              "grim",
            ),
          ),
        ],
      },
    ],
  },
};
