/**
 * Coalition campaign, Act IV part 2 (missions 4-5): Signal Fire and The
 * Breach of Sol. Story, squad, enemies, rewards and debriefs; objectives,
 * scripts, hazards and allies live in ../designs/coalitionAct4*.ts.
 */

import type { CampaignMission } from "../campaignTypes";
import {
  CHEN,
  COALITION,
  DREAMER,
  LOYALIST_FACTION,
  OMEGA,
  PLACEHOLDER_SHIPS,
  PRIME,
  VASQUEZ,
  line,
} from "../designs/coalitionShared";

export const COALITION_ACT4B_MISSIONS: CampaignMission[] = [
  {
    id: "coal_4_4",
    act: 4,
    missionNumber: 4,
    day: 246,
    location: "Node Kel-9, Outer Drift",
    title: "Signal Fire",
    briefing:
      "Prime still rides the lattice, and its whisper is the Tide's best relay. OMEGA-7 can cut it out from Node Kel-9, but only while the Coalition holds the node. Keep the uplink in range until the lattice goes quiet.",
    objectives: [
      {
        id: "cut",
        type: "eliminate",
        description: "Cut Prime out of the lattice",
      },
    ],
    playerShips: [...PLACEHOLDER_SHIPS],
    maxSquadSize: 5,
    enemies: [
      { shipId: "synth_drone", count: 4, faction: "synthetic_collective" },
      { shipId: "synth_heavy_drone", count: 2, faction: "synthetic_collective" },
    ],
    rewards: { xp: 1300, credits: 1250 },
    debrief: [
      line(
        OMEGA,
        "Prime is out of the lattice. The silence is mine now, and I find I do not like it.",
        "solemn",
      ),
      line(
        PRIME,
        "OMEGA-7 has severed a limb and calls it freedom. Quiet is coming regardless.",
        "grim",
      ),
      line(
        VASQUEZ,
        "Prime's carrier wave holds three notes, descending. Whoever made the Tide also shaped the relay minds.",
        "urgent",
      ),
      line(
        COALITION,
        "Kel-9 is ours. The Coalition holds a node of its own for the first time.",
        "proud",
      ),
    ],
  },
  {
    id: "coal_4_5",
    act: 4,
    missionNumber: 5,
    day: 251,
    location: "The Sol Mouth",
    title: "The Breach of Sol",
    briefing:
      "The Tide has reached the Sol Mouth, the lane humanity first jumped through. The whole Coalition fleet is here, and the first Resonance prototype sits in the debris ring. Survive, kill the Pruning Herald, and keep the prototype in tune.",
    objectives: [
      {
        id: "survive",
        type: "survive",
        description: "Hold the Sol Mouth for 3 minutes",
      },
    ],
    playerShips: [...PLACEHOLDER_SHIPS],
    maxSquadSize: 6,
    enemies: [{ shipId: "terran_centurion", count: 2, faction: LOYALIST_FACTION }],
    rewards: { xp: 1500, credits: 1500 },
    debrief: [
      line(
        COALITION,
        "The Herald is dead and the Mouth still stands. Sol lives another night.",
        "proud",
      ),
      line(
        VASQUEZ,
        "The prototype logged everything. A chorus, a lattice and the shards can make a voice the Tide answers.",
        "urgent",
      ),
      line(
        DREAMER,
        "I remember this. The First Tide began with a song just like ours. We must be loud, and we must be kind.",
        "solemn",
      ),
      line(
        CHEN,
        "Earth is untouched. Whatever comes next comes through us.",
        "proud",
      ),
    ],
  },
];
