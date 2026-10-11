/**
 * Void Corsairs — "The Plunder Path", Acts I-III (missions 1-15).
 * Story, squad, enemies, rewards and debriefs; scripted beats, objective
 * geometry, hazards and bonus objectives live in ../designs/.
 */

import type { CampaignMission } from "../campaignTypes";

export const VOID_CORSAIRS_MISSIONS: CampaignMission[] = [
  // Act I
  {
    id: "cors_1_1",
    act: 1,
    missionNumber: 1,
    title: "Welcome to the Crew",
    briefing:
      "You've joined Captain Blackmaw's crew. Learn to fly like a Corsair - fast and deadly.",
    objectives: [
      {
        id: "nav",
        type: "survive",
        description: "Complete evasion training",
        timeLimit: 120,
      },
    ],
    playerShips: ["corsair_talon"],
    maxSquadSize: 1,
    enemies: [],
    rewards: { xp: 100, credits: 50 },
    newMechanic: "Movement Charts",
  },
  {
    id: "cors_1_2",
    act: 1,
    missionNumber: 2,
    title: "First Plunder",
    briefing:
      "Time for your first raid. A merchant ship awaits. Take what you can.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy the escort",
        count: 1,
      },
    ],
    playerShips: ["corsair_talon"],
    maxSquadSize: 1,
    enemies: [
      { shipId: "confed_falcon", count: 1, faction: "free_confederation" },
    ],
    rewards: { xp: 150, credits: 100 },
    newMechanic: "Combat Dice",
  },
  {
    id: "cors_1_3",
    act: 1,
    missionNumber: 3,
    title: "Terror Tactics",
    briefing:
      "Intimidation is our weapon. Break their spirits, then take everything.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy convoy escorts",
        count: 3,
      },
      {
        id: "survive",
        type: "survive",
        description: "No casualties",
        optional: true,
        xpBonus: 50,
      },
    ],
    playerShips: ["corsair_talon", "corsair_phantom"],
    maxSquadSize: 2,
    enemies: [
      { shipId: "confed_falcon", count: 2, faction: "free_confederation" },
      { shipId: "confed_kestrel", count: 1, faction: "free_confederation" },
    ],
    rewards: { xp: 200, credits: 150 },
    newMechanic: "Intimidation",
  },
  {
    id: "cors_1_4",
    act: 1,
    missionNumber: 4,
    title: "Ship Upgrade",
    briefing:
      "We've captured a Hegemony gunship. It's yours now. Learn to use it.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Test your new ship",
        count: 4,
      },
    ],
    playerShips: ["corsair_talon", "corsair_phantom", "corsair_marauder"],
    maxSquadSize: 2,
    enemies: [{ shipId: "terran_viper", count: 4, faction: "terran_hegemony" }],
    rewards: { xp: 250, credits: 200, unlocks: ["corsair_marauder"] },
    newMechanic: "Ship Evolution",
  },
  {
    id: "cors_1_5",
    act: 1,
    missionNumber: 5,
    title: "Fleet Action",
    briefing:
      "Multiple Hegemony patrols in our territory. Show them this space belongs to us.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy all intruders",
        count: 6,
      },
    ],
    playerShips: ["corsair_talon", "corsair_phantom", "corsair_marauder"],
    maxSquadSize: 3,
    enemies: [
      { shipId: "terran_viper", count: 4, faction: "terran_hegemony" },
      { shipId: "terran_raptor", count: 2, faction: "terran_hegemony" },
    ],
    rewards: { xp: 300, credits: 250 },
  },

  // Act II (5 missions)
  {
    id: "cors_2_1",
    act: 2,
    missionNumber: 6,
    title: "Rich Pickings",
    briefing:
      "A luxury transport carrying nobles. The ransom will be substantial.",
    objectives: [
      {
        id: "capture",
        type: "capture",
        description: "Disable luxury transport",
      },
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy military escorts",
        count: 4,
      },
    ],
    playerShips: ["corsair_talon", "corsair_phantom", "corsair_marauder"],
    maxSquadSize: 3,
    enemies: [
      { shipId: "terran_raptor", count: 4, faction: "terran_hegemony" },
    ],
    rewards: { xp: 400, credits: 400 },
  },
  {
    id: "cors_2_2",
    act: 2,
    missionNumber: 7,
    title: "Rival Elimination",
    briefing:
      "Another pirate crew is encroaching on our territory. Eliminate them.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy rival pirates",
        count: 6,
      },
    ],
    playerShips: [
      "corsair_talon",
      "corsair_phantom",
      "corsair_marauder",
      "corsair_reaver",
    ],
    maxSquadSize: 4,
    enemies: [
      { shipId: "corsair_talon", count: 4, faction: "void_corsairs" },
      { shipId: "corsair_marauder", count: 2, faction: "void_corsairs" },
    ],
    rewards: { xp: 450, credits: 350, unlocks: ["corsair_reaver"] },
  },
  {
    id: "cors_2_3",
    act: 2,
    missionNumber: 8,
    title: "Prison Ship",
    briefing: "Our crew members are on a prison transport. Free them.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy prison guards",
        count: 5,
      },
      { id: "escort", type: "escort", description: "Protect escape shuttles" },
    ],
    playerShips: ["corsair_talon", "corsair_phantom", "corsair_marauder"],
    maxSquadSize: 4,
    enemies: [
      { shipId: "terran_viper", count: 3, faction: "terran_hegemony" },
      { shipId: "terran_bastion", count: 2, faction: "terran_hegemony" },
    ],
    rewards: { xp: 500, credits: 400 },
  },
  {
    id: "cors_2_4",
    act: 2,
    missionNumber: 9,
    title: "Ambush Setup",
    briefing:
      "A Hegemony supply convoy is passing through. Set up the perfect ambush.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy convoy and escorts",
        count: 7,
      },
    ],
    playerShips: [
      "corsair_talon",
      "corsair_phantom",
      "corsair_marauder",
      "corsair_reaver",
    ],
    maxSquadSize: 4,
    enemies: [
      { shipId: "terran_viper", count: 4, faction: "terran_hegemony" },
      { shipId: "terran_raptor", count: 3, faction: "terran_hegemony" },
    ],
    rewards: { xp: 550, credits: 500 },
  },
  {
    id: "cors_2_5",
    act: 2,
    missionNumber: 10,
    title: "The Captain's Grudge",
    briefing:
      "Captain Blackmaw has a score to settle. Destroy Admiral Kronos' personal escort.",
    objectives: [
      {
        id: "assassinate",
        type: "assassinate",
        description: "Destroy Admiral's escort commander",
      },
    ],
    playerShips: [
      "corsair_talon",
      "corsair_phantom",
      "corsair_marauder",
      "corsair_reaver",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "terran_raptor", count: 3, faction: "terran_hegemony" },
      {
        shipId: "terran_bastion",
        count: 1,
        faction: "terran_hegemony",
        isBoss: true,
      },
    ],
    rewards: { xp: 600, credits: 600 },
  },

  // Act III (5 missions)
  {
    id: "cors_3_1",
    act: 3,
    missionNumber: 11,
    title: "Pirate Armada",
    briefing: "Unite the pirate clans. Those who refuse will be destroyed.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Defeat rival clan leaders",
        count: 8,
      },
    ],
    playerShips: [
      "corsair_talon",
      "corsair_phantom",
      "corsair_marauder",
      "corsair_reaver",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "corsair_talon", count: 4, faction: "void_corsairs" },
      { shipId: "corsair_marauder", count: 3, faction: "void_corsairs" },
      {
        shipId: "corsair_reaver",
        count: 1,
        faction: "void_corsairs",
        isAce: true,
      },
    ],
    rewards: { xp: 700, credits: 700 },
  },
  {
    id: "cors_3_2",
    act: 3,
    missionNumber: 12,
    title: "Hegemony Payback",
    briefing: "The Hegemony destroyed our home station. Now we destroy theirs.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy station defenses",
        count: 10,
      },
    ],
    playerShips: [
      "corsair_talon",
      "corsair_phantom",
      "corsair_marauder",
      "corsair_reaver",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "terran_viper", count: 5, faction: "terran_hegemony" },
      { shipId: "terran_bastion", count: 3, faction: "terran_hegemony" },
      { shipId: "terran_bulwark", count: 2, faction: "terran_hegemony" },
    ],
    rewards: { xp: 800, credits: 800 },
  },
  {
    id: "cors_3_3",
    act: 3,
    missionNumber: 13,
    title: "War Profiteering",
    briefing: "The galaxy is at war. We'll raid all sides equally.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Raid multiple factions",
        count: 10,
      },
    ],
    playerShips: [
      "corsair_talon",
      "corsair_phantom",
      "corsair_marauder",
      "corsair_reaver",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "terran_raptor", count: 3, faction: "terran_hegemony" },
      { shipId: "confed_kestrel", count: 3, faction: "free_confederation" },
      {
        shipId: "synth_interceptor_drone",
        count: 2,
        faction: "synthetic_collective",
      },
      { shipId: "ascendant_seraph", count: 2, faction: "ascendant_empire" },
    ],
    rewards: { xp: 850, credits: 900 },
  },
  {
    id: "cors_3_4",
    act: 3,
    missionNumber: 14,
    title: "Grand Heist",
    briefing:
      "The greatest heist in history. Steal the Hegemony's treasury ship.",
    objectives: [
      { id: "capture", type: "capture", description: "Disable treasury ship" },
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy heavy escort",
        count: 8,
      },
    ],
    playerShips: [
      "corsair_talon",
      "corsair_phantom",
      "corsair_marauder",
      "corsair_reaver",
    ],
    maxSquadSize: 6,
    enemies: [
      { shipId: "terran_bastion", count: 4, faction: "terran_hegemony" },
      { shipId: "terran_bulwark", count: 4, faction: "terran_hegemony" },
    ],
    rewards: { xp: 950, credits: 1500 },
  },
  {
    id: "cors_3_5",
    act: 3,
    missionNumber: 15,
    title: "Pirate King",
    briefing:
      "Captain Blackmaw falls. You will take the throne. Destroy all who oppose.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Defeat all rivals",
        count: 12,
      },
    ],
    playerShips: [
      "corsair_talon",
      "corsair_phantom",
      "corsair_marauder",
      "corsair_reaver",
    ],
    maxSquadSize: 6,
    enemies: [
      { shipId: "corsair_talon", count: 4, faction: "void_corsairs" },
      { shipId: "corsair_marauder", count: 4, faction: "void_corsairs" },
      {
        shipId: "corsair_reaver",
        count: 4,
        faction: "void_corsairs",
        isAce: true,
      },
    ],
    rewards: { xp: 1000, credits: 1000 },
  },
];
