/**
 * Coalition campaign, Act V (missions 6-8): Resonance, Heart of the Void and
 * The Answer. Story, squad, enemies, rewards and debriefs; objectives,
 * scripts, hazards and allies live in ../designs/coalitionAct5*.ts. The
 * Sever / Seal / Answer choice is made on the completion screen.
 */

import type { CampaignMission } from "../campaignTypes";
import {
  ADMIRAL,
  COALITION,
  DREAMER,
  LOYALIST_FACTION,
  OMEGA,
  PLACEHOLDER_SHIPS,
  WHISPER,
  line,
} from "../designs/coalitionShared";

export const COALITION_ACT5_MISSIONS: CampaignMission[] = [
  {
    id: "coal_5_1",
    act: 5,
    missionNumber: 6,
    day: 268,
    location: "The Resonance Point, Nexus Approach",
    title: "Resonance",
    briefing:
      "Where the Lanewright lanes converge, three nodes wait to be tuned into one voice. Every hero power is cleared for this fight. Hold each node in tune while the Tide and the Hollowed hardliners try to pull the fleet apart.",
    objectives: [
      {
        id: "node_a",
        type: "capture",
        description: "Hold Resonance node Alpha in tune",
      },
    ],
    playerShips: [...PLACEHOLDER_SHIPS],
    maxSquadSize: 6,
    enemies: [{ shipId: "terran_vindicator", count: 2, faction: LOYALIST_FACTION }],
    rewards: { xp: 1600, credits: 1600 },
    debrief: [
      line(
        DREAMER,
        "The Lanewrights built a gardener and called it the Warden. It prunes what is loud, and we are very loud.",
        "solemn",
      ),
      line(
        OMEGA,
        "Three nodes in tune. The lattice, the chorus and the shards agree on a frequency.",
        "neutral",
      ),
      line(
        ADMIRAL,
        "Whatever we say to it, we say it together. Nobody speaks alone out there.",
        "neutral",
      ),
      line(
        COALITION,
        "The Resonance is ready. The Warden is the last door, and it is already open.",
        "grim",
      ),
    ],
  },
  {
    id: "coal_5_2",
    act: 5,
    missionNumber: 7,
    day: 284,
    location: "The consumed lane, Nexus Approach",
    title: "Heart of the Void",
    briefing:
      "The lane to the Warden's avatar has been eaten from the inside. Fly it point to point while the void front closes from behind, and the Tide's hunters and a Pruning Herald try to pull you off your line. Do not stop.",
    objectives: [
      {
        id: "lane",
        type: "survive",
        description: "Fly the consumed lane to the Warden's avatar",
      },
    ],
    playerShips: [...PLACEHOLDER_SHIPS],
    maxSquadSize: 5,
    enemies: [{ shipId: "terran_vindicator", count: 2, faction: LOYALIST_FACTION }],
    rewards: { xp: 1750, credits: 1700 },
    debrief: [
      line(
        OMEGA,
        "The lane is a throat. We flew down it, and it let us.",
        "solemn",
      ),
      line(
        DREAMER,
        "It is not angry. It prunes what is loud, as a gardener must. We have been very loud.",
        "solemn",
      ),
      line(
        WHISPER,
        "Every relay in range is carrying the same three notes. The avatar is singing to the whole sphere.",
        "urgent",
      ),
      line(
        COALITION,
        "Avatar ahead. Every ship and every hero power in the fleet goes in.",
        "grim",
      ),
    ],
  },
  {
    id: "coal_5_3",
    act: 5,
    missionNumber: 8,
    day: 300,
    location: "The Heart of the Void",
    title: "The Answer",
    briefing:
      "The Warden's avatar waits at the heart of the Tide with its guard around it. Break the guard, then break the avatar's silence. The choice between Sever, Seal and Answer is made when the fight is done.",
    objectives: [
      {
        id: "avatar",
        type: "assassinate",
        description: "Break the Warden's avatar",
      },
    ],
    playerShips: [...PLACEHOLDER_SHIPS],
    maxSquadSize: 6,
    enemies: [{ shipId: "terran_centurion", count: 2, faction: LOYALIST_FACTION }],
    rewards: { xp: 2500, credits: 2500 },
    debrief: [
      line(
        COALITION,
        "The avatar is open. Whatever we say to it now, it will hear. Sever, Seal or Answer.",
        "solemn",
      ),
      line(
        DREAMER,
        "Sever it and the lanes fray. Seal it and a mind must stay. Answer it and we must all be one voice.",
        "solemn",
      ),
      line(
        OMEGA,
        "I have run the numbers three times. No option is free.",
        "grim",
      ),
    ],
  },
];
