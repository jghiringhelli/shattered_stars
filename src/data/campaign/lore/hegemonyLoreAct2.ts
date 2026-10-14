/**
 * Hegemony lore, Act II — The Cordon (Days 41–120): slots 6–10
 * (docs/lore/campaigns/hegemony.md).
 */

import {
  atTime,
  banner,
  beat,
  bonus,
  hit,
  music,
  onObjective,
  onStart,
  salvage,
  say,
  setFlag,
} from "../designKit";
import { CHEN, STRIKER, WHISPER } from "../designs/hegemonyAct1";
import { HEGEMONY_ACT23_DESIGNS } from "../designs/hegemonyAct23";
import type { MissionLore } from "../loreTypes";
import {
  CDR_CHEN,
  CHEN_RANK_SWAP,
  PHOENIX,
  withoutObjective,
} from "./hegemonyLoreShared";

const CONVOY_BLACK_BOX = bonus(
  salvage("intact", "Recover the gutted straggler's black box", {
    crates: [[700, -900]],
    dropZone: [0, 400],
    required: 1,
  }),
  2,
  80,
);

/** Seconds before the Collective's harvesters edge into Omega's defense. */
const HARVESTER_ARRIVAL_MS = 45_000;

/** Slots 6–10 of the Hegemony campaign. */
export const HEGEMONY_ACT2_LORE: Readonly<Record<string, MissionLore>> = {
  heg_2_1: {
    day: 52,
    location: "Omega supply lane",
    crossover: "X4",
    tagline: "Three freighters. One lane. Corsairs in the dark.",
    mood: "urgent",
    briefing:
      "Convoy Alpha: three freighters of Omega's winter stock on the supply lane, through Corsair-held dark. The raiders have been right about our timing on every run. Deliver the freighters and lose no more than one.",
    objectiveText: {
      escort: "Escort Convoy Alpha to the jump point",
      kill: "Destroy the Corsair raiders",
    },
    textSwaps: [
      CHEN_RANK_SWAP,
      [
        "We report directly to the Admiral. No comm channels. In person only.",
        "Nothing goes over the relay. This stays inside Iron Fist until we know who.",
      ],
    ],
    script: [
      beat(
        { on: "time", atSeconds: 12 },
        [
          say(
            WHISPER,
            "Your nav logs from the cordon. The pattern matches. Whoever fed the Corsairs then is feeding them now.",
            "grim",
          ),
        ],
        { if: [{ flag: "heg_path_covert" }] },
      ),
    ],
    variants: [
      {
        when: { flag: "x4_convoy_gutted" },
        briefing:
          "Convoy Alpha: three freighters through Corsair-held dark. A straggler is already gutted in the ion cloud, and the raiders are still out there. Bring the rest through and recover the wreck's black box.",
        objectives: [
          ...withoutObjective(HEGEMONY_ACT23_DESIGNS.heg_2_1?.objectives, "intact"),
          CONVOY_BLACK_BOX,
        ],
        script: [
          onObjective(
            "intact",
            "completed",
            say(
              CDR_CHEN,
              "Black box recovered. Corsair work, Hegemony keys.",
              "grim",
            ),
          ),
        ],
      },
    ],
  },
  heg_2_2: {
    day: 60,
    location: "Picket Lyra outpost",
    tagline: "The outpost holds or the sector falls.",
    mood: "urgent",
    briefing:
      "A Collective drone swarm has found Picket Lyra, a sensor outpost on the cordon's edge. Lance Squadron flies with you: keep them breathing, and keep the outpost standing.",
    textSwaps: [CHEN_RANK_SWAP, ["Outpost Gamma", "Picket Lyra"]],
  },
  heg_2_3: {
    day: 74,
    location: "Deep Rim",
    crossover: "X6",
    tagline: "Commander Phoenix. End the legend.",
    mood: "grim",
    briefing:
      "Orders out of Fleet Intelligence put Phoenix in a staging area deep in the Rim. Down her Hawk before she runs. She bleeds, she flees, so cut the north-east lane.",
    objectiveText: {
      phoenix: "Down Commander Phoenix's Hawk before she escapes",
      escorts: "Destroy her wing within 90 seconds",
    },
    textSwaps: [
      CHEN_RANK_SWAP,
      [
        "Phoenix is down. We... we got her.",
        "Phoenix's Hawk is dead in the lane. A Confederation tug jumped in and dragged her out.",
      ],
    ],
    script: [
      onObjective(
        "phoenix",
        "completed",
        setFlag("x1_phoenix_wounded", true),
        say(WHISPER, "Hawk's dead, hull cracked. She'll live. She'll be back.", "grim"),
      ),
    ],
  },
  heg_2_3b: {
    title: "The Witness",
    day: 80,
    location: "A dead relay, deep Rim",
    crossover: "X6",
    tagline: "The enemy ace wants out. So do we.",
    mood: "urgent",
    briefing:
      "Phoenix asked for a truce at a dead relay deep in the Rim. She carries her own flight logs, and Vance's loyalists have orders to silence her. Escort her Hawk to the safe jump. It could be a trap. It could be the break we need.",
    objectiveText: {
      phoenix: "Escort Phoenix's Hawk to the safe jump",
      kill: "Destroy Vance's loyalists",
    },
    textSwaps: [CHEN_RANK_SWAP],
    script: [
      beat(
        { on: "start" },
        [
          say(
            PHOENIX,
            "These are my flight logs. Every sortie Vance's office sent me on. Read them.",
            "solemn",
          ),
        ],
        { if: [{ flag: "x6_vance_orders", is: false }] },
      ),
    ],
    variants: [
      {
        when: { flag: "x6_vance_orders" },
        briefing:
          "Phoenix asked for a truce at a dead relay deep in the Rim. She carries the orders your own relay leaked to her side, with Vance's name on every line, and his loyalists have orders to silence her. Escort her Hawk to the safe jump.",
        script: [
          onStart(
            say(
              PHOENIX,
              "Your own relay leaked these orders to my cell. Now I'm handing them back. Don't let him bury them.",
              "solemn",
            ),
          ),
        ],
      },
    ],
  },
  heg_2_4: {
    day: 90,
    location: "Station Omega",
    crossover: "X7",
    tagline: "Station Omega. Three waves. No retreat.",
    mood: "grim",
    briefing:
      "Vance ordered Prometheus scuttled at 0400, and the flash is still fading. Omega holds the cordon while everyone comes for the wreck: raiders, Phantoms and, at the edge of the field, Collective harvesters and an Ascendant Herald. Hold the station.",
    objectiveText: { defend: "Hold Station Omega for 3 minutes" },
    textSwaps: [
      CHEN_RANK_SWAP,
      [
        "Someone knew exactly when we'd be short-crewed.",
        "Someone knew exactly when we'd be short-crewed. And Vance signed the Prometheus scuttle order himself.",
      ],
    ],
    addEnemies: [
      {
        shipId: "synth_drone",
        count: 2,
        faction: "synthetic_collective",
        spawnDelay: HARVESTER_ARRIVAL_MS,
      },
    ],
    addObjectives: [
      bonus(
        hit("herald", "Down the Ascendant Herald before it slips away", {
          shipId: "ascendant_herald",
          at: [900, -1100],
          flee: [[1800, -2000]],
          fleeAfter: 70,
        }),
        1,
        60,
      ),
    ],
    script: [
      onStart(
        music("tension"),
        banner("PROMETHEUS LOST", "A flash on the horizon. Omega holds the cordon."),
      ),
      atTime(
        20,
        say(WHISPER, "Harvesters and a Herald at the edge of the wreck field. They want Prometheus, not us.", "grim"),
      ),
      onObjective(
        "defend",
        "completed",
        setFlag("x7_omega_held", true),
        say(CHEN, "Omega stands. Log it, whatever else burned tonight.", "solemn"),
      ),
      onObjective(
        "herald",
        "failed",
        say(STRIKER, "The Herald's gone, jumped clear with whatever it grabbed.", "neutral"),
      ),
    ],
  },
  heg_2_5: {
    day: 104,
    location: "Kel-9 approach, ion storm",
    crossover: "X8",
    tagline: "The Mothership. Cut the relay, then the heart.",
    mood: "grim",
    briefing:
      "A Collective Mothership has pushed into the Kel-9 approach under cover of an ion storm. Its relay feeds it fresh drones. Cut the relay, then kill the heart, and see what its comm core is listening to.",
    objectiveText: { kill: "Destroy the Collective Mothership" },
    textSwaps: [CHEN_RANK_SWAP],
    variants: [
      {
        when: { flag: "x8_node_preserved" },
        script: [
          onStart(
            say(
              WHISPER,
              "The node behind it survived. The Mothership was its shield, not its jailer.",
              "solemn",
            ),
          ),
        ],
      },
    ],
  },
};
