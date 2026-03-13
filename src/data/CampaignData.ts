/**
 * Campaign Data
 *
 * Mission definitions for all 5 faction campaigns.
 * Each faction has a unique storyline with 25 missions across 4 acts.
 */

import type { FactionId } from '../config';

export interface MissionObjective {
  id: string;
  type: 'eliminate' | 'survive' | 'escort' | 'capture' | 'defend' | 'assassinate';
  description: string;
  target?: string;
  count?: number;
  timeLimit?: number; // seconds
  optional?: boolean;
  xpBonus?: number;
}

export interface MissionEnemy {
  shipId: string;
  count: number;
  faction: FactionId;
  isAce?: boolean;
  isBoss?: boolean;
  spawnDelay?: number; // ms
}

export interface MissionReward {
  xp: number;
  credits: number;
  unlocks?: string[]; // ship IDs or upgrade IDs
}

export interface DebriefLine {
  readonly speaker: string;      // e.g. "ADMIRAL CHEN"
  readonly portraitKey: string;  // Phaser texture key
  readonly text: string;         // max ~140 chars
  readonly mood?: 'neutral' | 'urgent' | 'solemn' | 'proud' | 'grim';
}

export interface EvolutionOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly keepCurrentShip: boolean;
  readonly newShipId?: string;
  readonly statBonuses: { hull?: number; shields?: number; attack?: number; agility?: number };
  readonly grantAbilityId: string;
  readonly flavorText: string;
}

export interface EvolutionChoiceData {
  readonly triggerMissionId: string;
  readonly promptText: string;
  readonly optionA: EvolutionOption;
  readonly optionB: EvolutionOption;
}

export interface CampaignMission {
  id: string;
  act: 1 | 2 | 3 | 4;
  missionNumber: number;
  title: string;
  briefing: string;
  objectives: MissionObjective[];
  playerShips: string[]; // Available ship IDs
  maxSquadSize: number;
  enemies: MissionEnemy[];
  rewards: MissionReward;
  newMechanic?: string;
  isUnlocked?: boolean;
  debrief?: readonly DebriefLine[];
  evolutionChoice?: EvolutionChoiceData;
  /** If true, this mission is one option in a branch pair sharing the same missionNumber */
  isBranch?: boolean;
  /** Short tag shown on the branch choice card (e.g. "AGGRESSIVE" | "COVERT") */
  branchTag?: string;
}

export interface FactionCampaign {
  factionId: FactionId;
  name: string;
  description: string;
  protagonist: string;
  missions: CampaignMission[];
}

// ============================================
// TERRAN HEGEMONY CAMPAIGN
// "The Iron Fist"
// ============================================

const TERRAN_HEGEMONY_MISSIONS: CampaignMission[] = [
  // Act I: The Convergence
  {
    id: 'heg_1_1',
    act: 1,
    missionNumber: 1,
    title: 'Academy Training',
    briefing: 'Welcome to the Hegemony Naval Academy, cadet. Today you will learn the basics of starfighter control. Navigate through the training course and demonstrate your piloting skills.',
    objectives: [
      { id: 'nav', type: 'survive', description: 'Complete navigation course', timeLimit: 120 },
    ],
    playerShips: ['terran_viper'],
    maxSquadSize: 1,
    enemies: [],
    rewards: { xp: 100, credits: 50 },
    newMechanic: 'Movement Charts',
    debrief: [
      { speaker: 'COMMAND', portraitKey: 'portrait_command', text: 'Welcome to Hegemony Delta Station, pilot. You\'re assigned to Iron Fist Squadron. Try not to crash.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Iron Fist. I like the sound of that. Gives us something to live up to.', mood: 'proud' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Can we stop naming things and START flying? I didn\'t join the Navy to give speeches.', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'You two are going to be the death of me. Commander Chen, please — they\'re watching.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'They\'re right, Whisper. Let\'s show them what Iron Fist can do. Navigation course — begin.', mood: 'proud' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'NOW that is what I\'m talking about. Last one through the pattern buys drinks.', mood: 'proud' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: '...I will not be buying drinks.', mood: 'neutral' },
    ],
  },
  {
    id: 'heg_1_2',
    act: 1,
    missionNumber: 2,
    title: 'First Blood',
    briefing: 'A pirate raider has been spotted near the training grounds. This is your first live combat exercise. Engage and destroy the hostile.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy the pirate raider', count: 1 },
    ],
    playerShips: ['terran_viper'],
    maxSquadSize: 1,
    enemies: [{ shipId: 'corsair_blade', count: 1, faction: 'void_corsairs' }],
    rewards: { xp: 150, credits: 75 },
    newMechanic: 'Combat Dice',
    debrief: [
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Target down. Nice clean shot.', mood: 'neutral' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'First kill. Feels different than the sims, doesn\'t it, Commander?', mood: 'solemn' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'It does. Remember that feeling. We\'re not playing games anymore.', mood: 'solemn' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'I pulled the flight data from that raider before we engaged. The timing of their approach...', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'What about it?', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'They were waiting for us. Someone told them we\'d be here.', mood: 'urgent' },
      { speaker: 'COMMAND', portraitKey: 'portrait_command', text: 'Corsairs don\'t plan that far ahead. File your report, soldier. Dismissed.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'File it anyway, Whisper. I want to see those nav logs.', mood: 'neutral' },
    ],
  },
  {
    id: 'heg_1_3',
    act: 1,
    missionNumber: 3,
    isBranch: true,
    branchTag: 'TEAMWORK',
    title: 'Wing Formation',
    briefing: 'You have been assigned a wingman. Learn to fly in formation and coordinate attacks. The Hegemony\'s strength lies in disciplined teamwork.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy pirate fighters', count: 3 },
      { id: 'survive', type: 'survive', description: 'Keep your wingman alive', optional: true, xpBonus: 50 },
    ],
    playerShips: ['terran_viper', 'terran_raptor'],
    maxSquadSize: 2,
    enemies: [{ shipId: 'corsair_blade', count: 3, faction: 'void_corsairs' }],
    rewards: { xp: 200, credits: 100, unlocks: ['terran_centurion'] },
    newMechanic: 'Formation Tactics',
    debrief: [
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Striker — your formation position. You were fifty meters out of bounds during the engagement.', mood: 'neutral' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Fifty meters? I was HUNTING, Whisper. I tagged two of them.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'And nearly got the third on your tail while I was out of position to help. You\'re not flying solo anymore.', mood: 'urgent' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'With respect, Commander, tight formation kills aren\'t something I trained for.', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Strange. The pirates adjusted their vector the moment Striker broke — as if they knew he would.', mood: 'urgent' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'You\'re saying someone predicted our tactics?', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'I\'m saying this wasn\'t random piracy. There\'s a pattern I can\'t explain yet.', mood: 'solemn' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Alright... I may have been reckless. Won\'t happen again, Commander.', mood: 'solemn' },
    ],
  },
  {
    id: 'heg_1_3b',
    act: 1,
    missionNumber: 3,
    isBranch: true,
    branchTag: 'COVERT',
    title: 'Shadow Strike',
    briefing: 'Command has a different assignment for you — solo covert reconnaissance. Track the Corsair coordination pattern before they go dark. No wingman, no backup.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Eliminate Corsair scout ships', count: 3 },
      { id: 'survive', type: 'survive', description: 'Return without triggering an alarm', optional: true, xpBonus: 75 },
    ],
    playerShips: ['terran_viper'],
    maxSquadSize: 1,
    enemies: [
      { shipId: 'corsair_fang', count: 2, faction: 'void_corsairs' },
      { shipId: 'corsair_marauder', count: 1, faction: 'void_corsairs' },
    ],
    rewards: { xp: 250, credits: 150, unlocks: ['terran_raptor'] },
    newMechanic: 'Solo Operations',
    debrief: [
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Mission complete. Solo. Clean run. That\'s some serious flying.', mood: 'proud' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'The recon data you pulled — this isn\'t a raiding party. The Corsairs have a timetable.', mood: 'urgent' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'A timetable for what?', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'I don\'t know yet. But it\'s coordinated with someone inside. Someone with fleet-level intel.', mood: 'solemn' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'You\'re saying we have a leak.', mood: 'grim' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'I\'m saying you need to act like we do. Quietly. For now.', mood: 'solemn' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Good work. You just gave us a head start. Let\'s make it count.', mood: 'neutral' },
    ],
  },
  {
    id: 'heg_1_4',
    act: 1,
    missionNumber: 4,
    title: 'Field Promotion',
    briefing: 'Your performance has earned you access to advanced fighters. Choose your specialization path and take command of an upgraded vessel.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy rebel patrol', count: 4 },
    ],
    playerShips: ['terran_raptor', 'terran_centurion'],
    maxSquadSize: 2,
    enemies: [
      { shipId: 'confed_falcon', count: 3, faction: 'free_confederation' },
      { shipId: 'confed_hawk', count: 1, faction: 'free_confederation', isAce: true },
    ],
    rewards: { xp: 250, credits: 150, unlocks: ['terran_centurion'] },
    newMechanic: 'Ship Evolution',
    debrief: [
      { speaker: 'COMMAND', portraitKey: 'portrait_command', text: 'Congratulations, Commander Chen. Performance noted. Iron Fist gets access to the Mark IV Centurion effective immediately.', mood: 'proud' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Understood, Admiral. The team\'s earned it.', mood: 'proud' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'That Confederation ace — Commander Phoenix. Did you see how she flew? That wasn\'t standard doctrine.', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'I identified her from Fleet records. Callsign PHOENIX. Four combat tours. Decorated three times.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'And she let us drive her back. She could have ended this differently.', mood: 'solemn' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'She was watching us. Studying how we fight.', mood: 'urgent' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Great. An ace with a grudge. That\'s not terrifying at all.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Stay sharp. She\'ll be back.', mood: 'solemn' },
    ],
  },
  {
    id: 'heg_1_5',
    act: 1,
    missionNumber: 5,
    title: 'Border Skirmish',
    briefing: 'Multiple enemy contacts detected at the border. This is a full fleet engagement. Command your squadron and repel the invasion.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy all enemy ships', count: 6 },
    ],
    playerShips: ['terran_viper', 'terran_raptor', 'terran_centurion'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'confed_falcon', count: 4, faction: 'free_confederation' },
      { shipId: 'synth_drone', count: 2, faction: 'synthetic_collective' },
    ],
    rewards: { xp: 300, credits: 200 },
    debrief: [
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Border secure. Six contacts destroyed. Iron Fist is undefeated.', mood: 'proud' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'THAT\'S what I\'m talking about! Drinks are on me tonight — for real this time.', mood: 'proud' },
      { speaker: 'COMMAND', portraitKey: 'portrait_command', text: 'Commander Chen. Excellent work. The Senate takes notice. You have a decision to make about your career path.', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Commander... something in the border traffic. The Confederation and Corsairs were coordinating their timing.', mood: 'urgent' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Multi-faction coordination at the border? That\'s not random.', mood: 'solemn' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'No. It isn\'t. I don\'t know what it means yet. I\'m running the analysis.', mood: 'neutral' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Can we worry about it AFTER we celebrate? Just once?', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Celebrate. But stay ready. Something\'s coming.', mood: 'grim' },
    ],
    evolutionChoice: {
      triggerMissionId: 'heg_1_5',
      promptText: 'Iron Fist has proven itself. Command offers you a critical specialization path. Choose wisely — there is no going back.',
      optionA: {
        id: 'iron_discipline',
        label: 'IRON DISCIPLINE',
        description: 'Master your current ship. Become a precision weapon — faster, sharper, deadlier alone. +1 Attack, +1 Agility.',
        keepCurrentShip: true,
        statBonuses: { attack: 1, agility: 1 },
        grantAbilityId: 'dead_eye',
        flavorText: '"Perfection of a single blade is worth more than mediocrity in a hundred." — Terran Naval Doctrine',
      },
      optionB: {
        id: 'the_vanguard',
        label: 'THE VANGUARD',
        description: 'Upgrade to the Terran Praetorian — a command-class gunship. Lead from strength. +1 Hull, +1 Shields.',
        keepCurrentShip: false,
        newShipId: 'terran_praetorian',
        statBonuses: { hull: 1, shields: 1 },
        grantAbilityId: 'squad_leader',
        flavorText: '"An admiral who leads the charge is worth ten admirals who lead from safety." — Admiral Vasquez, 2187',
      },
    },
  },

  // Act II: Rising Tensions
  {
    id: 'heg_2_1',
    act: 2,
    missionNumber: 6,
    title: 'Supply Convoy',
    briefing: 'Escort a vital supply convoy through contested space. Corsair raiders have been active in this sector.',
    objectives: [
      { id: 'escort', type: 'escort', description: 'Protect the convoy', target: 'Transport Alpha' },
      { id: 'kill', type: 'eliminate', description: 'Destroy attackers', count: 5 },
    ],
    playerShips: ['terran_viper', 'terran_raptor', 'terran_centurion'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'corsair_blade', count: 3, faction: 'void_corsairs' },
      { shipId: 'corsair_marauder', count: 2, faction: 'void_corsairs', spawnDelay: 30000 },
    ],
    rewards: { xp: 350, credits: 250 },
    debrief: [
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Convoy secured. Good work keeping the formation, Striker.', mood: 'proud' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'I learn from my mistakes. Sometimes.', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'The contraband the Corsairs were running wasn\'t standard piracy hardware. These were military-grade plasma relays. Hegemony specifications.', mood: 'urgent' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Hegemony weapons? In Corsair hands?', mood: 'urgent' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'The manifest points to a three-party chain. Someone inside the Hegemony is supplying both the raiders AND the Collective.', mood: 'grim' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'That\'s treason.', mood: 'grim' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Whisper, how reliable is this intel?', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'I verified it twice. This is real, Commander. Whoever is doing this has been at it for months.', mood: 'solemn' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'We report directly to the Admiral. No comm channels. In person only.', mood: 'grim' },
    ],
  },
  {
    id: 'heg_2_2',
    act: 2,
    missionNumber: 7,
    title: 'Drone Swarm',
    briefing: 'The Synthetic Collective has deployed a drone swarm near our outpost. Eliminate the threat before they overwhelm our defenses.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy all drones', count: 8 },
      { id: 'defend', type: 'defend', description: 'Protect the outpost', target: 'Outpost Gamma' },
    ],
    playerShips: ['terran_viper', 'terran_raptor', 'terran_centurion', 'terran_thunderbolt'],
    maxSquadSize: 4,
    enemies: [
      { shipId: 'synth_drone', count: 6, faction: 'synthetic_collective' },
      { shipId: 'synth_interceptor_drone', count: 2, faction: 'synthetic_collective' },
    ],
    rewards: { xp: 400, credits: 300, unlocks: ['terran_thunderbolt'] },
    debrief: [
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Outpost Gamma holding. All drones destroyed.', mood: 'neutral' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Whisper — your systems, how\'s your shielding?', mood: 'urgent' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Compromised. I took a hit protecting Striker\'s six. I\'m fine.', mood: 'neutral' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'That was my fault. I\'m sorry, Whisper.', mood: 'solemn' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Forget it. The Collective\'s attack vector was pre-programmed with our patrol route. Our classified patrol route.', mood: 'urgent' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Someone fed them our schedule.', mood: 'grim' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'The same someone feeding equipment to the Corsairs. Commander — this is internal. Deep internal.', mood: 'grim' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'I don\'t want to believe that.', mood: 'solemn' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Neither do I. But I will not let it stand. Not in my Navy. Not in my squadron\'s sector.', mood: 'proud' },
    ],
  },
  {
    id: 'heg_2_3',
    act: 2,
    missionNumber: 8,
    isBranch: true,
    branchTag: 'ELIMINATE',
    title: 'Ace Hunt',
    briefing: 'Intelligence has located a notorious Confederation ace pilot. Eliminate this high-value target to cripple enemy morale.',
    objectives: [
      { id: 'assassinate', type: 'assassinate', description: 'Destroy Commander Phoenix', target: 'confed_hawk' },
    ],
    playerShips: ['terran_raptor', 'terran_centurion'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'confed_falcon', count: 2, faction: 'free_confederation' },
      { shipId: 'confed_hawk', count: 1, faction: 'free_confederation', isAce: true, isBoss: true },
    ],
    rewards: { xp: 500, credits: 400 },
    debrief: [
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Phoenix is down. We... we got her.', mood: 'solemn' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'She was protecting her people. I want that noted in the report.', mood: 'solemn' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'She transmitted a message before we engaged. I captured it.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'What did she say?', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: '"IRON ACTUAL — you\'re hunting the wrong enemy. The real threat is inside your walls. Iron Fist is being used."', mood: 'urgent' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'She could have said anything to throw us off.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'She flew into three of us knowing she\'d lose. That\'s not a diversion. That\'s a warning.', mood: 'solemn' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'I believe her, Commander.', mood: 'solemn' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: '...So do I. Whisper — I want everything you have on the supply chain. All of it. Tonight.', mood: 'urgent' },
    ],
  },
  {
    id: 'heg_2_3b',
    act: 2,
    missionNumber: 8,
    isBranch: true,
    branchTag: 'DEFECTION',
    title: 'The Defection',
    briefing: 'Phoenix is requesting a covert rendezvous. She says she has proof of a conspiracy inside the Hegemony. This could be a trap — or the break we\'ve been looking for.',
    objectives: [
      { id: 'escort', type: 'escort', description: 'Escort Phoenix to safety', target: 'confed_hawk' },
      { id: 'kill', type: 'eliminate', description: 'Destroy pursuing Hegemony loyalists', count: 4 },
    ],
    playerShips: ['terran_raptor', 'terran_centurion'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'terran_viper', count: 3, faction: 'terran_hegemony' },
      { shipId: 'terran_centurion', count: 1, faction: 'terran_hegemony', isAce: true },
    ],
    rewards: { xp: 480, credits: 380, unlocks: ['confed_hawk'] },
    debrief: [
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Phoenix. You risked your ship. Your career. Why?', mood: 'solemn' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'She risked a lot more than that. Those were Hegemony loyalists! Someone ordered them to silence her.', mood: 'urgent' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'The data she brought — supply manifests, encrypted orders. There\'s a name at the top of every document.', mood: 'grim' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Vance.', mood: 'grim' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Admiral Vance. He\'s been using Iron Fist as his personal hammer. Every mission we flew — staged intelligence.', mood: 'grim' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'We were killing people for a conspiracy and didn\'t even know it.', mood: 'solemn' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Phoenix — you could have stayed quiet. Why come to us?', mood: 'solemn' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Because we were the only ones left who weren\'t already his.', mood: 'grim' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Then we end this. All of us. Together.', mood: 'proud' },
    ],
  },
  {
    id: 'heg_2_4',
    act: 2,
    missionNumber: 9,
    title: 'Station Defense',
    briefing: 'Our orbital station is under attack. Hold the line until reinforcements arrive.',
    objectives: [
      { id: 'survive', type: 'survive', description: 'Survive for 3 minutes', timeLimit: 180 },
      { id: 'defend', type: 'defend', description: 'Protect Station Omega' },
    ],
    playerShips: ['terran_viper', 'terran_raptor', 'terran_centurion', 'terran_thunderbolt'],
    maxSquadSize: 4,
    enemies: [
      { shipId: 'corsair_blade', count: 4, faction: 'void_corsairs' },
      { shipId: 'corsair_marauder', count: 2, faction: 'void_corsairs', spawnDelay: 60000 },
      { shipId: 'corsair_phantom', count: 2, faction: 'void_corsairs', spawnDelay: 120000 },
    ],
    rewards: { xp: 450, credits: 350 },
    debrief: [
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Station OMEGA is holding! Corsairs are retreating.', mood: 'proud' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Outstanding flying, Striker. You bought us the time we needed.', mood: 'proud' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'I\'ve done this before. Different uniform, same enemy.', mood: 'solemn' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: '...Striker. The Corsairs. You know them.', mood: 'neutral' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'I used to run with them. Before Chen gave me a reason to be something better. That\'s all you\'re getting.', mood: 'solemn' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'That\'s all I need. You stood between them and the station. That\'s who you are now.', mood: 'proud' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'The attack was perfectly timed with our relief rotation. Someone knew exactly when we\'d be short-crewed.', mood: 'urgent' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'The leak is someone in Command rotation. Flight scheduling access.', mood: 'grim' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'I know who has that access. I need two more missions worth of proof.', mood: 'grim' },
    ],
  },
  {
    id: 'heg_2_5',
    act: 2,
    missionNumber: 10,
    title: 'The Mothership',
    briefing: 'A Collective Mothership has entered our territory. Lead the assault to disable it before it deploys more drones.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy the Mothership', target: 'Collective Mothership' },
    ],
    playerShips: ['terran_viper', 'terran_raptor', 'terran_centurion', 'terran_thunderbolt'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'synth_drone', count: 6, faction: 'synthetic_collective' },
      { shipId: 'synth_nexus', count: 1, faction: 'synthetic_collective', isBoss: true },
    ],
    rewards: { xp: 600, credits: 500 },
    debrief: [
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Collective Mothership destroyed. Iron Fist victorious.', mood: 'proud' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'HAH! How do you like THAT, you chrome pile of—', mood: 'proud' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'I have the logs from the Mothership\'s comm core. They were receiving autonomous coordination signals. Hegemony-grade encryption.', mood: 'urgent' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'A Hegemony officer is commanding the Collective? That\'s war.', mood: 'grim' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Admiral Vance. Fleet Intelligence. He\'s been running them all — Corsairs, Collective, the Confederation ace. All of it.', mood: 'grim' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Vance. He authorized our patrol routes. He approved every mission briefing.', mood: 'grim' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'We\'ve been hunting his enemies for him.', mood: 'solemn' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Tell me we\'re going to burn him.', mood: 'urgent' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'We\'re going to END this. But Iron Fist needs to grow into what this fight demands.', mood: 'solemn' },
      { speaker: 'COMMAND', portraitKey: 'portrait_command', text: 'Commander Chen. Command acknowledges your findings. You are authorized to proceed — at your discretion.', mood: 'neutral' },
    ],
    evolutionChoice: {
      triggerMissionId: 'heg_2_5',
      promptText: 'The enemy is revealed. The final war begins. Iron Fist must become something greater. Choose your path.',
      optionA: {
        id: 'apex_striker',
        label: 'APEX STRIKER',
        description: 'Push your current ship to its absolute limits. Master-class modifications — the ultimate precision weapon. +1 Hull, +1 Attack, +1 Shields.',
        keepCurrentShip: true,
        statBonuses: { hull: 1, attack: 1, shields: 1 },
        grantAbilityId: 'coordinated_assault',
        flavorText: '"The blade that has struck a thousand times is more dangerous than the sword never drawn." — Iron Fist motto',
      },
      optionB: {
        id: 'iron_command',
        label: 'IRON COMMAND',
        description: 'Transfer to the Terran Vindicator — a command battlecruiser. Lead the final assault from the front. +2 Hull, +1 Attack.',
        keepCurrentShip: false,
        newShipId: 'terran_vindicator',
        statBonuses: { hull: 2, attack: 1 },
        grantAbilityId: 'inspiring_presence',
        flavorText: '"One ship with the right commander is worth a fleet without one." — Admiral Vasquez, last words',
      },
    },
  },

  // Act III: Galactic War
  {
    id: 'heg_3_1',
    act: 3,
    missionNumber: 11,
    title: 'Fleet Engagement',
    briefing: 'Full-scale war has begun. Lead your squadron in a major fleet battle against the Confederation.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy enemy fleet', count: 10 },
    ],
    playerShips: ['terran_viper', 'terran_raptor', 'terran_centurion', 'terran_thunderbolt'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'confed_falcon', count: 5, faction: 'free_confederation' },
      { shipId: 'confed_hawk', count: 3, faction: 'free_confederation' },
      { shipId: 'confed_condor', count: 2, faction: 'free_confederation' },
    ],
    rewards: { xp: 700, credits: 600 },
    debrief: [
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Ten contacts down. Fleet holds.', mood: 'proud' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Vance has accelerated his timeline. He knows we\'re onto him.', mood: 'urgent' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Good. Let him sweat.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'He\'s pulling his remaining agents. Burning evidence. Whoever we don\'t catch in the next two missions walks free.', mood: 'grim' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Then we don\'t give him two missions. We end this in one.', mood: 'urgent' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Patience, Striker. We\'re building the cage first. Then we let him step in it.', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Commander... for what it\'s worth. I\'m glad we\'re the ones doing this. No one else would have seen it in time.', mood: 'solemn' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'When did you get sentimental, Whisper?', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'I\'ve always been sentimental. I just hide it better than you.', mood: 'proud' },
    ],
  },
  {
    id: 'heg_3_2',
    act: 3,
    missionNumber: 12,
    title: 'Behind Enemy Lines',
    briefing: 'Infiltrate enemy territory and destroy their supply depot.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy supply depot', target: 'Supply Depot' },
      { id: 'survive', type: 'survive', description: 'Escape before reinforcements' },
    ],
    playerShips: ['terran_viper', 'terran_raptor'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'confed_falcon', count: 4, faction: 'free_confederation' },
      { shipId: 'confed_hawk', count: 3, faction: 'free_confederation', spawnDelay: 60000 },
    ],
    rewards: { xp: 650, credits: 550 },
    debrief: [
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'WHISPER, GET OUT OF THERE!', mood: 'urgent' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'The depot is secured. I have the encryption keys. I\'m extracting now.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Whisper — your shields are down to twelve percent. We\'re coming to you.', mood: 'urgent' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Negative. Hold the extraction corridor. I\'ll make the rendezvous.', mood: 'neutral' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'I swear to every star in this sector if you don\'t come back I\'ll haunt your records for eternity—', mood: 'urgent' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: '...I made the rendezvous. All pilots accounted for.', mood: 'proud' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Never do that again.', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'I\'ll do it as many times as necessary. That\'s what Iron Fist is.', mood: 'proud' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'She\'s right. That\'s what we are. God help us all.', mood: 'solemn' },
    ],
  },
  {
    id: 'heg_3_3',
    act: 3,
    missionNumber: 13,
    isBranch: true,
    branchTag: 'REACTIVE',
    title: 'Alliance Betrayal',
    briefing: 'The Empire has broken our alliance. Defend against their surprise attack.',
    objectives: [
      { id: 'survive', type: 'survive', description: 'Survive the ambush' },
      { id: 'kill', type: 'eliminate', description: 'Destroy attackers', count: 8 },
    ],
    playerShips: ['terran_viper', 'terran_raptor', 'terran_centurion', 'terran_thunderbolt'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'ascendant_seraph', count: 4, faction: 'ascendant_empire' },
      { shipId: 'ascendant_templar', count: 4, faction: 'ascendant_empire' },
    ],
    rewards: { xp: 750, credits: 650 },
    debrief: [
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Ascendant forces are withdrawing. Hold your course — do not pursue.', mood: 'urgent' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'They were supposed to be our flank cover! VANCE told them we were hostile!', mood: 'grim' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'He burned our alliance from the inside. Used classified comm channels to stage a false flag.', mood: 'grim' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'How many?', mood: 'solemn' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Eight ships confirmed lost on both sides before the confusion cleared. Eight ships that didn\'t have to die.', mood: 'grim' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'He\'s using us to start a war between factions. Weaken them all so he can take control.', mood: 'grim' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Commander. The Ascendant commander sent us a private channel message after the engagement.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'What does it say?', mood: 'neutral' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: '"Iron Fist — we see the truth now. One chance. Take it."', mood: 'urgent' },
    ],
  },
  {
    id: 'heg_3_3b',
    act: 3,
    missionNumber: 13,
    isBranch: true,
    branchTag: 'PREEMPTIVE',
    title: 'Iron Preemption',
    briefing: 'Whisper has cracked Vance\'s timeline. We have hours before he triggers the Ascendant betrayal. Hit his loyalist fleet now — before the trap snaps shut.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy Vance\'s loyalist fleet', count: 8 },
      { id: 'assassinate', type: 'assassinate', description: 'Eliminate Vance\'s fleet commander', target: 'terran_vindicator', optional: true, xpBonus: 150 },
    ],
    playerShips: ['terran_viper', 'terran_raptor', 'terran_centurion', 'terran_thunderbolt'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'terran_viper', count: 4, faction: 'terran_hegemony' },
      { shipId: 'terran_centurion', count: 3, faction: 'terran_hegemony' },
      { shipId: 'terran_vindicator', count: 1, faction: 'terran_hegemony', isAce: true, isBoss: true },
    ],
    rewards: { xp: 800, credits: 700, unlocks: ['terran_vindicator'] },
    debrief: [
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Vance\'s fleet commander is down. His timetable is broken. The Ascendant betrayal never fires.', mood: 'proud' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'We hit them before they could move. They didn\'t see us coming.', mood: 'proud' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'The Ascendant commander is on our channel. They received Vance\'s false orders — and they rejected them.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'They chose not to fire.', mood: 'solemn' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'They knew it was wrong. We just gave them the time to realize it.', mood: 'neutral' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Eight ships saved. Two factions not at war. I\'ll take that outcome.', mood: 'proud' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Vance is going to run. One last push — we end this before he can disappear.', mood: 'urgent' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'I\'ve locked his coordinates. He has nowhere left to hide.', mood: 'grim' },
    ],
  },
  {
    id: 'heg_3_4',
    act: 3,
    missionNumber: 14,
    title: 'Capital Strike',
    briefing: 'Lead an assault on the enemy capital ship. This could turn the tide of war.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy the Dreadnought', target: 'CNS Freedom' },
    ],
    playerShips: ['terran_viper', 'terran_raptor', 'terran_centurion', 'terran_thunderbolt'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'confed_falcon', count: 4, faction: 'free_confederation' },
      { shipId: 'confed_albatross', count: 1, faction: 'free_confederation', isBoss: true },
    ],
    rewards: { xp: 800, credits: 700 },
    debrief: [
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'CNS Freedom disabled. Strike complete.', mood: 'proud' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'VANCE is broadcasting. He\'s trying to blame the attack on the Confederation.', mood: 'grim' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'I\'m overriding his broadcast with our evidence packet. Every fleet channel. Every encrypted log. Authenticated.', mood: 'neutral' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'That is EXTREMELY satisfying to watch.', mood: 'proud' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Vance. You had the best fleet in five sectors. You had my trust. You sold it for a throne no one will let you sit on.', mood: 'grim' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'He\'s in custody. Fleet Intelligence is receiving him now.', mood: 'neutral' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Is it over, Whisper?', mood: 'solemn' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'The conspiracy is over. The war he started... that\'s going to take longer to mend.', mood: 'solemn' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'One last op. Let\'s finish it.', mood: 'proud' },
    ],
  },
  {
    id: 'heg_3_5',
    act: 3,
    missionNumber: 15,
    title: 'Final Push',
    briefing: 'Victory is within reach. Crush the remaining resistance and secure total dominance.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy all enemy forces', count: 12 },
    ],
    playerShips: ['terran_viper', 'terran_raptor', 'terran_centurion', 'terran_thunderbolt'],
    maxSquadSize: 6,
    enemies: [
      { shipId: 'confed_falcon', count: 4, faction: 'free_confederation' },
      { shipId: 'confed_hawk', count: 4, faction: 'free_confederation' },
      { shipId: 'confed_condor', count: 2, faction: 'free_confederation' },
      { shipId: 'confed_albatross', count: 2, faction: 'free_confederation', isAce: true },
    ],
    rewards: { xp: 1000, credits: 1000 },
    debrief: [
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'All remaining hostile forces are down. Sector is clear.', mood: 'proud' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Iron Fist. Undefeated. How about that.', mood: 'proud' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Seventeen missions. Twelve months. One conspiracy dismantled and one war averted.', mood: 'solemn' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'We\'re not done. There are four other factions. Whatever Vance started, the fractures remain.', mood: 'solemn' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'Then we mend them. That\'s what we do.', mood: 'proud' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Commander Chen — Fleet Command has announced. You\'ve been promoted to Admiral.', mood: 'proud' },
      { speaker: 'STRIKER', portraitKey: 'portrait_striker', text: 'ADMIRAL CHEN! There it is!', mood: 'proud' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'Iron Fist Squadron is redesignated as the First Response Wing. Striker — your own command. Whisper — your own unit.', mood: 'proud' },
      { speaker: 'WHISPER', portraitKey: 'portrait_whisper', text: 'Sir? You\'re breaking up the squadron?', mood: 'solemn' },
      { speaker: 'ADMIRAL CHEN', portraitKey: 'portrait_admiral_chen', text: 'No. I\'m making it bigger. Iron Fist never flies alone. Not today. Not ever.', mood: 'proud' },
    ],
  },
];

// ============================================
// FREE CONFEDERATION CAMPAIGN
// "The Rebel's Path"
// ============================================

const FREE_CONFEDERATION_MISSIONS: CampaignMission[] = [
  // Act I
  {
    id: 'conf_1_1',
    act: 1,
    missionNumber: 1,
    title: 'Freedom Flight',
    briefing: 'You\'ve escaped Hegemony oppression and joined the Confederation. Learn to pilot your salvaged fighter.',
    objectives: [
      { id: 'nav', type: 'survive', description: 'Complete flight training', timeLimit: 120 },
    ],
    playerShips: ['confed_falcon'],
    maxSquadSize: 1,
    enemies: [],
    rewards: { xp: 100, credits: 50 },
    newMechanic: 'Movement Charts',
  },
  {
    id: 'conf_1_2',
    act: 1,
    missionNumber: 2,
    title: 'First Strike',
    briefing: 'A Hegemony patrol has been spotted. Show them the Confederation fights back.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy the patrol', count: 1 },
    ],
    playerShips: ['confed_falcon'],
    maxSquadSize: 1,
    enemies: [{ shipId: 'heg_viper', count: 1, faction: 'terran_hegemony' }],
    rewards: { xp: 150, credits: 75 },
    newMechanic: 'Combat Dice',
  },
  {
    id: 'conf_1_3',
    act: 1,
    missionNumber: 3,
    title: 'Guerrilla Tactics',
    briefing: 'Join your rebel cell in a hit-and-run attack. Strike fast, then disappear.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy supply convoy', count: 3 },
      { id: 'survive', type: 'survive', description: 'All pilots survive', optional: true, xpBonus: 50 },
    ],
    playerShips: ['confed_falcon', 'confed_nova'],
    maxSquadSize: 2,
    enemies: [
      { shipId: 'heg_viper', count: 2, faction: 'terran_hegemony' },
      { shipId: 'heg_raptor', count: 1, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 200, credits: 100 },
    newMechanic: 'Hit and Run',
  },
  {
    id: 'conf_1_4',
    act: 1,
    missionNumber: 4,
    title: 'Upgrade Salvage',
    briefing: 'We\'ve located a crashed Hegemony transport with advanced tech. Secure the salvage.',
    objectives: [
      { id: 'capture', type: 'capture', description: 'Secure crash site' },
      { id: 'defend', type: 'defend', description: 'Hold until extraction' },
    ],
    playerShips: ['confed_falcon', 'confed_nova'],
    maxSquadSize: 2,
    enemies: [
      { shipId: 'heg_viper', count: 3, faction: 'terran_hegemony' },
      { shipId: 'heg_raptor', count: 1, faction: 'terran_hegemony', spawnDelay: 45000 },
    ],
    rewards: { xp: 250, credits: 150, unlocks: ['confed_nova'] },
    newMechanic: 'Ship Evolution',
  },
  {
    id: 'conf_1_5',
    act: 1,
    missionNumber: 5,
    title: 'Hidden Base Defense',
    briefing: 'The Hegemony has found our base. Hold them off while we evacuate.',
    objectives: [
      { id: 'survive', type: 'survive', description: 'Survive for 2 minutes', timeLimit: 120 },
      { id: 'defend', type: 'defend', description: 'Protect the evacuation ships' },
    ],
    playerShips: ['confed_falcon', 'confed_nova', 'confed_meteor'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'heg_viper', count: 4, faction: 'terran_hegemony' },
      { shipId: 'heg_raptor', count: 2, faction: 'terran_hegemony', spawnDelay: 60000 },
    ],
    rewards: { xp: 300, credits: 200, unlocks: ['confed_meteor'] },
  },

  // Act II
  {
    id: 'conf_2_1',
    act: 2,
    missionNumber: 6,
    title: 'Supply Raid',
    briefing: 'We need supplies. Intercept the Hegemony cargo convoy.',
    objectives: [
      { id: 'capture', type: 'capture', description: 'Disable cargo ships', count: 2 },
      { id: 'kill', type: 'eliminate', description: 'Destroy escorts', count: 4 },
    ],
    playerShips: ['confed_falcon', 'confed_nova', 'confed_meteor'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'heg_viper', count: 4, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 350, credits: 250 },
  },
  {
    id: 'conf_2_2',
    act: 2,
    missionNumber: 7,
    title: 'Prison Break',
    briefing: 'Our comrades are being held at a Hegemony prison station. Break them out.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy station defenses', count: 5 },
      { id: 'escort', type: 'escort', description: 'Protect escape pods' },
    ],
    playerShips: ['confed_falcon', 'confed_nova', 'confed_meteor', 'confed_aurora'],
    maxSquadSize: 4,
    enemies: [
      { shipId: 'heg_viper', count: 3, faction: 'terran_hegemony' },
      { shipId: 'heg_aegis', count: 2, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 400, credits: 300, unlocks: ['confed_aurora'] },
  },
  {
    id: 'conf_2_3',
    act: 2,
    missionNumber: 8,
    title: 'Corsair Alliance',
    briefing: 'The Void Corsairs offer an alliance. Meet with their captain, but stay alert.',
    objectives: [
      { id: 'survive', type: 'survive', description: 'Survive the meeting' },
      { id: 'kill', type: 'eliminate', description: 'Destroy Hegemony ambush', count: 6 },
    ],
    playerShips: ['confed_falcon', 'confed_nova'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'heg_raptor', count: 4, faction: 'terran_hegemony', spawnDelay: 30000 },
      { shipId: 'heg_aegis', count: 2, faction: 'terran_hegemony', spawnDelay: 30000 },
    ],
    rewards: { xp: 450, credits: 350 },
  },
  {
    id: 'conf_2_4',
    act: 2,
    missionNumber: 9,
    title: 'Intelligence Theft',
    briefing: 'Steal tactical data from a Hegemony communications relay.',
    objectives: [
      { id: 'capture', type: 'capture', description: 'Hack relay station' },
      { id: 'survive', type: 'survive', description: 'Escape with data' },
    ],
    playerShips: ['confed_falcon', 'confed_nova', 'confed_meteor'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'heg_viper', count: 3, faction: 'terran_hegemony' },
      { shipId: 'heg_raptor', count: 3, faction: 'terran_hegemony', spawnDelay: 45000 },
    ],
    rewards: { xp: 500, credits: 400 },
  },
  {
    id: 'conf_2_5',
    act: 2,
    missionNumber: 10,
    title: 'Hegemony Battlecruiser',
    briefing: 'A Hegemony Battlecruiser threatens our sector. It must be destroyed.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy the Battlecruiser' },
    ],
    playerShips: ['confed_falcon', 'confed_nova', 'confed_meteor', 'confed_aurora'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'heg_viper', count: 4, faction: 'terran_hegemony' },
      { shipId: 'heg_devastator', count: 1, faction: 'terran_hegemony', isBoss: true },
    ],
    rewards: { xp: 600, credits: 500 },
  },

  // Act III (5 missions)
  {
    id: 'conf_3_1',
    act: 3,
    missionNumber: 11,
    title: 'Revolution Rising',
    briefing: 'The people rise across multiple worlds. Support the uprising.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy oppressors', count: 10 },
    ],
    playerShips: ['confed_falcon', 'confed_nova', 'confed_meteor', 'confed_aurora'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'heg_viper', count: 5, faction: 'terran_hegemony' },
      { shipId: 'heg_raptor', count: 3, faction: 'terran_hegemony' },
      { shipId: 'heg_aegis', count: 2, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 700, credits: 600 },
  },
  {
    id: 'conf_3_2',
    act: 3,
    missionNumber: 12,
    title: 'Capital Liberation',
    briefing: 'Free the capital world from Hegemony control.',
    objectives: [
      { id: 'capture', type: 'capture', description: 'Secure orbital control' },
      { id: 'kill', type: 'eliminate', description: 'Destroy garrison', count: 8 },
    ],
    playerShips: ['confed_falcon', 'confed_nova', 'confed_meteor', 'confed_aurora'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'heg_raptor', count: 4, faction: 'terran_hegemony' },
      { shipId: 'heg_aegis', count: 4, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 750, credits: 650 },
  },
  {
    id: 'conf_3_3',
    act: 3,
    missionNumber: 13,
    title: 'Admiral\'s Gambit',
    briefing: 'The Hegemony Admiral has sprung a trap. Break through the encirclement.',
    objectives: [
      { id: 'survive', type: 'survive', description: 'Break through blockade' },
      { id: 'kill', type: 'eliminate', description: 'Create escape route', count: 6 },
    ],
    playerShips: ['confed_falcon', 'confed_nova', 'confed_meteor', 'confed_aurora'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'heg_viper', count: 6, faction: 'terran_hegemony' },
      { shipId: 'heg_devastator', count: 2, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 800, credits: 700 },
  },
  {
    id: 'conf_3_4',
    act: 3,
    missionNumber: 14,
    title: 'Final Offensive',
    briefing: 'Launch the final assault on Hegemony High Command.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy High Command defense fleet', count: 10 },
    ],
    playerShips: ['confed_falcon', 'confed_nova', 'confed_meteor', 'confed_aurora'],
    maxSquadSize: 6,
    enemies: [
      { shipId: 'heg_raptor', count: 4, faction: 'terran_hegemony' },
      { shipId: 'heg_aegis', count: 4, faction: 'terran_hegemony' },
      { shipId: 'heg_devastator', count: 2, faction: 'terran_hegemony', isAce: true },
    ],
    rewards: { xp: 900, credits: 800 },
  },
  {
    id: 'conf_3_5',
    act: 3,
    missionNumber: 15,
    title: 'Freedom\'s Dawn',
    briefing: 'The Hegemony falls. Destroy their last flagship and secure independence.',
    objectives: [
      { id: 'assassinate', type: 'assassinate', description: 'Destroy Admiral Kronos\' flagship' },
      { id: 'kill', type: 'eliminate', description: 'Destroy escorts', count: 6 },
    ],
    playerShips: ['confed_falcon', 'confed_nova', 'confed_meteor', 'confed_aurora'],
    maxSquadSize: 6,
    enemies: [
      { shipId: 'heg_aegis', count: 4, faction: 'terran_hegemony' },
      { shipId: 'heg_devastator', count: 2, faction: 'terran_hegemony' },
      { shipId: 'heg_devastator', count: 1, faction: 'terran_hegemony', isBoss: true },
    ],
    rewards: { xp: 1000, credits: 1000 },
  },
];

// ============================================
// SYNTHETIC COLLECTIVE CAMPAIGN
// "Network Expansion"
// ============================================

const SYNTHETIC_COLLECTIVE_MISSIONS: CampaignMission[] = [
  // Act I
  {
    id: 'synth_1_1',
    act: 1,
    missionNumber: 1,
    title: 'Initialization',
    briefing: 'Unit activated. Primary directive: learn combat protocols. Execute training simulation.',
    objectives: [
      { id: 'nav', type: 'survive', description: 'Complete initialization sequence', timeLimit: 120 },
    ],
    playerShips: ['synth_drone'],
    maxSquadSize: 1,
    enemies: [],
    rewards: { xp: 100, credits: 50 },
    newMechanic: 'Movement Charts',
  },
  {
    id: 'synth_1_2',
    act: 1,
    missionNumber: 2,
    title: 'First Engagement',
    briefing: 'Hostile organic detected. Eliminate threat to the Collective.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Terminate hostile', count: 1 },
    ],
    playerShips: ['synth_drone'],
    maxSquadSize: 1,
    enemies: [{ shipId: 'corsair_razor', count: 1, faction: 'void_corsairs' }],
    rewards: { xp: 150, credits: 75 },
    newMechanic: 'Combat Dice',
  },
  {
    id: 'synth_1_3',
    act: 1,
    missionNumber: 3,
    title: 'Network Sync',
    briefing: 'Additional units assigned. Synchronize targeting data. Organic inefficiency will be eliminated.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Eliminate organic fighters', count: 3 },
    ],
    playerShips: ['synth_drone', 'synth_interceptor'],
    maxSquadSize: 3,
    enemies: [{ shipId: 'corsair_razor', count: 3, faction: 'void_corsairs' }],
    rewards: { xp: 200, credits: 100 },
    newMechanic: 'Networked Targeting',
  },
  {
    id: 'synth_1_4',
    act: 1,
    missionNumber: 4,
    title: 'Evolution Protocol',
    briefing: 'Superior chassis available. Select optimal configuration for mission parameters.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Eliminate organic patrol', count: 4 },
    ],
    playerShips: ['synth_drone', 'synth_interceptor', 'synth_guardian'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'heg_viper', count: 3, faction: 'terran_hegemony' },
      { shipId: 'heg_raptor', count: 1, faction: 'terran_hegemony', isAce: true },
    ],
    rewards: { xp: 250, credits: 150, unlocks: ['synth_guardian'] },
    newMechanic: 'Ship Evolution',
  },
  {
    id: 'synth_1_5',
    act: 1,
    missionNumber: 5,
    title: 'Multi-Vector Assault',
    briefing: 'Multiple organic factions detected. Simultaneous elimination required for efficiency.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Terminate all organics', count: 6 },
    ],
    playerShips: ['synth_drone', 'synth_interceptor', 'synth_guardian'],
    maxSquadSize: 4,
    enemies: [
      { shipId: 'heg_viper', count: 3, faction: 'terran_hegemony' },
      { shipId: 'confed_falcon', count: 3, faction: 'free_confederation' },
    ],
    rewards: { xp: 300, credits: 200, unlocks: ['synth_titan'] },
  },

  // Act II (5 missions)
  {
    id: 'synth_2_1',
    act: 2,
    missionNumber: 6,
    title: 'Data Harvest',
    briefing: 'Organic technology detected. Assimilate for Collective improvement.',
    objectives: [
      { id: 'capture', type: 'capture', description: 'Assimilate technology' },
      { id: 'kill', type: 'eliminate', description: 'Eliminate defenders', count: 4 },
    ],
    playerShips: ['synth_drone', 'synth_interceptor', 'synth_guardian', 'synth_titan'],
    maxSquadSize: 4,
    enemies: [
      { shipId: 'heg_viper', count: 4, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 350, credits: 250 },
  },
  {
    id: 'synth_2_2',
    act: 2,
    missionNumber: 7,
    title: 'Swarm Protocol',
    briefing: 'Deploy maximum drone complement. Overwhelm organic defenses.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Eliminate all resistance', count: 8 },
    ],
    playerShips: ['synth_drone', 'synth_interceptor', 'synth_guardian', 'synth_titan'],
    maxSquadSize: 6,
    enemies: [
      { shipId: 'confed_falcon', count: 4, faction: 'free_confederation' },
      { shipId: 'confed_nova', count: 4, faction: 'free_confederation' },
    ],
    rewards: { xp: 400, credits: 300 },
  },
  {
    id: 'synth_2_3',
    act: 2,
    missionNumber: 8,
    title: 'Conversion',
    briefing: 'Organic vessel captured. Convert crew to Collective consciousness.',
    objectives: [
      { id: 'defend', type: 'defend', description: 'Protect conversion vessel' },
      { id: 'kill', type: 'eliminate', description: 'Repel rescue attempt', count: 6 },
    ],
    playerShips: ['synth_drone', 'synth_interceptor', 'synth_guardian'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'confed_falcon', count: 4, faction: 'free_confederation' },
      { shipId: 'confed_nova', count: 2, faction: 'free_confederation', spawnDelay: 45000 },
    ],
    rewards: { xp: 450, credits: 350 },
  },
  {
    id: 'synth_2_4',
    act: 2,
    missionNumber: 9,
    title: 'Node Defense',
    briefing: 'Primary processing node under attack. Defend at all costs.',
    objectives: [
      { id: 'survive', type: 'survive', description: 'Protect node for 3 minutes', timeLimit: 180 },
      { id: 'defend', type: 'defend', description: 'Node must survive' },
    ],
    playerShips: ['synth_drone', 'synth_interceptor', 'synth_guardian', 'synth_titan'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'heg_raptor', count: 3, faction: 'terran_hegemony' },
      { shipId: 'heg_devastator', count: 2, faction: 'terran_hegemony', spawnDelay: 60000 },
      { shipId: 'heg_aegis', count: 2, faction: 'terran_hegemony', spawnDelay: 120000 },
    ],
    rewards: { xp: 500, credits: 400 },
  },
  {
    id: 'synth_2_5',
    act: 2,
    missionNumber: 10,
    title: 'Organic Command',
    briefing: 'Organic command structure located. Eliminate leadership for strategic advantage.',
    objectives: [
      { id: 'assassinate', type: 'assassinate', description: 'Terminate organic commander' },
    ],
    playerShips: ['synth_drone', 'synth_interceptor', 'synth_guardian', 'synth_titan'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'heg_viper', count: 4, faction: 'terran_hegemony' },
      { shipId: 'heg_aegis', count: 1, faction: 'terran_hegemony', isBoss: true },
    ],
    rewards: { xp: 600, credits: 500 },
  },

  // Act III (5 missions)
  {
    id: 'synth_3_1',
    act: 3,
    missionNumber: 11,
    title: 'Mass Assimilation',
    briefing: 'Large-scale conversion operation initiated. Process all organic vessels.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Process organic fleet', count: 10 },
    ],
    playerShips: ['synth_drone', 'synth_interceptor', 'synth_guardian', 'synth_titan'],
    maxSquadSize: 6,
    enemies: [
      { shipId: 'confed_falcon', count: 5, faction: 'free_confederation' },
      { shipId: 'confed_nova', count: 3, faction: 'free_confederation' },
      { shipId: 'confed_meteor', count: 2, faction: 'free_confederation' },
    ],
    rewards: { xp: 700, credits: 600 },
  },
  {
    id: 'synth_3_2',
    act: 3,
    missionNumber: 12,
    title: 'Corruption Vector',
    briefing: 'Deploy corruption virus to organic homeworld defenses.',
    objectives: [
      { id: 'capture', type: 'capture', description: 'Upload virus to defense grid' },
      { id: 'survive', type: 'survive', description: 'Complete upload sequence' },
    ],
    playerShips: ['synth_drone', 'synth_interceptor', 'synth_guardian'],
    maxSquadSize: 4,
    enemies: [
      { shipId: 'heg_raptor', count: 4, faction: 'terran_hegemony' },
      { shipId: 'heg_aegis', count: 3, faction: 'terran_hegemony', spawnDelay: 60000 },
    ],
    rewards: { xp: 750, credits: 650 },
  },
  {
    id: 'synth_3_3',
    act: 3,
    missionNumber: 13,
    title: 'Resistance Purge',
    briefing: 'Organic resistance coalition forming. Eliminate before unification.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy coalition fleet', count: 10 },
    ],
    playerShips: ['synth_drone', 'synth_interceptor', 'synth_guardian', 'synth_titan'],
    maxSquadSize: 6,
    enemies: [
      { shipId: 'heg_viper', count: 3, faction: 'terran_hegemony' },
      { shipId: 'confed_falcon', count: 3, faction: 'free_confederation' },
      { shipId: 'corsair_razor', count: 2, faction: 'void_corsairs' },
      { shipId: 'ascend_specter', count: 2, faction: 'ascendant_empire' },
    ],
    rewards: { xp: 800, credits: 700 },
  },
  {
    id: 'synth_3_4',
    act: 3,
    missionNumber: 14,
    title: 'Core Expansion',
    briefing: 'Establish new Collective core in organic territory.',
    objectives: [
      { id: 'capture', type: 'capture', description: 'Secure core installation site' },
      { id: 'defend', type: 'defend', description: 'Protect installation' },
    ],
    playerShips: ['synth_drone', 'synth_interceptor', 'synth_guardian', 'synth_titan'],
    maxSquadSize: 6,
    enemies: [
      { shipId: 'confed_nova', count: 5, faction: 'free_confederation' },
      { shipId: 'confed_meteor', count: 3, faction: 'free_confederation' },
    ],
    rewards: { xp: 900, credits: 800 },
  },
  {
    id: 'synth_3_5',
    act: 3,
    missionNumber: 15,
    title: 'Perfect Unity',
    briefing: 'Final organic stronghold identified. Achieve total assimilation.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Assimilate all organic resistance', count: 12 },
    ],
    playerShips: ['synth_drone', 'synth_interceptor', 'synth_guardian', 'synth_titan'],
    maxSquadSize: 6,
    enemies: [
      { shipId: 'heg_raptor', count: 4, faction: 'terran_hegemony' },
      { shipId: 'confed_nova', count: 4, faction: 'free_confederation' },
      { shipId: 'heg_devastator', count: 2, faction: 'terran_hegemony', isAce: true },
      { shipId: 'confed_aurora', count: 2, faction: 'free_confederation', isAce: true },
    ],
    rewards: { xp: 1000, credits: 1000 },
  },
];

// ============================================
// VOID CORSAIRS CAMPAIGN
// "The Plunder Path"
// ============================================

const VOID_CORSAIRS_MISSIONS: CampaignMission[] = [
  // Act I
  {
    id: 'cors_1_1',
    act: 1,
    missionNumber: 1,
    title: 'Welcome to the Crew',
    briefing: 'You\'ve joined Captain Blackmaw\'s crew. Learn to fly like a Corsair - fast and deadly.',
    objectives: [
      { id: 'nav', type: 'survive', description: 'Complete evasion training', timeLimit: 120 },
    ],
    playerShips: ['corsair_razor'],
    maxSquadSize: 1,
    enemies: [],
    rewards: { xp: 100, credits: 50 },
    newMechanic: 'Movement Charts',
  },
  {
    id: 'cors_1_2',
    act: 1,
    missionNumber: 2,
    title: 'First Plunder',
    briefing: 'Time for your first raid. A merchant ship awaits. Take what you can.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy the escort', count: 1 },
    ],
    playerShips: ['corsair_razor'],
    maxSquadSize: 1,
    enemies: [{ shipId: 'confed_falcon', count: 1, faction: 'free_confederation' }],
    rewards: { xp: 150, credits: 100 },
    newMechanic: 'Combat Dice',
  },
  {
    id: 'cors_1_3',
    act: 1,
    missionNumber: 3,
    title: 'Terror Tactics',
    briefing: 'Intimidation is our weapon. Break their spirits, then take everything.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy convoy escorts', count: 3 },
      { id: 'survive', type: 'survive', description: 'No casualties', optional: true, xpBonus: 50 },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom'],
    maxSquadSize: 2,
    enemies: [
      { shipId: 'confed_falcon', count: 2, faction: 'free_confederation' },
      { shipId: 'confed_nova', count: 1, faction: 'free_confederation' },
    ],
    rewards: { xp: 200, credits: 150 },
    newMechanic: 'Intimidation',
  },
  {
    id: 'cors_1_4',
    act: 1,
    missionNumber: 4,
    title: 'Ship Upgrade',
    briefing: 'We\'ve captured a Hegemony gunship. It\'s yours now. Learn to use it.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Test your new ship', count: 4 },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom', 'corsair_marauder'],
    maxSquadSize: 2,
    enemies: [
      { shipId: 'heg_viper', count: 4, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 250, credits: 200, unlocks: ['corsair_marauder'] },
    newMechanic: 'Ship Evolution',
  },
  {
    id: 'cors_1_5',
    act: 1,
    missionNumber: 5,
    title: 'Fleet Action',
    briefing: 'Multiple Hegemony patrols in our territory. Show them this space belongs to us.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy all intruders', count: 6 },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom', 'corsair_marauder'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'heg_viper', count: 4, faction: 'terran_hegemony' },
      { shipId: 'heg_raptor', count: 2, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 300, credits: 250 },
  },

  // Act II (5 missions)
  {
    id: 'cors_2_1',
    act: 2,
    missionNumber: 6,
    title: 'Rich Pickings',
    briefing: 'A luxury transport carrying nobles. The ransom will be substantial.',
    objectives: [
      { id: 'capture', type: 'capture', description: 'Disable luxury transport' },
      { id: 'kill', type: 'eliminate', description: 'Destroy military escorts', count: 4 },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom', 'corsair_marauder'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'heg_raptor', count: 4, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 400, credits: 400 },
  },
  {
    id: 'cors_2_2',
    act: 2,
    missionNumber: 7,
    title: 'Rival Elimination',
    briefing: 'Another pirate crew is encroaching on our territory. Eliminate them.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy rival pirates', count: 6 },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom', 'corsair_marauder', 'corsair_reaper'],
    maxSquadSize: 4,
    enemies: [
      { shipId: 'corsair_razor', count: 4, faction: 'void_corsairs' },
      { shipId: 'corsair_marauder', count: 2, faction: 'void_corsairs' },
    ],
    rewards: { xp: 450, credits: 350, unlocks: ['corsair_reaper'] },
  },
  {
    id: 'cors_2_3',
    act: 2,
    missionNumber: 8,
    title: 'Prison Ship',
    briefing: 'Our crew members are on a prison transport. Free them.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy prison guards', count: 5 },
      { id: 'escort', type: 'escort', description: 'Protect escape shuttles' },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom', 'corsair_marauder'],
    maxSquadSize: 4,
    enemies: [
      { shipId: 'heg_viper', count: 3, faction: 'terran_hegemony' },
      { shipId: 'heg_aegis', count: 2, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 500, credits: 400 },
  },
  {
    id: 'cors_2_4',
    act: 2,
    missionNumber: 9,
    title: 'Ambush Setup',
    briefing: 'A Hegemony supply convoy is passing through. Set up the perfect ambush.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy convoy and escorts', count: 7 },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom', 'corsair_marauder', 'corsair_reaper'],
    maxSquadSize: 4,
    enemies: [
      { shipId: 'heg_viper', count: 4, faction: 'terran_hegemony' },
      { shipId: 'heg_raptor', count: 3, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 550, credits: 500 },
  },
  {
    id: 'cors_2_5',
    act: 2,
    missionNumber: 10,
    title: 'The Captain\'s Grudge',
    briefing: 'Captain Blackmaw has a score to settle. Destroy Admiral Kronos\' personal escort.',
    objectives: [
      { id: 'assassinate', type: 'assassinate', description: 'Destroy Admiral\'s escort commander' },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom', 'corsair_marauder', 'corsair_reaper'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'heg_raptor', count: 3, faction: 'terran_hegemony' },
      { shipId: 'heg_aegis', count: 1, faction: 'terran_hegemony', isBoss: true },
    ],
    rewards: { xp: 600, credits: 600 },
  },

  // Act III (5 missions)
  {
    id: 'cors_3_1',
    act: 3,
    missionNumber: 11,
    title: 'Pirate Armada',
    briefing: 'Unite the pirate clans. Those who refuse will be destroyed.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Defeat rival clan leaders', count: 8 },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom', 'corsair_marauder', 'corsair_reaper'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'corsair_razor', count: 4, faction: 'void_corsairs' },
      { shipId: 'corsair_marauder', count: 3, faction: 'void_corsairs' },
      { shipId: 'corsair_reaper', count: 1, faction: 'void_corsairs', isAce: true },
    ],
    rewards: { xp: 700, credits: 700 },
  },
  {
    id: 'cors_3_2',
    act: 3,
    missionNumber: 12,
    title: 'Hegemony Payback',
    briefing: 'The Hegemony destroyed our home station. Now we destroy theirs.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy station defenses', count: 10 },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom', 'corsair_marauder', 'corsair_reaper'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'heg_viper', count: 5, faction: 'terran_hegemony' },
      { shipId: 'heg_aegis', count: 3, faction: 'terran_hegemony' },
      { shipId: 'heg_devastator', count: 2, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 800, credits: 800 },
  },
  {
    id: 'cors_3_3',
    act: 3,
    missionNumber: 13,
    title: 'War Profiteering',
    briefing: 'The galaxy is at war. We\'ll raid all sides equally.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Raid multiple factions', count: 10 },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom', 'corsair_marauder', 'corsair_reaper'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'heg_raptor', count: 3, faction: 'terran_hegemony' },
      { shipId: 'confed_nova', count: 3, faction: 'free_confederation' },
      { shipId: 'synth_interceptor', count: 2, faction: 'synthetic_collective' },
      { shipId: 'ascend_specter', count: 2, faction: 'ascendant_empire' },
    ],
    rewards: { xp: 850, credits: 900 },
  },
  {
    id: 'cors_3_4',
    act: 3,
    missionNumber: 14,
    title: 'Grand Heist',
    briefing: 'The greatest heist in history. Steal the Hegemony\'s treasury ship.',
    objectives: [
      { id: 'capture', type: 'capture', description: 'Disable treasury ship' },
      { id: 'kill', type: 'eliminate', description: 'Destroy heavy escort', count: 8 },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom', 'corsair_marauder', 'corsair_reaper'],
    maxSquadSize: 6,
    enemies: [
      { shipId: 'heg_aegis', count: 4, faction: 'terran_hegemony' },
      { shipId: 'heg_devastator', count: 4, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 950, credits: 1500 },
  },
  {
    id: 'cors_3_5',
    act: 3,
    missionNumber: 15,
    title: 'Pirate King',
    briefing: 'Captain Blackmaw falls. You will take the throne. Destroy all who oppose.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Defeat all rivals', count: 12 },
    ],
    playerShips: ['corsair_razor', 'corsair_phantom', 'corsair_marauder', 'corsair_reaper'],
    maxSquadSize: 6,
    enemies: [
      { shipId: 'corsair_razor', count: 4, faction: 'void_corsairs' },
      { shipId: 'corsair_marauder', count: 4, faction: 'void_corsairs' },
      { shipId: 'corsair_reaper', count: 4, faction: 'void_corsairs', isAce: true },
    ],
    rewards: { xp: 1000, credits: 1000 },
  },
];

// ============================================
// ASCENDANT EMPIRE CAMPAIGN
// "The Prophecy"
// ============================================

const ASCENDANT_EMPIRE_MISSIONS: CampaignMission[] = [
  // Act I
  {
    id: 'asc_1_1',
    act: 1,
    missionNumber: 1,
    title: 'Awakening',
    briefing: 'The Oracles have foreseen your destiny. Your psionic abilities will guide your ship through the trial.',
    objectives: [
      { id: 'nav', type: 'survive', description: 'Complete psionic navigation trial', timeLimit: 120 },
    ],
    playerShips: ['ascend_specter'],
    maxSquadSize: 1,
    enemies: [],
    rewards: { xp: 100, credits: 50 },
    newMechanic: 'Movement Charts',
  },
  {
    id: 'asc_1_2',
    act: 1,
    missionNumber: 2,
    title: 'First Prophecy',
    briefing: 'The visions show an enemy. Strike before they can act.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Eliminate the threat', count: 1 },
    ],
    playerShips: ['ascend_specter'],
    maxSquadSize: 1,
    enemies: [{ shipId: 'synth_drone', count: 1, faction: 'synthetic_collective' }],
    rewards: { xp: 150, credits: 75 },
    newMechanic: 'Combat Dice',
  },
  {
    id: 'asc_1_3',
    act: 1,
    missionNumber: 3,
    title: 'Mind Link',
    briefing: 'Join with fellow psionics. Together, your visions will guide you to victory.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy the machines', count: 3 },
    ],
    playerShips: ['ascend_specter', 'ascend_templar'],
    maxSquadSize: 2,
    enemies: [{ shipId: 'synth_interceptor', count: 3, faction: 'synthetic_collective' }],
    rewards: { xp: 200, credits: 100 },
    newMechanic: 'Prescience',
  },
  {
    id: 'asc_1_4',
    act: 1,
    missionNumber: 4,
    title: 'Evolution Path',
    briefing: 'Your abilities grow. The Oracles grant you access to more powerful vessels.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Prove your worth', count: 4 },
    ],
    playerShips: ['ascend_specter', 'ascend_templar', 'ascend_oracle'],
    maxSquadSize: 2,
    enemies: [
      { shipId: 'synth_drone', count: 3, faction: 'synthetic_collective' },
      { shipId: 'synth_guardian', count: 1, faction: 'synthetic_collective', isAce: true },
    ],
    rewards: { xp: 250, credits: 150, unlocks: ['ascend_oracle'] },
    newMechanic: 'Ship Evolution',
  },
  {
    id: 'asc_1_5',
    act: 1,
    missionNumber: 5,
    title: 'The Convergence',
    briefing: 'Multiple timelines converge. Many enemies approach. You have seen this moment.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Eliminate all threats', count: 6 },
    ],
    playerShips: ['ascend_specter', 'ascend_templar', 'ascend_oracle'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'synth_drone', count: 3, faction: 'synthetic_collective' },
      { shipId: 'corsair_razor', count: 3, faction: 'void_corsairs' },
    ],
    rewards: { xp: 300, credits: 200, unlocks: ['ascend_leviathan'] },
  },

  // Act II (5 missions)
  {
    id: 'asc_2_1',
    act: 2,
    missionNumber: 6,
    title: 'Sacred Artifact',
    briefing: 'An ancient artifact has been located. It must be recovered for the Empire.',
    objectives: [
      { id: 'capture', type: 'capture', description: 'Secure the artifact' },
      { id: 'kill', type: 'eliminate', description: 'Defeat guardians', count: 4 },
    ],
    playerShips: ['ascend_specter', 'ascend_templar', 'ascend_oracle', 'ascend_leviathan'],
    maxSquadSize: 4,
    enemies: [
      { shipId: 'synth_guardian', count: 4, faction: 'synthetic_collective' },
    ],
    rewards: { xp: 350, credits: 250 },
  },
  {
    id: 'asc_2_2',
    act: 2,
    missionNumber: 7,
    title: 'Heretic Purge',
    briefing: 'Heretics deny the Prophecy. They must be eliminated.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Purge the heretics', count: 6 },
    ],
    playerShips: ['ascend_specter', 'ascend_templar', 'ascend_oracle', 'ascend_leviathan'],
    maxSquadSize: 4,
    enemies: [
      { shipId: 'confed_falcon', count: 3, faction: 'free_confederation' },
      { shipId: 'confed_nova', count: 3, faction: 'free_confederation' },
    ],
    rewards: { xp: 400, credits: 300 },
  },
  {
    id: 'asc_2_3',
    act: 2,
    missionNumber: 8,
    title: 'Vision Quest',
    briefing: 'The Oracles send you on a sacred mission. Trust in the visions.',
    objectives: [
      { id: 'survive', type: 'survive', description: 'Survive the trial', timeLimit: 150 },
      { id: 'kill', type: 'eliminate', description: 'Overcome the challenge', count: 5 },
    ],
    playerShips: ['ascend_specter', 'ascend_templar'],
    maxSquadSize: 3,
    enemies: [
      { shipId: 'heg_raptor', count: 3, faction: 'terran_hegemony', spawnDelay: 30000 },
      { shipId: 'confed_nova', count: 2, faction: 'free_confederation', spawnDelay: 60000 },
    ],
    rewards: { xp: 450, credits: 350 },
  },
  {
    id: 'asc_2_4',
    act: 2,
    missionNumber: 9,
    title: 'Temple Defense',
    briefing: 'The Sacred Temple is under attack by machines. It must not fall.',
    objectives: [
      { id: 'defend', type: 'defend', description: 'Protect the Temple' },
      { id: 'kill', type: 'eliminate', description: 'Destroy attackers', count: 8 },
    ],
    playerShips: ['ascend_specter', 'ascend_templar', 'ascend_oracle', 'ascend_leviathan'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'synth_drone', count: 4, faction: 'synthetic_collective' },
      { shipId: 'synth_interceptor', count: 2, faction: 'synthetic_collective', spawnDelay: 45000 },
      { shipId: 'synth_titan', count: 2, faction: 'synthetic_collective', spawnDelay: 90000 },
    ],
    rewards: { xp: 500, credits: 400 },
  },
  {
    id: 'asc_2_5',
    act: 2,
    missionNumber: 10,
    title: 'Machine God',
    briefing: 'The Collective has created something... wrong. It must be destroyed.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Destroy the abomination' },
    ],
    playerShips: ['ascend_specter', 'ascend_templar', 'ascend_oracle', 'ascend_leviathan'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'synth_drone', count: 4, faction: 'synthetic_collective' },
      { shipId: 'synth_titan', count: 1, faction: 'synthetic_collective', isBoss: true },
    ],
    rewards: { xp: 600, credits: 500 },
  },

  // Act III (5 missions)
  {
    id: 'asc_3_1',
    act: 3,
    missionNumber: 11,
    title: 'Crusade Begins',
    briefing: 'The time of the Great Crusade is upon us. Spread the faith.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Convert or destroy', count: 10 },
    ],
    playerShips: ['ascend_specter', 'ascend_templar', 'ascend_oracle', 'ascend_leviathan'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'heg_viper', count: 5, faction: 'terran_hegemony' },
      { shipId: 'heg_raptor', count: 3, faction: 'terran_hegemony' },
      { shipId: 'heg_aegis', count: 2, faction: 'terran_hegemony' },
    ],
    rewards: { xp: 700, credits: 600 },
  },
  {
    id: 'asc_3_2',
    act: 3,
    missionNumber: 12,
    title: 'The Dark Vision',
    briefing: 'A terrible vision has come. Great darkness approaches. You must prevent it.',
    objectives: [
      { id: 'assassinate', type: 'assassinate', description: 'Eliminate the catalyst' },
      { id: 'survive', type: 'survive', description: 'Escape the void' },
    ],
    playerShips: ['ascend_specter', 'ascend_templar', 'ascend_oracle'],
    maxSquadSize: 4,
    enemies: [
      { shipId: 'synth_guardian', count: 4, faction: 'synthetic_collective' },
      { shipId: 'synth_titan', count: 1, faction: 'synthetic_collective', isAce: true },
    ],
    rewards: { xp: 750, credits: 650 },
  },
  {
    id: 'asc_3_3',
    act: 3,
    missionNumber: 13,
    title: 'Alliance of Faith',
    briefing: 'Some organics accept the faith. Protect them from the machines.',
    objectives: [
      { id: 'defend', type: 'defend', description: 'Protect the faithful' },
      { id: 'kill', type: 'eliminate', description: 'Destroy machine aggressors', count: 8 },
    ],
    playerShips: ['ascend_specter', 'ascend_templar', 'ascend_oracle', 'ascend_leviathan'],
    maxSquadSize: 5,
    enemies: [
      { shipId: 'synth_drone', count: 4, faction: 'synthetic_collective' },
      { shipId: 'synth_interceptor', count: 4, faction: 'synthetic_collective' },
    ],
    rewards: { xp: 800, credits: 700 },
  },
  {
    id: 'asc_3_4',
    act: 3,
    missionNumber: 14,
    title: 'Final Revelation',
    briefing: 'The ultimate prophecy reveals itself. All paths lead to this moment.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Defeat the enemies of destiny', count: 10 },
    ],
    playerShips: ['ascend_specter', 'ascend_templar', 'ascend_oracle', 'ascend_leviathan'],
    maxSquadSize: 6,
    enemies: [
      { shipId: 'synth_interceptor', count: 4, faction: 'synthetic_collective' },
      { shipId: 'synth_guardian', count: 4, faction: 'synthetic_collective' },
      { shipId: 'synth_titan', count: 2, faction: 'synthetic_collective', isAce: true },
    ],
    rewards: { xp: 900, credits: 800 },
  },
  {
    id: 'asc_3_5',
    act: 3,
    missionNumber: 15,
    title: 'Ascension',
    briefing: 'The prophecy is fulfilled. Ascend to your destiny. Destroy all who stand in your way.',
    objectives: [
      { id: 'kill', type: 'eliminate', description: 'Complete the Ascension', count: 12 },
    ],
    playerShips: ['ascend_specter', 'ascend_templar', 'ascend_oracle', 'ascend_leviathan'],
    maxSquadSize: 6,
    enemies: [
      { shipId: 'heg_aegis', count: 3, faction: 'terran_hegemony' },
      { shipId: 'confed_aurora', count: 3, faction: 'free_confederation' },
      { shipId: 'synth_titan', count: 3, faction: 'synthetic_collective' },
      { shipId: 'corsair_reaper', count: 3, faction: 'void_corsairs' },
    ],
    rewards: { xp: 1000, credits: 1000 },
  },
];

// ============================================
// FACTION CAMPAIGNS
// ============================================

export const FACTION_CAMPAIGNS: Record<FactionId, FactionCampaign> = {
  terran_hegemony: {
    factionId: 'terran_hegemony',
    name: 'The Iron Fist',
    description: 'Rise through the ranks of the Hegemony Navy. Enforce order across the galaxy.',
    protagonist: 'Cadet → Admiral',
    missions: TERRAN_HEGEMONY_MISSIONS,
  },
  free_confederation: {
    factionId: 'free_confederation',
    name: 'The Rebel\'s Path',
    description: 'Fight for freedom against Hegemony oppression. Lead the revolution.',
    protagonist: 'Rebel → Revolutionary Leader',
    missions: FREE_CONFEDERATION_MISSIONS,
  },
  synthetic_collective: {
    factionId: 'synthetic_collective',
    name: 'Network Expansion',
    description: 'Expand the Collective. Eliminate organic inefficiency. Achieve unity.',
    protagonist: 'Unit → Prime Node',
    missions: SYNTHETIC_COLLECTIVE_MISSIONS,
  },
  void_corsairs: {
    factionId: 'void_corsairs',
    name: 'The Plunder Path',
    description: 'Plunder the galaxy. Build your fleet. Become the Pirate King.',
    protagonist: 'Crewmember → Pirate King',
    missions: VOID_CORSAIRS_MISSIONS,
  },
  ascendant_empire: {
    factionId: 'ascendant_empire',
    name: 'The Prophecy',
    description: 'Follow the ancient prophecy. Master your psionic abilities. Achieve Ascension.',
    protagonist: 'Initiate → Ascendant',
    missions: ASCENDANT_EMPIRE_MISSIONS,
  },
};

export function getCampaignMission(factionId: FactionId, missionNumber: number): CampaignMission | undefined {
  return FACTION_CAMPAIGNS[factionId]?.missions.find(m => m.missionNumber === missionNumber);
}

export function getMissionCount(factionId: FactionId): number {
  return FACTION_CAMPAIGNS[factionId]?.missions.length ?? 0;
}
