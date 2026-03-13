/**
 * Squad Builder System
 *
 * Implements X-Wing TMG style squad building with:
 * - Point-based squad construction
 * - Upgrade slot validation
 * - Unique card restrictions
 * - Faction restrictions
 * - Ship and pilot selection
 */

import type { FactionId, ShipSize } from '../config';
import type { ShipRole, ShipDefinition, ActionType, ShipStats } from '../core/types';
import {
  type UpgradeSlotType,
  type UpgradeDefinition,
  UPGRADE_DEFINITIONS,
  getDefaultUpgradeSlots,
  canEquipUpgrade,
  calculateUpgradesCost,
} from './UpgradeSystem';
import { PILOT_ABILITIES, type PilotAbility } from './PilotAbilities';
import { SHIP_DEFINITIONS } from '../data/ShipDefinitions';

// ============================================
// Squad Building Constants
// ============================================

export const SQUAD_POINT_LIMITS = {
  standard: 200,
  extended: 250,
  epic: 500,
  unlimited: Infinity,
} as const;

export type GameFormat = keyof typeof SQUAD_POINT_LIMITS;

// ============================================
// Pilot Card Definitions
// ============================================

export interface PilotCard {
  readonly id: string;
  readonly name: string;
  readonly shipId: string; // References ShipDefinition.id
  readonly faction: FactionId;
  readonly initiative: number; // 1-6 (skill level)
  readonly pointCost: number;
  readonly isUnique: boolean;
  readonly abilityText?: string;
  readonly abilityId?: string; // References PilotAbility.id
  readonly extraSlots?: UpgradeSlotType[]; // Additional slots this pilot adds
  readonly removedSlots?: UpgradeSlotType[]; // Slots this pilot removes
  readonly charges?: number;
  readonly force?: number; // For Force-sensitive pilots
  readonly limitedCount?: number; // How many can be in a squad (default 1 for unique)
}

// ============================================
// Squad Unit (Ship + Pilot + Upgrades)
// ============================================

export interface SquadUnit {
  readonly id: string; // Unique instance ID
  readonly pilotId: string;
  readonly shipId: string;
  readonly equippedUpgrades: string[]; // Upgrade IDs
  readonly customName?: string; // Optional custom name
}

export interface SquadUnitDetails {
  readonly unit: SquadUnit;
  readonly pilot: PilotCard;
  readonly ship: ShipDefinition;
  readonly upgrades: UpgradeDefinition[];
  readonly availableSlots: UpgradeSlotType[];
  readonly usedSlots: UpgradeSlotType[];
  readonly totalPointCost: number;
}

// ============================================
// Squad Definition
// ============================================

export interface Squad {
  readonly id: string;
  readonly name: string;
  readonly faction: FactionId;
  readonly format: GameFormat;
  readonly units: SquadUnit[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface SquadValidation {
  readonly isValid: boolean;
  readonly totalPoints: number;
  readonly pointLimit: number;
  readonly errors: SquadError[];
  readonly warnings: SquadWarning[];
}

export interface SquadError {
  readonly type: 'over_points' | 'duplicate_unique' | 'invalid_faction' | 'invalid_upgrade' | 'missing_required' | 'invalid_format';
  readonly message: string;
  readonly unitId?: string;
  readonly upgradeId?: string;
}

export interface SquadWarning {
  readonly type: 'suboptimal' | 'unused_points' | 'no_ships';
  readonly message: string;
}

// ============================================
// Pilot Database
// ============================================

export const PILOT_CARDS: Record<string, PilotCard> = {
  // ============================================
  // TERRAN HEGEMONY PILOTS
  // ============================================

  // Viper-class Interceptor pilots
  viper_cadet: {
    id: 'viper_cadet',
    name: 'Viper Cadet',
    shipId: 'terran_viper',
    faction: 'terran_hegemony',
    initiative: 1,
    pointCost: 32,
    isUnique: false,
  },
  viper_ace: {
    id: 'viper_ace',
    name: 'Viper Ace',
    shipId: 'terran_viper',
    faction: 'terran_hegemony',
    initiative: 3,
    pointCost: 40,
    isUnique: false,
  },
  commander_striker: {
    id: 'commander_striker',
    name: 'Commander Striker',
    shipId: 'terran_viper',
    faction: 'terran_hegemony',
    initiative: 5,
    pointCost: 52,
    isUnique: true,
    abilityText: 'After you perform a boost or barrel roll, you may acquire a lock on a ship in your bullseye arc.',
    abilityId: 'predator',
    extraSlots: ['talent'],
  },
  whisper_null: {
    id: 'whisper_null',
    name: 'Whisper Null',
    shipId: 'terran_viper',
    faction: 'terran_hegemony',
    initiative: 6,
    pointCost: 58,
    isUnique: true,
    abilityText: 'When defending, if the attacker is outside your firing arc, roll 1 additional defense die.',
    abilityId: 'elusive',
    extraSlots: ['talent', 'tech'],
  },

  // Gladius-class Fighter pilots
  gladius_pilot: {
    id: 'gladius_pilot',
    name: 'Gladius Pilot',
    shipId: 'terran_gladius',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 38,
    isUnique: false,
  },
  gladius_veteran: {
    id: 'gladius_veteran',
    name: 'Gladius Veteran',
    shipId: 'terran_gladius',
    faction: 'terran_hegemony',
    initiative: 3,
    pointCost: 45,
    isUnique: false,
  },
  iron_wolf: {
    id: 'iron_wolf',
    name: 'Iron Wolf',
    shipId: 'terran_gladius',
    faction: 'terran_hegemony',
    initiative: 4,
    pointCost: 52,
    isUnique: true,
    abilityText: 'When attacking, if you are not stressed, you may gain 1 stress to roll 1 additional attack die.',
    abilityId: 'fearless',
    extraSlots: ['talent', 'modification'],
  },

  // Hammer-class Bomber pilots
  hammer_crew: {
    id: 'hammer_crew',
    name: 'Hammer Crew',
    shipId: 'terran_hammer',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 42,
    isUnique: false,
  },
  deathbringer_ix: {
    id: 'deathbringer_ix',
    name: 'Deathbringer IX',
    shipId: 'terran_hammer',
    faction: 'terran_hegemony',
    initiative: 4,
    pointCost: 55,
    isUnique: true,
    abilityText: 'When you drop a bomb, you may use a speed 2 template instead of speed 1.',
    abilityId: 'bombardier',
    extraSlots: ['bomb', 'torpedo'],
  },
  captain_demolisher: {
    id: 'captain_demolisher',
    name: 'Captain Demolisher',
    shipId: 'terran_hammer',
    faction: 'terran_hegemony',
    initiative: 5,
    pointCost: 62,
    isUnique: true,
    abilityText: 'After you perform a torpedo or missile attack, you may acquire a lock on the defender.',
    abilityId: 'dead_eye',
    extraSlots: ['talent', 'gunner'],
  },

  // Sentinel-class Support pilots
  sentinel_crew: {
    id: 'sentinel_crew',
    name: 'Sentinel Crew',
    shipId: 'terran_sentinel',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 48,
    isUnique: false,
  },
  admiral_kaine: {
    id: 'admiral_kaine',
    name: 'Admiral Kaine',
    shipId: 'terran_sentinel',
    faction: 'terran_hegemony',
    initiative: 5,
    pointCost: 68,
    isUnique: true,
    abilityText: 'At the start of the Engagement Phase, you may choose up to 2 friendly ships at range 0-2. Those ships may perform a focus action.',
    abilityId: 'coordinated_assault',
    extraSlots: ['crew', 'crew', 'sensor'],
  },

  // ============================================
  // FREE CONFEDERATION PILOTS
  // ============================================

  // Sparrow Light Fighter pilots
  sparrow_rookie: {
    id: 'sparrow_rookie',
    name: 'Sparrow Rookie',
    shipId: 'confed_sparrow',
    faction: 'free_confederation',
    initiative: 1,
    pointCost: 22,
    isUnique: false,
  },
  sparrow_pilot: {
    id: 'sparrow_pilot',
    name: 'Sparrow Pilot',
    shipId: 'confed_sparrow',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 26,
    isUnique: false,
  },
  swift_sara: {
    id: 'swift_sara',
    name: 'Swift Sara',
    shipId: 'confed_sparrow',
    faction: 'free_confederation',
    initiative: 4,
    pointCost: 35,
    isUnique: true,
    abilityText: 'After you fully execute a maneuver, if you did not overlap a ship, you may perform a boost action.',
    abilityId: 'afterburners',
    extraSlots: ['talent'],
  },

  // Falcon Strike Fighter pilots
  falcon_pilot: {
    id: 'falcon_pilot',
    name: 'Falcon Pilot',
    shipId: 'confed_falcon',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 36,
    isUnique: false,
  },
  falcon_veteran: {
    id: 'falcon_veteran',
    name: 'Falcon Veteran',
    shipId: 'confed_falcon',
    faction: 'free_confederation',
    initiative: 3,
    pointCost: 42,
    isUnique: false,
  },
  hawk_rennick: {
    id: 'hawk_rennick',
    name: 'Hawk Rennick',
    shipId: 'confed_falcon',
    faction: 'free_confederation',
    initiative: 5,
    pointCost: 52,
    isUnique: true,
    abilityText: 'After you perform an attack, you may acquire a lock on the defender.',
    abilityId: 'predator',
    extraSlots: ['talent', 'missile'],
  },
  storm_keller: {
    id: 'storm_keller',
    name: 'Storm Keller',
    shipId: 'confed_falcon',
    faction: 'free_confederation',
    initiative: 6,
    pointCost: 58,
    isUnique: true,
    abilityText: 'When defending, if the attacker is in your front arc, you may reroll 1 defense die.',
    abilityId: 'elusive',
    extraSlots: ['talent', 'modification'],
  },

  // Raven Stealth Fighter pilots
  raven_pilot: {
    id: 'raven_pilot',
    name: 'Raven Pilot',
    shipId: 'confed_raven',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 38,
    isUnique: false,
  },
  shadow_lynx: {
    id: 'shadow_lynx',
    name: 'Shadow Lynx',
    shipId: 'confed_raven',
    faction: 'free_confederation',
    initiative: 5,
    pointCost: 55,
    isUnique: true,
    abilityText: 'After you decloak, you may perform an Evade action.',
    abilityId: 'phantom_strike',
    extraSlots: ['talent', 'tech'],
  },

  // Phoenix Gunship pilots
  phoenix_crew: {
    id: 'phoenix_crew',
    name: 'Phoenix Crew',
    shipId: 'confed_phoenix',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 52,
    isUnique: false,
  },
  captain_vex: {
    id: 'captain_vex',
    name: 'Captain Vex',
    shipId: 'confed_phoenix',
    faction: 'free_confederation',
    initiative: 4,
    pointCost: 68,
    isUnique: true,
    abilityText: 'At the start of the Engagement Phase, you may choose 1 friendly ship at range 0-2. That ship may perform a red Focus action.',
    abilityId: 'coordinated_assault',
    extraSlots: ['crew', 'gunner'],
  },
  firebird_quinn: {
    id: 'firebird_quinn',
    name: 'Firebird Quinn',
    shipId: 'confed_phoenix',
    faction: 'free_confederation',
    initiative: 5,
    pointCost: 75,
    isUnique: true,
    abilityText: 'When attacking with a turret weapon, you may reroll up to 2 attack dice.',
    abilityId: 'marksman',
    extraSlots: ['talent', 'gunner', 'modification'],
  },

  // ============================================
  // SYNTHETIC COLLECTIVE PILOTS
  // ============================================

  // Combat Drone pilots
  combat_drone_alpha: {
    id: 'combat_drone_alpha',
    name: 'Combat Drone Alpha',
    shipId: 'synth_drone',
    faction: 'synthetic_collective',
    initiative: 1,
    pointCost: 20,
    isUnique: false,
  },
  combat_drone_beta: {
    id: 'combat_drone_beta',
    name: 'Combat Drone Beta',
    shipId: 'synth_drone',
    faction: 'synthetic_collective',
    initiative: 2,
    pointCost: 24,
    isUnique: false,
  },
  unit_zero: {
    id: 'unit_zero',
    name: 'Unit Zero',
    shipId: 'synth_drone',
    faction: 'synthetic_collective',
    initiative: 4,
    pointCost: 32,
    isUnique: true,
    abilityText: 'When another friendly ship at range 0-1 defends, you may spend 1 calculate token. If you do, the defender gains 1 evade token.',
    abilityId: 'networked_aim',
    extraSlots: ['sensor'],
  },

  // Hunter Unit pilots
  hunter_protocol: {
    id: 'hunter_protocol',
    name: 'Hunter Protocol',
    shipId: 'synth_hunter',
    faction: 'synthetic_collective',
    initiative: 2,
    pointCost: 40,
    isUnique: false,
  },
  hunter_prime: {
    id: 'hunter_prime',
    name: 'Hunter Prime',
    shipId: 'synth_hunter',
    faction: 'synthetic_collective',
    initiative: 3,
    pointCost: 48,
    isUnique: false,
  },
  executioner_seven: {
    id: 'executioner_seven',
    name: 'Executioner Seven',
    shipId: 'synth_hunter',
    faction: 'synthetic_collective',
    initiative: 5,
    pointCost: 58,
    isUnique: true,
    abilityText: 'When attacking, if the defender has no green tokens, you may roll 1 additional attack die.',
    abilityId: 'ruthless',
    extraSlots: ['talent', 'cannon'],
  },

  // Carrier Node pilots
  carrier_node_basic: {
    id: 'carrier_node_basic',
    name: 'Carrier Node',
    shipId: 'synth_carrier',
    faction: 'synthetic_collective',
    initiative: 1,
    pointCost: 55,
    isUnique: false,
  },
  nexus_core: {
    id: 'nexus_core',
    name: 'Nexus Core',
    shipId: 'synth_carrier',
    faction: 'synthetic_collective',
    initiative: 4,
    pointCost: 72,
    isUnique: true,
    abilityText: 'At the start of the Activation Phase, you may transfer 1 calculate token to each friendly ship at range 0-2.',
    abilityId: 'swarm_tactics',
    extraSlots: ['crew', 'crew', 'sensor'],
  },
  overmind_alpha: {
    id: 'overmind_alpha',
    name: 'Overmind Alpha',
    shipId: 'synth_carrier',
    faction: 'synthetic_collective',
    initiative: 6,
    pointCost: 85,
    isUnique: true,
    abilityText: 'Friendly ships at range 0-3 may spend your calculate tokens as if they were their own.',
    abilityId: 'hive_mind',
    extraSlots: ['crew', 'sensor', 'modification'],
  },

  // Destroyer Protocol pilots
  destroyer_protocol: {
    id: 'destroyer_protocol',
    name: 'Destroyer Protocol',
    shipId: 'synth_destroyer',
    faction: 'synthetic_collective',
    initiative: 2,
    pointCost: 48,
    isUnique: false,
  },
  annihilator_nine: {
    id: 'annihilator_nine',
    name: 'Annihilator Nine',
    shipId: 'synth_destroyer',
    faction: 'synthetic_collective',
    initiative: 5,
    pointCost: 68,
    isUnique: true,
    abilityText: 'When you perform a torpedo attack, you may spend 1 calculate token to change 1 hit result to a critical hit result.',
    abilityId: 'dead_eye',
    extraSlots: ['torpedo', 'cannon'],
  },

  // ============================================
  // VOID CORSAIRS PILOTS
  // ============================================

  // Blade Raider pilots
  blade_raider: {
    id: 'blade_raider',
    name: 'Blade Raider',
    shipId: 'corsair_blade',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 32,
    isUnique: false,
  },
  blade_cutthroat: {
    id: 'blade_cutthroat',
    name: 'Blade Cutthroat',
    shipId: 'corsair_blade',
    faction: 'void_corsairs',
    initiative: 3,
    pointCost: 38,
    isUnique: false,
  },
  red_jenna: {
    id: 'red_jenna',
    name: 'Red Jenna',
    shipId: 'corsair_blade',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 50,
    isUnique: true,
    abilityText: 'After you fully execute a red maneuver, you may perform a bonus attack.',
    abilityId: 'daredevil',
    extraSlots: ['talent', 'modification'],
  },
  venom_sting: {
    id: 'venom_sting',
    name: 'Venom Sting',
    shipId: 'corsair_blade',
    faction: 'void_corsairs',
    initiative: 6,
    pointCost: 55,
    isUnique: true,
    abilityText: 'When attacking at range 1, you may change 1 focus result to a critical hit result.',
    abilityId: 'crack_shot',
    extraSlots: ['talent', 'missile'],
  },

  // Marauder Assault Ship pilots
  marauder_pilot: {
    id: 'marauder_pilot',
    name: 'Marauder Pilot',
    shipId: 'corsair_marauder',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 40,
    isUnique: false,
  },
  marauder_veteran: {
    id: 'marauder_veteran',
    name: 'Marauder Veteran',
    shipId: 'corsair_marauder',
    faction: 'void_corsairs',
    initiative: 3,
    pointCost: 48,
    isUnique: false,
  },
  iron_fist_mora: {
    id: 'iron_fist_mora',
    name: 'Iron Fist Mora',
    shipId: 'corsair_marauder',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 60,
    isUnique: true,
    abilityText: 'When attacking, you may spend 1 focus token to change all focus results to hit results.',
    abilityId: 'marksman',
    extraSlots: ['talent', 'gunner', 'modification'],
  },

  // Specter Infiltrator pilots
  specter_pilot: {
    id: 'specter_pilot',
    name: 'Specter Pilot',
    shipId: 'corsair_specter',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 38,
    isUnique: false,
  },
  ghost_dancer: {
    id: 'ghost_dancer',
    name: 'Ghost Dancer',
    shipId: 'corsair_specter',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 55,
    isUnique: true,
    abilityText: 'After you perform a cloak action, you may perform a barrel roll.',
    abilityId: 'phantom_strike',
    extraSlots: ['talent', 'tech'],
  },

  // Reaver Gunboat pilots
  reaver_crew: {
    id: 'reaver_crew',
    name: 'Reaver Crew',
    shipId: 'corsair_reaver',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 52,
    isUnique: false,
  },
  bloodaxe_thorne: {
    id: 'bloodaxe_thorne',
    name: 'Bloodaxe Thorne',
    shipId: 'corsair_reaver',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 72,
    isUnique: true,
    abilityText: 'When attacking with your primary weapon, you may spend 1 focus to add 1 hit result.',
    abilityId: 'heavy_gunner',
    extraSlots: ['talent', 'gunner', 'crew'],
  },

  // ============================================
  // ASCENDANT EMPIRE PILOTS
  // ============================================

  // Seraph Guardian pilots
  seraph_initiate: {
    id: 'seraph_initiate',
    name: 'Seraph Initiate',
    shipId: 'ascendant_seraph',
    faction: 'ascendant_empire',
    initiative: 1,
    pointCost: 38,
    isUnique: false,
  },
  seraph_guardian: {
    id: 'seraph_guardian',
    name: 'Seraph Guardian',
    shipId: 'ascendant_seraph',
    faction: 'ascendant_empire',
    initiative: 3,
    pointCost: 48,
    isUnique: false,
  },
  divine_seraphina: {
    id: 'divine_seraphina',
    name: 'Divine Seraphina',
    shipId: 'ascendant_seraph',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 60,
    isUnique: true,
    abilityText: 'When you spend a Force charge, you may perform a boost or barrel roll action.',
    abilityId: 'supernatural_reflexes',
    force: 2,
    extraSlots: ['talent', 'force_power'],
  },
  archon_prime: {
    id: 'archon_prime',
    name: 'Archon Prime',
    shipId: 'ascendant_seraph',
    faction: 'ascendant_empire',
    initiative: 6,
    pointCost: 68,
    isUnique: true,
    abilityText: 'When attacking or defending, you may spend 1 Force charge to change 1 blank result to a focus result.',
    abilityId: 'prescience',
    force: 3,
    extraSlots: ['talent', 'force_power'],
  },

  // Templar Heavy Fighter pilots
  templar_knight: {
    id: 'templar_knight',
    name: 'Templar Knight',
    shipId: 'ascendant_templar',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 42,
    isUnique: false,
  },
  templar_champion: {
    id: 'templar_champion',
    name: 'Templar Champion',
    shipId: 'ascendant_templar',
    faction: 'ascendant_empire',
    initiative: 3,
    pointCost: 50,
    isUnique: false,
  },
  crusader_vorn: {
    id: 'crusader_vorn',
    name: 'Crusader Vorn',
    shipId: 'ascendant_templar',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 62,
    isUnique: true,
    abilityText: 'When you perform a reinforce action, gain 1 focus token.',
    abilityId: 'stalwart',
    extraSlots: ['talent', 'modification'],
  },

  // Oracle Support Craft pilots
  oracle_acolyte: {
    id: 'oracle_acolyte',
    name: 'Oracle Acolyte',
    shipId: 'ascendant_oracle',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 45,
    isUnique: false,
  },
  high_seer_mira: {
    id: 'high_seer_mira',
    name: 'High Seer Mira',
    shipId: 'ascendant_oracle',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 65,
    isUnique: true,
    abilityText: 'At the start of the Engagement Phase, you may spend 1 Force charge. If you do, each friendly ship at range 0-2 may remove 1 red token.',
    abilityId: 'force_heal',
    force: 2,
    extraSlots: ['crew', 'force_power', 'sensor'],
  },

  // Avatar Assault Ship pilots
  avatar_crew: {
    id: 'avatar_crew',
    name: 'Avatar Crew',
    shipId: 'ascendant_avatar',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 58,
    isUnique: false,
  },
  warlord_darius: {
    id: 'warlord_darius',
    name: 'Warlord Darius',
    shipId: 'ascendant_avatar',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 82,
    isUnique: true,
    abilityText: 'When a friendly ship at range 0-2 attacks, you may spend 1 Force charge. If you do, the attacker may reroll up to 2 attack dice.',
    abilityId: 'force_guidance',
    force: 2,
    extraSlots: ['talent', 'crew', 'gunner', 'force_power'],
  },
  grand_avatar: {
    id: 'grand_avatar',
    name: 'Grand Avatar',
    shipId: 'ascendant_avatar',
    faction: 'ascendant_empire',
    initiative: 6,
    pointCost: 92,
    isUnique: true,
    abilityText: 'At the start of the Engagement Phase, you may choose 1 enemy ship at range 0-3. That ship gains 1 stress token.',
    abilityId: 'force_push',
    force: 3,
    extraSlots: ['talent', 'crew', 'gunner', 'force_power', 'modification'],
  },

  // ============================================
  // NEW TERRAN HEGEMONY PILOTS (for expanded ships)
  // ============================================

  // Stiletto Light Fighter
  stiletto_cadet: {
    id: 'stiletto_cadet',
    name: 'Stiletto Cadet',
    shipId: 'terran_stiletto',
    faction: 'terran_hegemony',
    initiative: 1,
    pointCost: 22,
    isUnique: false,
  },
  stiletto_pilot: {
    id: 'stiletto_pilot',
    name: 'Stiletto Pilot',
    shipId: 'terran_stiletto',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 26,
    isUnique: false,
  },
  viper_dash: {
    id: 'viper_dash',
    name: 'Viper Dash',
    shipId: 'terran_stiletto',
    faction: 'terran_hegemony',
    initiative: 4,
    pointCost: 34,
    isUnique: true,
    abilityText: 'After you fully execute a maneuver, you may perform a barrel roll action.',
    abilityId: 'afterburners',
    extraSlots: ['talent'],
  },

  // Raptor Strike Fighter
  raptor_pilot: {
    id: 'raptor_pilot',
    name: 'Raptor Pilot',
    shipId: 'terran_raptor',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 40,
    isUnique: false,
  },
  raptor_ace: {
    id: 'raptor_ace',
    name: 'Raptor Ace',
    shipId: 'terran_raptor',
    faction: 'terran_hegemony',
    initiative: 3,
    pointCost: 46,
    isUnique: false,
  },
  talon_reyes: {
    id: 'talon_reyes',
    name: 'Talon Reyes',
    shipId: 'terran_raptor',
    faction: 'terran_hegemony',
    initiative: 5,
    pointCost: 56,
    isUnique: true,
    abilityText: 'When attacking, if the defender is in your bullseye arc, roll 1 additional attack die.',
    abilityId: 'predator',
    extraSlots: ['talent', 'modification'],
  },

  // Centurion Heavy Fighter
  centurion_pilot: {
    id: 'centurion_pilot',
    name: 'Centurion Pilot',
    shipId: 'terran_centurion',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 48,
    isUnique: false,
  },
  centurion_veteran: {
    id: 'centurion_veteran',
    name: 'Centurion Veteran',
    shipId: 'terran_centurion',
    faction: 'terran_hegemony',
    initiative: 3,
    pointCost: 54,
    isUnique: false,
  },
  shield_breaker_kane: {
    id: 'shield_breaker_kane',
    name: 'Shield Breaker Kane',
    shipId: 'terran_centurion',
    faction: 'terran_hegemony',
    initiative: 5,
    pointCost: 66,
    isUnique: true,
    abilityText: 'When attacking, you may spend 1 focus token to change 1 hit result to a critical hit result.',
    abilityId: 'ruthless',
    extraSlots: ['talent', 'gunner'],
  },

  // Praetorian Fighter
  praetorian_pilot: {
    id: 'praetorian_pilot',
    name: 'Praetorian Pilot',
    shipId: 'terran_praetorian',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 50,
    isUnique: false,
  },
  praetorian_guard: {
    id: 'praetorian_guard',
    name: 'Praetorian Guard',
    shipId: 'terran_praetorian',
    faction: 'terran_hegemony',
    initiative: 3,
    pointCost: 56,
    isUnique: false,
  },
  steel_marcus: {
    id: 'steel_marcus',
    name: 'Steel Marcus',
    shipId: 'terran_praetorian',
    faction: 'terran_hegemony',
    initiative: 5,
    pointCost: 68,
    isUnique: true,
    abilityText: 'When defending, you may reroll 1 defense die for each friendly ship at range 0-1.',
    abilityId: 'stalwart',
    extraSlots: ['talent', 'modification'],
  },

  // Legionnaire Fighter
  legionnaire_pilot: {
    id: 'legionnaire_pilot',
    name: 'Legionnaire Pilot',
    shipId: 'terran_legionnaire',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 46,
    isUnique: false,
  },
  legion_master_vex: {
    id: 'legion_master_vex',
    name: 'Legion Master Vex',
    shipId: 'terran_legionnaire',
    faction: 'terran_hegemony',
    initiative: 4,
    pointCost: 58,
    isUnique: true,
    abilityText: 'At the start of the Engagement Phase, you may choose 1 friendly ship at range 0-1. That ship may perform a focus action.',
    abilityId: 'coordinated_assault',
    extraSlots: ['talent', 'crew'],
  },

  // Thunderbolt Bomber
  thunderbolt_crew: {
    id: 'thunderbolt_crew',
    name: 'Thunderbolt Crew',
    shipId: 'terran_thunderbolt',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 46,
    isUnique: false,
  },
  stormbringer_cole: {
    id: 'stormbringer_cole',
    name: 'Stormbringer Cole',
    shipId: 'terran_thunderbolt',
    faction: 'terran_hegemony',
    initiative: 4,
    pointCost: 60,
    isUnique: true,
    abilityText: 'When you drop a bomb, you may use a speed 2 template instead of speed 1.',
    abilityId: 'bombardier',
    extraSlots: ['talent', 'bomb'],
  },

  // Javelin Torpedo Bomber
  javelin_crew: {
    id: 'javelin_crew',
    name: 'Javelin Crew',
    shipId: 'terran_javelin',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 48,
    isUnique: false,
  },
  javelin_veteran: {
    id: 'javelin_veteran',
    name: 'Javelin Veteran',
    shipId: 'terran_javelin',
    faction: 'terran_hegemony',
    initiative: 3,
    pointCost: 54,
    isUnique: false,
  },
  torpedo_ace_zara: {
    id: 'torpedo_ace_zara',
    name: 'Torpedo Ace Zara',
    shipId: 'terran_javelin',
    faction: 'terran_hegemony',
    initiative: 5,
    pointCost: 68,
    isUnique: true,
    abilityText: 'When you perform a torpedo attack, you may reroll up to 2 attack dice.',
    abilityId: 'dead_eye',
    extraSlots: ['talent', 'torpedo'],
  },

  // Guardian Support Ship
  guardian_crew: {
    id: 'guardian_crew',
    name: 'Guardian Crew',
    shipId: 'terran_guardian',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 52,
    isUnique: false,
  },
  shield_commander_ross: {
    id: 'shield_commander_ross',
    name: 'Shield Commander Ross',
    shipId: 'terran_guardian',
    faction: 'terran_hegemony',
    initiative: 4,
    pointCost: 68,
    isUnique: true,
    abilityText: 'At the start of the Combat Phase, you may transfer 1 shield token to a friendly ship at range 0-1.',
    abilityId: 'shield_transfer',
    extraSlots: ['crew', 'sensor'],
  },

  // Harbinger Support Cruiser
  harbinger_crew: {
    id: 'harbinger_crew',
    name: 'Harbinger Crew',
    shipId: 'terran_harbinger',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 58,
    isUnique: false,
  },
  fleet_admiral_cross: {
    id: 'fleet_admiral_cross',
    name: 'Fleet Admiral Cross',
    shipId: 'terran_harbinger',
    faction: 'terran_hegemony',
    initiative: 5,
    pointCost: 78,
    isUnique: true,
    abilityText: 'At the start of the Activation Phase, you may choose up to 3 friendly ships at range 0-3. Those ships may remove 1 stress token.',
    abilityId: 'inspiring_presence',
    extraSlots: ['crew', 'crew', 'sensor'],
  },

  // Bastion Gunship
  bastion_crew: {
    id: 'bastion_crew',
    name: 'Bastion Crew',
    shipId: 'terran_bastion',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 56,
    isUnique: false,
  },
  fortress_gunner_wade: {
    id: 'fortress_gunner_wade',
    name: 'Fortress Gunner Wade',
    shipId: 'terran_bastion',
    faction: 'terran_hegemony',
    initiative: 4,
    pointCost: 72,
    isUnique: true,
    abilityText: 'When attacking with a turret weapon, you may reroll 1 attack die.',
    abilityId: 'heavy_gunner',
    extraSlots: ['gunner', 'modification'],
  },

  // Bulwark Heavy Gunship
  bulwark_crew: {
    id: 'bulwark_crew',
    name: 'Bulwark Crew',
    shipId: 'terran_bulwark',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 62,
    isUnique: false,
  },
  captain_ironside: {
    id: 'captain_ironside',
    name: 'Captain Ironside',
    shipId: 'terran_bulwark',
    faction: 'terran_hegemony',
    initiative: 4,
    pointCost: 78,
    isUnique: true,
    abilityText: 'When defending, if you have a reinforce token, add 1 evade result.',
    abilityId: 'stalwart',
    extraSlots: ['talent', 'gunner', 'crew'],
  },

  // Vindicator Assault Gunship
  vindicator_crew: {
    id: 'vindicator_crew',
    name: 'Vindicator Crew',
    shipId: 'terran_vindicator',
    faction: 'terran_hegemony',
    initiative: 2,
    pointCost: 68,
    isUnique: false,
  },
  wrath_of_mars: {
    id: 'wrath_of_mars',
    name: 'Wrath of Mars',
    shipId: 'terran_vindicator',
    faction: 'terran_hegemony',
    initiative: 5,
    pointCost: 88,
    isUnique: true,
    abilityText: 'When attacking, you may spend 1 charge to add 1 hit result.',
    abilityId: 'heavy_gunner',
    charges: 3,
    extraSlots: ['talent', 'gunner', 'gunner', 'crew'],
  },

  // Imperator Capital Ship
  imperator_crew: {
    id: 'imperator_crew',
    name: 'Imperator Crew',
    shipId: 'terran_imperator',
    faction: 'terran_hegemony',
    initiative: 1,
    pointCost: 90,
    isUnique: false,
  },
  grand_admiral_nero: {
    id: 'grand_admiral_nero',
    name: 'Grand Admiral Nero',
    shipId: 'terran_imperator',
    faction: 'terran_hegemony',
    initiative: 4,
    pointCost: 120,
    isUnique: true,
    abilityText: 'Friendly ships at range 0-3 may spend your focus tokens as if they were their own.',
    abilityId: 'coordinated_assault',
    extraSlots: ['crew', 'crew', 'crew', 'gunner'],
  },

  // Dominator Battleship
  dominator_crew: {
    id: 'dominator_crew',
    name: 'Dominator Crew',
    shipId: 'terran_dominator',
    faction: 'terran_hegemony',
    initiative: 1,
    pointCost: 110,
    isUnique: false,
  },
  conqueror_prime: {
    id: 'conqueror_prime',
    name: 'Conqueror Prime',
    shipId: 'terran_dominator',
    faction: 'terran_hegemony',
    initiative: 4,
    pointCost: 145,
    isUnique: true,
    abilityText: 'At the start of the Combat Phase, you may choose 1 enemy ship at range 0-4. That ship gains 1 stress token.',
    abilityId: 'intimidation',
    extraSlots: ['crew', 'crew', 'gunner', 'gunner'],
  },

  // Executor Dreadnought
  executor_crew: {
    id: 'executor_crew',
    name: 'Executor Crew',
    shipId: 'terran_executor',
    faction: 'terran_hegemony',
    initiative: 1,
    pointCost: 130,
    isUnique: false,
  },
  supreme_commander_ash: {
    id: 'supreme_commander_ash',
    name: 'Supreme Commander Ash',
    shipId: 'terran_executor',
    faction: 'terran_hegemony',
    initiative: 5,
    pointCost: 175,
    isUnique: true,
    abilityText: 'At the start of each round, you may acquire a lock on an enemy ship at range 0-5.',
    abilityId: 'predator',
    extraSlots: ['crew', 'crew', 'crew', 'gunner', 'gunner'],
  },

  // Consul Command Ship
  consul_crew: {
    id: 'consul_crew',
    name: 'Consul Crew',
    shipId: 'terran_consul',
    faction: 'terran_hegemony',
    initiative: 1,
    pointCost: 78,
    isUnique: false,
  },
  high_consul_vera: {
    id: 'high_consul_vera',
    name: 'High Consul Vera',
    shipId: 'terran_consul',
    faction: 'terran_hegemony',
    initiative: 4,
    pointCost: 105,
    isUnique: true,
    abilityText: 'At the start of the Activation Phase, each friendly ship at range 0-3 may perform a coordinate action.',
    abilityId: 'coordinated_assault',
    extraSlots: ['crew', 'crew', 'sensor', 'sensor'],
  },

  // ============================================
  // NEW FREE CONFEDERATION PILOTS
  // ============================================

  // Wasp Light Fighter
  wasp_rookie: {
    id: 'wasp_rookie',
    name: 'Wasp Rookie',
    shipId: 'confed_wasp',
    faction: 'free_confederation',
    initiative: 1,
    pointCost: 20,
    isUnique: false,
  },
  wasp_pilot: {
    id: 'wasp_pilot',
    name: 'Wasp Pilot',
    shipId: 'confed_wasp',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 24,
    isUnique: false,
  },
  stinger_webb: {
    id: 'stinger_webb',
    name: 'Stinger Webb',
    shipId: 'confed_wasp',
    faction: 'free_confederation',
    initiative: 4,
    pointCost: 32,
    isUnique: true,
    abilityText: 'After you perform an attack that misses, you may perform a boost action.',
    abilityId: 'afterburners',
    extraSlots: ['talent'],
  },

  // Finch Scout
  finch_pilot: {
    id: 'finch_pilot',
    name: 'Finch Pilot',
    shipId: 'confed_finch',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 22,
    isUnique: false,
  },
  scout_master_piper: {
    id: 'scout_master_piper',
    name: 'Scout Master Piper',
    shipId: 'confed_finch',
    faction: 'free_confederation',
    initiative: 4,
    pointCost: 30,
    isUnique: true,
    abilityText: 'At the start of the Planning Phase, if you are not stressed, you may look at 1 enemy ships dial.',
    abilityId: 'informant',
    extraSlots: ['sensor'],
  },

  // Kestrel Interceptor
  kestrel_pilot: {
    id: 'kestrel_pilot',
    name: 'Kestrel Pilot',
    shipId: 'confed_kestrel',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 30,
    isUnique: false,
  },
  kestrel_ace: {
    id: 'kestrel_ace',
    name: 'Kestrel Ace',
    shipId: 'confed_kestrel',
    faction: 'free_confederation',
    initiative: 3,
    pointCost: 36,
    isUnique: false,
  },
  striker_vale: {
    id: 'striker_vale',
    name: 'Striker Vale',
    shipId: 'confed_kestrel',
    faction: 'free_confederation',
    initiative: 5,
    pointCost: 46,
    isUnique: true,
    abilityText: 'When attacking at range 1, you may roll 1 additional attack die.',
    abilityId: 'crack_shot',
    extraSlots: ['talent', 'modification'],
  },

  // Hawk Heavy Fighter
  hawk_pilot: {
    id: 'hawk_pilot',
    name: 'Hawk Pilot',
    shipId: 'confed_hawk',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 38,
    isUnique: false,
  },
  hawk_veteran: {
    id: 'hawk_veteran',
    name: 'Hawk Veteran',
    shipId: 'confed_hawk',
    faction: 'free_confederation',
    initiative: 3,
    pointCost: 44,
    isUnique: false,
  },
  ironwing_chen: {
    id: 'ironwing_chen',
    name: 'Ironwing Chen',
    shipId: 'confed_hawk',
    faction: 'free_confederation',
    initiative: 5,
    pointCost: 56,
    isUnique: true,
    abilityText: 'When defending, you may spend 1 focus to cancel 1 hit result.',
    abilityId: 'elusive',
    extraSlots: ['talent', 'missile'],
  },

  // Eagle Strike Fighter
  eagle_pilot: {
    id: 'eagle_pilot',
    name: 'Eagle Pilot',
    shipId: 'confed_eagle',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 42,
    isUnique: false,
  },
  sky_commander_rex: {
    id: 'sky_commander_rex',
    name: 'Sky Commander Rex',
    shipId: 'confed_eagle',
    faction: 'free_confederation',
    initiative: 5,
    pointCost: 58,
    isUnique: true,
    abilityText: 'At the start of the Engagement Phase, you may choose 1 friendly ship at range 0-2. That ship may acquire a lock.',
    abilityId: 'coordinated_assault',
    extraSlots: ['talent', 'modification'],
  },

  // Condor Assault Fighter
  condor_pilot: {
    id: 'condor_pilot',
    name: 'Condor Pilot',
    shipId: 'confed_condor',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 46,
    isUnique: false,
  },
  warhawk_santos: {
    id: 'warhawk_santos',
    name: 'Warhawk Santos',
    shipId: 'confed_condor',
    faction: 'free_confederation',
    initiative: 5,
    pointCost: 62,
    isUnique: true,
    abilityText: 'When attacking, if you are not stressed, you may gain 1 stress to roll 1 additional attack die.',
    abilityId: 'fearless',
    extraSlots: ['talent', 'gunner'],
  },

  // Owl Stealth Scout
  owl_pilot: {
    id: 'owl_pilot',
    name: 'Owl Pilot',
    shipId: 'confed_owl',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 36,
    isUnique: false,
  },
  night_hunter_nova: {
    id: 'night_hunter_nova',
    name: 'Night Hunter Nova',
    shipId: 'confed_owl',
    faction: 'free_confederation',
    initiative: 5,
    pointCost: 50,
    isUnique: true,
    abilityText: 'While you are cloaked, enemy ships cannot acquire locks on you.',
    abilityId: 'phantom_strike',
    extraSlots: ['talent', 'tech'],
  },

  // Pelican Bomber
  pelican_crew: {
    id: 'pelican_crew',
    name: 'Pelican Crew',
    shipId: 'confed_pelican',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 44,
    isUnique: false,
  },
  bomb_master_hayes: {
    id: 'bomb_master_hayes',
    name: 'Bomb Master Hayes',
    shipId: 'confed_pelican',
    faction: 'free_confederation',
    initiative: 4,
    pointCost: 58,
    isUnique: true,
    abilityText: 'When you drop a bomb, you may choose to drop it from your front guides instead of rear guides.',
    abilityId: 'bombardier',
    extraSlots: ['talent', 'bomb'],
  },

  // Albatross Heavy Bomber
  albatross_crew: {
    id: 'albatross_crew',
    name: 'Albatross Crew',
    shipId: 'confed_albatross',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 52,
    isUnique: false,
  },
  thunder_mason: {
    id: 'thunder_mason',
    name: 'Thunder Mason',
    shipId: 'confed_albatross',
    faction: 'free_confederation',
    initiative: 4,
    pointCost: 70,
    isUnique: true,
    abilityText: 'After you perform a torpedo attack, you may acquire a lock on another ship at range 1-2.',
    abilityId: 'dead_eye',
    extraSlots: ['torpedo', 'torpedo', 'gunner'],
  },

  // Thunderbird Heavy Gunship
  thunderbird_crew: {
    id: 'thunderbird_crew',
    name: 'Thunderbird Crew',
    shipId: 'confed_thunderbird',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 58,
    isUnique: false,
  },
  stormlord_kai: {
    id: 'stormlord_kai',
    name: 'Stormlord Kai',
    shipId: 'confed_thunderbird',
    faction: 'free_confederation',
    initiative: 5,
    pointCost: 78,
    isUnique: true,
    abilityText: 'When attacking with a turret weapon, you may spend 1 focus to add 1 hit result.',
    abilityId: 'heavy_gunner',
    extraSlots: ['talent', 'gunner', 'crew'],
  },

  // Harrier Strike Gunship
  harrier_crew: {
    id: 'harrier_crew',
    name: 'Harrier Crew',
    shipId: 'confed_harrier',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 52,
    isUnique: false,
  },
  swooping_death_jin: {
    id: 'swooping_death_jin',
    name: 'Swooping Death Jin',
    shipId: 'confed_harrier',
    faction: 'free_confederation',
    initiative: 5,
    pointCost: 70,
    isUnique: true,
    abilityText: 'After you fully execute a maneuver, you may perform a primary attack.',
    abilityId: 'predator',
    extraSlots: ['talent', 'missile', 'gunner'],
  },

  // Crane Support Ship
  crane_crew: {
    id: 'crane_crew',
    name: 'Crane Crew',
    shipId: 'confed_crane',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 48,
    isUnique: false,
  },
  mercy_pilot_lee: {
    id: 'mercy_pilot_lee',
    name: 'Mercy Pilot Lee',
    shipId: 'confed_crane',
    faction: 'free_confederation',
    initiative: 4,
    pointCost: 62,
    isUnique: true,
    abilityText: 'At the start of the Combat Phase, you may transfer 1 shield to a friendly ship at range 0-1.',
    abilityId: 'shield_transfer',
    extraSlots: ['crew', 'sensor'],
  },

  // Heron Medical Ship
  heron_crew: {
    id: 'heron_crew',
    name: 'Heron Crew',
    shipId: 'confed_heron',
    faction: 'free_confederation',
    initiative: 2,
    pointCost: 52,
    isUnique: false,
  },
  chief_medic_strand: {
    id: 'chief_medic_strand',
    name: 'Chief Medic Strand',
    shipId: 'confed_heron',
    faction: 'free_confederation',
    initiative: 4,
    pointCost: 68,
    isUnique: true,
    abilityText: 'At the start of the End Phase, each friendly ship at range 0-2 may recover 1 shield.',
    abilityId: 'healing_aura',
    extraSlots: ['crew', 'crew', 'sensor'],
  },

  // Liberty Carrier
  liberty_crew: {
    id: 'liberty_crew',
    name: 'Liberty Crew',
    shipId: 'confed_liberty',
    faction: 'free_confederation',
    initiative: 1,
    pointCost: 82,
    isUnique: false,
  },
  admiral_freedom: {
    id: 'admiral_freedom',
    name: 'Admiral Freedom',
    shipId: 'confed_liberty',
    faction: 'free_confederation',
    initiative: 4,
    pointCost: 110,
    isUnique: true,
    abilityText: 'At the start of each round, friendly ships at range 0-3 may perform a coordinate action.',
    abilityId: 'coordinated_assault',
    extraSlots: ['crew', 'crew', 'crew', 'sensor'],
  },

  // Independence Cruiser
  independence_crew: {
    id: 'independence_crew',
    name: 'Independence Crew',
    shipId: 'confed_independence',
    faction: 'free_confederation',
    initiative: 1,
    pointCost: 95,
    isUnique: false,
  },
  rebel_commander_blake: {
    id: 'rebel_commander_blake',
    name: 'Rebel Commander Blake',
    shipId: 'confed_independence',
    faction: 'free_confederation',
    initiative: 4,
    pointCost: 125,
    isUnique: true,
    abilityText: 'When a friendly ship at range 0-3 attacks, it may reroll 1 attack die.',
    abilityId: 'inspiring_presence',
    extraSlots: ['crew', 'crew', 'gunner', 'sensor'],
  },

  // Defiance Battlecruiser
  defiance_crew: {
    id: 'defiance_crew',
    name: 'Defiance Crew',
    shipId: 'confed_defiance',
    faction: 'free_confederation',
    initiative: 1,
    pointCost: 105,
    isUnique: false,
  },
  hero_of_liberation: {
    id: 'hero_of_liberation',
    name: 'Hero of Liberation',
    shipId: 'confed_defiance',
    faction: 'free_confederation',
    initiative: 5,
    pointCost: 140,
    isUnique: true,
    abilityText: 'Friendly ships at range 0-2 roll 1 additional defense die when defending against attacks from ships at range 3 or greater.',
    abilityId: 'stalwart',
    extraSlots: ['crew', 'crew', 'crew', 'gunner', 'gunner'],
  },

  // ============================================
  // NEW SYNTHETIC COLLECTIVE PILOTS
  // ============================================

  // Scout Drone
  scout_drone_alpha: {
    id: 'scout_drone_alpha',
    name: 'Scout Drone Alpha',
    shipId: 'synth_scout_drone',
    faction: 'synthetic_collective',
    initiative: 1,
    pointCost: 16,
    isUnique: false,
  },
  scout_drone_beta: {
    id: 'scout_drone_beta',
    name: 'Scout Drone Beta',
    shipId: 'synth_scout_drone',
    faction: 'synthetic_collective',
    initiative: 2,
    pointCost: 20,
    isUnique: false,
  },
  observer_prime: {
    id: 'observer_prime',
    name: 'Observer Prime',
    shipId: 'synth_scout_drone',
    faction: 'synthetic_collective',
    initiative: 4,
    pointCost: 28,
    isUnique: true,
    abilityText: 'At the start of the Planning Phase, you may choose 1 enemy ship at range 0-3. All friendly ships may acquire a lock on that ship.',
    abilityId: 'networked_aim',
    extraSlots: ['sensor'],
  },

  // Heavy Drone
  heavy_drone_alpha: {
    id: 'heavy_drone_alpha',
    name: 'Heavy Drone Alpha',
    shipId: 'synth_heavy_drone',
    faction: 'synthetic_collective',
    initiative: 1,
    pointCost: 26,
    isUnique: false,
  },
  heavy_drone_beta: {
    id: 'heavy_drone_beta',
    name: 'Heavy Drone Beta',
    shipId: 'synth_heavy_drone',
    faction: 'synthetic_collective',
    initiative: 2,
    pointCost: 30,
    isUnique: false,
  },
  assault_core: {
    id: 'assault_core',
    name: 'Assault Core',
    shipId: 'synth_heavy_drone',
    faction: 'synthetic_collective',
    initiative: 4,
    pointCost: 40,
    isUnique: true,
    abilityText: 'When attacking, if there is another friendly ship at range 0-1 of the defender, roll 1 additional attack die.',
    abilityId: 'swarm_tactics',
    extraSlots: ['sensor', 'cannon'],
  },

  // Bomber Drone
  bomber_drone_alpha: {
    id: 'bomber_drone_alpha',
    name: 'Bomber Drone Alpha',
    shipId: 'synth_bomber_drone',
    faction: 'synthetic_collective',
    initiative: 1,
    pointCost: 28,
    isUnique: false,
  },
  demolition_unit: {
    id: 'demolition_unit',
    name: 'Demolition Unit',
    shipId: 'synth_bomber_drone',
    faction: 'synthetic_collective',
    initiative: 3,
    pointCost: 38,
    isUnique: true,
    abilityText: 'When you are destroyed, each ship at range 0-1 suffers 1 damage.',
    abilityId: 'self_destruct',
    extraSlots: ['bomb'],
  },

  // Interceptor Drone
  interceptor_drone_alpha: {
    id: 'interceptor_drone_alpha',
    name: 'Interceptor Drone Alpha',
    shipId: 'synth_interceptor_drone',
    faction: 'synthetic_collective',
    initiative: 2,
    pointCost: 24,
    isUnique: false,
  },
  interceptor_drone_beta: {
    id: 'interceptor_drone_beta',
    name: 'Interceptor Drone Beta',
    shipId: 'synth_interceptor_drone',
    faction: 'synthetic_collective',
    initiative: 3,
    pointCost: 28,
    isUnique: false,
  },
  pursuit_protocol: {
    id: 'pursuit_protocol',
    name: 'Pursuit Protocol',
    shipId: 'synth_interceptor_drone',
    faction: 'synthetic_collective',
    initiative: 5,
    pointCost: 38,
    isUnique: true,
    abilityText: 'After an enemy ship at range 0-2 executes a maneuver, you may perform a boost action.',
    abilityId: 'afterburners',
    extraSlots: ['sensor'],
  },

  // Stalker Unit
  stalker_protocol: {
    id: 'stalker_protocol',
    name: 'Stalker Protocol',
    shipId: 'synth_stalker',
    faction: 'synthetic_collective',
    initiative: 2,
    pointCost: 42,
    isUnique: false,
  },
  shadow_hunter: {
    id: 'shadow_hunter',
    name: 'Shadow Hunter',
    shipId: 'synth_stalker',
    faction: 'synthetic_collective',
    initiative: 5,
    pointCost: 58,
    isUnique: true,
    abilityText: 'When attacking a ship that has no focus or evade tokens, roll 1 additional attack die.',
    abilityId: 'ruthless',
    extraSlots: ['talent', 'cannon'],
  },

  // Ravager Unit
  ravager_protocol: {
    id: 'ravager_protocol',
    name: 'Ravager Protocol',
    shipId: 'synth_ravager',
    faction: 'synthetic_collective',
    initiative: 2,
    pointCost: 48,
    isUnique: false,
  },
  decimator_prime: {
    id: 'decimator_prime',
    name: 'Decimator Prime',
    shipId: 'synth_ravager',
    faction: 'synthetic_collective',
    initiative: 5,
    pointCost: 66,
    isUnique: true,
    abilityText: 'When attacking, you may spend 2 calculate tokens to change 1 focus result to a critical hit result.',
    abilityId: 'ruthless',
    extraSlots: ['cannon', 'missile'],
  },

  // Predator Unit
  predator_protocol: {
    id: 'predator_protocol',
    name: 'Predator Protocol',
    shipId: 'synth_predator',
    faction: 'synthetic_collective',
    initiative: 2,
    pointCost: 52,
    isUnique: false,
  },
  apex_hunter: {
    id: 'apex_hunter',
    name: 'Apex Hunter',
    shipId: 'synth_predator',
    faction: 'synthetic_collective',
    initiative: 5,
    pointCost: 72,
    isUnique: true,
    abilityText: 'When you perform an attack, if the defender has fewer hull points than their starting value, roll 1 additional attack die.',
    abilityId: 'predator',
    extraSlots: ['talent', 'cannon', 'sensor'],
  },

  // Annihilator Unit
  annihilator_protocol: {
    id: 'annihilator_protocol',
    name: 'Annihilator Protocol',
    shipId: 'synth_annihilator',
    faction: 'synthetic_collective',
    initiative: 2,
    pointCost: 56,
    isUnique: false,
  },
  extinction_unit: {
    id: 'extinction_unit',
    name: 'Extinction Unit',
    shipId: 'synth_annihilator',
    faction: 'synthetic_collective',
    initiative: 5,
    pointCost: 78,
    isUnique: true,
    abilityText: 'When you perform a torpedo attack that hits, the defender suffers 1 additional damage.',
    abilityId: 'dead_eye',
    extraSlots: ['torpedo', 'torpedo', 'cannon'],
  },

  // Relay Node
  relay_node_basic: {
    id: 'relay_node_basic',
    name: 'Relay Node',
    shipId: 'synth_relay_node',
    faction: 'synthetic_collective',
    initiative: 1,
    pointCost: 42,
    isUnique: false,
  },
  command_relay: {
    id: 'command_relay',
    name: 'Command Relay',
    shipId: 'synth_relay_node',
    faction: 'synthetic_collective',
    initiative: 3,
    pointCost: 55,
    isUnique: true,
    abilityText: 'Friendly ships at range 0-2 may spend your calculate tokens as if they were their own.',
    abilityId: 'networked_aim',
    extraSlots: ['sensor', 'sensor'],
  },

  // Repair Node
  repair_node_basic: {
    id: 'repair_node_basic',
    name: 'Repair Node',
    shipId: 'synth_repair_node',
    faction: 'synthetic_collective',
    initiative: 1,
    pointCost: 45,
    isUnique: false,
  },
  restoration_core: {
    id: 'restoration_core',
    name: 'Restoration Core',
    shipId: 'synth_repair_node',
    faction: 'synthetic_collective',
    initiative: 3,
    pointCost: 60,
    isUnique: true,
    abilityText: 'At the start of the End Phase, each friendly ship at range 0-1 may recover 1 shield.',
    abilityId: 'healing_aura',
    extraSlots: ['sensor', 'crew'],
  },

  // Devastator Gunship
  devastator_protocol: {
    id: 'devastator_protocol',
    name: 'Devastator Protocol',
    shipId: 'synth_devastator',
    faction: 'synthetic_collective',
    initiative: 2,
    pointCost: 58,
    isUnique: false,
  },
  obliterator: {
    id: 'obliterator',
    name: 'Obliterator',
    shipId: 'synth_devastator',
    faction: 'synthetic_collective',
    initiative: 4,
    pointCost: 78,
    isUnique: true,
    abilityText: 'When attacking with a turret weapon, you may spend 1 calculate to change 1 focus result to a hit result.',
    abilityId: 'heavy_gunner',
    extraSlots: ['cannon', 'gunner'],
  },

  // Eradicator Assault Ship
  eradicator_protocol: {
    id: 'eradicator_protocol',
    name: 'Eradicator Protocol',
    shipId: 'synth_eradicator',
    faction: 'synthetic_collective',
    initiative: 2,
    pointCost: 64,
    isUnique: false,
  },
  purge_unit: {
    id: 'purge_unit',
    name: 'Purge Unit',
    shipId: 'synth_eradicator',
    faction: 'synthetic_collective',
    initiative: 5,
    pointCost: 88,
    isUnique: true,
    abilityText: 'When attacking, you may spend any number of calculate tokens to add that many hit results.',
    abilityId: 'heavy_gunner',
    extraSlots: ['cannon', 'cannon', 'gunner'],
  },

  // Nexus Command Ship
  nexus_core_basic: {
    id: 'nexus_core_basic',
    name: 'Nexus Core',
    shipId: 'synth_nexus',
    faction: 'synthetic_collective',
    initiative: 1,
    pointCost: 90,
    isUnique: false,
  },
  central_nexus: {
    id: 'central_nexus',
    name: 'Central Nexus',
    shipId: 'synth_nexus',
    faction: 'synthetic_collective',
    initiative: 4,
    pointCost: 125,
    isUnique: true,
    abilityText: 'At the start of each round, all friendly ships at range 0-4 gain 1 calculate token.',
    abilityId: 'hive_mind',
    extraSlots: ['crew', 'crew', 'sensor', 'sensor'],
  },

  // Overmind Capital Ship
  overmind_basic: {
    id: 'overmind_basic',
    name: 'Overmind Core',
    shipId: 'synth_overmind',
    faction: 'synthetic_collective',
    initiative: 1,
    pointCost: 115,
    isUnique: false,
  },
  supreme_overmind: {
    id: 'supreme_overmind',
    name: 'Supreme Overmind',
    shipId: 'synth_overmind',
    faction: 'synthetic_collective',
    initiative: 5,
    pointCost: 160,
    isUnique: true,
    abilityText: 'When a friendly ship at range 0-5 is destroyed, you may gain 2 calculate tokens.',
    abilityId: 'hive_mind',
    extraSlots: ['crew', 'crew', 'crew', 'sensor', 'gunner'],
  },

  // Terminus Dreadnought
  terminus_core: {
    id: 'terminus_core',
    name: 'Terminus Core',
    shipId: 'synth_terminus',
    faction: 'synthetic_collective',
    initiative: 1,
    pointCost: 130,
    isUnique: false,
  },
  end_protocol: {
    id: 'end_protocol',
    name: 'End Protocol',
    shipId: 'synth_terminus',
    faction: 'synthetic_collective',
    initiative: 4,
    pointCost: 175,
    isUnique: true,
    abilityText: 'When you are destroyed, all enemy ships at range 0-2 suffer 2 damage.',
    abilityId: 'self_destruct',
    extraSlots: ['crew', 'crew', 'gunner', 'gunner', 'cannon'],
  },

  // Conduit Support Ship
  conduit_core: {
    id: 'conduit_core',
    name: 'Conduit Core',
    shipId: 'synth_conduit',
    faction: 'synthetic_collective',
    initiative: 1,
    pointCost: 75,
    isUnique: false,
  },
  prime_conduit: {
    id: 'prime_conduit',
    name: 'Prime Conduit',
    shipId: 'synth_conduit',
    faction: 'synthetic_collective',
    initiative: 3,
    pointCost: 100,
    isUnique: true,
    abilityText: 'At the start of the Activation Phase, you may transfer up to 2 calculate tokens to friendly ships at range 0-3.',
    abilityId: 'networked_aim',
    extraSlots: ['crew', 'sensor', 'sensor'],
  },

  // ============================================
  // NEW VOID CORSAIRS PILOTS
  // ============================================

  // Fang Interceptor
  fang_raider: {
    id: 'fang_raider',
    name: 'Fang Raider',
    shipId: 'corsair_fang',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 30,
    isUnique: false,
  },
  fang_ace: {
    id: 'fang_ace',
    name: 'Fang Ace',
    shipId: 'corsair_fang',
    faction: 'void_corsairs',
    initiative: 3,
    pointCost: 36,
    isUnique: false,
  },
  poison_fang: {
    id: 'poison_fang',
    name: 'Poison Fang',
    shipId: 'corsair_fang',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 48,
    isUnique: true,
    abilityText: 'When attacking at range 1, you may change 1 hit result to a critical hit result.',
    abilityId: 'crack_shot',
    extraSlots: ['talent', 'modification'],
  },

  // Talon Fighter
  talon_pilot: {
    id: 'talon_pilot',
    name: 'Talon Pilot',
    shipId: 'corsair_talon',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 32,
    isUnique: false,
  },
  razor_talon: {
    id: 'razor_talon',
    name: 'Razor Talon',
    shipId: 'corsair_talon',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 46,
    isUnique: true,
    abilityText: 'After you perform a boost action, you may perform a focus action.',
    abilityId: 'afterburners',
    extraSlots: ['talent'],
  },

  // Venom Strike Fighter
  venom_pilot: {
    id: 'venom_pilot',
    name: 'Venom Pilot',
    shipId: 'corsair_venom',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 34,
    isUnique: false,
  },
  deadly_venom: {
    id: 'deadly_venom',
    name: 'Deadly Venom',
    shipId: 'corsair_venom',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 50,
    isUnique: true,
    abilityText: 'When defending, if the attacker is at range 1, they roll 1 fewer attack die.',
    abilityId: 'elusive',
    extraSlots: ['talent', 'missile'],
  },

  // Cutlass Heavy Fighter
  cutlass_pilot: {
    id: 'cutlass_pilot',
    name: 'Cutlass Pilot',
    shipId: 'corsair_cutlass',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 40,
    isUnique: false,
  },
  cutlass_veteran: {
    id: 'cutlass_veteran',
    name: 'Cutlass Veteran',
    shipId: 'corsair_cutlass',
    faction: 'void_corsairs',
    initiative: 3,
    pointCost: 46,
    isUnique: false,
  },
  bloody_cutlass: {
    id: 'bloody_cutlass',
    name: 'Bloody Cutlass',
    shipId: 'corsair_cutlass',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 58,
    isUnique: true,
    abilityText: 'When attacking, if you have at least 1 damage card, roll 1 additional attack die.',
    abilityId: 'fearless',
    extraSlots: ['talent', 'gunner'],
  },

  // Scimitar Assault Fighter
  scimitar_pilot: {
    id: 'scimitar_pilot',
    name: 'Scimitar Pilot',
    shipId: 'corsair_scimitar',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 44,
    isUnique: false,
  },
  whirlwind_scimitar: {
    id: 'whirlwind_scimitar',
    name: 'Whirlwind Scimitar',
    shipId: 'corsair_scimitar',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 62,
    isUnique: true,
    abilityText: 'After you fully execute a red maneuver, you may perform an attack.',
    abilityId: 'daredevil',
    extraSlots: ['talent', 'missile'],
  },

  // Saber Elite Fighter
  saber_pilot: {
    id: 'saber_pilot',
    name: 'Saber Pilot',
    shipId: 'corsair_saber',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 46,
    isUnique: false,
  },
  saber_master: {
    id: 'saber_master',
    name: 'Saber Master',
    shipId: 'corsair_saber',
    faction: 'void_corsairs',
    initiative: 6,
    pointCost: 66,
    isUnique: true,
    abilityText: 'When defending, you may spend 1 focus token to roll 1 additional defense die.',
    abilityId: 'elusive',
    extraSlots: ['talent', 'modification', 'modification'],
  },

  // Phantom Stealth Fighter
  phantom_pilot: {
    id: 'phantom_pilot',
    name: 'Phantom Pilot',
    shipId: 'corsair_phantom',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 40,
    isUnique: false,
  },
  phantom_whisper: {
    id: 'phantom_whisper',
    name: 'Phantom Whisper',
    shipId: 'corsair_phantom',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 58,
    isUnique: true,
    abilityText: 'After you decloak, you may perform an evade action.',
    abilityId: 'phantom_strike',
    extraSlots: ['talent', 'tech'],
  },

  // Shadow Assassin
  shadow_pilot: {
    id: 'shadow_pilot',
    name: 'Shadow Pilot',
    shipId: 'corsair_shadow',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 44,
    isUnique: false,
  },
  death_shadow: {
    id: 'death_shadow',
    name: 'Death Shadow',
    shipId: 'corsair_shadow',
    faction: 'void_corsairs',
    initiative: 6,
    pointCost: 66,
    isUnique: true,
    abilityText: 'When you attack from cloak, add 1 critical hit result.',
    abilityId: 'phantom_strike',
    extraSlots: ['talent', 'tech', 'modification'],
  },

  // Pillager Gunship
  pillager_crew: {
    id: 'pillager_crew',
    name: 'Pillager Crew',
    shipId: 'corsair_pillager',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 54,
    isUnique: false,
  },
  loot_master_graves: {
    id: 'loot_master_graves',
    name: 'Loot Master Graves',
    shipId: 'corsair_pillager',
    faction: 'void_corsairs',
    initiative: 4,
    pointCost: 72,
    isUnique: true,
    abilityText: 'When you destroy an enemy ship, gain 1 focus and 1 evade token.',
    abilityId: 'plunder',
    extraSlots: ['gunner', 'crew', 'modification'],
  },

  // Ravager Assault Gunship
  ravager_crew: {
    id: 'ravager_crew',
    name: 'Ravager Crew',
    shipId: 'corsair_ravager',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 58,
    isUnique: false,
  },
  warlord_drake: {
    id: 'warlord_drake',
    name: 'Warlord Drake',
    shipId: 'corsair_ravager',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 78,
    isUnique: true,
    abilityText: 'When attacking, you may spend 1 focus token to add 1 hit result to your attack.',
    abilityId: 'heavy_gunner',
    extraSlots: ['talent', 'gunner', 'gunner', 'crew'],
  },

  // Corsair Bomber
  corsair_bomber_crew: {
    id: 'corsair_bomber_crew',
    name: 'Bomber Crew',
    shipId: 'corsair_bomber',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 42,
    isUnique: false,
  },
  bomb_runner_hex: {
    id: 'bomb_runner_hex',
    name: 'Bomb Runner Hex',
    shipId: 'corsair_bomber',
    faction: 'void_corsairs',
    initiative: 4,
    pointCost: 56,
    isUnique: true,
    abilityText: 'When you drop a bomb, enemy ships at range 0-1 of that bomb gain 1 stress token.',
    abilityId: 'bombardier',
    extraSlots: ['bomb', 'bomb'],
  },

  // Torpedo Boat
  torpedo_boat_crew: {
    id: 'torpedo_boat_crew',
    name: 'Torpedo Boat Crew',
    shipId: 'corsair_torpedo_boat',
    faction: 'void_corsairs',
    initiative: 2,
    pointCost: 48,
    isUnique: false,
  },
  torpedo_king_blaze: {
    id: 'torpedo_king_blaze',
    name: 'Torpedo King Blaze',
    shipId: 'corsair_torpedo_boat',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 68,
    isUnique: true,
    abilityText: 'When you perform a torpedo attack, you may reroll up to 2 attack dice.',
    abilityId: 'dead_eye',
    extraSlots: ['torpedo', 'torpedo', 'missile'],
  },

  // Dreadnought Capital Ship
  dreadnought_crew: {
    id: 'dreadnought_crew',
    name: 'Dreadnought Crew',
    shipId: 'corsair_dreadnought',
    faction: 'void_corsairs',
    initiative: 1,
    pointCost: 95,
    isUnique: false,
  },
  pirate_king_skull: {
    id: 'pirate_king_skull',
    name: 'Pirate King Skull',
    shipId: 'corsair_dreadnought',
    faction: 'void_corsairs',
    initiative: 5,
    pointCost: 135,
    isUnique: true,
    abilityText: 'Friendly Corsair ships at range 0-3 roll 1 additional attack die when attacking at range 1.',
    abilityId: 'inspiring_presence',
    extraSlots: ['crew', 'crew', 'gunner', 'gunner'],
  },

  // Galleon Carrier
  galleon_crew: {
    id: 'galleon_crew',
    name: 'Galleon Crew',
    shipId: 'corsair_galleon',
    faction: 'void_corsairs',
    initiative: 1,
    pointCost: 82,
    isUnique: false,
  },
  fleet_master_storm: {
    id: 'fleet_master_storm',
    name: 'Fleet Master Storm',
    shipId: 'corsair_galleon',
    faction: 'void_corsairs',
    initiative: 4,
    pointCost: 110,
    isUnique: true,
    abilityText: 'At the start of the Engagement Phase, friendly ships at range 0-2 may perform a barrel roll action.',
    abilityId: 'coordinated_assault',
    extraSlots: ['crew', 'crew', 'crew', 'gunner'],
  },

  // Frigate Raider
  frigate_crew: {
    id: 'frigate_crew',
    name: 'Frigate Crew',
    shipId: 'corsair_frigate',
    faction: 'void_corsairs',
    initiative: 1,
    pointCost: 72,
    isUnique: false,
  },
  raider_captain_flint: {
    id: 'raider_captain_flint',
    name: 'Raider Captain Flint',
    shipId: 'corsair_frigate',
    faction: 'void_corsairs',
    initiative: 4,
    pointCost: 95,
    isUnique: true,
    abilityText: 'When attacking, if the defender has no shields remaining, roll 1 additional attack die.',
    abilityId: 'ruthless',
    extraSlots: ['crew', 'gunner', 'modification'],
  },

  // Tender Support Ship
  tender_crew: {
    id: 'tender_crew',
    name: 'Tender Crew',
    shipId: 'corsair_tender',
    faction: 'void_corsairs',
    initiative: 1,
    pointCost: 55,
    isUnique: false,
  },
  supply_master_patch: {
    id: 'supply_master_patch',
    name: 'Supply Master Patch',
    shipId: 'corsair_tender',
    faction: 'void_corsairs',
    initiative: 3,
    pointCost: 72,
    isUnique: true,
    abilityText: 'At the start of the End Phase, friendly ships at range 0-2 may recover 1 shield or remove 1 stress token.',
    abilityId: 'healing_aura',
    extraSlots: ['crew', 'crew', 'sensor'],
  },

  // ============================================
  // NEW ASCENDANT EMPIRE PILOTS
  // ============================================

  // Cherub Light Fighter
  cherub_initiate: {
    id: 'cherub_initiate',
    name: 'Cherub Initiate',
    shipId: 'ascendant_cherub',
    faction: 'ascendant_empire',
    initiative: 1,
    pointCost: 26,
    isUnique: false,
  },
  cherub_guardian: {
    id: 'cherub_guardian',
    name: 'Cherub Guardian',
    shipId: 'ascendant_cherub',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 30,
    isUnique: false,
  },
  divine_light: {
    id: 'divine_light',
    name: 'Divine Light',
    shipId: 'ascendant_cherub',
    faction: 'ascendant_empire',
    initiative: 4,
    pointCost: 42,
    isUnique: true,
    abilityText: 'When defending, you may spend 1 Force charge to add 1 evade result.',
    abilityId: 'prescience',
    force: 1,
    extraSlots: ['force_power'],
  },

  // Herald Scout
  herald_pilot: {
    id: 'herald_pilot',
    name: 'Herald Pilot',
    shipId: 'ascendant_herald',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 28,
    isUnique: false,
  },
  voice_of_glory: {
    id: 'voice_of_glory',
    name: 'Voice of Glory',
    shipId: 'ascendant_herald',
    faction: 'ascendant_empire',
    initiative: 4,
    pointCost: 40,
    isUnique: true,
    abilityText: 'At the start of the Planning Phase, you may spend 1 Force charge to let all friendly ships at range 0-2 look at enemy dials.',
    abilityId: 'informant',
    force: 1,
    extraSlots: ['sensor', 'force_power'],
  },

  // Virtue Interceptor
  virtue_pilot: {
    id: 'virtue_pilot',
    name: 'Virtue Pilot',
    shipId: 'ascendant_virtue',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 36,
    isUnique: false,
  },
  righteous_fury: {
    id: 'righteous_fury',
    name: 'Righteous Fury',
    shipId: 'ascendant_virtue',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 52,
    isUnique: true,
    abilityText: 'When attacking, you may spend 1 Force charge to reroll up to 2 attack dice.',
    abilityId: 'prescience',
    force: 2,
    extraSlots: ['talent', 'force_power'],
  },

  // Crusader Heavy Fighter
  crusader_pilot: {
    id: 'crusader_pilot',
    name: 'Crusader Pilot',
    shipId: 'ascendant_crusader',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 44,
    isUnique: false,
  },
  crusader_champion: {
    id: 'crusader_champion',
    name: 'Crusader Champion',
    shipId: 'ascendant_crusader',
    faction: 'ascendant_empire',
    initiative: 3,
    pointCost: 50,
    isUnique: false,
  },
  holy_avenger: {
    id: 'holy_avenger',
    name: 'Holy Avenger',
    shipId: 'ascendant_crusader',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 65,
    isUnique: true,
    abilityText: 'When a friendly ship at range 0-2 is destroyed, gain 2 Force charges (up to your maximum).',
    abilityId: 'righteous_anger',
    force: 2,
    extraSlots: ['talent', 'force_power', 'modification'],
  },

  // Paladin Elite Fighter
  paladin_pilot: {
    id: 'paladin_pilot',
    name: 'Paladin Pilot',
    shipId: 'ascendant_paladin',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 48,
    isUnique: false,
  },
  shield_of_faith: {
    id: 'shield_of_faith',
    name: 'Shield of Faith',
    shipId: 'ascendant_paladin',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 68,
    isUnique: true,
    abilityText: 'When a friendly ship at range 0-1 defends, you may spend 1 Force charge. If you do, the defender adds 1 evade result.',
    abilityId: 'force_shield',
    force: 2,
    extraSlots: ['talent', 'force_power', 'modification'],
  },

  // Inquisitor Heavy Fighter
  inquisitor_pilot: {
    id: 'inquisitor_pilot',
    name: 'Inquisitor Pilot',
    shipId: 'ascendant_inquisitor',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 52,
    isUnique: false,
  },
  grand_inquisitor: {
    id: 'grand_inquisitor',
    name: 'Grand Inquisitor',
    shipId: 'ascendant_inquisitor',
    faction: 'ascendant_empire',
    initiative: 6,
    pointCost: 78,
    isUnique: true,
    abilityText: 'When attacking, you may spend 2 Force charges to change 1 focus result to a critical hit result.',
    abilityId: 'ruthless',
    force: 3,
    extraSlots: ['talent', 'force_power', 'force_power'],
  },

  // Prophet Seer Ship
  prophet_acolyte: {
    id: 'prophet_acolyte',
    name: 'Prophet Acolyte',
    shipId: 'ascendant_prophet',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 46,
    isUnique: false,
  },
  vision_of_doom: {
    id: 'vision_of_doom',
    name: 'Vision of Doom',
    shipId: 'ascendant_prophet',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 65,
    isUnique: true,
    abilityText: 'At the start of the Engagement Phase, you may spend 2 Force charges. If you do, choose 1 enemy ship at range 0-3. That ship cannot spend focus or evade tokens this round.',
    abilityId: 'force_suppression',
    force: 3,
    extraSlots: ['crew', 'force_power', 'sensor'],
  },

  // Acolyte Support Ship
  acolyte_pilot: {
    id: 'acolyte_pilot',
    name: 'Acolyte Pilot',
    shipId: 'ascendant_acolyte',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 38,
    isUnique: false,
  },
  blessed_healer: {
    id: 'blessed_healer',
    name: 'Blessed Healer',
    shipId: 'ascendant_acolyte',
    faction: 'ascendant_empire',
    initiative: 4,
    pointCost: 52,
    isUnique: true,
    abilityText: 'At the start of the End Phase, you may spend 1 Force charge. If you do, each friendly ship at range 0-2 may recover 1 shield.',
    abilityId: 'force_heal',
    force: 2,
    extraSlots: ['crew', 'force_power'],
  },

  // Wrath Assault Ship
  wrath_pilot: {
    id: 'wrath_pilot',
    name: 'Wrath Pilot',
    shipId: 'ascendant_wrath',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 56,
    isUnique: false,
  },
  fury_incarnate: {
    id: 'fury_incarnate',
    name: 'Fury Incarnate',
    shipId: 'ascendant_wrath',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 78,
    isUnique: true,
    abilityText: 'When attacking, you may spend any number of Force charges. For each charge spent, change 1 focus result to a hit result.',
    abilityId: 'force_fury',
    force: 3,
    extraSlots: ['talent', 'gunner', 'force_power'],
  },

  // Judgment Heavy Gunship
  judgment_crew: {
    id: 'judgment_crew',
    name: 'Judgment Crew',
    shipId: 'ascendant_judgment',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 62,
    isUnique: false,
  },
  divine_sentence: {
    id: 'divine_sentence',
    name: 'Divine Sentence',
    shipId: 'ascendant_judgment',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 88,
    isUnique: true,
    abilityText: 'When attacking, after rolling dice, you may spend 2 Force charges to add 1 critical hit result.',
    abilityId: 'force_fury',
    force: 3,
    extraSlots: ['talent', 'gunner', 'gunner', 'force_power'],
  },

  // Smiter Bomber
  smiter_crew: {
    id: 'smiter_crew',
    name: 'Smiter Crew',
    shipId: 'ascendant_smiter',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 44,
    isUnique: false,
  },
  wrath_of_heaven: {
    id: 'wrath_of_heaven',
    name: 'Wrath of Heaven',
    shipId: 'ascendant_smiter',
    faction: 'ascendant_empire',
    initiative: 4,
    pointCost: 60,
    isUnique: true,
    abilityText: 'When you drop a bomb, you may spend 1 Force charge. If you do, increase the bombs damage by 1.',
    abilityId: 'bombardier',
    force: 2,
    extraSlots: ['bomb', 'force_power'],
  },

  // Purifier Heavy Bomber
  purifier_crew: {
    id: 'purifier_crew',
    name: 'Purifier Crew',
    shipId: 'ascendant_purifier',
    faction: 'ascendant_empire',
    initiative: 2,
    pointCost: 52,
    isUnique: false,
  },
  cleansing_fire: {
    id: 'cleansing_fire',
    name: 'Cleansing Fire',
    shipId: 'ascendant_purifier',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 72,
    isUnique: true,
    abilityText: 'After you perform a torpedo attack, the defender gains 1 stress token.',
    abilityId: 'dead_eye',
    force: 2,
    extraSlots: ['torpedo', 'torpedo', 'force_power'],
  },

  // Divine Capital Ship
  divine_crew: {
    id: 'divine_crew',
    name: 'Divine Crew',
    shipId: 'ascendant_divine',
    faction: 'ascendant_empire',
    initiative: 1,
    pointCost: 105,
    isUnique: false,
  },
  hand_of_the_divine: {
    id: 'hand_of_the_divine',
    name: 'Hand of the Divine',
    shipId: 'ascendant_divine',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 150,
    isUnique: true,
    abilityText: 'At the start of each round, all friendly ships at range 0-4 may recover 1 Force charge.',
    abilityId: 'force_guidance',
    force: 4,
    extraSlots: ['crew', 'crew', 'gunner', 'force_power', 'force_power'],
  },

  // Glory Battleship
  glory_crew: {
    id: 'glory_crew',
    name: 'Glory Crew',
    shipId: 'ascendant_glory',
    faction: 'ascendant_empire',
    initiative: 1,
    pointCost: 115,
    isUnique: false,
  },
  light_of_glory: {
    id: 'light_of_glory',
    name: 'Light of Glory',
    shipId: 'ascendant_glory',
    faction: 'ascendant_empire',
    initiative: 5,
    pointCost: 160,
    isUnique: true,
    abilityText: 'When a friendly ship at range 0-3 attacks, you may spend 1 Force charge. If you do, the attacker may reroll up to 2 attack dice.',
    abilityId: 'force_guidance',
    force: 4,
    extraSlots: ['crew', 'crew', 'gunner', 'gunner', 'force_power'],
  },

  // Sanctum Cathedral Ship
  sanctum_crew: {
    id: 'sanctum_crew',
    name: 'Sanctum Crew',
    shipId: 'ascendant_sanctum',
    faction: 'ascendant_empire',
    initiative: 1,
    pointCost: 95,
    isUnique: false,
  },
  high_priest: {
    id: 'high_priest',
    name: 'High Priest',
    shipId: 'ascendant_sanctum',
    faction: 'ascendant_empire',
    initiative: 4,
    pointCost: 130,
    isUnique: true,
    abilityText: 'At the start of the End Phase, friendly ships at range 0-3 may recover 1 shield or remove 1 stress token.',
    abilityId: 'force_heal',
    force: 4,
    extraSlots: ['crew', 'crew', 'crew', 'force_power', 'sensor'],
  },

  // Bastion Fortress Ship
  bastion_empire_crew: {
    id: 'bastion_empire_crew',
    name: 'Bastion Crew',
    shipId: 'ascendant_bastion',
    faction: 'ascendant_empire',
    initiative: 1,
    pointCost: 85,
    isUnique: false,
  },
  fortress_of_faith: {
    id: 'fortress_of_faith',
    name: 'Fortress of Faith',
    shipId: 'ascendant_bastion',
    faction: 'ascendant_empire',
    initiative: 4,
    pointCost: 115,
    isUnique: true,
    abilityText: 'Friendly ships at range 0-2 add 1 evade result when defending against attacks from outside range 2.',
    abilityId: 'stalwart',
    force: 2,
    extraSlots: ['crew', 'crew', 'gunner', 'force_power'],
  },
};

// ============================================
// Squad Builder Functions
// ============================================

let nextUnitId = 1;

/**
 * Create a new empty squad
 */
export function createSquad(
  name: string,
  faction: FactionId,
  format: GameFormat = 'standard'
): Squad {
  return {
    id: `squad_${Date.now()}`,
    name,
    faction,
    format,
    units: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Add a pilot/ship to the squad
 */
export function addUnitToSquad(
  squad: Squad,
  pilotId: string
): Squad | { error: string } {
  const pilot = PILOT_CARDS[pilotId];
  if (!pilot) {
    return { error: `Unknown pilot: ${pilotId}` };
  }

  if (pilot.faction !== squad.faction) {
    return { error: `Pilot ${pilot.name} is not from faction ${squad.faction}` };
  }

  // Check unique restriction
  if (pilot.isUnique) {
    const alreadyExists = squad.units.some((u) => u.pilotId === pilotId);
    if (alreadyExists) {
      return { error: `Unique pilot ${pilot.name} is already in the squad` };
    }
  }

  // Check limited count
  if (pilot.limitedCount !== undefined) {
    const currentCount = squad.units.filter((u) => u.pilotId === pilotId).length;
    if (currentCount >= pilot.limitedCount) {
      return { error: `Maximum ${pilot.limitedCount} copies of ${pilot.name} allowed` };
    }
  }

  // Capital / huge ships are only allowed in epic format
  const shipDef = SHIP_DEFINITIONS[pilot.shipId];
  if (shipDef) {
    const isHugeShip =
      shipDef.baseStats.size === 'huge' || shipDef.role === 'capital';
    if (isHugeShip && squad.format !== 'epic') {
      return {
        error: `${pilot.name} pilots a capital ship and requires epic format (current: ${squad.format})`,
      };
    }
  }

  const newUnit: SquadUnit = {
    id: `unit_${nextUnitId++}`,
    pilotId,
    shipId: pilot.shipId,
    equippedUpgrades: [],
  };

  return {
    ...squad,
    units: [...squad.units, newUnit],
    updatedAt: Date.now(),
  };
}

/**
 * Remove a unit from the squad
 */
export function removeUnitFromSquad(squad: Squad, unitId: string): Squad {
  return {
    ...squad,
    units: squad.units.filter((u) => u.id !== unitId),
    updatedAt: Date.now(),
  };
}

/**
 * Equip an upgrade to a unit
 */
export function equipUpgradeToUnit(
  squad: Squad,
  unitId: string,
  upgradeId: string,
  shipDefinitions: Record<string, ShipDefinition>
): Squad | { error: string } {
  const upgrade = UPGRADE_DEFINITIONS[upgradeId];
  if (!upgrade) {
    return { error: `Unknown upgrade: ${upgradeId}` };
  }

  const unitIndex = squad.units.findIndex((u) => u.id === unitId);
  if (unitIndex === -1) {
    return { error: `Unit not found: ${unitId}` };
  }

  const unit = squad.units[unitIndex]!;
  const pilot = PILOT_CARDS[unit.pilotId];
  const ship = shipDefinitions[unit.shipId];

  if (!pilot || !ship) {
    return { error: 'Invalid pilot or ship configuration' };
  }

  // Get available slots for this unit
  const baseSlots = getDefaultUpgradeSlots(ship.baseStats.size, ship.role);
  const extraSlots = pilot.extraSlots ?? [];
  const removedSlots = pilot.removedSlots ?? [];

  let availableSlots = [...baseSlots, ...extraSlots];
  for (const removed of removedSlots) {
    const idx = availableSlots.indexOf(removed);
    if (idx !== -1) {
      availableSlots.splice(idx, 1);
    }
  }

  // Remove slots used by existing upgrades
  for (const equippedId of unit.equippedUpgrades) {
    const equipped = UPGRADE_DEFINITIONS[equippedId];
    if (equipped) {
      const idx = availableSlots.indexOf(equipped.slotType);
      if (idx !== -1) {
        availableSlots.splice(idx, 1);
      }
    }
  }

  // Validate the upgrade can be equipped
  const validation = canEquipUpgrade(upgrade, {
    size: ship.baseStats.size,
    role: ship.role,
    faction: squad.faction,
    availableSlots,
    equippedUpgrades: unit.equippedUpgrades,
  });

  if (!validation.valid) {
    return { error: validation.reason ?? 'Cannot equip upgrade' };
  }

  // Check squad-wide unique restriction
  if (upgrade.isUnique) {
    for (const u of squad.units) {
      if (u.equippedUpgrades.includes(upgradeId)) {
        return { error: `Unique upgrade ${upgrade.name} is already equipped in squad` };
      }
    }
  }

  // Equip the upgrade
  const updatedUnits = [...squad.units];
  updatedUnits[unitIndex] = {
    id: unit.id,
    pilotId: unit.pilotId,
    shipId: unit.shipId,
    equippedUpgrades: [...unit.equippedUpgrades, upgradeId],
  };

  return {
    ...squad,
    units: updatedUnits,
    updatedAt: Date.now(),
  };
}

/**
 * Remove an upgrade from a unit
 */
export function removeUpgradeFromUnit(
  squad: Squad,
  unitId: string,
  upgradeId: string
): Squad {
  const unitIndex = squad.units.findIndex((u) => u.id === unitId);
  if (unitIndex === -1) {
    return squad;
  }

  const unit = squad.units[unitIndex]!;
  const updatedUnits = [...squad.units];
  updatedUnits[unitIndex] = {
    id: unit.id,
    pilotId: unit.pilotId,
    shipId: unit.shipId,
    equippedUpgrades: unit.equippedUpgrades.filter((id) => id !== upgradeId),
  };

  return {
    ...squad,
    units: updatedUnits,
    updatedAt: Date.now(),
  };
}

/**
 * Calculate the total point cost of a unit
 */
export function calculateUnitCost(unit: SquadUnit): number {
  const pilot = PILOT_CARDS[unit.pilotId];
  if (!pilot) return 0;

  const pilotCost = pilot.pointCost;
  const upgradeCost = calculateUpgradesCost(unit.equippedUpgrades);

  return pilotCost + upgradeCost;
}

/**
 * Calculate the total point cost of a squad
 */
export function calculateSquadCost(squad: Squad): number {
  return squad.units.reduce((total, unit) => total + calculateUnitCost(unit), 0);
}

/**
 * Validate a squad
 */
export function validateSquad(squad: Squad): SquadValidation {
  const errors: SquadError[] = [];
  const warnings: SquadWarning[] = [];
  const totalPoints = calculateSquadCost(squad);
  const pointLimit = SQUAD_POINT_LIMITS[squad.format];

  // Check point limit
  if (totalPoints > pointLimit) {
    errors.push({
      type: 'over_points',
      message: `Squad exceeds point limit: ${totalPoints}/${pointLimit}`,
    });
  }

  // Check for empty squad
  if (squad.units.length === 0) {
    warnings.push({
      type: 'no_ships',
      message: 'Squad has no ships',
    });
  }

  // Track unique pilots and upgrades
  const uniquePilots = new Set<string>();
  const uniqueUpgrades = new Set<string>();

  for (const unit of squad.units) {
    const pilot = PILOT_CARDS[unit.pilotId];
    if (!pilot) continue;

    // Check unique pilots
    if (pilot.isUnique) {
      if (uniquePilots.has(pilot.id)) {
        errors.push({
          type: 'duplicate_unique',
          message: `Duplicate unique pilot: ${pilot.name}`,
          unitId: unit.id,
        });
      }
      uniquePilots.add(pilot.id);
    }

    // Check unique upgrades
    for (const upgradeId of unit.equippedUpgrades) {
      const upgrade = UPGRADE_DEFINITIONS[upgradeId];
      if (upgrade?.isUnique) {
        if (uniqueUpgrades.has(upgradeId)) {
          errors.push({
            type: 'duplicate_unique',
            message: `Duplicate unique upgrade: ${upgrade.name}`,
            unitId: unit.id,
            upgradeId,
          });
        }
        uniqueUpgrades.add(upgradeId);
      }
    }

    // Check faction match
    if (pilot.faction !== squad.faction) {
      errors.push({
        type: 'invalid_faction',
        message: `Pilot ${pilot.name} is not from faction ${squad.faction}`,
        unitId: unit.id,
      });
    }

    // Capital / huge ships only in epic format
    const shipDef = SHIP_DEFINITIONS[pilot.shipId];
    if (shipDef) {
      const isHugeShip =
        shipDef.baseStats.size === 'huge' || shipDef.role === 'capital';
      if (isHugeShip && squad.format !== 'epic') {
        errors.push({
          type: 'invalid_format',
          message: `${pilot.name} pilots a capital ship and requires epic format`,
          unitId: unit.id,
        });
      }
    }
  }

  // Check for unused points
  const unusedPoints = pointLimit - totalPoints;
  if (unusedPoints >= 20 && squad.units.length > 0) {
    warnings.push({
      type: 'unused_points',
      message: `${unusedPoints} points remaining - consider adding upgrades`,
    });
  }

  return {
    isValid: errors.length === 0,
    totalPoints,
    pointLimit,
    errors,
    warnings,
  };
}

/**
 * Get all pilots available for a faction
 */
export function getPilotsForFaction(faction: FactionId): PilotCard[] {
  return Object.values(PILOT_CARDS).filter((p) => p.faction === faction);
}

/**
 * Get all pilots for a specific ship
 */
export function getPilotsForShip(shipId: string): PilotCard[] {
  return Object.values(PILOT_CARDS).filter((p) => p.shipId === shipId);
}

/**
 * Get upgrades that can be equipped on a unit
 */
export function getAvailableUpgradesForUnit(
  unit: SquadUnit,
  squad: Squad,
  shipDefinitions: Record<string, ShipDefinition>
): UpgradeDefinition[] {
  const pilot = PILOT_CARDS[unit.pilotId];
  const ship = shipDefinitions[unit.shipId];

  if (!pilot || !ship) return [];

  // Calculate available slots
  const baseSlots = getDefaultUpgradeSlots(ship.baseStats.size, ship.role);
  const extraSlots = pilot.extraSlots ?? [];
  const removedSlots = pilot.removedSlots ?? [];

  let availableSlots = [...baseSlots, ...extraSlots];
  for (const removed of removedSlots) {
    const idx = availableSlots.indexOf(removed);
    if (idx !== -1) {
      availableSlots.splice(idx, 1);
    }
  }

  // Remove slots used by existing upgrades
  for (const equippedId of unit.equippedUpgrades) {
    const equipped = UPGRADE_DEFINITIONS[equippedId];
    if (equipped) {
      const idx = availableSlots.indexOf(equipped.slotType);
      if (idx !== -1) {
        availableSlots.splice(idx, 1);
      }
    }
  }

  // Get squad-wide unique upgrades
  const squadUniqueUpgrades = new Set<string>();
  for (const u of squad.units) {
    for (const upgradeId of u.equippedUpgrades) {
      const upgrade = UPGRADE_DEFINITIONS[upgradeId];
      if (upgrade?.isUnique) {
        squadUniqueUpgrades.add(upgradeId);
      }
    }
  }

  // Filter available upgrades
  return Object.values(UPGRADE_DEFINITIONS).filter((upgrade) => {
    // Check slot availability
    if (!availableSlots.includes(upgrade.slotType)) {
      return false;
    }

    // Check already equipped
    if (unit.equippedUpgrades.includes(upgrade.id)) {
      return false;
    }

    // Check squad-wide unique
    if (upgrade.isUnique && squadUniqueUpgrades.has(upgrade.id)) {
      return false;
    }

    // Check equipment restrictions
    const validation = canEquipUpgrade(upgrade, {
      size: ship.baseStats.size,
      role: ship.role,
      faction: squad.faction,
      availableSlots,
      equippedUpgrades: unit.equippedUpgrades,
    });

    return validation.valid;
  });
}

/**
 * Get unit details including calculated fields
 */
export function getUnitDetails(
  unit: SquadUnit,
  shipDefinitions: Record<string, ShipDefinition>
): SquadUnitDetails | null {
  const pilot = PILOT_CARDS[unit.pilotId];
  const ship = shipDefinitions[unit.shipId];

  if (!pilot || !ship) return null;

  const upgrades = unit.equippedUpgrades
    .map((id) => UPGRADE_DEFINITIONS[id])
    .filter((u): u is UpgradeDefinition => u !== undefined);

  // Calculate slots
  const baseSlots = getDefaultUpgradeSlots(ship.baseStats.size, ship.role);
  const extraSlots = pilot.extraSlots ?? [];
  const removedSlots = pilot.removedSlots ?? [];

  let allSlots = [...baseSlots, ...extraSlots];
  for (const removed of removedSlots) {
    const idx = allSlots.indexOf(removed);
    if (idx !== -1) {
      allSlots.splice(idx, 1);
    }
  }

  const usedSlots = upgrades.map((u) => u.slotType);
  const availableSlots = [...allSlots];
  for (const used of usedSlots) {
    const idx = availableSlots.indexOf(used);
    if (idx !== -1) {
      availableSlots.splice(idx, 1);
    }
  }

  return {
    unit,
    pilot,
    ship,
    upgrades,
    availableSlots,
    usedSlots,
    totalPointCost: calculateUnitCost(unit),
  };
}

/**
 * Clone a squad
 */
export function cloneSquad(squad: Squad, newName?: string): Squad {
  return {
    ...squad,
    id: `squad_${Date.now()}`,
    name: newName ?? `${squad.name} (Copy)`,
    units: squad.units.map((unit) => ({
      ...unit,
      id: `unit_${nextUnitId++}`,
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Export squad to shareable string format
 */
export function exportSquad(squad: Squad): string {
  const data = {
    v: 1, // Version
    f: squad.faction,
    m: squad.format,
    u: squad.units.map((unit) => ({
      p: unit.pilotId,
      g: unit.equippedUpgrades,
    })),
  };
  return btoa(JSON.stringify(data));
}

/**
 * Import squad from shareable string format
 */
export function importSquad(
  encoded: string,
  name: string
): Squad | { error: string } {
  try {
    const data = JSON.parse(atob(encoded));

    if (data.v !== 1) {
      return { error: 'Unsupported squad format version' };
    }

    const squad = createSquad(name, data.f, data.m);

    let currentSquad: Squad = squad;
    for (const unitData of data.u) {
      const result = addUnitToSquad(currentSquad, unitData.p);
      if ('error' in result) {
        return result;
      }
      currentSquad = result;

      // Note: upgrades would need ship definitions to validate properly
      // For import, we assume they're valid
      const unitIndex = currentSquad.units.length - 1;
      const updatedUnits = [...currentSquad.units];
      const existingUnit = updatedUnits[unitIndex];
      if (existingUnit) {
        const updatedUnit: SquadUnit = {
          id: existingUnit.id,
          pilotId: existingUnit.pilotId,
          shipId: existingUnit.shipId,
          equippedUpgrades: unitData.g ?? [],
        };
        updatedUnits[unitIndex] = updatedUnit;
        currentSquad = { ...currentSquad, units: updatedUnits };
      }
    }

    return currentSquad;
  } catch {
    return { error: 'Invalid squad data' };
  }
}

/**
 * Get a list of preset/recommended squads
 */
export function getPresetSquads(faction: FactionId): Squad[] {
  const presets: Squad[] = [];

  switch (faction) {
    case 'terran_hegemony':
      presets.push({
        id: 'preset_terran_viper_swarm',
        name: 'Viper Swarm',
        faction: 'terran_hegemony',
        format: 'standard',
        units: [
          {
            id: 'preset_unit_1',
            pilotId: 'whisper_null',
            shipId: 'terran_viper',
            equippedUpgrades: ['stealth_device'],
          },
          {
            id: 'preset_unit_2',
            pilotId: 'commander_striker',
            shipId: 'terran_viper',
            equippedUpgrades: ['predator'],
          },
          {
            id: 'preset_unit_3',
            pilotId: 'viper_ace',
            shipId: 'terran_viper',
            equippedUpgrades: ['vectored_thrusters'],
          },
          {
            id: 'preset_unit_4',
            pilotId: 'viper_ace',
            shipId: 'terran_viper',
            equippedUpgrades: ['vectored_thrusters'],
          },
          {
            id: 'preset_unit_5',
            pilotId: 'viper_cadet',
            shipId: 'terran_viper',
            equippedUpgrades: [],
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      });
      presets.push({
        id: 'preset_terran_strike_force',
        name: 'Strike Force',
        faction: 'terran_hegemony',
        format: 'standard',
        units: [
          {
            id: 'preset_unit_1',
            pilotId: 'deathbringer_ix',
            shipId: 'terran_hammer',
            equippedUpgrades: ['proton_torpedoes', 'seismic_charge'],
          },
          {
            id: 'preset_unit_2',
            pilotId: 'iron_wolf',
            shipId: 'terran_gladius',
            equippedUpgrades: ['shield_upgrade'],
          },
          {
            id: 'preset_unit_3',
            pilotId: 'gladius_veteran',
            shipId: 'terran_gladius',
            equippedUpgrades: ['hull_upgrade'],
          },
          {
            id: 'preset_unit_4',
            pilotId: 'gladius_pilot',
            shipId: 'terran_gladius',
            equippedUpgrades: [],
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      });
      break;

    case 'free_confederation':
      presets.push({
        id: 'preset_confed_balanced',
        name: 'Balanced Strike Force',
        faction: 'free_confederation',
        format: 'standard',
        units: [
          {
            id: 'preset_unit_1',
            pilotId: 'hawk_rennick',
            shipId: 'confed_falcon',
            equippedUpgrades: ['predator'],
          },
          {
            id: 'preset_unit_2',
            pilotId: 'storm_keller',
            shipId: 'confed_falcon',
            equippedUpgrades: ['elusive'],
          },
          {
            id: 'preset_unit_3',
            pilotId: 'falcon_veteran',
            shipId: 'confed_falcon',
            equippedUpgrades: ['shield_upgrade'],
          },
          {
            id: 'preset_unit_4',
            pilotId: 'falcon_pilot',
            shipId: 'confed_falcon',
            equippedUpgrades: [],
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      });
      presets.push({
        id: 'preset_confed_sparrow_swarm',
        name: 'Sparrow Swarm',
        faction: 'free_confederation',
        format: 'standard',
        units: [
          {
            id: 'preset_unit_1',
            pilotId: 'swift_sara',
            shipId: 'confed_sparrow',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_2',
            pilotId: 'sparrow_pilot',
            shipId: 'confed_sparrow',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_3',
            pilotId: 'sparrow_pilot',
            shipId: 'confed_sparrow',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_4',
            pilotId: 'sparrow_pilot',
            shipId: 'confed_sparrow',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_5',
            pilotId: 'sparrow_rookie',
            shipId: 'confed_sparrow',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_6',
            pilotId: 'sparrow_rookie',
            shipId: 'confed_sparrow',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_7',
            pilotId: 'sparrow_rookie',
            shipId: 'confed_sparrow',
            equippedUpgrades: [],
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      });
      break;

    case 'synthetic_collective':
      presets.push({
        id: 'preset_synth_drone_swarm',
        name: 'Drone Swarm',
        faction: 'synthetic_collective',
        format: 'standard',
        units: [
          {
            id: 'preset_unit_1',
            pilotId: 'nexus_core',
            shipId: 'synth_carrier',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_2',
            pilotId: 'unit_zero',
            shipId: 'synth_drone',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_3',
            pilotId: 'combat_drone_beta',
            shipId: 'synth_drone',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_4',
            pilotId: 'combat_drone_beta',
            shipId: 'synth_drone',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_5',
            pilotId: 'combat_drone_alpha',
            shipId: 'synth_drone',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_6',
            pilotId: 'combat_drone_alpha',
            shipId: 'synth_drone',
            equippedUpgrades: [],
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      });
      presets.push({
        id: 'preset_synth_hunter_killer',
        name: 'Hunter-Killer Protocol',
        faction: 'synthetic_collective',
        format: 'standard',
        units: [
          {
            id: 'preset_unit_1',
            pilotId: 'executioner_seven',
            shipId: 'synth_hunter',
            equippedUpgrades: ['fire_control_system'],
          },
          {
            id: 'preset_unit_2',
            pilotId: 'annihilator_nine',
            shipId: 'synth_destroyer',
            equippedUpgrades: ['proton_torpedoes'],
          },
          {
            id: 'preset_unit_3',
            pilotId: 'hunter_prime',
            shipId: 'synth_hunter',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_4',
            pilotId: 'hunter_protocol',
            shipId: 'synth_hunter',
            equippedUpgrades: [],
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      });
      break;

    case 'void_corsairs':
      presets.push({
        id: 'preset_corsair_raiders',
        name: 'Corsair Raiders',
        faction: 'void_corsairs',
        format: 'standard',
        units: [
          {
            id: 'preset_unit_1',
            pilotId: 'red_jenna',
            shipId: 'corsair_blade',
            equippedUpgrades: ['daredevil'],
          },
          {
            id: 'preset_unit_2',
            pilotId: 'iron_fist_mora',
            shipId: 'corsair_marauder',
            equippedUpgrades: ['heavy_laser_cannon'],
          },
          {
            id: 'preset_unit_3',
            pilotId: 'blade_cutthroat',
            shipId: 'corsair_blade',
            equippedUpgrades: ['shield_upgrade'],
          },
          {
            id: 'preset_unit_4',
            pilotId: 'blade_raider',
            shipId: 'corsair_blade',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_5',
            pilotId: 'blade_raider',
            shipId: 'corsair_blade',
            equippedUpgrades: [],
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      });
      presets.push({
        id: 'preset_corsair_ambush',
        name: 'Ambush Fleet',
        faction: 'void_corsairs',
        format: 'standard',
        units: [
          {
            id: 'preset_unit_1',
            pilotId: 'ghost_dancer',
            shipId: 'corsair_specter',
            equippedUpgrades: ['stealth_device'],
          },
          {
            id: 'preset_unit_2',
            pilotId: 'bloodaxe_thorne',
            shipId: 'corsair_reaver',
            equippedUpgrades: ['hull_upgrade'],
          },
          {
            id: 'preset_unit_3',
            pilotId: 'specter_pilot',
            shipId: 'corsair_specter',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_4',
            pilotId: 'specter_pilot',
            shipId: 'corsair_specter',
            equippedUpgrades: [],
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      });
      break;

    case 'ascendant_empire':
      presets.push({
        id: 'preset_ascendant_crusade',
        name: 'Holy Crusade',
        faction: 'ascendant_empire',
        format: 'standard',
        units: [
          {
            id: 'preset_unit_1',
            pilotId: 'archon_prime',
            shipId: 'ascendant_seraph',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_2',
            pilotId: 'divine_seraphina',
            shipId: 'ascendant_seraph',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_3',
            pilotId: 'seraph_guardian',
            shipId: 'ascendant_seraph',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_4',
            pilotId: 'seraph_guardian',
            shipId: 'ascendant_seraph',
            equippedUpgrades: [],
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      });
      presets.push({
        id: 'preset_ascendant_temple_guard',
        name: 'Temple Guard',
        faction: 'ascendant_empire',
        format: 'standard',
        units: [
          {
            id: 'preset_unit_1',
            pilotId: 'warlord_darius',
            shipId: 'ascendant_avatar',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_2',
            pilotId: 'crusader_vorn',
            shipId: 'ascendant_templar',
            equippedUpgrades: ['shield_upgrade'],
          },
          {
            id: 'preset_unit_3',
            pilotId: 'templar_champion',
            shipId: 'ascendant_templar',
            equippedUpgrades: [],
          },
          {
            id: 'preset_unit_4',
            pilotId: 'templar_knight',
            shipId: 'ascendant_templar',
            equippedUpgrades: [],
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      });
      break;
  }

  return presets;
}

// ============================================
// Scene Integration Bridge
// ============================================

/**
 * Configuration for a single ship as needed by battle scenes.
 * Derives pilotSkill from the PILOT_CARDS initiative value so scenes
 * don't need to import or inspect PILOT_CARDS directly.
 */
export interface SceneShipConfig {
  readonly unitId: string;
  readonly shipId: string;
  readonly pilotId: string;
  readonly pilotName: string;
  readonly pilotSkill: number;       // 1–6 from PilotCard.initiative
  readonly faction: FactionId;
  readonly isUnique: boolean;
  readonly equippedUpgrades: string[];
  readonly pointCost: number;
}

/**
 * Converts a Squad into an ordered list of SceneShipConfig objects ready
 * to be handed to a battle scene. Ships are sorted by descending pilot skill
 * (highest initiative first, matching how aces are typically deployed).
 *
 * Returns an empty array if the squad has no units.
 */
export function getSquadForScene(squad: Squad): SceneShipConfig[] {
  const configs: SceneShipConfig[] = squad.units.map((unit) => {
    const pilot = PILOT_CARDS[unit.pilotId];
    return {
      unitId: unit.id,
      shipId: unit.shipId,
      pilotId: unit.pilotId,
      pilotName: pilot?.name ?? 'Unknown Pilot',
      pilotSkill: pilot?.initiative ?? 1,
      faction: squad.faction,
      isUnique: pilot?.isUnique ?? false,
      equippedUpgrades: [...unit.equippedUpgrades],
      pointCost: calculateUnitCost(unit),
    };
  });

  // Highest-skill pilots first (aces lead the charge)
  return configs.sort((a, b) => b.pilotSkill - a.pilotSkill);
}

/**
 * Look up a single pilot's scene config by pilot ID.
 * Useful when building ships one-at-a-time rather than from a full squad.
 */
export function getPilotSceneConfig(
  pilotId: string,
  equippedUpgrades: string[] = []
): SceneShipConfig | null {
  const pilot = PILOT_CARDS[pilotId];
  if (!pilot) return null;

  const mockUnit: SquadUnit = {
    id: pilotId,
    pilotId,
    shipId: pilot.shipId,
    equippedUpgrades,
  };

  return {
    unitId: pilotId,
    shipId: pilot.shipId,
    pilotId,
    pilotName: pilot.name,
    pilotSkill: pilot.initiative,
    faction: pilot.faction,
    isUnique: pilot.isUnique,
    equippedUpgrades,
    pointCost: calculateUnitCost(mockUnit),
  };
}
