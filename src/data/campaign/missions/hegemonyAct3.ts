/**
 * Terran Hegemony — "The Iron Fist", Act III (missions 11-15).
 * Story, squad, enemies, rewards and debriefs; scripted beats, objective
 * geometry, hazards and bonus objectives live in ../designs/.
 */

import type { CampaignMission } from "../campaignTypes";

export const HEGEMONY_ACT3_MISSIONS: CampaignMission[] = [
  {
    id: "heg_3_1",
    act: 3,
    missionNumber: 11,
    title: "Fleet Engagement",
    briefing:
      "Full-scale war has begun. Lead your squadron in a major fleet battle against the Confederation.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy enemy fleet",
        count: 10,
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
      { shipId: "confed_falcon", count: 5, faction: "free_confederation" },
      { shipId: "confed_hawk", count: 3, faction: "free_confederation" },
      { shipId: "confed_condor", count: 2, faction: "free_confederation" },
    ],
    rewards: { xp: 700, credits: 600 },
    debrief: [
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Ten contacts down. Fleet holds.",
        mood: "proud",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Vance has accelerated his timeline. He knows we're onto him.",
        mood: "urgent",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Good. Let him sweat.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "He's pulling his remaining agents. Burning evidence. Whoever we don't catch in the next two missions walks free.",
        mood: "grim",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Then we don't give him two missions. We end this in one.",
        mood: "urgent",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Patience, Striker. We're building the cage first. Then we let him step in it.",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Commander... for what it's worth. I'm glad we're the ones doing this. No one else would have seen it in time.",
        mood: "solemn",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "When did you get sentimental, Whisper?",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "I've always been sentimental. I just hide it better than you.",
        mood: "proud",
      },
    ],
  },
  {
    id: "heg_3_2",
    act: 3,
    missionNumber: 12,
    title: "Behind Enemy Lines",
    briefing: "Infiltrate enemy territory and destroy their supply depot.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy supply depot",
        target: "Supply Depot",
      },
      {
        id: "survive",
        type: "survive",
        description: "Escape before reinforcements",
      },
    ],
    playerShips: ["terran_viper", "terran_raptor"],
    maxSquadSize: 3,
    enemies: [
      {
        shipId: "confed_falcon",
        count: 4,
        faction: "free_confederation",
        hullScale: 0.7,
      },
      {
        shipId: "confed_hawk",
        count: 3,
        faction: "free_confederation",
        spawnDelay: 60000,
        hullScale: 0.7,
      },
    ],
    rewards: { xp: 650, credits: 550 },
    debrief: [
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "WHISPER, GET OUT OF THERE!",
        mood: "urgent",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "The depot is secured. I have the encryption keys. I'm extracting now.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Whisper — your shields are down to twelve percent. We're coming to you.",
        mood: "urgent",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Negative. Hold the extraction corridor. I'll make the rendezvous.",
        mood: "neutral",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "I swear to every star in this sector if you don't come back I'll haunt your records for eternity—",
        mood: "urgent",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "...I made the rendezvous. All pilots accounted for.",
        mood: "proud",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Never do that again.",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "I'll do it as many times as necessary. That's what Iron Fist is.",
        mood: "proud",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "She's right. That's what we are. God help us all.",
        mood: "solemn",
      },
    ],
  },
  {
    id: "heg_3_3",
    act: 3,
    missionNumber: 13,
    isBranch: true,
    branchTag: "REACTIVE",
    title: "Alliance Betrayal",
    briefing:
      "The Empire has broken our alliance. Defend against their surprise attack.",
    objectives: [
      { id: "survive", type: "survive", description: "Survive the ambush" },
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy attackers",
        count: 8,
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
      { shipId: "ascendant_seraph", count: 4, faction: "ascendant_empire" },
      { shipId: "ascendant_templar", count: 4, faction: "ascendant_empire" },
    ],
    rewards: { xp: 750, credits: 650 },
    debrief: [
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Ascendant forces are withdrawing. Hold your course — do not pursue.",
        mood: "urgent",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "They were supposed to be our flank cover! VANCE told them we were hostile!",
        mood: "grim",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "He burned our alliance from the inside. Used classified comm channels to stage a false flag.",
        mood: "grim",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "How many?",
        mood: "solemn",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Eight ships confirmed lost on both sides before the confusion cleared. Eight ships that didn't have to die.",
        mood: "grim",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "He's using us to start a war between factions. Weaken them all so he can take control.",
        mood: "grim",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Commander. The Ascendant commander sent us a private channel message after the engagement.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "What does it say?",
        mood: "neutral",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: '"Iron Fist — we see the truth now. One chance. Take it."',
        mood: "urgent",
      },
    ],
  },
  {
    id: "heg_3_3b",
    act: 3,
    missionNumber: 13,
    isBranch: true,
    branchTag: "PREEMPTIVE",
    title: "Iron Preemption",
    briefing:
      "Whisper has cracked Vance's timeline. We have hours before he triggers the Ascendant betrayal. Hit his loyalist fleet now — before the trap snaps shut.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy Vance's loyalist fleet",
        count: 8,
      },
      {
        id: "assassinate",
        type: "assassinate",
        description: "Eliminate Vance's fleet commander",
        target: "terran_vindicator",
        optional: true,
        xpBonus: 150,
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
      { shipId: "terran_viper", count: 4, faction: "terran_hegemony" },
      { shipId: "terran_centurion", count: 3, faction: "terran_hegemony" },
      {
        shipId: "terran_vindicator",
        count: 1,
        faction: "terran_hegemony",
        isAce: true,
        isBoss: true,
      },
    ],
    rewards: { xp: 800, credits: 700, unlocks: ["terran_vindicator"] },
    debrief: [
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Vance's fleet commander is down. His timetable is broken. The Ascendant betrayal never fires.",
        mood: "proud",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "We hit them before they could move. They didn't see us coming.",
        mood: "proud",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "The Ascendant commander is on our channel. They received Vance's false orders — and they rejected them.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "They chose not to fire.",
        mood: "solemn",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "They knew it was wrong. We just gave them the time to realize it.",
        mood: "neutral",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Eight ships saved. Two factions not at war. I'll take that outcome.",
        mood: "proud",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Vance is going to run. One last push — we end this before he can disappear.",
        mood: "urgent",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "I've locked his coordinates. He has nowhere left to hide.",
        mood: "grim",
      },
    ],
  },
  {
    id: "heg_3_4",
    act: 3,
    missionNumber: 14,
    title: "Capital Strike",
    briefing:
      "Lead an assault on the enemy capital ship. This could turn the tide of war.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy the Dreadnought",
        target: "CNS Freedom",
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
      { shipId: "confed_falcon", count: 4, faction: "free_confederation" },
      {
        shipId: "confed_albatross",
        count: 1,
        faction: "free_confederation",
        isBoss: true,
      },
    ],
    rewards: { xp: 800, credits: 700 },
    debrief: [
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "CNS Freedom disabled. Strike complete.",
        mood: "proud",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "VANCE is broadcasting. He's trying to blame the attack on the Confederation.",
        mood: "grim",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "I'm overriding his broadcast with our evidence packet. Every fleet channel. Every encrypted log. Authenticated.",
        mood: "neutral",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "That is EXTREMELY satisfying to watch.",
        mood: "proud",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Vance. You had the best fleet in five sectors. You had my trust. You sold it for a throne no one will let you sit on.",
        mood: "grim",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "He's in custody. Fleet Intelligence is receiving him now.",
        mood: "neutral",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Is it over, Whisper?",
        mood: "solemn",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "The conspiracy is over. The war he started... that's going to take longer to mend.",
        mood: "solemn",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "One last op. Let's finish it.",
        mood: "proud",
      },
    ],
  },
  {
    id: "heg_3_5",
    act: 3,
    missionNumber: 15,
    title: "Final Push",
    briefing:
      "Victory is within reach. Crush the remaining resistance and secure total dominance.",
    objectives: [
      {
        id: "kill",
        type: "eliminate",
        description: "Destroy all enemy forces",
        count: 12,
      },
    ],
    playerShips: [
      "terran_viper",
      "terran_raptor",
      "terran_centurion",
      "terran_thunderbolt",
    ],
    maxSquadSize: 6,
    enemies: [
      { shipId: "confed_falcon", count: 4, faction: "free_confederation" },
      { shipId: "confed_hawk", count: 4, faction: "free_confederation" },
      { shipId: "confed_condor", count: 2, faction: "free_confederation" },
      {
        shipId: "confed_albatross",
        count: 2,
        faction: "free_confederation",
        isAce: true,
      },
    ],
    rewards: { xp: 1000, credits: 1000 },
    debrief: [
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "All remaining hostile forces are down. Sector is clear.",
        mood: "proud",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Iron Fist. Undefeated. How about that.",
        mood: "proud",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Seventeen missions. Twelve months. One conspiracy dismantled and one war averted.",
        mood: "solemn",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "We're not done. There are four other factions. Whatever Vance started, the fractures remain.",
        mood: "solemn",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "Then we mend them. That's what we do.",
        mood: "proud",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Commander Chen — Fleet Command has announced. You've been promoted to Admiral.",
        mood: "proud",
      },
      {
        speaker: "STRIKER",
        portraitKey: "portrait_striker",
        text: "ADMIRAL CHEN! There it is!",
        mood: "proud",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "Iron Fist Squadron is redesignated as the First Response Wing. Striker — your own command. Whisper — your own unit.",
        mood: "proud",
      },
      {
        speaker: "WHISPER",
        portraitKey: "portrait_whisper",
        text: "Sir? You're breaking up the squadron?",
        mood: "solemn",
      },
      {
        speaker: "ADMIRAL CHEN",
        portraitKey: "portrait_admiral_chen",
        text: "No. I'm making it bigger. Iron Fist never flies alone. Not today. Not ever.",
        mood: "proud",
      },
    ],
  },
];
