/**
 * Coalition design, Act V finale (Day 300): The Answer. Break the Warden's
 * guard and its avatar; the mission ends on the avatar's last phase and a
 * stinger line. The Sever / Seal / Answer choice is made on the completion
 * screen, not here. Each faction key held in the Chronicle lends its voice.
 */

import type { MissionDesign, MissionVariant } from "../campaignTypes";
import {
  atTime,
  banner,
  bonus,
  hazardOn,
  hit,
  hold,
  ionStorm,
  kill,
  music,
  onObjective,
  onStart,
  say,
  wave,
} from "../designKit";
import {
  ADMIRAL,
  AT,
  CHEN,
  COALITION,
  DREAMER,
  KIRA,
  LOYALIST_FACTION,
  OMEGA,
  SANTOS,
  TIDE_FACTION,
  WHISPER,
  heroSays,
  ironFist,
  kiraRaiders,
  omegaCluster,
  santosCell,
  templarGuard,
} from "./coalitionShared";

/** Seconds into the battle the Hush falls over the field. */
const HUSH_SECONDS = 100;

/** The five keys of the true ending: each one lends its faction's voice. */
const KEY_VARIANTS: readonly MissionVariant[] = [
  {
    when: { flag: "key_heg_witness" },
    script: [
      heroSays(
        "terran_hegemony",
        AT(15),
        CHEN,
        "The Hegemony's witnesses are on the line, and their testimony stands behind the codes. The gates will answer.",
        "proud",
      ),
    ],
  },
  {
    when: { flag: "key_conf_pact" },
    script: [
      heroSays(
        "free_confederation",
        AT(20),
        SANTOS,
        "Libre and the Moot at one table. The pact holds, and so do we.",
        "proud",
      ),
    ],
  },
  {
    when: { flag: "key_synth_dissent" },
    script: [
      heroSays(
        "synthetic_collective",
        AT(25),
        OMEGA,
        "I speak for the lattice in Prime's absence. It chose to be heard.",
        "solemn",
      ),
    ],
  },
  {
    when: { flag: "key_cors_loyalty" },
    script: [
      heroSays(
        "void_corsairs",
        AT(30),
        KIRA,
        "Crews that stayed when the gold ran out. That is the shard's price, and we paid it.",
        "proud",
      ),
    ],
  },
  {
    when: { flag: "key_asc_mercy" },
    script: [
      heroSays(
        "ascendant_empire",
        AT(35),
        DREAMER,
        "The mercy we spared is part of the voice. I can hear it from here.",
        "solemn",
      ),
    ],
  },
];

export const COALITION_ACT5B_DESIGNS: Readonly<Record<string, MissionDesign>> =
  {
    coal_5_3: {
      style: "boss",
      tagline: "The Warden's avatar. Break its guard, then be heard.",
      mood: "solemn",
      prerequisites: [7],
      allies: [
        ironFist(2),
        santosCell(2),
        omegaCluster(2),
        kiraRaiders(2),
        templarGuard(2),
      ],
      objectives: [
        kill("guard", "Destroy the avatar's guard", 8, "guard"),
        hit("avatar", "Break the Warden's avatar", {
          shipId: "warden_avatar",
          at: [0, -1100],
          boss: true,
        }),
        bonus(
          hold("chorus", "Hold the chorus point for 30 seconds", {
            at: [0, -300],
            radius: 300,
            seconds: 30,
          }),
          3,
          200,
        ),
      ],
      hazards: [ionStorm("hush", 0, -1100, 600, 6, true)],
      variants: [
        ...KEY_VARIANTS,
        {
          when: { flag: "cors_gate_codes" },
          script: [
            atTime(
              45,
              say(
                ADMIRAL,
                "The codes are loaded and the Spine gates are listening. Whatever you choose, it will carry.",
              ),
            ),
          ],
        },
      ],
      script: [
        onStart(
          say(
            COALITION,
            "That is the Warden's avatar. Break its guard, then break its silence. The choice is made after, not here.",
            "solemn",
          ),
          wave("tidecell", 4, TIDE_FACTION, { at: "ahead", tag: "guard" }),
          wave("pruning_herald", 1, TIDE_FACTION, { at: "ahead", tag: "guard" }),
        ),
        atTime(
          60,
          wave("hulk_gnawer", 2, TIDE_FACTION, { at: "flank", tag: "guard" }),
          say(WHISPER, "More from its flanks. It is calling them.", "urgent"),
        ),
        atTime(
          HUSH_SECONDS,
          hazardOn("hush"),
          banner("THE HUSH", "The Warden tries to quiet the battlefield"),
        ),
        atTime(
          110,
          wave("tidecell", 4, TIDE_FACTION, { at: "behind", tag: "guard" }),
          wave("terran_vindicator", 2, LOYALIST_FACTION, { at: "flank" }),
        ),
        onObjective(
          "avatar",
          "completed",
          music("victory"),
          banner("THE WARDEN FALTERS", "It is listening now"),
          say(
            DREAMER,
            "It is listening. Whatever we choose now, we choose loudly.",
            "solemn",
          ),
        ),
      ],
    },
  };
