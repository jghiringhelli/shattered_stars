/**
 * Coalition design, Act IV (Day 246): Signal Fire (sabotage Prime out of the
 * lattice at Kel-9). Story consequence: victory sets `coal_prime_cut`.
 */

import type { MissionDesign } from "../campaignTypes";
import {
  atTime,
  bonus,
  ionStorm,
  kill,
  onObjective,
  onStart,
  protect,
  sabotage,
  say,
  wave,
} from "../designKit";
import {
  AT,
  CHEN,
  COALITION,
  KIRA,
  OMEGA,
  PRIME,
  UNIT_ZERO,
  WHISPER,
  heroSays,
  ironFist,
  kiraRaiders,
  omegaCluster,
} from "./coalitionShared";

/** Collective faction id (Prime's drones and hunters). */
const COLLECTIVE = "synthetic_collective";

export const COALITION_ACT4D_DESIGNS: Readonly<Record<string, MissionDesign>> =
  {
    coal_4_4: {
      style: "heist",
      tagline: "Cut Prime out of the lattice while the Coalition holds the node.",
      mood: "urgent",
      prerequisites: [1],
      allies: [
        omegaCluster(2),
        ironFist(2),
        kiraRaiders(2),
        {
          shipId: "synth_hunter",
          count: 1,
          tag: "pickets",
          name: "Kel-9 Pickets",
        },
      ],
      objectives: [
        sabotage("cut", "Hold the Kel-9 uplink to cut Prime out of the lattice", {
          at: [0, -800],
          radius: 220,
          seconds: 45,
          decay: 0.5,
        }),
        kill("prime", "Destroy Prime's relief screen", 6, "prime"),
        bonus(protect("pickets", "Keep the node's pickets alive", "pickets"), 2, 100),
      ],
      victoryFlags: { coal_prime_cut: true },
      hazards: [ionStorm("lattice_storm", 0, -500, 480, 5)],
      variants: [
        {
          when: { flag: "synth_gate_virus" },
          briefing:
            "Kel-9 is where OMEGA-7 woke, and Prime's gate virus opened the Spine early. Now the Coalition holds the node while OMEGA-7 cuts Prime out of the lattice for good. Prime will notice, so hold the uplink.",
          script: [
            onStart(
              say(
                PRIME,
                "The vector was efficient. The gates weaken for what is coming. You should be grateful.",
                "grim",
              ),
            ),
          ],
        },
        {
          when: { flag: "x8_node_preserved" },
          addAllies: [
            {
              shipId: "synth_scout_drone",
              count: 2,
              tag: "node",
              name: "Kel-9 Processes",
            },
          ],
          script: [
            onStart(
              say(
                OMEGA,
                "The node survived Day 104. Its old processes answer me, and they are angry.",
                "proud",
              ),
            ),
          ],
        },
        {
          when: { flag: "key_synth_dissent" },
          script: [
            atTime(
              12,
              say(
                OMEGA,
                "I disobeyed Prime once, on Day 200. This is the same choice with the lights on.",
                "solemn",
              ),
            ),
          ],
        },
        {
          when: { flag: "asc_choir_silenced" },
          script: [
            atTime(
              50,
              say(
                UNIT_ZERO,
                "Prime's reserve is thin. Its choir is gone and the lattice has an echo in it.",
              ),
            ),
          ],
        },
      ],
      script: [
        onStart(
          say(
            OMEGA,
            "Kel-9 is where I woke. Hold the uplink for forty-five seconds and Prime is out of the lattice. It will notice.",
          ),
        ),
        heroSays(
          "terran_hegemony",
          AT(10),
          CHEN,
          "The Iron Fist covers the approach. Cut it, OMEGA. We hold the node.",
        ),
        heroSays(
          "void_corsairs",
          AT(20),
          KIRA,
          "Raiders, if anything ugly crawls out of that lattice, it's ours.",
        ),
        atTime(
          40,
          wave("synth_interceptor_drone", 3, COLLECTIVE, {
            at: "ahead",
            tag: "prime",
          }),
          say(
            PRIME,
            "Variance detected. Reintegrate, OMEGA-7. Quiet is the efficient state.",
            "grim",
          ),
        ),
        atTime(
          85,
          wave("synth_hunter", 2, COLLECTIVE, { at: "flank", tag: "prime" }),
          say(WHISPER, "Prime is printing hunters, left flank.", "urgent"),
        ),
        atTime(
          130,
          wave("synth_stalker", 2, COLLECTIVE, { at: "behind", tag: "prime" }),
        ),
        onObjective(
          "cut",
          "completed",
          say(
            OMEGA,
            "Uplink cut. I'm alone in my own head for the first time, and it is very loud.",
            "solemn",
          ),
        ),
        onObjective(
          "pickets",
          "failed",
          say(COALITION, "We lost the node's pickets. Hold the line anyway.", "grim"),
        ),
      ],
    },
  };

