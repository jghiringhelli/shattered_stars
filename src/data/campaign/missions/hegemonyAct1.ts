/**
 * Terran Hegemony — "The Iron Fist", Act I (missions 1-5).
 * Story, squad, enemies, rewards and debriefs; scripted beats, objective
 * geometry, hazards and bonus objectives live in ../designs/.
 */

import type { CampaignMission } from "../campaignTypes";

export const HEGEMONY_ACT1_MISSIONS: CampaignMission[] = [
  {
    id: "heg_1_1",
    act: 1,
    missionNumber: 1,
    title: "Academy Training",
    briefing:
      "Welcome to the Hegemony Naval Academy, cadet. Today you will learn the basics of starfighter control. Navigate through the training course and demonstrate your piloting skills.",
    objectives: [
      {
        id: "nav",
        type: "survive",
        description: "Complete navigation course",
        timeLimit: 120,
      },
    ],
    playerShips: ["terran_viper"],
    maxSquadSize: 1,
    enemies: [],
    rewards: { xp: 100, credits: 50 },
    newMechanic: "Movement Charts",
    debrief: [
      {
        speaker: "COMMAND",
        portraitKey: "portrait_command",
        text: "Welcome to Hegemony Delta Station, pilot. You're assigned to Iron Fist Squadron. Try not to crash.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Iron Fist. I like the sound of that. Gives us something to live up to.",
        mood: "proud",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Can we stop naming things and START flying? I didn't join the Navy to give speeches.",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "You two are going to be the death of me. Commander Chen, please — they're watching.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "They're right, Whisper. Let's show them what Iron Fist can do. Navigation course — begin.",
        mood: "proud",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "NOW that is what I'm talking about. Last one through the pattern buys drinks.",
        mood: "proud",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "...I will not be buying drinks.",
        mood: "neutral",
      },
    ],
  },
  {
    id: "heg_1_2",
    act: 1,
    missionNumber: 2,
    title: "First Blood",
    briefing:
      "A pirate raider has been spotted near the training grounds. This is your first live combat exercise. Engage and destroy the hostile.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy the pirate raider",
        count: 1,
      },
    ],
    playerShips: ["terran_viper"],
    maxSquadSize: 1,
    enemies: [{ shipId: "corsair_blade", count: 1, faction: "void_corsairs" }],
    rewards: { xp: 150, credits: 75 },
    newMechanic: "Combat Dice",
    debrief: [
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Target down. Nice clean shot.",
        mood: "neutral",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "First kill. Feels different than the sims, doesn't it, Commander?",
        mood: "solemn",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "It does. Remember that feeling. We're not playing games anymore.",
        mood: "solemn",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "I pulled the flight data from that raider before we engaged. The timing of their approach...",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "What about it?",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "They were waiting for us. Someone told them we'd be here.",
        mood: "urgent",
      },
      {
        speaker: "COMMAND",
        portraitKey: "portrait_command",
        text: "Corsairs don't plan that far ahead. File your report, soldier. Dismissed.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "File it anyway, Whisper. I want to see those nav logs.",
        mood: "neutral",
      },
    ],
  },
  {
    id: "heg_1_3",
    act: 1,
    missionNumber: 3,
    isBranch: true,
    branchTag: "TEAMWORK",
    title: "Wing Formation",
    briefing:
      "You have been assigned a wingman. Learn to fly in formation and coordinate attacks. The Hegemony's strength lies in disciplined teamwork.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy pirate fighters",
        count: 3,
      },
      {
        id: "survive",
        type: "survive",
        description: "Keep your wingman alive",
        optional: true,
        xpBonus: 50,
      },
    ],
    playerShips: ["terran_viper", "terran_raptor"],
    maxSquadSize: 2,
    enemies: [{ shipId: "corsair_blade", count: 3, faction: "void_corsairs" }],
    rewards: { xp: 200, credits: 100, unlocks: ["terran_centurion"] },
    newMechanic: "Formation Tactics",
    debrief: [
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Striker — your formation position. You were fifty meters out of bounds during the engagement.",
        mood: "neutral",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Fifty meters? I was HUNTING, Whisper. I tagged two of them.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "And nearly got the third on your tail while I was out of position to help. You're not flying solo anymore.",
        mood: "urgent",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "With respect, Commander, tight formation kills aren't something I trained for.",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Strange. The pirates adjusted their vector the moment Striker broke — as if they knew he would.",
        mood: "urgent",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "You're saying someone predicted our tactics?",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "I'm saying this wasn't random piracy. There's a pattern I can't explain yet.",
        mood: "solemn",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Alright... I may have been reckless. Won't happen again, Commander.",
        mood: "solemn",
      },
    ],
  },
  {
    id: "heg_1_3b",
    act: 1,
    missionNumber: 3,
    isBranch: true,
    branchTag: "COVERT",
    title: "Shadow Strike",
    briefing:
      "Command has a different assignment for you — solo covert reconnaissance. Track the Corsair coordination pattern before they go dark. No wingman, no backup.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Eliminate Corsair scout ships",
        count: 3,
      },
      {
        id: "survive",
        type: "survive",
        description: "Return without triggering an alarm",
        optional: true,
        xpBonus: 75,
      },
    ],
    playerShips: ["terran_viper"],
    maxSquadSize: 1,
    enemies: [
      { shipId: "corsair_fang", count: 2, faction: "void_corsairs" },
      { shipId: "corsair_marauder", count: 1, faction: "void_corsairs" },
    ],
    rewards: { xp: 250, credits: 150, unlocks: ["terran_raptor"] },
    newMechanic: "Solo Operations",
    debrief: [
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Mission complete. Solo. Clean run. That's some serious flying.",
        mood: "proud",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "The recon data you pulled — this isn't a raiding party. The Corsairs have a timetable.",
        mood: "urgent",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "A timetable for what?",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "I don't know yet. But it's coordinated with someone inside. Someone with fleet-level intel.",
        mood: "solemn",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "You're saying we have a leak.",
        mood: "grim",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "I'm saying you need to act like we do. Quietly. For now.",
        mood: "solemn",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Good work. You just gave us a head start. Let's make it count.",
        mood: "neutral",
      },
    ],
  },
  {
    id: "heg_1_4",
    act: 1,
    missionNumber: 4,
    title: "Field Promotion",
    briefing:
      "Your performance has earned you access to advanced fighters. Choose your specialization path and take command of an upgraded vessel.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy insurgent patrol",
        count: 4,
      },
    ],
    playerShips: ["terran_raptor", "terran_centurion"],
    maxSquadSize: 2,
    enemies: [
      { shipId: "confed_falcon", count: 3, faction: "free_confederation" },
      {
        shipId: "confed_hawk",
        count: 1,
        faction: "free_confederation",
        isAce: true,
      },
    ],
    rewards: { xp: 250, credits: 150, unlocks: ["terran_centurion"] },
    newMechanic: "Ship Evolution",
    debrief: [
      {
        speaker: "COMMAND",
        portraitKey: "portrait_command",
        text: "Congratulations, Commander Chen. Performance noted. Iron Fist gets access to the Mark IV Centurion effective immediately.",
        mood: "proud",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Understood, Admiral. The team's earned it.",
        mood: "proud",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "That Confederation ace — Commander Phoenix. Did you see how she flew? That wasn't standard doctrine.",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "I identified her from Fleet records. Callsign PHOENIX. Four combat tours. Decorated three times.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "And she let us drive her back. She could have ended this differently.",
        mood: "solemn",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "She was watching us. Studying how we fight.",
        mood: "urgent",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Great. An ace with a grudge. That's not terrifying at all.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Stay sharp. She'll be back.",
        mood: "solemn",
      },
    ],
  },
  {
    id: "heg_1_5",
    act: 1,
    missionNumber: 5,
    title: "Border Skirmish",
    briefing:
      "Multiple enemy contacts detected at the border. This is a full fleet engagement. Command your squadron and repel the invasion.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy all enemy ships",
        count: 6,
      },
    ],
    playerShips: ["terran_viper", "terran_raptor", "terran_centurion"],
    maxSquadSize: 3,
    enemies: [
      { shipId: "confed_falcon", count: 4, faction: "free_confederation" },
      { shipId: "synth_drone", count: 2, faction: "synthetic_collective" },
    ],
    rewards: { xp: 300, credits: 200 },
    debrief: [
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Border secure. Six contacts destroyed. Iron Fist is undefeated.",
        mood: "proud",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "THAT'S what I'm talking about! Drinks are on me tonight — for real this time.",
        mood: "proud",
      },
      {
        speaker: "COMMAND",
        portraitKey: "portrait_command",
        text: "Commander Chen. Excellent work. The Senate takes notice. You have a decision to make about your career path.",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Commander... something in the border traffic. The Confederation and Corsairs were coordinating their timing.",
        mood: "urgent",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Multi-faction coordination at the border? That's not random.",
        mood: "solemn",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "No. It isn't. I don't know what it means yet. I'm running the analysis.",
        mood: "neutral",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Can we worry about it AFTER we celebrate? Just once?",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Celebrate. But stay ready. Something's coming.",
        mood: "grim",
      },
    ],
    evolutionChoice: {
      triggerMissionId: "heg_1_5",
      promptText:
        "Iron Fist has proven itself. Command offers you a critical specialization path. Choose wisely — there is no going back.",
      optionA: {
        id: "iron_discipline",
        label: "IRON DISCIPLINE",
        description:
          "Master your current ship. Become a precision weapon — faster, sharper, deadlier alone. +1 Attack, +1 Agility.",
        keepCurrentShip: true,
        statBonuses: { attack: 1, agility: 1 },
        grantAbilityId: "dead_eye",
        flavorText:
          '"Perfection of a single blade is worth more than mediocrity in a hundred." — Terran Naval Doctrine',
      },
      optionB: {
        id: "the_vanguard",
        label: "THE VANGUARD",
        description:
          "Upgrade to the Terran Praetorian — a command-class gunship. Lead from strength. +1 Hull, +1 Shields.",
        keepCurrentShip: false,
        newShipId: "terran_praetorian",
        statBonuses: { hull: 1, shields: 1 },
        grantAbilityId: "squad_leader",
        flavorText:
          '"An admiral who leads the charge is worth ten admirals who lead from safety." — Admiral Vasquez, 2187',
      },
    },
  },
];
