/**
 * Ascendant Empire — "The Prophecy", Acts I-III (missions 1-15).
 * Story, squad, enemies, rewards and debriefs; scripted beats, objective
 * geometry, hazards and bonus objectives live in ../designs/.
 */

import type { CampaignMission } from "../campaignTypes";

export const ASCENDANT_EMPIRE_MISSIONS: CampaignMission[] = [
  // Act I
  {
    id: "asc_1_1",
    act: 1,
    missionNumber: 1,
    title: "Awakening",
    briefing:
      "The Oracles have foreseen your destiny. Your psionic abilities will guide your ship through the trial.",
    objectives: [
      {
        id: "nav",
        type: "survive",
        description: "Complete psionic navigation trial",
        timeLimit: 120,
      },
    ],
    playerShips: ["ascendant_seraph"],
    maxSquadSize: 1,
    enemies: [],
    rewards: { xp: 100, credits: 50 },
    newMechanic: "Movement Charts",
  },
  {
    id: "asc_1_2",
    act: 1,
    missionNumber: 2,
    title: "First Prophecy",
    briefing: "The visions show an enemy. Strike before they can act.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Eliminate the threat",
        count: 1,
      },
    ],
    playerShips: ["ascendant_seraph"],
    maxSquadSize: 1,
    enemies: [
      { shipId: "synth_drone", count: 1, faction: "synthetic_collective" },
    ],
    rewards: { xp: 150, credits: 75 },
    newMechanic: "Combat Dice",
  },
  {
    id: "asc_1_3",
    act: 1,
    missionNumber: 3,
    title: "Mind Link",
    briefing:
      "Join with fellow psionics. Together, your visions will guide you to victory.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy the machines",
        count: 3,
      },
    ],
    playerShips: ["ascendant_seraph", "ascendant_templar"],
    maxSquadSize: 2,
    enemies: [
      {
        shipId: "synth_interceptor_drone",
        count: 3,
        faction: "synthetic_collective",
      },
    ],
    rewards: { xp: 200, credits: 100 },
    newMechanic: "Prescience",
  },
  {
    id: "asc_1_4",
    act: 1,
    missionNumber: 4,
    title: "Evolution Path",
    briefing:
      "Your abilities grow. The Oracles grant you access to more powerful vessels.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Prove your worth",
        count: 4,
      },
    ],
    playerShips: ["ascendant_seraph", "ascendant_templar", "ascendant_oracle"],
    maxSquadSize: 2,
    enemies: [
      {
        shipId: "synth_drone",
        count: 3,
        faction: "synthetic_collective",
        hullScale: 0.7,
      },
      {
        shipId: "synth_hunter",
        count: 1,
        faction: "synthetic_collective",
        isAce: true,
        hullScale: 0.7,
      },
    ],
    rewards: { xp: 250, credits: 150, unlocks: ["ascendant_oracle"] },
    newMechanic: "Ship Evolution",
  },
  {
    id: "asc_1_5",
    act: 1,
    missionNumber: 5,
    title: "The Convergence",
    briefing:
      "Multiple timelines converge. Many enemies approach. You have seen this moment.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Eliminate all threats",
        count: 6,
      },
    ],
    playerShips: ["ascendant_seraph", "ascendant_templar", "ascendant_oracle"],
    maxSquadSize: 3,
    enemies: [
      { shipId: "synth_drone", count: 3, faction: "synthetic_collective" },
      { shipId: "corsair_talon", count: 3, faction: "void_corsairs" },
    ],
    rewards: { xp: 300, credits: 200, unlocks: ["ascendant_avatar"] },
  },

  // Act II (5 missions)
  {
    id: "asc_2_1",
    act: 2,
    missionNumber: 6,
    title: "Sacred Artifact",
    briefing:
      "An ancient artifact has been located. It must be recovered for the Empire.",
    objectives: [
      { id: "capture", type: "capture", description: "Secure the artifact" },
      {
        id: "kill",
        type: "eliminate",
        description: "Defeat guardians",
        count: 4,
      },
    ],
    playerShips: [
      "ascendant_seraph",
      "ascendant_templar",
      "ascendant_oracle",
      "ascendant_avatar",
    ],
    maxSquadSize: 4,
    enemies: [
      { shipId: "synth_hunter", count: 4, faction: "synthetic_collective" },
    ],
    rewards: { xp: 350, credits: 250 },
  },
  {
    id: "asc_2_2",
    act: 2,
    missionNumber: 7,
    title: "Heretic Purge",
    briefing: "Heretics deny the Prophecy. They must be eliminated.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Purge the heretics",
        count: 6,
      },
    ],
    playerShips: [
      "ascendant_seraph",
      "ascendant_templar",
      "ascendant_oracle",
      "ascendant_avatar",
    ],
    maxSquadSize: 4,
    enemies: [
      { shipId: "confed_falcon", count: 3, faction: "free_confederation" },
      { shipId: "confed_kestrel", count: 3, faction: "free_confederation" },
    ],
    rewards: { xp: 400, credits: 300 },
  },
  {
    id: "asc_2_3",
    act: 2,
    missionNumber: 8,
    title: "Vision Quest",
    briefing: "The Oracles send you on a sacred mission. Trust in the visions.",
    objectives: [
      {
        id: "survive",
        type: "survive",
        description: "Survive the trial",
        timeLimit: 150,
      },
      {
        id: "kill",
        type: "eliminate",
        description: "Overcome the challenge",
        count: 5,
      },
    ],
    playerShips: ["ascendant_seraph", "ascendant_templar"],
    maxSquadSize: 3,
    enemies: [
      {
        shipId: "terran_raptor",
        count: 3,
        faction: "terran_hegemony",
        spawnDelay: 30000,
      },
      {
        shipId: "confed_kestrel",
        count: 2,
        faction: "free_confederation",
        spawnDelay: 60000,
      },
    ],
    rewards: { xp: 450, credits: 350 },
  },
  {
    id: "asc_2_4",
    act: 2,
    missionNumber: 9,
    title: "Temple Defense",
    briefing:
      "The Sacred Temple is under attack by machines. It must not fall.",
    objectives: [
      { id: "defend", type: "defend", description: "Protect the Temple" },
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy attackers",
        count: 8,
      },
    ],
    playerShips: [
      "ascendant_seraph",
      "ascendant_templar",
      "ascendant_oracle",
      "ascendant_avatar",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "synth_drone", count: 4, faction: "synthetic_collective" },
      {
        shipId: "synth_interceptor_drone",
        count: 2,
        faction: "synthetic_collective",
        spawnDelay: 45000,
      },
      {
        shipId: "synth_devastator",
        count: 2,
        faction: "synthetic_collective",
        spawnDelay: 90000,
      },
    ],
    rewards: { xp: 500, credits: 400 },
  },
  {
    id: "asc_2_5",
    act: 2,
    missionNumber: 10,
    title: "Machine God",
    briefing:
      "The Collective has created something... wrong. It must be destroyed.",
    objectives: [
      { id: "kill", type: "eliminate", description: "Destroy the abomination" },
    ],
    playerShips: [
      "ascendant_seraph",
      "ascendant_templar",
      "ascendant_oracle",
      "ascendant_avatar",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "synth_drone", count: 4, faction: "synthetic_collective" },
      {
        shipId: "synth_devastator",
        count: 1,
        faction: "synthetic_collective",
        isBoss: true,
      },
    ],
    rewards: { xp: 600, credits: 500 },
  },

  // Act III (5 missions)
  {
    id: "asc_3_1",
    act: 3,
    missionNumber: 11,
    title: "Crusade Begins",
    briefing: "The time of the Great Crusade is upon us. Spread the faith.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Convert or destroy",
        count: 10,
      },
    ],
    playerShips: [
      "ascendant_seraph",
      "ascendant_templar",
      "ascendant_oracle",
      "ascendant_avatar",
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
    id: "asc_3_2",
    act: 3,
    missionNumber: 12,
    title: "The Dark Vision",
    briefing:
      "A terrible vision has come. Great darkness approaches. You must prevent it.",
    objectives: [
      {
        id: "assassinate",
        type: "assassinate",
        description: "Eliminate the catalyst",
      },
      { id: "survive", type: "survive", description: "Escape the void" },
    ],
    playerShips: ["ascendant_seraph", "ascendant_templar", "ascendant_oracle"],
    maxSquadSize: 4,
    enemies: [
      { shipId: "synth_hunter", count: 4, faction: "synthetic_collective" },
      {
        shipId: "synth_devastator",
        count: 1,
        faction: "synthetic_collective",
        isAce: true,
      },
    ],
    rewards: { xp: 750, credits: 650 },
  },
  {
    id: "asc_3_3",
    act: 3,
    missionNumber: 13,
    title: "Alliance of Faith",
    briefing: "Some organics accept the faith. Protect them from the machines.",
    objectives: [
      { id: "defend", type: "defend", description: "Protect the faithful" },
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy machine aggressors",
        count: 8,
      },
    ],
    playerShips: [
      "ascendant_seraph",
      "ascendant_templar",
      "ascendant_oracle",
      "ascendant_avatar",
    ],
    maxSquadSize: 5,
    enemies: [
      { shipId: "synth_drone", count: 4, faction: "synthetic_collective" },
      {
        shipId: "synth_interceptor_drone",
        count: 4,
        faction: "synthetic_collective",
      },
    ],
    rewards: { xp: 800, credits: 700 },
  },
  {
    id: "asc_3_4",
    act: 3,
    missionNumber: 14,
    title: "Final Revelation",
    briefing:
      "The ultimate prophecy reveals itself. All paths lead to this moment.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Defeat the enemies of destiny",
        count: 10,
      },
    ],
    playerShips: [
      "ascendant_seraph",
      "ascendant_templar",
      "ascendant_oracle",
      "ascendant_avatar",
    ],
    maxSquadSize: 6,
    enemies: [
      {
        shipId: "synth_interceptor_drone",
        count: 4,
        faction: "synthetic_collective",
      },
      { shipId: "synth_hunter", count: 4, faction: "synthetic_collective" },
      {
        shipId: "synth_devastator",
        count: 2,
        faction: "synthetic_collective",
        isAce: true,
      },
    ],
    rewards: { xp: 900, credits: 800 },
  },
  {
    id: "asc_3_5",
    act: 3,
    missionNumber: 15,
    title: "Ascension",
    briefing:
      "The prophecy is fulfilled. Ascend to your destiny. Destroy all who stand in your way.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Complete the Ascension",
        count: 12,
      },
    ],
    playerShips: [
      "ascendant_seraph",
      "ascendant_templar",
      "ascendant_oracle",
      "ascendant_avatar",
    ],
    maxSquadSize: 6,
    enemies: [
      {
        shipId: "terran_bastion",
        count: 3,
        faction: "terran_hegemony",
        hullScale: 0.7,
      },
      {
        shipId: "confed_phoenix",
        count: 3,
        faction: "free_confederation",
        hullScale: 0.7,
      },
      {
        shipId: "synth_devastator",
        count: 3,
        faction: "synthetic_collective",
        hullScale: 0.7,
      },
      {
        shipId: "corsair_reaver",
        count: 3,
        faction: "void_corsairs",
        hullScale: 0.7,
      },
    ],
    rewards: { xp: 1000, credits: 1000 },
  },
];
