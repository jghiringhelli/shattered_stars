/**
 * Terran Hegemony — "The Iron Fist", Act II (missions 6-10).
 * Story, squad, enemies, rewards and debriefs; scripted beats, objective
 * geometry, hazards and bonus objectives live in ../designs/.
 */

import type { CampaignMission } from "../campaignTypes";

export const HEGEMONY_ACT2_MISSIONS: CampaignMission[] = [
  {
    id: "heg_2_1",
    act: 2,
    missionNumber: 6,
    title: "Supply Convoy",
    briefing:
      "Escort a vital supply convoy through contested space. Corsair raiders have been active in this sector.",
    objectives: [
      {
        id: "escort",
        type: "escort",
        description: "Protect the convoy",
        target: "Transport Alpha",
      },
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy attackers",
        count: 5,
      },
    ],
    playerShips: ["terran_viper", "terran_raptor", "terran_centurion"],
    maxSquadSize: 3,
    enemies: [
      { shipId: "corsair_blade", count: 3, faction: "void_corsairs" },
      {
        shipId: "corsair_marauder",
        count: 2,
        faction: "void_corsairs",
        spawnDelay: 30000,
      },
    ],
    rewards: { xp: 350, credits: 250 },
    debrief: [
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Convoy secured. Good work keeping the formation, Striker.",
        mood: "proud",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "I learn from my mistakes. Sometimes.",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "The contraband the Corsairs were running wasn't standard piracy hardware. These were military-grade plasma relays. Hegemony specifications.",
        mood: "urgent",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Hegemony weapons? In Corsair hands?",
        mood: "urgent",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "The manifest points to a three-party chain. Someone inside the Hegemony is supplying both the raiders AND the Collective.",
        mood: "grim",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "That's treason.",
        mood: "grim",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Whisper, how reliable is this intel?",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "I verified it twice. This is real, Commander. Whoever is doing this has been at it for months.",
        mood: "solemn",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "We report directly to the Admiral. No comm channels. In person only.",
        mood: "grim",
      },
    ],
  },
  {
    id: "heg_2_2",
    act: 2,
    missionNumber: 7,
    title: "Drone Swarm",
    briefing:
      "The Synthetic Collective has deployed a drone swarm near our outpost. Eliminate the threat before they overwhelm our defenses.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy all drones",
        count: 8,
      },
      {
        id: "defend",
        type: "defend",
        description: "Protect the outpost",
        target: "Outpost Gamma",
      },
    ],
    playerShips: [
      "terran_viper",
      "terran_raptor",
      "terran_centurion",
      "terran_thunderbolt",
    ],
    maxSquadSize: 4,
    enemies: [
      { shipId: "synth_drone", count: 6, faction: "synthetic_collective" },
      {
        shipId: "synth_interceptor_drone",
        count: 2,
        faction: "synthetic_collective",
      },
    ],
    rewards: { xp: 400, credits: 300, unlocks: ["terran_thunderbolt"] },
    debrief: [
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Outpost Gamma holding. All drones destroyed.",
        mood: "neutral",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Whisper — your systems, how's your shielding?",
        mood: "urgent",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Compromised. I took a hit protecting Striker's six. I'm fine.",
        mood: "neutral",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "That was my fault. I'm sorry, Whisper.",
        mood: "solemn",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Forget it. The Collective's attack vector was pre-programmed with our patrol route. Our classified patrol route.",
        mood: "urgent",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Someone fed them our schedule.",
        mood: "grim",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "The same someone feeding equipment to the Corsairs. Commander — this is internal. Deep internal.",
        mood: "grim",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "I don't want to believe that.",
        mood: "solemn",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Neither do I. But I will not let it stand. Not in my Navy. Not in my squadron's sector.",
        mood: "proud",
      },
    ],
  },
  {
    id: "heg_2_3",
    act: 2,
    missionNumber: 8,
    isBranch: true,
    branchTag: "ELIMINATE",
    title: "Ace Hunt",
    briefing:
      "Intelligence has located a notorious Confederation ace pilot. Eliminate this high-value target to cripple enemy morale.",
    objectives: [
      {
        id: "assassinate",
        type: "assassinate",
        description: "Destroy Commander Phoenix",
        target: "confed_hawk",
      },
    ],
    playerShips: ["terran_raptor", "terran_centurion"],
    maxSquadSize: 3,
    enemies: [
      { shipId: "confed_falcon", count: 2, faction: "free_confederation" },
      {
        shipId: "confed_hawk",
        count: 1,
        faction: "free_confederation",
        isAce: true,
        isBoss: true,
      },
    ],
    rewards: { xp: 500, credits: 400 },
    debrief: [
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Phoenix is down. We... we got her.",
        mood: "solemn",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "She was protecting her people. I want that noted in the report.",
        mood: "solemn",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "She transmitted a message before we engaged. I captured it.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "What did she say?",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: '"IRON ACTUAL — you\'re hunting the wrong enemy. The real threat is inside your walls. Iron Fist is being used."',
        mood: "urgent",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "She could have said anything to throw us off.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "She flew into three of us knowing she'd lose. That's not a diversion. That's a warning.",
        mood: "solemn",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "I believe her, Commander.",
        mood: "solemn",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "...So do I. Whisper — I want everything you have on the supply chain. All of it. Tonight.",
        mood: "urgent",
      },
    ],
  },
  {
    id: "heg_2_3b",
    act: 2,
    missionNumber: 8,
    isBranch: true,
    branchTag: "DEFECTION",
    title: "The Defection",
    briefing:
      "Phoenix is requesting a covert rendezvous. She says she has proof of a conspiracy inside the Hegemony. This could be a trap — or the break we've been looking for.",
    objectives: [
      {
        id: "escort",
        type: "escort",
        description: "Escort Phoenix to safety",
        target: "confed_hawk",
      },
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy pursuing Hegemony loyalists",
        count: 4,
      },
    ],
    playerShips: ["terran_raptor", "terran_centurion"],
    maxSquadSize: 3,
    enemies: [
      { shipId: "terran_viper", count: 3, faction: "terran_hegemony" },
      {
        shipId: "terran_centurion",
        count: 1,
        faction: "terran_hegemony",
        isAce: true,
      },
    ],
    rewards: { xp: 480, credits: 380, unlocks: ["confed_hawk"] },
    debrief: [
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Phoenix. You risked your ship. Your career. Why?",
        mood: "solemn",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "She risked a lot more than that. Those were Hegemony loyalists! Someone ordered them to silence her.",
        mood: "urgent",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "The data she brought — supply manifests, encrypted orders. There's a name at the top of every document.",
        mood: "grim",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Vance.",
        mood: "grim",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Admiral Vance. He's been using Iron Fist as his personal hammer. Every mission we flew — staged intelligence.",
        mood: "grim",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "We were killing people for a conspiracy and didn't even know it.",
        mood: "solemn",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Phoenix — you could have stayed quiet. Why come to us?",
        mood: "solemn",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Because we were the only ones left who weren't already his.",
        mood: "grim",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Then we end this. All of us. Together.",
        mood: "proud",
      },
    ],
  },
  {
    id: "heg_2_4",
    act: 2,
    missionNumber: 9,
    title: "Station Defense",
    briefing:
      "Our orbital station is under attack. Hold the line until reinforcements arrive.",
    objectives: [
      {
        id: "survive",
        type: "survive",
        description: "Survive for 3 minutes",
        timeLimit: 180,
      },
      { id: "defend", type: "defend", description: "Protect Station Omega" },
    ],
    playerShips: [
      "terran_viper",
      "terran_raptor",
      "terran_centurion",
      "terran_thunderbolt",
    ],
    maxSquadSize: 4,
    enemies: [
      { shipId: "corsair_blade", count: 4, faction: "void_corsairs" },
      {
        shipId: "corsair_marauder",
        count: 2,
        faction: "void_corsairs",
        spawnDelay: 60000,
      },
      {
        shipId: "corsair_phantom",
        count: 2,
        faction: "void_corsairs",
        spawnDelay: 120000,
      },
    ],
    rewards: { xp: 450, credits: 350 },
    debrief: [
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Station OMEGA is holding! Corsairs are retreating.",
        mood: "proud",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Outstanding flying, Striker. You bought us the time we needed.",
        mood: "proud",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "I've done this before. Different uniform, same enemy.",
        mood: "solemn",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "...Striker. The Corsairs. You know them.",
        mood: "neutral",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "I used to run with them. Before Chen gave me a reason to be something better. That's all you're getting.",
        mood: "solemn",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "That's all I need. You stood between them and the station. That's who you are now.",
        mood: "proud",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "The attack was perfectly timed with our relief rotation. Someone knew exactly when we'd be short-crewed.",
        mood: "urgent",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "The leak is someone in Command rotation. Flight scheduling access.",
        mood: "grim",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "I know who has that access. I need two more missions worth of proof.",
        mood: "grim",
      },
    ],
  },
  {
    id: "heg_2_5",
    act: 2,
    missionNumber: 10,
    title: "The Mothership",
    briefing:
      "A Collective Mothership has entered our territory. Lead the assault to disable it before it deploys more drones.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy the Mothership",
        target: "Collective Mothership",
      },
    ],
    playerShips: [
      "terran_viper",
      "terran_raptor",
      "terran_centurion",
      "terran_thunderbolt",
    ],
    maxSquadSize: 5,
    enemies: [
      {
        shipId: "synth_drone",
        count: 6,
        faction: "synthetic_collective",
        hullScale: 0.7,
      },
      {
        shipId: "synth_nexus",
        count: 1,
        faction: "synthetic_collective",
        isBoss: true,
        hullScale: 0.7,
      },
    ],
    rewards: { xp: 600, credits: 500 },
    debrief: [
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Collective Mothership destroyed. Iron Fist victorious.",
        mood: "proud",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "HAH! How do you like THAT, you chrome pile of—",
        mood: "proud",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "I have the logs from the Mothership's comm core. They were receiving autonomous coordination signals. Hegemony-grade encryption.",
        mood: "urgent",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "A Hegemony officer is commanding the Collective? That's war.",
        mood: "grim",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Admiral Vance. Fleet Intelligence. He's been running them all — Corsairs, Collective, the Confederation ace. All of it.",
        mood: "grim",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Vance. He authorized our patrol routes. He approved every mission briefing.",
        mood: "grim",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "We've been hunting his enemies for him.",
        mood: "solemn",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Tell me we're going to burn him.",
        mood: "urgent",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "We're going to END this. But Iron Fist needs to grow into what this fight demands.",
        mood: "solemn",
      },
      {
        speaker: "COMMAND",
        portraitKey: "portrait_command",
        text: "Commander Chen. Command acknowledges your findings. You are authorized to proceed — at your discretion.",
        mood: "neutral",
      },
    ],
    evolutionChoice: {
      triggerMissionId: "heg_2_5",
      promptText:
        "The enemy is revealed. The final war begins. Iron Fist must become something greater. Choose your path.",
      optionA: {
        id: "apex_striker",
        label: "APEX STRIKER",
        description:
          "Push your current ship to its absolute limits. Master-class modifications — the ultimate precision weapon. +1 Hull, +1 Attack, +1 Shields.",
        keepCurrentShip: true,
        statBonuses: { hull: 1, attack: 1, shields: 1 },
        grantAbilityId: "coordinated_assault",
        flavorText:
          '"The blade that has struck a thousand times is more dangerous than the sword never drawn." — Iron Fist motto',
      },
      optionB: {
        id: "iron_command",
        label: "IRON COMMAND",
        description:
          "Transfer to the Terran Vindicator — a command battlecruiser. Lead the final assault from the front. +2 Hull, +1 Attack.",
        keepCurrentShip: false,
        newShipId: "terran_vindicator",
        statBonuses: { hull: 2, attack: 1 },
        grantAbilityId: "inspiring_presence",
        flavorText:
          '"One ship with the right commander is worth a fleet without one." — Admiral Vasquez, last words',
      },
    },
  },
];
