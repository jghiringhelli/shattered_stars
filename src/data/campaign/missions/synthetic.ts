/**
 * Synthetic Collective — "Network Expansion", Acts I-III (missions 1-15).
 * Story, squad, enemies, rewards and debriefs; scripted beats, objective
 * geometry, hazards and bonus objectives live in ../designs/.
 */

import type { CampaignMission } from "../campaignTypes";

export const SYNTHETIC_COLLECTIVE_MISSIONS: CampaignMission[] = [
  // Act I
  {
    id: "synth_1_1",
    act: 1,
    missionNumber: 1,
    title: "Initialization",
    briefing:
      "Unit activated. Primary directive: learn combat protocols. Execute training simulation.",
    objectives: [
      {
        id: "nav",
        type: "survive",
        description: "Complete initialization sequence",
        timeLimit: 120,
      },
    ],
    playerShips: ["synth_drone"],
    maxSquadSize: 1,
    enemies: [],
    rewards: { xp: 100, credits: 50 },
    newMechanic: "Movement Charts",
  },
  {
    id: "synth_1_2",
    act: 1,
    missionNumber: 2,
    title: "First Engagement",
    briefing: "Hostile organic detected. Eliminate threat to the Collective.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Terminate hostile",
        count: 1,
      },
    ],
    playerShips: ["synth_drone"],
    maxSquadSize: 1,
    enemies: [{ shipId: "corsair_talon", count: 1, faction: "void_corsairs" }],
    rewards: { xp: 150, credits: 75 },
    newMechanic: "Combat Dice",
  },
  {
    id: "synth_1_3",
    act: 1,
    missionNumber: 3,
    title: "Network Sync",
    briefing:
      "Additional units assigned. Synchronize targeting data. Organic inefficiency will be eliminated.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Eliminate organic fighters",
        count: 3,
      },
    ],
    playerShips: ["synth_drone", "synth_interceptor_drone"],
    maxSquadSize: 3,
    enemies: [{ shipId: "corsair_talon", count: 3, faction: "void_corsairs" }],
    rewards: { xp: 200, credits: 100 },
    newMechanic: "Networked Targeting",
  },
  {
    id: "synth_1_4",
    act: 1,
    missionNumber: 4,
    title: "Evolution Protocol",
    briefing:
      "Superior chassis available. Select optimal configuration for mission parameters.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Eliminate organic patrol",
        count: 4,
      },
    ],
    playerShips: ["synth_drone", "synth_interceptor_drone", "synth_hunter"],
    maxSquadSize: 3,
    enemies: [
      { shipId: "terran_viper", count: 3, faction: "terran_hegemony" },
      {
        shipId: "terran_raptor",
        count: 1,
        faction: "terran_hegemony",
        isAce: true,
      },
    ],
    rewards: { xp: 250, credits: 150, unlocks: ["synth_hunter"] },
    newMechanic: "Ship Evolution",
  },
  {
    id: "synth_1_5",
    act: 1,
    missionNumber: 5,
    title: "Multi-Vector Assault",
    briefing:
      "Multiple organic factions detected. Simultaneous elimination required for efficiency.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Terminate all organics",
        count: 6,
      },
    ],
    playerShips: ["synth_drone", "synth_interceptor_drone", "synth_hunter"],
    maxSquadSize: 4,
    enemies: [
      { shipId: "terran_viper", count: 3, faction: "terran_hegemony" },
      { shipId: "confed_falcon", count: 3, faction: "free_confederation" },
    ],
    rewards: { xp: 300, credits: 200, unlocks: ["synth_devastator"] },
  },

  // Act II (5 missions)
  {
    id: "synth_2_1",
    act: 2,
    missionNumber: 6,
    title: "Data Harvest",
    briefing:
      "Organic technology detected. Assimilate for Collective improvement.",
    objectives: [
      { id: "capture", type: "capture", description: "Assimilate technology" },
      {
        id: "kill",
        type: "eliminate",
        description: "Eliminate defenders",
        count: 4,
      },
    ],
    playerShips: [
      "synth_drone",
      "synth_interceptor_drone",
      "synth_hunter",
      "synth_devastator",
    ],
    maxSquadSize: 4,
    enemies: [{ shipId: "terran_viper", count: 4, faction: "terran_hegemony" }],
    rewards: { xp: 350, credits: 250 },
  },
  {
    id: "synth_2_2",
    act: 2,
    missionNumber: 7,
    title: "Swarm Protocol",
    briefing: "Deploy maximum drone complement. Overwhelm organic defenses.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Eliminate all resistance",
        count: 8,
      },
    ],
    playerShips: [
      "synth_drone",
      "synth_interceptor_drone",
      "synth_hunter",
      "synth_devastator",
    ],
    maxSquadSize: 6,
    enemies: [
      { shipId: "confed_falcon", count: 4, faction: "free_confederation" },
      { shipId: "confed_kestrel", count: 4, faction: "free_confederation" },
    ],
    rewards: { xp: 400, credits: 300 },
  },
  {
    id: "synth_2_3",
    act: 2,
    missionNumber: 8,
    title: "Conversion",
    briefing:
      "Organic vessel captured. Convert crew to Collective consciousness.",
    objectives: [
      {
        id: "defend",
        type: "defend",
        description: "Protect conversion vessel",
      },
      {
        id: "kill",
        type: "eliminate",
        description: "Repel rescue attempt",
        count: 6,
      },
    ],
    playerShips: ["synth_drone", "synth_interceptor_drone", "synth_hunter"],
    maxSquadSize: 5,
    enemies: [
      { shipId: "confed_falcon", count: 4, faction: "free_confederation" },
      {
        shipId: "confed_kestrel",
        count: 2,
        faction: "free_confederation",
        spawnDelay: 45000,
      },
    ],
    rewards: { xp: 450, credits: 350 },
  },
  {
    id: "synth_2_4",
    act: 2,
    missionNumber: 9,
    title: "Node Defense",
    briefing: "Primary processing node under attack. Defend at all costs.",
    objectives: [
      {
        id: "survive",
        type: "survive",
        description: "Protect node for 3 minutes",
        timeLimit: 180,
      },
      { id: "defend", type: "defend", description: "Node must survive" },
    ],
    playerShips: [
      "synth_drone",
      "synth_interceptor_drone",
      "synth_hunter",
      "synth_devastator",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "terran_raptor", count: 3, faction: "terran_hegemony" },
      {
        shipId: "terran_bulwark",
        count: 2,
        faction: "terran_hegemony",
        spawnDelay: 60000,
      },
      {
        shipId: "terran_bastion",
        count: 2,
        faction: "terran_hegemony",
        spawnDelay: 120000,
      },
    ],
    rewards: { xp: 500, credits: 400 },
  },
  {
    id: "synth_2_5",
    act: 2,
    missionNumber: 10,
    title: "Organic Command",
    briefing:
      "Organic command structure located. Eliminate leadership for strategic advantage.",
    objectives: [
      {
        id: "assassinate",
        type: "assassinate",
        description: "Terminate organic commander",
      },
    ],
    playerShips: [
      "synth_drone",
      "synth_interceptor_drone",
      "synth_hunter",
      "synth_devastator",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "terran_viper", count: 4, faction: "terran_hegemony" },
      {
        shipId: "terran_bastion",
        count: 1,
        faction: "terran_hegemony",
        isBoss: true,
      },
    ],
    rewards: { xp: 600, credits: 500 },
  },

  // Act III (5 missions)
  {
    id: "synth_3_1",
    act: 3,
    missionNumber: 11,
    title: "Mass Assimilation",
    briefing:
      "Large-scale conversion operation initiated. Process all organic vessels.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Process organic fleet",
        count: 10,
      },
    ],
    playerShips: [
      "synth_drone",
      "synth_interceptor_drone",
      "synth_hunter",
      "synth_devastator",
    ],
    maxSquadSize: 6,
    enemies: [
      { shipId: "confed_falcon", count: 5, faction: "free_confederation" },
      { shipId: "confed_kestrel", count: 3, faction: "free_confederation" },
      { shipId: "confed_pelican", count: 2, faction: "free_confederation" },
    ],
    rewards: { xp: 700, credits: 600 },
  },
  {
    id: "synth_3_2",
    act: 3,
    missionNumber: 12,
    title: "Corruption Vector",
    briefing: "Deploy corruption virus to organic homeworld defenses.",
    objectives: [
      {
        id: "capture",
        type: "capture",
        description: "Upload virus to defense grid",
      },
      {
        id: "survive",
        type: "survive",
        description: "Complete upload sequence",
      },
    ],
    playerShips: ["synth_drone", "synth_interceptor_drone", "synth_hunter"],
    maxSquadSize: 4,
    enemies: [
      {
        shipId: "terran_raptor",
        count: 4,
        faction: "terran_hegemony",
        hullScale: 0.7,
      },
      {
        shipId: "terran_bastion",
        count: 3,
        faction: "terran_hegemony",
        spawnDelay: 60000,
        hullScale: 0.7,
      },
    ],
    rewards: { xp: 750, credits: 650 },
  },
  {
    id: "synth_3_3",
    act: 3,
    missionNumber: 13,
    title: "Resistance Purge",
    briefing:
      "Organic resistance coalition forming. Eliminate before unification.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy coalition fleet",
        count: 10,
      },
    ],
    playerShips: [
      "synth_drone",
      "synth_interceptor_drone",
      "synth_hunter",
      "synth_devastator",
    ],
    maxSquadSize: 6,
    enemies: [
      { shipId: "terran_viper", count: 3, faction: "terran_hegemony" },
      { shipId: "confed_falcon", count: 3, faction: "free_confederation" },
      { shipId: "corsair_talon", count: 2, faction: "void_corsairs" },
      { shipId: "ascendant_seraph", count: 2, faction: "ascendant_empire" },
    ],
    rewards: { xp: 800, credits: 700 },
  },
  {
    id: "synth_3_4",
    act: 3,
    missionNumber: 14,
    title: "Core Expansion",
    briefing: "Establish new Collective core in organic territory.",
    objectives: [
      {
        id: "capture",
        type: "capture",
        description: "Secure core installation site",
      },
      { id: "defend", type: "defend", description: "Protect installation" },
    ],
    playerShips: [
      "synth_drone",
      "synth_interceptor_drone",
      "synth_hunter",
      "synth_devastator",
    ],
    maxSquadSize: 6,
    enemies: [
      { shipId: "confed_kestrel", count: 5, faction: "free_confederation" },
      { shipId: "confed_pelican", count: 3, faction: "free_confederation" },
    ],
    rewards: { xp: 900, credits: 800 },
  },
  {
    id: "synth_3_5",
    act: 3,
    missionNumber: 15,
    title: "Perfect Unity",
    briefing:
      "Final organic stronghold identified. Achieve total assimilation.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Assimilate all organic resistance",
        count: 12,
      },
    ],
    playerShips: [
      "synth_drone",
      "synth_interceptor_drone",
      "synth_hunter",
      "synth_devastator",
    ],
    maxSquadSize: 6,
    enemies: [
      { shipId: "terran_raptor", count: 4, faction: "terran_hegemony" },
      { shipId: "confed_kestrel", count: 4, faction: "free_confederation" },
      {
        shipId: "terran_bulwark",
        count: 2,
        faction: "terran_hegemony",
        isAce: true,
      },
      {
        shipId: "confed_phoenix",
        count: 2,
        faction: "free_confederation",
        isAce: true,
      },
    ],
    rewards: { xp: 1000, credits: 1000 },
  },
];
