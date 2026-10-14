/**
 * Free Confederation — "Libre", Acts I-III (missions 1-15).
 * Story, squad, enemies, rewards and debriefs; scripted beats, objective
 * geometry, hazards and bonus objectives live in ../designs/.
 */

import type { CampaignMission } from "../campaignTypes";

export const FREE_CONFEDERATION_MISSIONS: CampaignMission[] = [
  // Act I
  {
    id: "conf_1_1",
    act: 1,
    missionNumber: 1,
    title: "Freedom Flight",
    briefing:
      "You've escaped Hegemony oppression and joined the Confederation. Learn to pilot your salvaged fighter.",
    objectives: [
      {
        id: "nav",
        type: "survive",
        description: "Complete flight training",
        timeLimit: 120,
      },
    ],
    playerShips: ["confed_falcon"],
    maxSquadSize: 1,
    enemies: [],
    rewards: { xp: 100, credits: 50 },
    newMechanic: "Movement Charts",
  },
  {
    id: "conf_1_2",
    act: 1,
    missionNumber: 2,
    title: "First Strike",
    briefing:
      "A Hegemony patrol has been spotted. Show them the Confederation fights back.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy the patrol",
        count: 1,
      },
    ],
    playerShips: ["confed_falcon"],
    maxSquadSize: 1,
    enemies: [{ shipId: "terran_viper", count: 1, faction: "terran_hegemony" }],
    rewards: { xp: 150, credits: 75 },
    newMechanic: "Combat Dice",
  },
  {
    id: "conf_1_3",
    act: 1,
    missionNumber: 3,
    title: "Guerrilla Tactics",
    briefing:
      "Join your cell in a hit-and-run attack. Strike fast, then disappear.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy supply convoy",
        count: 3,
      },
      {
        id: "survive",
        type: "survive",
        description: "All pilots survive",
        optional: true,
        xpBonus: 50,
      },
    ],
    playerShips: ["confed_falcon", "confed_kestrel"],
    maxSquadSize: 2,
    enemies: [
      { shipId: "terran_viper", count: 2, faction: "terran_hegemony" },
      { shipId: "terran_raptor", count: 1, faction: "terran_hegemony" },
    ],
    rewards: { xp: 200, credits: 100 },
    newMechanic: "Hit and Run",
  },
  {
    id: "conf_1_4",
    act: 1,
    missionNumber: 4,
    title: "Upgrade Salvage",
    briefing:
      "We've located a crashed Hegemony transport with advanced tech. Secure the salvage.",
    objectives: [
      { id: "capture", type: "capture", description: "Secure crash site" },
      { id: "defend", type: "defend", description: "Hold until extraction" },
    ],
    playerShips: ["confed_falcon", "confed_kestrel"],
    maxSquadSize: 2,
    enemies: [
      { shipId: "terran_viper", count: 3, faction: "terran_hegemony" },
      {
        shipId: "terran_raptor",
        count: 1,
        faction: "terran_hegemony",
        spawnDelay: 45000,
      },
    ],
    rewards: { xp: 250, credits: 150, unlocks: ["confed_kestrel"] },
    newMechanic: "Ship Evolution",
  },
  {
    id: "conf_1_5",
    act: 1,
    missionNumber: 5,
    title: "Hidden Base Defense",
    briefing:
      "The Hegemony has found our base. Hold them off while we evacuate.",
    objectives: [
      {
        id: "survive",
        type: "survive",
        description: "Survive for 2 minutes",
        timeLimit: 120,
      },
      {
        id: "defend",
        type: "defend",
        description: "Protect the evacuation ships",
      },
    ],
    playerShips: ["confed_falcon", "confed_kestrel", "confed_pelican"],
    maxSquadSize: 3,
    enemies: [
      { shipId: "terran_viper", count: 4, faction: "terran_hegemony" },
      {
        shipId: "terran_raptor",
        count: 2,
        faction: "terran_hegemony",
        spawnDelay: 60000,
      },
    ],
    rewards: { xp: 300, credits: 200, unlocks: ["confed_pelican"] },
  },

  // Act II
  {
    id: "conf_2_1",
    act: 2,
    missionNumber: 6,
    title: "Supply Raid",
    briefing: "We need supplies. Intercept the Hegemony cargo convoy.",
    objectives: [
      {
        id: "capture",
        type: "capture",
        description: "Disable cargo ships",
        count: 2,
      },
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy escorts",
        count: 4,
      },
    ],
    playerShips: ["confed_falcon", "confed_kestrel", "confed_pelican"],
    maxSquadSize: 3,
    enemies: [{ shipId: "terran_viper", count: 4, faction: "terran_hegemony" }],
    rewards: { xp: 350, credits: 250 },
  },
  {
    id: "conf_2_2",
    act: 2,
    missionNumber: 7,
    title: "Prison Break",
    briefing:
      "Our comrades are being held at a Hegemony prison station. Break them out.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy station defenses",
        count: 5,
      },
      { id: "escort", type: "escort", description: "Protect escape pods" },
    ],
    playerShips: [
      "confed_falcon",
      "confed_kestrel",
      "confed_pelican",
      "confed_phoenix",
    ],
    maxSquadSize: 4,
    enemies: [
      { shipId: "terran_viper", count: 3, faction: "terran_hegemony" },
      { shipId: "terran_bastion", count: 2, faction: "terran_hegemony" },
    ],
    rewards: { xp: 400, credits: 300, unlocks: ["confed_phoenix"] },
  },
  {
    id: "conf_2_3",
    act: 2,
    missionNumber: 8,
    title: "Corsair Alliance",
    briefing:
      "The Void Corsairs offer an alliance. Meet with their captain, but stay alert.",
    objectives: [
      { id: "survive", type: "survive", description: "Survive the meeting" },
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy Hegemony ambush",
        count: 6,
      },
    ],
    playerShips: ["confed_falcon", "confed_kestrel"],
    maxSquadSize: 3,
    enemies: [
      {
        shipId: "terran_raptor",
        count: 4,
        faction: "terran_hegemony",
        spawnDelay: 30000,
      },
      {
        shipId: "terran_bastion",
        count: 2,
        faction: "terran_hegemony",
        spawnDelay: 30000,
      },
    ],
    rewards: { xp: 450, credits: 350 },
  },
  {
    id: "conf_2_4",
    act: 2,
    missionNumber: 9,
    title: "Intelligence Theft",
    briefing: "Steal tactical data from a Hegemony communications relay.",
    objectives: [
      { id: "capture", type: "capture", description: "Hack relay station" },
      { id: "survive", type: "survive", description: "Escape with data" },
    ],
    playerShips: ["confed_falcon", "confed_kestrel", "confed_pelican"],
    maxSquadSize: 3,
    enemies: [
      { shipId: "terran_viper", count: 3, faction: "terran_hegemony" },
      {
        shipId: "terran_raptor",
        count: 3,
        faction: "terran_hegemony",
        spawnDelay: 45000,
      },
    ],
    rewards: { xp: 500, credits: 400 },
  },
  {
    id: "conf_2_5",
    act: 2,
    missionNumber: 10,
    title: "Hegemony Battlecruiser",
    briefing:
      "A Hegemony Battlecruiser threatens our sector. It must be destroyed.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy the Battlecruiser",
      },
    ],
    playerShips: [
      "confed_falcon",
      "confed_kestrel",
      "confed_pelican",
      "confed_phoenix",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "terran_viper", count: 4, faction: "terran_hegemony" },
      {
        shipId: "terran_bulwark",
        count: 1,
        faction: "terran_hegemony",
        isBoss: true,
      },
    ],
    rewards: { xp: 600, credits: 500 },
  },

  // Act III (5 missions)
  {
    id: "conf_3_1",
    act: 3,
    missionNumber: 11,
    title: "Revolution Rising",
    briefing: "The people rise across multiple worlds. Support the uprising.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy oppressors",
        count: 10,
      },
    ],
    playerShips: [
      "confed_falcon",
      "confed_kestrel",
      "confed_pelican",
      "confed_phoenix",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "terran_viper", count: 5, faction: "terran_hegemony" },
      { shipId: "terran_raptor", count: 3, faction: "terran_hegemony" },
      { shipId: "terran_bastion", count: 2, faction: "terran_hegemony" },
    ],
    rewards: { xp: 700, credits: 600 },
  },
  {
    id: "conf_3_2",
    act: 3,
    missionNumber: 12,
    title: "Capital Liberation",
    briefing: "Free the capital world from Hegemony control.",
    objectives: [
      { id: "capture", type: "capture", description: "Secure orbital control" },
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy garrison",
        count: 8,
      },
    ],
    playerShips: [
      "confed_falcon",
      "confed_kestrel",
      "confed_pelican",
      "confed_phoenix",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "terran_raptor", count: 4, faction: "terran_hegemony" },
      { shipId: "terran_bastion", count: 4, faction: "terran_hegemony" },
    ],
    rewards: { xp: 750, credits: 650 },
  },
  {
    id: "conf_3_3",
    act: 3,
    missionNumber: 13,
    title: "Admiral's Gambit",
    briefing:
      "The Hegemony Admiral has sprung a trap. Break through the encirclement.",
    objectives: [
      { id: "survive", type: "survive", description: "Break through blockade" },
      {
        id: "kill",
        type: "eliminate",
        description: "Create escape route",
        count: 6,
      },
    ],
    playerShips: [
      "confed_falcon",
      "confed_kestrel",
      "confed_pelican",
      "confed_phoenix",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "terran_viper", count: 6, faction: "terran_hegemony" },
      { shipId: "terran_bulwark", count: 2, faction: "terran_hegemony" },
    ],
    rewards: { xp: 800, credits: 700 },
  },
  {
    id: "conf_3_4",
    act: 3,
    missionNumber: 14,
    title: "Final Offensive",
    briefing: "Launch the final assault on Hegemony High Command.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy High Command defense fleet",
        count: 10,
      },
    ],
    playerShips: [
      "confed_falcon",
      "confed_kestrel",
      "confed_pelican",
      "confed_phoenix",
    ],
    maxSquadSize: 6,
    enemies: [
      { shipId: "terran_raptor", count: 4, faction: "terran_hegemony" },
      { shipId: "terran_bastion", count: 4, faction: "terran_hegemony" },
      {
        shipId: "terran_bulwark",
        count: 2,
        faction: "terran_hegemony",
        isAce: true,
      },
    ],
    rewards: { xp: 900, credits: 800 },
  },
  {
    id: "conf_3_5",
    act: 3,
    missionNumber: 15,
    title: "Freedom's Dawn",
    briefing:
      "The Hegemony falls. Destroy their last flagship and secure independence.",
    objectives: [
      {
        id: "assassinate",
        type: "assassinate",
        description: "Destroy Admiral Kronos' flagship",
      },
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy escorts",
        count: 6,
      },
    ],
    playerShips: [
      "confed_falcon",
      "confed_kestrel",
      "confed_pelican",
      "confed_phoenix",
    ],
    maxSquadSize: 6,
    enemies: [
      { shipId: "terran_bastion", count: 4, faction: "terran_hegemony" },
      { shipId: "terran_bulwark", count: 2, faction: "terran_hegemony" },
      {
        shipId: "terran_bulwark",
        count: 1,
        faction: "terran_hegemony",
        isBoss: true,
      },
    ],
    rewards: { xp: 1000, credits: 1000 },
  },
];
