/**
 * Coalition campaign, Act IV part 1 (missions 1-3): Truce at Brannoc, Exodus
 * of Vega Prime, The Hollow Man. Story, squad, enemies, rewards and debriefs;
 * objectives, scripts, hazards and allies live in ../designs/coalition*.ts.
 */

import type { CampaignMission } from "../campaignTypes";
import {
  CHEN,
  COALITION,
  DREAMER,
  KIRA,
  LOYALIST_FACTION,
  PLACEHOLDER_SHIPS,
  SANTOS,
  VANCE,
  WHISPER,
  line,
} from "../designs/coalitionShared";

export const COALITION_ACT4A_MISSIONS: CampaignMission[] = [
  {
    id: "coal_4_1",
    act: 4,
    missionNumber: 1,
    day: 205,
    location: "Fort Brannoc, the Rim",
    title: "Truce at Brannoc",
    briefing:
      "Fort Brannoc hosts the first meeting of all five powers since the Schism. Kronos's remnant fleet wants it to fail, and the first tidecells are already circling the platform. Hold it until the envoys sign.",
    objectives: [
      {
        id: "talks",
        type: "defend",
        description: "Hold the truce platform until the envoys sign",
      },
    ],
    playerShips: [...PLACEHOLDER_SHIPS],
    maxSquadSize: 4,
    enemies: [
      { shipId: "terran_centurion", count: 3, faction: LOYALIST_FACTION },
    ],
    rewards: { xp: 1100, credits: 1000 },
    debrief: [
      line(
        SANTOS,
        "Hegemony, Confederation, Collective, Corsairs and the Vigil on one page. I never thought I'd see it.",
        "proud",
      ),
      line(
        CHEN,
        "Kronos's remnant broke and ran. Hardliners don't sign treaties, so they'll be back.",
        "grim",
      ),
      line(
        WHISPER,
        "The tidecells ignored the treaty and went straight for the envoys. They hunt loud minds.",
        "urgent",
      ),
      line(
        COALITION,
        "The truce is a start. The Tide doesn't read treaties, so every wing is on notice.",
        "neutral",
      ),
    ],
  },
  {
    id: "coal_4_2",
    act: 4,
    missionNumber: 2,
    day: 220,
    location: "Vega Prime, edge of the Reach",
    title: "Exodus of Vega Prime",
    briefing:
      "Vega Prime, a colony of humans and Vaelith, is forty minutes ahead of the Tide's front. Three liners carry what can be saved. Get them to the lane mouth, and do not let the front catch them.",
    objectives: [
      {
        id: "exodus",
        type: "escort",
        description: "Escort the colonist liners to the lane mouth",
      },
    ],
    playerShips: [...PLACEHOLDER_SHIPS],
    maxSquadSize: 5,
    enemies: [
      { shipId: "terran_vindicator", count: 5, faction: LOYALIST_FACTION },
    ],
    rewards: { xp: 1150, credits: 1100 },
    debrief: [
      line(
        DREAMER,
        "The Vaelith of Vega sang all the way. Their liners hummed the lane open.",
        "solemn",
      ),
      line(
        KIRA,
        "The colony's empty and the charter's mine. I'll hold it for the ones who flew out.",
        "neutral",
      ),
      line(
        WHISPER,
        "Vega Prime's last beacon went dark at 0612. The front took the colony whole.",
        "grim",
      ),
      line(
        COALITION,
        "The Reach's edge is lost. Every lane the Tide eats is a lane we can't run.",
        "grim",
      ),
    ],
  },
  {
    id: "coal_4_3",
    act: 4,
    missionNumber: 3,
    day: 238,
    location: "Gate Theta, the Spine",
    title: "The Hollow Man",
    briefing:
      "Admiral Vance has left his cell with the Hegemony's half of the gate codes and a screen of loyalists. He is running for the Spine gate. If he opens it, the Tide does not need the Breach. Run him down.",
    objectives: [
      {
        id: "vance",
        type: "assassinate",
        description: "Destroy Vance before he reaches the Spine gate",
      },
    ],
    playerShips: [...PLACEHOLDER_SHIPS],
    maxSquadSize: 4,
    enemies: [
      { shipId: "terran_centurion", count: 2, faction: LOYALIST_FACTION },
    ],
    rewards: { xp: 1250, credits: 1200 },
    debrief: [
      line(
        VANCE,
        "It was never loud. It only asked me to make the galaxy quiet. Was that so much?",
        "solemn",
      ),
      line(
        CHEN,
        "He taught me everything I know about logistics. That is how he nearly won.",
        "grim",
      ),
      line(
        WHISPER,
        "The Spine gate is shut. I'm checking what he carried against the codes now.",
        "neutral",
      ),
      line(
        COALITION,
        "Vance was the last of the Hollowed who still held a fleet. The Tide has lost its voice in the Spine.",
        "grim",
      ),
    ],
  },
];
