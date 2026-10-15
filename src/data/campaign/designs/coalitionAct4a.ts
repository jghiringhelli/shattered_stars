/**
 * Coalition designs, Act IV part 1 (Days 201-232): the Brannoc truce
 * (defend) and the Vega Prime exodus (escort). Lore: docs/lore/campaign_arc.md.
 * Story consequences: coal_4_1 sets `coal_truce_held`; coal_4_2 sets
 * `coal_exodus_complete` and, with no liner lost, `coal_exodus_all_saved`.
 */

import type { MissionDesign } from "../campaignTypes";
import {
  atTime,
  banner,
  bonus,
  defend,
  escort,
  flareWall,
  hazardOn,
  ionStorm,
  kill,
  onObjective,
  onStart,
  protect,
  say,
  setFlag,
  wave,
} from "../designKit";
import {
  ADMIRAL,
  ARCHON,
  AT,
  COALITION,
  CHEN,
  DREAMER,
  HERALD,
  KIRA,
  LOYALIST_FACTION,
  PHOENIX,
  SANTOS,
  STRIKER,
  TIDE_FACTION,
  VASQUEZ,
  WHISPER,
  heroSays,
  ironFist,
  kiraRaiders,
  santosCell,
  templarGuard,
} from "./coalitionShared";

export const COALITION_ACT4A_DESIGNS: Readonly<Record<string, MissionDesign>> =
  {
    coal_4_1: {
      style: "defense",
      tagline: "Five delegations, one platform. Nobody fires on it.",
      mood: "grim",
      prerequisites: [],
      allies: [ironFist(2), santosCell(2)],
      objectives: [
        defend("talks", "Hold the truce platform until the envoys sign", {
          at: [0, -150],
          shipId: "terran_bulwark",
          seconds: 180,
        }),
        bonus(
          kill(
            "cells",
            "Burn six tidecells before they reach the envoys",
            6,
            "tide",
          ),
          2,
          80,
        ),
      ],
      victoryFlags: { coal_truce_held: true },
      variants: [
        {
          when: { flag: "synth_gate_virus" },
          briefing:
            "Five powers sit at Fort Brannoc, and the Spine gates failed early on Day 200 because of a virus in the gate code. The Collective's envoy swears it was Prime's, not his. Kronos's remnant wants the talks to fail and the tidecells are already circling: hold the platform until the envoys sign.",
          script: [
            onStart(
              say(
                PHOENIX,
                "The Collective envoy says the gate virus was Prime's own work. Half this platform wants him airlocked. Keep them talking.",
                "grim",
              ),
            ),
          ],
        },
        {
          when: { flag: "x14_ceasefire_called" },
          addAllies: [
            {
              shipId: "terran_guardian",
              count: 1,
              tag: "picket",
              name: "Brannoc Pickets",
            },
          ],
          script: [
            onStart(
              say(
                COALITION,
                "The pickets that held the ceasefire at Brannoc Gate are on station. They know this sky.",
                "proud",
              ),
            ),
          ],
        },
      ],
      script: [
        onStart(
          say(
            COALITION,
            "Envoys inside. Kronos's remnant wants this to fail and the Tide wants the envoys. Hold until they sign.",
          ),
        ),
        heroSays(
          "terran_hegemony",
          AT(8),
          CHEN,
          "Those are my old hulls out there, and they answer to Kronos, not to me. Don't spare them.",
          "grim",
        ),
        heroSays(
          "free_confederation",
          AT(14),
          SANTOS,
          "Cells, hold fire on anything that isn't Kronos's. The Fist flies with us today.",
        ),
        atTime(
          35,
          wave("tidecell", 3, TIDE_FACTION, { at: "ahead", tag: "tide" }),
          say(
            WHISPER,
            "Tidecells. They hunt loud minds, and that platform is full of psions.",
            "urgent",
          ),
        ),
        atTime(
          80,
          wave("terran_vindicator", 2, LOYALIST_FACTION, { at: "flank" }),
          say(
            STRIKER,
            "Kronos's gunships, low on the left. Mark them.",
            "urgent",
          ),
        ),
        atTime(
          125,
          banner("THE LAST HOUR", "The envoys are still talking"),
          wave("tidecell", 3, TIDE_FACTION, { at: "behind", tag: "tide" }),
          wave("hulk_gnawer", 1, TIDE_FACTION, { at: "behind" }),
          say(
            VASQUEZ,
            "Gnawers feed on wrecks. Don't leave a hull drifting near the platform.",
          ),
        ),
        onObjective(
          "talks",
          "completed",
          say(
            COALITION,
            "Signed. Five powers, one page. Don't ask how long it lasts.",
            "proud",
          ),
        ),
      ],
    },
    coal_4_2: {
      style: "escort",
      tagline:
        "Humans and Vaelith on the same liners. The front is behind them.",
      prerequisites: [1],
      allies: [templarGuard(2), kiraRaiders(2)],
      objectives: [
        escort("exodus", "Escort the colonist liners to the lane mouth", {
          path: [
            [-1300, 700],
            [-400, 100],
            [500, -700],
            [1400, -1500],
          ],
          shipId: "confed_crane",
          count: 3,
          maxLosses: 1,
          speed: 50,
        }),
        kill("hunters", "Destroy the Tide's hunters", 6, "tide"),
        bonus(protect("intact", "Lose no colonist liner", "transport"), 2, 100),
      ],
      victoryFlags: { coal_exodus_complete: true },
      hazards: [
        flareWall("front", {
          axis: "x",
          start: -1900,
          stop: 1900,
          speed: 18,
          dps: 8,
          startsInactive: true,
        }),
        ionStorm("lane_weather", 500, -800, 400, 4),
      ],
      variants: [
        {
          when: { flag: "x12_sanctuary_reached" },
          addAllies: [
            {
              shipId: "confed_kestrel",
              count: 2,
              tag: "sanctuary",
              name: "Sanctuary Pickets",
            },
          ],
          script: [
            onStart(
              say(
                VASQUEZ,
                "The sanctuary at Halden's Reach still stands. Its pickets will meet the liners at the mouth.",
                "proud",
              ),
            ),
          ],
        },
        {
          when: { flag: "cors_crew_rescued" },
          addAllies: [
            {
              shipId: "corsair_blade",
              count: 2,
              tag: "freed",
              name: "Freed Crew",
            },
          ],
          script: [
            onStart(
              say(
                ADMIRAL,
                "The crew we pulled off the hulk asked to fly the screen. Don't argue with them.",
              ),
            ),
          ],
        },
        {
          when: { flag: "asc_heretics_spared" },
          script: [
            onStart(
              say(
                HERALD,
                "The Unbound we spared are aboard the second liner. They sing its engines steady.",
                "solemn",
              ),
            ),
          ],
        },
      ],
      script: [
        onStart(
          say(
            COALITION,
            "Vega Prime is forty minutes from the front. Keep every liner together and keep them moving.",
          ),
        ),
        heroSays(
          "ascendant_empire",
          AT(10),
          DREAMER,
          "They are people, whatever the Prophecy called them. Bring every one of them to the lane.",
          "solemn",
        ),
        heroSays(
          "void_corsairs",
          AT(18),
          KIRA,
          "The colony charter is mine if the colony is empty. Don't make me regret waiting.",
        ),
        atTime(
          25,
          wave("tidecell", 3, TIDE_FACTION, { at: "ahead", tag: "tide" }),
          say(
            WHISPER,
            "Tidecells off the lane mouth. They heard the liners.",
            "urgent",
          ),
        ),
        atTime(
          70,
          hazardOn("front"),
          banner(
            "THE FRONT",
            "The Tide's edge reaches Vega Prime, so stay ahead of it",
          ),
        ),
        atTime(
          95,
          wave("hulk_gnawer", 2, TIDE_FACTION, { at: "behind", tag: "tide" }),
        ),
        atTime(
          140,
          wave("tidecell", 4, TIDE_FACTION, { at: "flank", tag: "tide" }),
          say(
            STRIKER,
            "Fresh cells on the flank. They want the liners.",
            "urgent",
          ),
        ),
        onObjective(
          "intact",
          "completed",
          setFlag("coal_exodus_all_saved", true),
          say(HERALD, "Every liner. Every one of them.", "proud"),
        ),
        onObjective(
          "intact",
          "failed",
          say(ARCHON, "We lost a liner. Remember its name.", "solemn"),
        ),
      ],
    },
  };
