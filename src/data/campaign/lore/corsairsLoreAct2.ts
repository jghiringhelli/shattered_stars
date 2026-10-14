/**
 * Corsair lore, Act II — Blood and Gold (Days 41–120): slots 6–10
 * (docs/lore/campaigns/corsairs.md).
 */

import {
  atTime,
  beat,
  bonus,
  kill,
  onObjective,
  onStart,
  reinforce,
  say,
  setFlag,
  wave,
  within,
} from "../designKit";
import { ADMIRAL, BLOODFANG, COMMAND, KIRA } from "../designs/corsairsAct1";
import { CORSAIR_ACT23_DESIGNS } from "../designs/corsairsAct23";
import type { MissionLore } from "../loreTypes";
import {
  BLACKMAW,
  CAPT_KIRA,
  CAPTAIN_LABEL_SWAP,
  debriefLine,
} from "./corsairsLoreShared";

const HEGEMONY = "terran_hegemony";
/** Seconds the Corsairs have to gut Omega's convoy for the clean-sweep bonus. */
const CONVOY_SWEEP_SECONDS = 150;

/** "No hauler escapes" (the canon where nobody has delivered the convoy yet). */
const ALL_HAULERS = bonus(
  within(
    kill("gutted", "No hauler escapes: gut all three freighters", 3, "hauler"),
    CONVOY_SWEEP_SECONDS,
  ),
  2,
  100,
);
/** Variant bonus once Omega's convoy is intact: only a straggler is left. */
const STRAGGLER = bonus(
  within(
    kill("gutted", "Gut the straggler and its escort", 2, "hauler"),
    CONVOY_SWEEP_SECONDS,
  ),
  2,
  100,
);
const CONVOY_OBJECTIVES = CORSAIR_ACT23_DESIGNS.cors_2_4?.objectives ?? [];

/** Slots 6–10 of the Corsair campaign. */
export const CORSAIRS_ACT2_LORE: Readonly<Record<string, MissionLore>> = {
  cors_2_1: {
    day: 45,
    location: "The liner Aurelia, Rim lane",
    briefing:
      "Day 45. The liner Aurelia carries Hegemony nobles, among them Consul Vera's nephew. Cripple her before she spools her drive, scoop the strongboxes and the ransom buys a new Rookery. The Admiral calls this run optional. The crews call it rent.",
    script: [
      atTime(
        55,
        say(
          ADMIRAL,
          "Consul Vera's nephew is in first class. Alive, he's worth more than the jewels.",
        ),
      ),
    ],
  },
  cors_2_2: {
    day: 56,
    location: "Rustjaw's den",
    briefing:
      "Day 56. Rustjaw has mined his own doorstep, and his crew flies guns no Corsair yard ever built. Bloodfang's Wolves ride with you. Take his crew apart and burn his fuel depot.",
    script: [
      atTime(
        65,
        say(
          ADMIRAL,
          "Look at those guns. Fleet issue, serial plates ground off. Vance pays rivals to keep the clans split.",
          "grim",
        ),
      ),
    ],
  },
  cors_2_3: {
    day: 63,
    location: "The Gallows Hulk",
    crossover: "X5",
    briefing:
      "Day 63. Blackmaw's people are in the cells of the Gallows Hulk, a Hegemony prison ship. Cut the shuttles loose, cover them to the rendezvous and lose none: a crew you save remembers it.",
    script: [
      beat(
        { on: "time", atSeconds: 20 },
        [
          say(
            BLOODFANG,
            "Hulk's lit up on the far side too. Somebody else is working the cells.",
          ),
        ],
        { if: [{ flag: "conf_prisoners_freed", is: false }] },
      ),
    ],
    variants: [
      {
        when: { flag: "conf_prisoners_freed" },
        briefing:
          "Day 63. Blackmaw's people are in the cells of the Gallows Hulk, and the Confederation has already emptied the other side. Cut our shuttles loose, cover them to the rendezvous and lose none: tonight two breakouts share one sky.",
        script: [
          atTime(
            20,
            say(
              BLOODFANG,
              "Confederation pods launching off the other side. Cell pilots with our idea, same night.",
              "proud",
            ),
          ),
        ],
      },
    ],
    debriefAppend: [
      debriefLine(
        BLACKMAW,
        "I counted the shuttles, Kira. You brought our own home.",
        "proud",
      ),
      debriefLine(
        BLACKMAW,
        "The Second Chance is yours, with her crew. Captain Kira. Wear it.",
        "proud",
      ),
      debriefLine(CAPT_KIRA, "Captain. I'll earn it.", "solemn"),
      debriefLine(ADMIRAL, "Don't earn the word. Earn the weight.", "solemn"),
    ],
  },
  cors_2_4: {
    day: 52,
    location: "Omega supply lane, the ion cloud",
    crossover: "X4",
    textSwaps: [CAPTAIN_LABEL_SWAP],
    briefing:
      "Day 52. Someone paid the clans to hit Omega's winter convoy: good coin, no name. The Admiral's orders are plain. Take the money, then find out who. Sit dark in the ion cloud, let the convoy come to you and gut it.",
    replaceObjectives: [...CONVOY_OBJECTIVES, ALL_HAULERS],
    variants: [
      {
        when: { flag: "heg_convoy_intact" },
        briefing:
          "Day 52. Omega's convoy got through whole, all but a straggler limping behind in the ion cloud with one escort. The coin is still good: gut the straggler and its escort, then find out who paid.",
        objectives: [...CONVOY_OBJECTIVES, STRAGGLER],
        script: [
          onStart(
            wave("terran_sentinel", 1, HEGEMONY, {
              at: "ahead",
              tag: "hauler",
            }),
            wave("terran_raptor", 1, HEGEMONY, { at: "ahead", tag: "hauler" }),
          ),
          onObjective(
            "gutted",
            "completed",
            say(
              KIRA,
              "Straggler's cold. Whoever paid us will want a refund.",
              "proud",
            ),
          ),
        ],
      },
    ],
    script: [
      atTime(6, say(ADMIRAL, "Take the money. Then find out who.", "grim")),
      beat(
        { on: "start" },
        [wave("terran_sentinel", 3, HEGEMONY, { at: "ahead", tag: "hauler" })],
        { if: [{ flag: "heg_convoy_intact", is: false }] },
      ),
      beat(
        { on: "objective", objectiveId: "gutted", status: "completed" },
        [
          setFlag("x4_convoy_gutted", true),
          say(
            KIRA,
            "Not a hull limped away. Omega will count the empty slots for weeks.",
            "proud",
          ),
        ],
        { if: [{ flag: "heg_convoy_intact", is: false }] },
      ),
    ],
  },
  cors_2_5: {
    day: 112,
    location: "Varn's Crossing",
    crossover: "X9",
    textSwaps: [CAPTAIN_LABEL_SWAP],
    briefing:
      "Day 112. Commodore Hale, Admiral Kronos's escort commander, gutted Blackmaw's old crew, and he runs the moment he bleeds. He is flying through Varn's Crossing behind a Raptor screen and a gunship. Cut him down before he reaches the jump lane.",
    objectiveText: {
      commander: "Kill Commodore Hale before he runs",
    },
    variants: [
      {
        when: { flag: "x9_hale_down" },
        briefing:
          "Day 112. The Collective got to Commodore Hale before we did: his flagship is a wreck at Varn's Crossing. His wing still flies under his name, and Blackmaw's grudge doesn't end with one hull. Break what is left of his command.",
        objectives: [
          kill(
            "commander",
            "Break Hale's command: destroy his wing and gunship",
            4,
          ),
          ...(CORSAIR_ACT23_DESIGNS.cors_2_5?.objectives ?? []).filter(
            (o) => o.id !== "commander",
          ),
        ],
      },
      {
        when: { flag: "x9_hale_escaped" },
        briefing:
          "Day 112. The Collective mauled Commodore Hale and he ran, trailing coolant toward the Crossing. Blackmaw's grudge is still open. Run him down before he reaches the jump lane.",
      },
    ],
    script: [
      atTime(
        30,
        reinforce("synth_drone", 3, "collective_drones", "flank"),
        say(
          KIRA,
          "Drones on Hale's flank. Collective transponders. They want him too.",
          "urgent",
        ),
        say(BLOODFANG, "Machines want him too? Then race them.", "urgent"),
      ),
      beat(
        { on: "objective", objectiveId: "commander", status: "completed" },
        [
          setFlag("x9_hale_down", true),
          say(COMMAND, "Escort Lead is down! Break off! Break off!", "urgent"),
        ],
        {
          if: [
            { flag: "x9_hale_down", is: false },
            { flag: "x9_hale_escaped", is: false },
          ],
        },
      ),
    ],
    replaceDebrief: [
      debriefLine(
        ADMIRAL,
        "Blackmaw's grudge is paid. Mine is older. Sit down, Kira.",
        "solemn",
      ),
      debriefLine(KIRA, "Admiral? The mask.", "neutral"),
      debriefLine(
        ADMIRAL,
        "A veil-cowl, child. Without it you would see what I am. Vaelith. Unbound.",
        "solemn",
      ),
      debriefLine(KIRA, "Vaelith. How long?", "grim"),
      debriefLine(
        ADMIRAL,
        "Three hundred years hiding among humans, waiting for the lock to fail. It has.",
        "grim",
      ),
      debriefLine(
        ADMIRAL,
        "The song you hear isn't a dream. It's my people's. Don't run from it.",
        "solemn",
      ),
    ],
  },
};
