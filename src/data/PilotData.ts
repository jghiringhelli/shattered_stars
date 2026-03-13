/**
 * Pilot Data
 *
 * Campaign pilot definitions for all factions.
 * Each faction has a protagonist and two support pilots with
 * Aturi Cluster-style progression: abilities unlock per level,
 * stat bonuses accumulate, and ships can evolve at key moments.
 */

import type { FactionId } from '../config';

// ============================================
// Campaign Pilot Interface
// ============================================

export interface CampaignPilot {
  readonly id: string;
  readonly displayName: string;
  readonly callsign: string;
  readonly portraitKey: string;
  readonly role: 'protagonist' | 'support';
  readonly factionId: FactionId;
  readonly defaultShipId: string;
  readonly startingAbilityIds: readonly string[];
  /** Maps pilot level (2-6) to the ability ID unlocked at that level */
  readonly levelAbilityMap: Readonly<Record<number, string>>;
  readonly xpMultiplier: number; // 1.0 for all pilots
}

// ============================================
// TERRAN HEGEMONY PILOTS
// Campaign: "The Iron Fist"
// ============================================

const TERRAN_PILOTS: CampaignPilot[] = [
  {
    id: 'admiral_chen',
    displayName: 'Admiral Chen',
    callsign: 'IRON ACTUAL',
    portraitKey: 'portrait_admiral_chen',
    role: 'protagonist',
    factionId: 'terran_hegemony',
    defaultShipId: 'terran_raptor',
    startingAbilityIds: ['marksman'],
    levelAbilityMap: {
      2: 'predatory_instinct',
      3: 'barrel_roll_efficiency',
      4: 'coordinated_assault',
      5: 'dead_eye',
      6: 'inspiring_presence',
    },
    xpMultiplier: 1.0,
  },
  {
    id: 'striker',
    displayName: 'Lt. Reyes',
    callsign: 'STRIKER',
    portraitKey: 'portrait_striker',
    role: 'support',
    factionId: 'terran_hegemony',
    defaultShipId: 'terran_viper',
    startingAbilityIds: ['fearless'],
    levelAbilityMap: {
      2: 'heavy_gunner',
      3: 'boost_expertise',
      4: 'stress_recovery',
      5: 'tenacity',
      6: 'informant',
    },
    xpMultiplier: 1.0,
  },
  {
    id: 'whisper',
    displayName: 'Cdr. Vasile',
    callsign: 'WHISPER',
    portraitKey: 'portrait_whisper',
    role: 'support',
    factionId: 'terran_hegemony',
    defaultShipId: 'terran_gladius',
    startingAbilityIds: ['defensive_flying'],
    levelAbilityMap: {
      2: 'evade_mastery',
      3: 'wingman',
      4: 'focus_mastery',
      5: 'target_lock_mastery',
      6: 'squad_leader',
    },
    xpMultiplier: 1.0,
  },
];

// ============================================
// FREE CONFEDERATION PILOTS
// Campaign: "The Freedom Fighters"
// ============================================

const FREE_CONFEDERATION_PILOTS: CampaignPilot[] = [
  {
    id: 'commander_santos',
    displayName: 'Commander Santos',
    callsign: 'LIBRE ONE',
    portraitKey: 'portrait_commander_santos',
    role: 'protagonist',
    factionId: 'free_confederation',
    defaultShipId: 'confed_sparrow',
    startingAbilityIds: ['marksman'],
    levelAbilityMap: {
      2: 'swarm_tactics',
      3: 'focus_mastery',
      4: 'coordinated_assault',
      5: 'prescience',
      6: 'inspiring_presence',
    },
    xpMultiplier: 1.0,
  },
  {
    id: 'phoenix_one',
    displayName: 'Phoenix One',
    callsign: 'PHOENIX ONE',
    portraitKey: 'portrait_phoenix_one',
    role: 'support',
    factionId: 'free_confederation',
    defaultShipId: 'confed_wasp',
    startingAbilityIds: ['fearless'],
    levelAbilityMap: {
      2: 'afterburners',
      3: 'daredevil',
      4: 'boost_expertise',
      5: 'barrel_roll_efficiency',
      6: 'dead_eye',
    },
    xpMultiplier: 1.0,
  },
  {
    id: 'doc_vasquez',
    displayName: 'Dr. Vasquez',
    callsign: 'MEDIC',
    portraitKey: 'portrait_doc_vasquez',
    role: 'support',
    factionId: 'free_confederation',
    defaultShipId: 'confed_pelican',
    startingAbilityIds: ['shield_transfer'],
    levelAbilityMap: {
      2: 'healing_aura',
      3: 'wingman',
      4: 'stalwart',
      5: 'stress_recovery',
      6: 'squad_leader',
    },
    xpMultiplier: 1.0,
  },
];

// ============================================
// SYNTHETIC COLLECTIVE PILOTS
// Campaign: "The Next Phase"
// ============================================

const SYNTHETIC_COLLECTIVE_PILOTS: CampaignPilot[] = [
  {
    id: 'omega_7',
    displayName: 'Omega-7',
    callsign: 'OMEGA SEVEN',
    portraitKey: 'portrait_omega_7',
    role: 'protagonist',
    factionId: 'synthetic_collective',
    defaultShipId: 'synth_interceptor_drone',
    startingAbilityIds: ['networked_aim'],
    levelAbilityMap: {
      2: 'hive_mind',
      3: 'predatory_instinct',
      4: 'target_lock_mastery',
      5: 'dead_eye',
      6: 'coordinated_assault',
    },
    xpMultiplier: 1.0,
  },
  {
    id: 'prime_collective',
    displayName: 'Prime Collective',
    callsign: 'PRIME',
    portraitKey: 'portrait_prime_collective',
    role: 'support',
    factionId: 'synthetic_collective',
    defaultShipId: 'synth_relay_node',
    startingAbilityIds: ['swarm_tactics'],
    levelAbilityMap: {
      2: 'shield_transfer',
      3: 'hive_mind',
      4: 'informant',
      5: 'inspiring_presence',
      6: 'squad_leader',
    },
    xpMultiplier: 1.0,
  },
  {
    id: 'unit_zero',
    displayName: 'Unit Zero',
    callsign: 'ZERO',
    portraitKey: 'portrait_unit_zero',
    role: 'support',
    factionId: 'synthetic_collective',
    defaultShipId: 'synth_hunter',
    startingAbilityIds: ['ruthless'],
    levelAbilityMap: {
      2: 'heavy_gunner',
      3: 'predatory_instinct',
      4: 'tenacity',
      5: 'fanatical',
      6: 'dead_eye',
    },
    xpMultiplier: 1.0,
  },
];

// ============================================
// VOID CORSAIRS PILOTS
// Campaign: "No Quarter"
// ============================================

const VOID_CORSAIRS_PILOTS: CampaignPilot[] = [
  {
    id: 'captain_kira',
    displayName: 'Captain Kira',
    callsign: 'KIRA',
    portraitKey: 'portrait_captain_kira',
    role: 'protagonist',
    factionId: 'void_corsairs',
    defaultShipId: 'corsair_blade',
    startingAbilityIds: ['daredevil'],
    levelAbilityMap: {
      2: 'barrel_roll_efficiency',
      3: 'outmaneuver',
      4: 'boost_expertise',
      5: 'dead_eye',
      6: 'phantom_strike',
    },
    xpMultiplier: 1.0,
  },
  {
    id: 'the_admiral',
    displayName: 'The Admiral',
    callsign: 'THE ADMIRAL',
    portraitKey: 'portrait_the_admiral',
    role: 'support',
    factionId: 'void_corsairs',
    defaultShipId: 'corsair_reaver',
    startingAbilityIds: ['intimidation'],
    levelAbilityMap: {
      2: 'informant',
      3: 'lone_wolf',
      4: 'ruthless',
      5: 'heavy_gunner',
      6: 'inspiring_presence',
    },
    xpMultiplier: 1.0,
  },
  {
    id: 'bloodfang',
    displayName: 'Bloodfang',
    callsign: 'BLOODFANG',
    portraitKey: 'portrait_bloodfang',
    role: 'support',
    factionId: 'void_corsairs',
    defaultShipId: 'corsair_fang',
    startingAbilityIds: ['fearless'],
    levelAbilityMap: {
      2: 'predatory_instinct',
      3: 'fanatical',
      4: 'tenacity',
      5: 'crack_shot',
      6: 'ruthless',
    },
    xpMultiplier: 1.0,
  },
];

// ============================================
// ASCENDANT EMPIRE PILOTS
// Campaign: "The Ascension"
// ============================================

const ASCENDANT_EMPIRE_PILOTS: CampaignPilot[] = [
  {
    id: 'the_dreamer',
    displayName: 'The Dreamer',
    callsign: 'THE DREAMER',
    portraitKey: 'portrait_the_dreamer',
    role: 'protagonist',
    factionId: 'ascendant_empire',
    defaultShipId: 'ascendant_seraph',
    startingAbilityIds: ['sense'],
    levelAbilityMap: {
      2: 'prescience',
      3: 'force_guidance',
      4: 'focus_mastery',
      5: 'force_heal',
      6: 'target_lock_mastery',
    },
    xpMultiplier: 1.0,
  },
  {
    id: 'archon_zaelthar',
    displayName: 'Archon Zaelthar',
    callsign: 'ARCHON',
    portraitKey: 'portrait_archon_zaelthar',
    role: 'support',
    factionId: 'ascendant_empire',
    defaultShipId: 'ascendant_templar',
    startingAbilityIds: ['stalwart'],
    levelAbilityMap: {
      2: 'shield_upgrade',
      3: 'regenerative_shields',
      4: 'shield_transfer',
      5: 'healing_aura',
      6: 'inspiring_presence',
    },
    xpMultiplier: 1.0,
  },
  {
    id: 'herald',
    displayName: 'The Herald',
    callsign: 'HERALD',
    portraitKey: 'portrait_herald',
    role: 'support',
    factionId: 'ascendant_empire',
    defaultShipId: 'ascendant_herald',
    startingAbilityIds: ['force_guidance'],
    levelAbilityMap: {
      2: 'force_push',
      3: 'supernatural_reflexes',
      4: 'elusive',
      5: 'evade_mastery',
      6: 'defensive_flying',
    },
    xpMultiplier: 1.0,
  },
];

// ============================================
// Campaign Pilot Registry
// ============================================

export const CAMPAIGN_PILOTS: Record<FactionId, CampaignPilot[]> = {
  terran_hegemony: TERRAN_PILOTS,
  free_confederation: FREE_CONFEDERATION_PILOTS,
  synthetic_collective: SYNTHETIC_COLLECTIVE_PILOTS,
  void_corsairs: VOID_CORSAIRS_PILOTS,
  ascendant_empire: ASCENDANT_EMPIRE_PILOTS,
};
