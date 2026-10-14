/**
 * Coalition design, Act V (Day 268): Resonance (hold three nodes). Victory
 * sets `coal_resonance_online`. The Corsair shard (`x3_shard_taken`) and
 * the gate codes (`cors_gate_codes`) return here.
 */

import type { MissionDesign } from "../campaignTypes";
import {
  atTime,
  banner,
  bonus,
  hidden,
  hold,
  ionStorm,
  kill,
  mineGrid,
  minefield,
  onObjective,
  onStart,
  reveal,
  say,
  wave,
} from "../designKit";
import {
  ADMIRAL,
  AT,
  COALITION,
  DREAMER,
  HERALD,
  LOYALIST_FACTION,
  OMEGA,
  STRIKER,
  TIDE_FACTION,
  WHISPER,
  heroSays,
  ironFist,
  kiraRaiders,
  omegaCluster,
  santosCell,
  templarGuard,
} from "./coalitionShared";

/** Seconds a Resonance node must be held in tune. */
const NODE_HOLD_SECONDS = 25;
/** Radius (px) of a Resonance node's zone. */
const NODE_RADIUS = 260;

export const COALITION_ACT5A_DESIGNS: Readonly<Record<string, MissionDesign>> =
  {
    coal_5_1: {
      style: "assault",
      tagline: "Three nodes, one voice. Every hero power is cleared.",
      mood: "urgent",
      prerequisites: [5],
      allies: [
        ironFist(2),
        santosCell(2),
        omegaCluster(2),
        kiraRaiders(2),
        templarGuard(2),
      ],
      objectives: [
        hold("node_a", "Hold Resonance node Alpha in tune", {
          at: [-900, -600],
          radius: NODE_RADIUS,
          seconds: NODE_HOLD_SECONDS,
        }),
        hidden(
          hold("node_b", "Hold Resonance node Beta in tune", {
            at: [0, -1100],
            radius: NODE_RADIUS,
            seconds: NODE_HOLD_SECONDS,
          }),
        ),
        hidden(
          hold("node_c", "Hold Resonance node Gamma in tune", {
            at: [900, -600],
            radius: NODE_RADIUS,
            seconds: NODE_HOLD_SECONDS,
          }),
        ),
        bonus(kill("lures", "Destroy the Tide's lure cells", 4, "lure"), 2, 100),
      ],
      victoryFlags: { coal_resonance_online: true },
      hazards: [
        ionStorm("beta_storm", 0, -1100, 380, 4),
        minefield("quiet_mines", mineGrid(900, -600, 3, 3, 200), 18),
      ],
      variants: [
        {
          when: { flag: "x3_shard_taken" },
          script: [
            onStart(
              say(
                ADMIRAL,
                "The shard is in the cradle. Kira gave it back instead of selling it, and you can hear what that cost.",
                "proud",
              ),
            ),
          ],
        },
        {
          when: { flag: "cors_gate_codes" },
          script: [
            atTime(
              12,
              say(
                ADMIRAL,
                "The Hegemony codes are loaded. The Spine gates will answer when the Resonance calls.",
              ),
            ),
          ],
        },
        {
          when: { flag: "coal_codes_recovered" },
          script: [
            atTime(
              18,
              say(
                WHISPER,
                "Both halves of the Hegemony codes are in the cradle. Vance's case made it home.",
                "proud",
              ),
            ),
          ],
        },
        {
          when: { flag: "x7_shards_saved" },
          script: [
            atTime(
              24,
              say(
                HERALD,
                "The saved shards sing with the rest. It is the first time they have been together since Prometheus.",
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
            "Resonance Point. Three nodes to bring into tune, and every hero power is cleared. Spend them.",
          ),
        ),
        heroSays(
          "ascendant_empire",
          AT(8),
          DREAMER,
          "A chorus, a lattice and the shards, all one voice. It will hear a voice and not a scream.",
          "solemn",
        ),
        heroSays(
          "synthetic_collective",
          AT(16),
          OMEGA,
          "The lattice is open and the chorus is tuning to it. Keep the nodes steady.",
        ),
        atTime(
          30,
          wave("tidecell", 3, TIDE_FACTION, { at: "ahead", tag: "lure" }),
          say(WHISPER, "Lure cells. They want to pull us off the nodes.", "urgent"),
        ),
        atTime(
          70,
          wave("hulk_gnawer", 2, TIDE_FACTION, { at: "flank" }),
        ),
        atTime(
          100,
          wave("terran_vindicator", 2, LOYALIST_FACTION, { at: "behind" }),
          say(
            STRIKER,
            "Vindicators, and none of them answer hails. That is the Quiet cell, the Hollowed who followed Vance.",
            "grim",
          ),
        ),
        atTime(
          140,
          wave("tidecell", 4, TIDE_FACTION, { at: "flank", tag: "lure" }),
        ),
        onObjective(
          "node_a",
          "completed",
          reveal("node_b"),
          say(COALITION, "Alpha is in tune. Beta is lighting up to the north.", "proud"),
        ),
        onObjective(
          "node_b",
          "completed",
          reveal("node_c"),
          say(COALITION, "Beta holds. Gamma is the last, and it is mined.", "urgent"),
        ),
        onObjective(
          "node_c",
          "completed",
          banner("RESONANCE", "Three nodes, one voice"),
          say(DREAMER, "There. Do you hear it? The galaxy, loud and not breaking.", "proud"),
        ),
      ],
    },
  };

