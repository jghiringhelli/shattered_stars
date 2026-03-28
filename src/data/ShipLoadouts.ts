/**
 * Ship Loadouts System
 *
 * Defines upgrade slots and pre-configured builds for each ship.
 * Follows X-Wing TMG Second Edition design philosophy:
 * - Each ship has specific upgrade slots based on role
 * - Pre-built loadouts optimize each ship's strengths
 * - AI enemies and campaign missions use these loadouts
 */

import type { UpgradeSlotType } from '../systems/UpgradeSystem';
import type { ShipRole } from '../core/types';

// ============================================
// Ship Upgrade Slot Configurations
// ============================================

export interface ShipSlotConfig {
  readonly shipId: string;
  readonly slots: readonly UpgradeSlotType[];
  readonly charges?: number; // Base charges for ordnance
}

/**
 * Upgrade slots for each ship
 * Based on X-Wing 2.0 slot distribution principles
 */
export const SHIP_SLOTS: Record<string, ShipSlotConfig> = {
  // ==========================================
  // TERRAN HEGEMONY (20 ships)
  // ==========================================

  // Light Fighters
  terran_viper: {
    shipId: 'terran_viper',
    slots: ['talent', 'missile', 'modification', 'configuration'],
  },
  terran_stiletto: {
    shipId: 'terran_stiletto',
    slots: ['talent', 'modification'],
  },
  terran_raptor: {
    shipId: 'terran_raptor',
    slots: ['talent', 'missile', 'sensor', 'modification'],
  },

  // Heavy Fighters
  terran_gladius: {
    shipId: 'terran_gladius',
    slots: ['talent', 'torpedo', 'sensor', 'modification'],
  },
  terran_centurion: {
    shipId: 'terran_centurion',
    slots: ['talent', 'cannon', 'sensor', 'modification'],
  },
  terran_praetorian: {
    shipId: 'terran_praetorian',
    slots: ['talent', 'cannon', 'crew', 'modification', 'configuration'],
  },
  terran_legionnaire: {
    shipId: 'terran_legionnaire',
    slots: ['talent', 'missile', 'sensor', 'modification'],
  },

  // Bombers
  terran_hammer: {
    shipId: 'terran_hammer',
    slots: ['torpedo', 'torpedo', 'bomb', 'gunner', 'crew', 'modification', 'configuration'],
    charges: 4,
  },
  terran_thunderbolt: {
    shipId: 'terran_thunderbolt',
    slots: ['torpedo', 'torpedo', 'bomb', 'bomb', 'gunner', 'crew', 'modification'],
    charges: 5,
  },
  terran_javelin: {
    shipId: 'terran_javelin',
    slots: ['torpedo', 'torpedo', 'sensor', 'modification'],
    charges: 3,
  },

  // Support Ships
  terran_sentinel: {
    shipId: 'terran_sentinel',
    slots: ['talent', 'crew', 'crew', 'sensor', 'tech', 'modification'],
  },
  terran_guardian: {
    shipId: 'terran_guardian',
    slots: ['crew', 'crew', 'sensor', 'tech', 'modification'],
  },
  terran_harbinger: {
    shipId: 'terran_harbinger',
    slots: ['talent', 'sensor', 'tech', 'modification'],
  },

  // Gunships
  terran_bastion: {
    shipId: 'terran_bastion',
    slots: ['turret', 'cannon', 'gunner', 'crew', 'modification'],
    charges: 2,
  },
  terran_bulwark: {
    shipId: 'terran_bulwark',
    slots: ['turret', 'turret', 'cannon', 'gunner', 'crew', 'modification'],
    charges: 3,
  },
  terran_vindicator: {
    shipId: 'terran_vindicator',
    slots: ['turret', 'cannon', 'missile', 'gunner', 'modification'],
    charges: 2,
  },

  // Capital Ships
  terran_imperator: {
    shipId: 'terran_imperator',
    slots: ['turret', 'turret', 'cannon', 'cannon', 'gunner', 'crew', 'crew', 'sensor', 'modification', 'title'],
    charges: 4,
  },
  terran_dominator: {
    shipId: 'terran_dominator',
    slots: ['turret', 'cannon', 'gunner', 'crew', 'crew', 'crew', 'sensor', 'modification', 'title'],
    charges: 3,
  },
  terran_executor: {
    shipId: 'terran_executor',
    slots: ['turret', 'turret', 'cannon', 'gunner', 'crew', 'modification', 'title'],
    charges: 3,
  },
  terran_consul: {
    shipId: 'terran_consul',
    slots: ['crew', 'crew', 'crew', 'sensor', 'sensor', 'tech', 'modification', 'title'],
  },

  // ==========================================
  // FREE CONFEDERATION (20 ships)
  // ==========================================

  // Light Fighters
  confed_sparrow: {
    shipId: 'confed_sparrow',
    slots: ['talent', 'missile', 'modification'],
  },
  confed_wasp: {
    shipId: 'confed_wasp',
    slots: ['talent', 'modification'],
  },
  confed_finch: {
    shipId: 'confed_finch',
    slots: ['sensor', 'modification'],
  },
  confed_kestrel: {
    shipId: 'confed_kestrel',
    slots: ['talent', 'missile', 'modification', 'configuration'],
  },

  // Heavy Fighters
  confed_falcon: {
    shipId: 'confed_falcon',
    slots: ['talent', 'torpedo', 'astromech', 'modification', 'configuration'],
  },
  confed_hawk: {
    shipId: 'confed_hawk',
    slots: ['talent', 'cannon', 'missile', 'modification'],
  },
  confed_eagle: {
    shipId: 'confed_eagle',
    slots: ['talent', 'torpedo', 'sensor', 'astromech', 'modification'],
  },
  confed_condor: {
    shipId: 'confed_condor',
    slots: ['talent', 'cannon', 'crew', 'modification'],
  },

  // Stealth Ships
  confed_raven: {
    shipId: 'confed_raven',
    slots: ['talent', 'tech', 'missile', 'modification', 'configuration'],
  },
  confed_owl: {
    shipId: 'confed_owl',
    slots: ['talent', 'tech', 'sensor', 'modification', 'configuration'],
  },

  // Bombers
  confed_pelican: {
    shipId: 'confed_pelican',
    slots: ['torpedo', 'bomb', 'gunner', 'modification'],
    charges: 3,
  },
  confed_albatross: {
    shipId: 'confed_albatross',
    slots: ['torpedo', 'torpedo', 'bomb', 'gunner', 'crew', 'modification'],
    charges: 4,
  },

  // Gunships
  confed_phoenix: {
    shipId: 'confed_phoenix',
    slots: ['talent', 'turret', 'cannon', 'crew', 'gunner', 'modification'],
    charges: 2,
  },
  confed_thunderbird: {
    shipId: 'confed_thunderbird',
    slots: ['turret', 'turret', 'cannon', 'gunner', 'crew', 'modification'],
    charges: 3,
  },
  confed_harrier: {
    shipId: 'confed_harrier',
    slots: ['turret', 'cannon', 'missile', 'gunner', 'modification'],
    charges: 2,
  },

  // Support Ships
  confed_crane: {
    shipId: 'confed_crane',
    slots: ['crew', 'crew', 'sensor', 'tech', 'modification'],
  },
  confed_heron: {
    shipId: 'confed_heron',
    slots: ['crew', 'crew', 'sensor', 'tech', 'modification', 'title'],
  },

  // Capital Ships
  confed_liberty: {
    shipId: 'confed_liberty',
    slots: ['turret', 'cannon', 'gunner', 'crew', 'crew', 'sensor', 'modification', 'title'],
    charges: 3,
  },
  confed_independence: {
    shipId: 'confed_independence',
    slots: ['turret', 'gunner', 'crew', 'crew', 'crew', 'sensor', 'modification', 'title'],
    charges: 2,
  },
  confed_defiance: {
    shipId: 'confed_defiance',
    slots: ['turret', 'turret', 'cannon', 'gunner', 'crew', 'modification', 'title'],
    charges: 3,
  },

  // ==========================================
  // SYNTHETIC COLLECTIVE (20 ships)
  // ==========================================

  // Drones
  synth_drone: {
    shipId: 'synth_drone',
    slots: ['cannon', 'modification', 'configuration'],
  },
  synth_scout_drone: {
    shipId: 'synth_scout_drone',
    slots: ['sensor', 'modification'],
  },
  synth_heavy_drone: {
    shipId: 'synth_heavy_drone',
    slots: ['cannon', 'sensor', 'modification'],
  },
  synth_bomber_drone: {
    shipId: 'synth_bomber_drone',
    slots: ['torpedo', 'bomb', 'modification'],
    charges: 2,
  },
  synth_interceptor_drone: {
    shipId: 'synth_interceptor_drone',
    slots: ['cannon', 'modification', 'configuration'],
  },

  // Heavy Units
  synth_hunter: {
    shipId: 'synth_hunter',
    slots: ['cannon', 'sensor', 'tech', 'modification', 'configuration'],
  },
  synth_stalker: {
    shipId: 'synth_stalker',
    slots: ['cannon', 'sensor', 'modification', 'configuration'],
  },
  synth_ravager: {
    shipId: 'synth_ravager',
    slots: ['cannon', 'cannon', 'sensor', 'modification'],
  },
  synth_predator: {
    shipId: 'synth_predator',
    slots: ['cannon', 'missile', 'sensor', 'modification'],
  },

  // Destroyers
  synth_destroyer: {
    shipId: 'synth_destroyer',
    slots: ['torpedo', 'torpedo', 'cannon', 'sensor', 'tech', 'modification'],
    charges: 4,
  },
  synth_annihilator: {
    shipId: 'synth_annihilator',
    slots: ['torpedo', 'torpedo', 'cannon', 'cannon', 'sensor', 'modification'],
    charges: 5,
  },

  // Support Nodes
  synth_carrier: {
    shipId: 'synth_carrier',
    slots: ['crew', 'crew', 'gunner', 'turret', 'sensor', 'tech', 'modification', 'title'],
    charges: 3,
  },
  synth_relay_node: {
    shipId: 'synth_relay_node',
    slots: ['sensor', 'sensor', 'tech', 'modification'],
  },
  synth_repair_node: {
    shipId: 'synth_repair_node',
    slots: ['crew', 'sensor', 'tech', 'modification'],
  },

  // Gunships
  synth_devastator: {
    shipId: 'synth_devastator',
    slots: ['turret', 'cannon', 'cannon', 'sensor', 'modification'],
    charges: 2,
  },
  synth_eradicator: {
    shipId: 'synth_eradicator',
    slots: ['turret', 'turret', 'cannon', 'sensor', 'modification'],
    charges: 3,
  },

  // Capital Ships
  synth_nexus: {
    shipId: 'synth_nexus',
    slots: ['turret', 'cannon', 'crew', 'crew', 'sensor', 'sensor', 'tech', 'modification', 'title'],
    charges: 4,
  },
  synth_overmind: {
    shipId: 'synth_overmind',
    slots: ['turret', 'crew', 'crew', 'crew', 'sensor', 'tech', 'modification', 'title'],
    charges: 3,
  },
  synth_terminus: {
    shipId: 'synth_terminus',
    slots: ['turret', 'turret', 'cannon', 'cannon', 'sensor', 'modification', 'title'],
    charges: 4,
  },
  synth_conduit: {
    shipId: 'synth_conduit',
    slots: ['turret', 'cannon', 'sensor', 'sensor', 'tech', 'modification', 'title'],
    charges: 3,
  },

  // ==========================================
  // VOID CORSAIRS (20 ships)
  // ==========================================

  // Interceptors
  corsair_blade: {
    shipId: 'corsair_blade',
    slots: ['talent', 'missile', 'modification', 'configuration'],
  },
  corsair_fang: {
    shipId: 'corsair_fang',
    slots: ['talent', 'modification', 'configuration'],
  },
  corsair_talon: {
    shipId: 'corsair_talon',
    slots: ['talent', 'missile', 'modification'],
  },
  corsair_venom: {
    shipId: 'corsair_venom',
    slots: ['talent', 'modification'],
  },

  // Heavy Fighters
  corsair_marauder: {
    shipId: 'corsair_marauder',
    slots: ['talent', 'cannon', 'missile', 'gunner', 'modification'],
    charges: 2,
  },
  corsair_cutlass: {
    shipId: 'corsair_cutlass',
    slots: ['talent', 'cannon', 'missile', 'modification'],
  },
  corsair_scimitar: {
    shipId: 'corsair_scimitar',
    slots: ['talent', 'cannon', 'torpedo', 'modification'],
  },
  corsair_saber: {
    shipId: 'corsair_saber',
    slots: ['talent', 'cannon', 'modification', 'configuration'],
  },

  // Stealth Ships
  corsair_specter: {
    shipId: 'corsair_specter',
    slots: ['talent', 'tech', 'crew', 'modification', 'configuration'],
  },
  corsair_phantom: {
    shipId: 'corsair_phantom',
    slots: ['talent', 'tech', 'modification', 'configuration'],
  },
  corsair_shadow: {
    shipId: 'corsair_shadow',
    slots: ['talent', 'tech', 'cannon', 'modification', 'configuration'],
  },

  // Gunships
  corsair_reaver: {
    shipId: 'corsair_reaver',
    slots: ['talent', 'turret', 'turret', 'cannon', 'gunner', 'crew', 'modification'],
    charges: 3,
  },
  corsair_pillager: {
    shipId: 'corsair_pillager',
    slots: ['turret', 'turret', 'cannon', 'gunner', 'crew', 'modification'],
    charges: 3,
  },
  corsair_ravager: {
    shipId: 'corsair_ravager',
    slots: ['turret', 'cannon', 'cannon', 'gunner', 'modification'],
    charges: 2,
  },

  // Bombers
  corsair_bomber: {
    shipId: 'corsair_bomber',
    slots: ['torpedo', 'bomb', 'gunner', 'modification'],
    charges: 3,
  },
  corsair_torpedo_boat: {
    shipId: 'corsair_torpedo_boat',
    slots: ['torpedo', 'torpedo', 'modification'],
    charges: 3,
  },

  // Capital Ships
  corsair_dreadnought: {
    shipId: 'corsair_dreadnought',
    slots: ['turret', 'turret', 'cannon', 'cannon', 'gunner', 'crew', 'crew', 'modification', 'title'],
    charges: 4,
  },
  corsair_galleon: {
    shipId: 'corsair_galleon',
    slots: ['turret', 'cannon', 'gunner', 'crew', 'crew', 'modification', 'title'],
    charges: 3,
  },
  corsair_frigate: {
    shipId: 'corsair_frigate',
    slots: ['turret', 'cannon', 'gunner', 'crew', 'modification', 'title'],
    charges: 2,
  },
  corsair_tender: {
    shipId: 'corsair_tender',
    slots: ['crew', 'crew', 'sensor', 'tech', 'modification'],
  },

  // ==========================================
  // ASCENDANT EMPIRE (20 ships)
  // ==========================================

  // Interceptors
  ascendant_seraph: {
    shipId: 'ascendant_seraph',
    slots: ['talent', 'talent', 'sensor', 'modification', 'configuration'],
  },
  ascendant_cherub: {
    shipId: 'ascendant_cherub',
    slots: ['talent', 'modification'],
  },
  ascendant_herald: {
    shipId: 'ascendant_herald',
    slots: ['talent', 'sensor', 'modification'],
  },
  ascendant_virtue: {
    shipId: 'ascendant_virtue',
    slots: ['talent', 'missile', 'modification', 'configuration'],
  },

  // Heavy Fighters
  ascendant_templar: {
    shipId: 'ascendant_templar',
    slots: ['talent', 'torpedo', 'cannon', 'sensor', 'modification'],
  },
  ascendant_crusader: {
    shipId: 'ascendant_crusader',
    slots: ['talent', 'cannon', 'cannon', 'sensor', 'modification'],
  },
  ascendant_paladin: {
    shipId: 'ascendant_paladin',
    slots: ['talent', 'cannon', 'crew', 'modification', 'configuration'],
  },
  ascendant_inquisitor: {
    shipId: 'ascendant_inquisitor',
    slots: ['talent', 'cannon', 'tech', 'modification'],
  },

  // Support Ships
  ascendant_oracle: {
    shipId: 'ascendant_oracle',
    slots: ['talent', 'crew', 'crew', 'sensor', 'tech', 'modification', 'title'],
  },
  ascendant_prophet: {
    shipId: 'ascendant_prophet',
    slots: ['crew', 'crew', 'crew', 'sensor', 'tech', 'modification', 'title'],
  },
  ascendant_acolyte: {
    shipId: 'ascendant_acolyte',
    slots: ['crew', 'sensor', 'tech', 'modification'],
  },

  // Gunships
  ascendant_avatar: {
    shipId: 'ascendant_avatar',
    slots: ['talent', 'turret', 'cannon', 'cannon', 'crew', 'gunner', 'modification', 'title'],
    charges: 3,
  },
  ascendant_wrath: {
    shipId: 'ascendant_wrath',
    slots: ['turret', 'cannon', 'cannon', 'gunner', 'modification'],
    charges: 2,
  },
  ascendant_judgment: {
    shipId: 'ascendant_judgment',
    slots: ['turret', 'turret', 'cannon', 'gunner', 'crew', 'modification'],
    charges: 3,
  },

  // Bombers
  ascendant_smiter: {
    shipId: 'ascendant_smiter',
    slots: ['torpedo', 'bomb', 'gunner', 'modification'],
    charges: 3,
  },
  ascendant_purifier: {
    shipId: 'ascendant_purifier',
    slots: ['torpedo', 'torpedo', 'bomb', 'gunner', 'crew', 'modification'],
    charges: 4,
  },

  // Capital Ships
  ascendant_divine: {
    shipId: 'ascendant_divine',
    slots: ['turret', 'turret', 'cannon', 'cannon', 'gunner', 'crew', 'crew', 'sensor', 'modification', 'title'],
    charges: 5,
  },
  ascendant_glory: {
    shipId: 'ascendant_glory',
    slots: ['turret', 'turret', 'cannon', 'gunner', 'crew', 'crew', 'modification', 'title'],
    charges: 4,
  },
  ascendant_sanctum: {
    shipId: 'ascendant_sanctum',
    slots: ['turret', 'cannon', 'crew', 'crew', 'crew', 'sensor', 'modification', 'title'],
    charges: 3,
  },
  ascendant_bastion: {
    shipId: 'ascendant_bastion',
    slots: ['turret', 'turret', 'cannon', 'gunner', 'crew', 'modification', 'title'],
    charges: 3,
  },
};

// ============================================
// Pre-Built Loadouts
// ============================================

export interface ShipLoadout {
  readonly id: string;
  readonly name: string;
  readonly shipId: string;
  readonly upgrades: readonly string[]; // Upgrade IDs
  readonly pointCost: number; // Total with upgrades
  readonly description: string;
  readonly role: 'offense' | 'defense' | 'support' | 'balanced' | 'swarm';
}

/**
 * Pre-configured loadouts for AI and campaign use
 * Each ship has 2-3 recommended builds
 */
export const SHIP_LOADOUTS: Record<string, ShipLoadout[]> = {
  // ==========================================
  // TERRAN HEGEMONY LOADOUTS (20 ships)
  // ==========================================

  terran_viper: [
    { id: 'viper_ace', name: 'Viper Ace', shipId: 'terran_viper', upgrades: ['predator', 'concussion_missile', 'stealth_device'], pointCost: 58, description: 'Elite interceptor with missile strike capability', role: 'offense' },
    { id: 'viper_pursuit', name: 'Viper Pursuit', shipId: 'terran_viper', upgrades: ['elusive', 'engine_upgrade'], pointCost: 52, description: 'Fast pursuit interceptor focused on evasion', role: 'defense' },
  ],
  terran_stiletto: [
    { id: 'stiletto_basic', name: 'Stiletto Basic', shipId: 'terran_stiletto', upgrades: [], pointCost: 28, description: 'Basic patrol fighter', role: 'swarm' },
    { id: 'stiletto_ace', name: 'Stiletto Ace', shipId: 'terran_stiletto', upgrades: ['elusive'], pointCost: 35, description: 'Nimble pilot build', role: 'defense' },
  ],
  terran_raptor: [
    { id: 'raptor_striker', name: 'Raptor Striker', shipId: 'terran_raptor', upgrades: ['predator', 'concussion_missile'], pointCost: 60, description: 'Elite strike interceptor', role: 'offense' },
    { id: 'raptor_pursuit', name: 'Raptor Pursuit', shipId: 'terran_raptor', upgrades: ['elusive', 'advanced_sensors'], pointCost: 58, description: 'Fast pursuit build', role: 'defense' },
  ],
  terran_gladius: [
    { id: 'gladius_striker', name: 'Gladius Striker', shipId: 'terran_gladius', upgrades: ['marksman', 'proton_torpedo', 'fire_control_system'], pointCost: 65, description: 'Heavy strike fighter with torpedo payload', role: 'offense' },
    { id: 'gladius_patrol', name: 'Gladius Patrol', shipId: 'terran_gladius', upgrades: ['fire_control_system', 'hull_upgrade'], pointCost: 57, description: 'Durable patrol fighter for extended operations', role: 'defense' },
  ],
  terran_centurion: [
    { id: 'centurion_assault', name: 'Centurion Assault', shipId: 'terran_centurion', upgrades: ['heavy_laser_cannon', 'fire_control_system'], pointCost: 72, description: 'Heavy assault build', role: 'offense' },
    { id: 'centurion_defender', name: 'Centurion Defender', shipId: 'terran_centurion', upgrades: ['shield_upgrade', 'hull_upgrade'], pointCost: 68, description: 'Durable defender build', role: 'defense' },
  ],
  terran_praetorian: [
    { id: 'praetorian_elite', name: 'Praetorian Elite', shipId: 'terran_praetorian', upgrades: ['predator', 'heavy_laser_cannon', 'tactical_officer'], pointCost: 82, description: 'Elite guard configuration', role: 'offense' },
    { id: 'praetorian_command', name: 'Praetorian Command', shipId: 'terran_praetorian', upgrades: ['coordinated_assault', 'hull_upgrade'], pointCost: 78, description: 'Command escort build', role: 'support' },
  ],
  terran_legionnaire: [
    { id: 'legionnaire_assault', name: 'Legionnaire Assault', shipId: 'terran_legionnaire', upgrades: ['marksman', 'concussion_missile'], pointCost: 68, description: 'Assault fighter build', role: 'offense' },
    { id: 'legionnaire_line', name: 'Legionnaire Line', shipId: 'terran_legionnaire', upgrades: ['hull_upgrade'], pointCost: 60, description: 'Line fighter build', role: 'balanced' },
  ],
  terran_hammer: [
    { id: 'hammer_devastator', name: 'Hammer Devastator', shipId: 'terran_hammer', upgrades: ['bombardier', 'proton_torpedo', 'proton_bomb', 'veteran_gunner'], pointCost: 85, description: 'Full ordnance bomber for capital ship assault', role: 'offense' },
    { id: 'hammer_minelayer', name: 'Hammer Minelayer', shipId: 'terran_hammer', upgrades: ['cluster_mine', 'proximity_mine', 'hull_upgrade'], pointCost: 72, description: 'Area denial bomber with mine deployment', role: 'support' },
  ],
  terran_thunderbolt: [
    { id: 'thunderbolt_siege', name: 'Thunderbolt Siege', shipId: 'terran_thunderbolt', upgrades: ['proton_torpedo', 'proton_torpedo', 'proton_bomb', 'veteran_gunner'], pointCost: 95, description: 'Heavy siege bomber', role: 'offense' },
    { id: 'thunderbolt_assault', name: 'Thunderbolt Assault', shipId: 'terran_thunderbolt', upgrades: ['proton_torpedo', 'seismic_charge', 'hull_upgrade'], pointCost: 88, description: 'Assault bomber build', role: 'balanced' },
  ],
  terran_javelin: [
    { id: 'javelin_strike', name: 'Javelin Strike', shipId: 'terran_javelin', upgrades: ['proton_torpedo', 'proton_torpedo'], pointCost: 62, description: 'Fast torpedo strike', role: 'offense' },
    { id: 'javelin_hunter', name: 'Javelin Hunter', shipId: 'terran_javelin', upgrades: ['proton_torpedo', 'fire_control_system'], pointCost: 58, description: 'Precision torpedo hunter', role: 'offense' },
  ],
  terran_sentinel: [
    { id: 'sentinel_command', name: 'Sentinel Command', shipId: 'terran_sentinel', upgrades: ['coordinated_assault', 'tactical_officer', 'weapons_engineer', 'advanced_sensors'], pointCost: 82, description: 'Fleet command ship with full coordination suite', role: 'support' },
    { id: 'sentinel_shield', name: 'Sentinel Shield', shipId: 'terran_sentinel', upgrades: ['shield_upgrade', 'hull_upgrade', 'collision_detector'], pointCost: 72, description: 'Durable support platform for sustained operations', role: 'defense' },
  ],
  terran_guardian: [
    { id: 'guardian_ecm', name: 'Guardian ECM', shipId: 'terran_guardian', upgrades: ['tactical_officer', 'weapons_engineer', 'advanced_sensors'], pointCost: 72, description: 'Electronic warfare platform', role: 'support' },
    { id: 'guardian_shield', name: 'Guardian Shield', shipId: 'terran_guardian', upgrades: ['shield_upgrade', 'advanced_sensors', 'tactical_officer'], pointCost: 68, description: 'Heavy shield support', role: 'defense' },
  ],
  terran_harbinger: [
    { id: 'harbinger_scout', name: 'Harbinger Scout', shipId: 'terran_harbinger', upgrades: ['advanced_sensors', 'targeting_computer'], pointCost: 55, description: 'Reconnaissance build', role: 'support' },
    { id: 'harbinger_coordinator', name: 'Harbinger Coordinator', shipId: 'terran_harbinger', upgrades: ['coordinated_assault', 'tactical_officer', 'weapons_engineer'], pointCost: 68, description: 'Full coordination platform', role: 'support' },
  ],
  terran_bastion: [
    { id: 'bastion_fortress', name: 'Bastion Fortress', shipId: 'terran_bastion', upgrades: ['twin_laser_turret', 'heavy_laser_cannon', 'veteran_gunner'], pointCost: 92, description: 'Heavy weapons platform', role: 'offense' },
    { id: 'bastion_defender', name: 'Bastion Defender', shipId: 'terran_bastion', upgrades: ['ion_turret', 'hull_upgrade'], pointCost: 85, description: 'Defensive gunship', role: 'defense' },
  ],
  terran_bulwark: [
    { id: 'bulwark_fortress', name: 'Bulwark Fortress', shipId: 'terran_bulwark', upgrades: ['twin_laser_turret', 'quad_laser_turret', 'heavy_laser_cannon', 'veteran_gunner'], pointCost: 105, description: 'Maximum firepower platform', role: 'offense' },
    { id: 'bulwark_bastion', name: 'Bulwark Bastion', shipId: 'terran_bulwark', upgrades: ['ion_turret', 'shield_upgrade', 'hull_upgrade'], pointCost: 98, description: 'Defensive fortress', role: 'defense' },
  ],
  terran_vindicator: [
    { id: 'vindicator_strike', name: 'Vindicator Strike', shipId: 'terran_vindicator', upgrades: ['twin_laser_turret', 'heavy_laser_cannon', 'seeker_missile'], pointCost: 88, description: 'Strike cruiser build', role: 'offense' },
    { id: 'vindicator_escort', name: 'Vindicator Escort', shipId: 'terran_vindicator', upgrades: ['ion_turret', 'concussion_missile'], pointCost: 82, description: 'Escort cruiser build', role: 'balanced' },
  ],
  terran_imperator: [
    { id: 'imperator_flagship', name: 'Imperator Flagship', shipId: 'terran_imperator', upgrades: ['quad_laser_turret', 'heavy_laser_cannon', 'veteran_gunner', 'tactical_officer'], pointCost: 145, description: 'Fleet flagship configuration', role: 'offense' },
    { id: 'imperator_command', name: 'Imperator Command', shipId: 'terran_imperator', upgrades: ['twin_laser_turret', 'coordinated_assault', 'tactical_officer'], pointCost: 138, description: 'Command ship configuration', role: 'support' },
  ],
  terran_dominator: [
    { id: 'dominator_carrier', name: 'Dominator Carrier', shipId: 'terran_dominator', upgrades: ['twin_laser_turret', 'coordinated_assault', 'tactical_officer', 'weapons_engineer'], pointCost: 125, description: 'Carrier operations build', role: 'support' },
    { id: 'dominator_assault', name: 'Dominator Assault', shipId: 'terran_dominator', upgrades: ['quad_laser_turret', 'veteran_gunner'], pointCost: 120, description: 'Assault carrier build', role: 'balanced' },
  ],
  terran_executor: [
    { id: 'executor_hunter', name: 'Executor Hunter', shipId: 'terran_executor', upgrades: ['quad_laser_turret', 'heavy_laser_cannon', 'veteran_gunner'], pointCost: 108, description: 'Hunter-killer destroyer', role: 'offense' },
    { id: 'executor_screen', name: 'Executor Screen', shipId: 'terran_executor', upgrades: ['twin_laser_turret', 'shield_upgrade'], pointCost: 100, description: 'Fleet screening destroyer', role: 'defense' },
  ],
  terran_consul: [
    { id: 'consul_command', name: 'Consul Command', shipId: 'terran_consul', upgrades: ['coordinated_assault', 'tactical_officer', 'weapons_engineer', 'advanced_sensors'], pointCost: 115, description: 'Fleet command vessel', role: 'support' },
    { id: 'consul_coordinator', name: 'Consul Coordinator', shipId: 'terran_consul', upgrades: ['coordinated_assault', 'tactical_officer'], pointCost: 108, description: 'Coordination platform', role: 'support' },
  ],

  // ==========================================
  // FREE CONFEDERATION LOADOUTS
  // ==========================================

  confed_sparrow: [
    {
      id: 'sparrow_swarm',
      name: 'Sparrow Swarm',
      shipId: 'confed_sparrow',
      upgrades: ['seeker_missile'],
      pointCost: 38,
      description: 'Cheap swarm fighter with missile punch',
      role: 'swarm',
    },
    {
      id: 'sparrow_ace',
      name: 'Sparrow Ace',
      shipId: 'confed_sparrow',
      upgrades: ['elusive', 'engine_upgrade'],
      pointCost: 42,
      description: 'Nimble ace pilot build',
      role: 'defense',
    },
  ],

  confed_falcon: [
    {
      id: 'falcon_striker',
      name: 'Falcon Striker',
      shipId: 'confed_falcon',
      upgrades: ['predator', 'proton_torpedo', 'targeting_astromech'],
      pointCost: 68,
      description: 'Balanced strike fighter with ordnance',
      role: 'offense',
    },
    {
      id: 'falcon_defender',
      name: 'Falcon Defender',
      shipId: 'confed_falcon',
      upgrades: ['elusive', 'shield_upgrade', 'repair_astromech'],
      pointCost: 65,
      description: 'Durable defender with shield regeneration',
      role: 'defense',
    },
  ],

  confed_raven: [
    {
      id: 'raven_ambush',
      name: 'Raven Ambush',
      shipId: 'confed_raven',
      upgrades: ['phantom_strike', 'pattern_analyzer', 'concussion_missile'],
      pointCost: 68,
      description: 'Stealth ambusher with alpha strike',
      role: 'offense',
    },
    {
      id: 'raven_scout',
      name: 'Raven Scout',
      shipId: 'confed_raven',
      upgrades: ['expert_handling', 'stealth_device'],
      pointCost: 60,
      description: 'Recon specialist with enhanced evasion',
      role: 'defense',
    },
  ],

  confed_phoenix: [
    {
      id: 'phoenix_fortress',
      name: 'Phoenix Fortress',
      shipId: 'confed_phoenix',
      upgrades: ['veteran_gunner', 'twin_laser_turret', 'heavy_laser_cannon', 'hull_upgrade'],
      pointCost: 92,
      description: 'Heavy weapons platform with 360° coverage',
      role: 'offense',
    },
    {
      id: 'phoenix_support',
      name: 'Phoenix Support',
      shipId: 'confed_phoenix',
      upgrades: ['tactical_officer', 'ion_turret', 'shield_upgrade'],
      pointCost: 82,
      description: 'Ion control platform with coordination',
      role: 'support',
    },
  ],

  confed_wasp: [
    { id: 'wasp_swarm', name: 'Wasp Swarm', shipId: 'confed_wasp', upgrades: [], pointCost: 25, description: 'Cheap swarm interceptor', role: 'swarm' },
    { id: 'wasp_ace', name: 'Wasp Ace', shipId: 'confed_wasp', upgrades: ['elusive'], pointCost: 32, description: 'Nimble ace build', role: 'defense' },
  ],
  confed_finch: [
    { id: 'finch_scout', name: 'Finch Scout', shipId: 'confed_finch', upgrades: ['advanced_sensors'], pointCost: 30, description: 'Recon scout', role: 'support' },
    { id: 'finch_patrol', name: 'Finch Patrol', shipId: 'confed_finch', upgrades: ['hull_upgrade'], pointCost: 28, description: 'Basic patrol', role: 'swarm' },
  ],
  confed_kestrel: [
    { id: 'kestrel_striker', name: 'Kestrel Striker', shipId: 'confed_kestrel', upgrades: ['predator', 'concussion_missile'], pointCost: 55, description: 'Strike interceptor', role: 'offense' },
    { id: 'kestrel_pursuit', name: 'Kestrel Pursuit', shipId: 'confed_kestrel', upgrades: ['elusive', 'engine_upgrade'], pointCost: 50, description: 'Fast pursuit build', role: 'defense' },
  ],
  confed_hawk: [
    { id: 'hawk_assault', name: 'Hawk Assault', shipId: 'confed_hawk', upgrades: ['marksman', 'heavy_laser_cannon', 'seeker_missile'], pointCost: 68, description: 'Heavy assault build', role: 'offense' },
    { id: 'hawk_patrol', name: 'Hawk Patrol', shipId: 'confed_hawk', upgrades: ['shield_upgrade', 'hull_upgrade'], pointCost: 60, description: 'Durable patrol fighter', role: 'defense' },
  ],
  confed_eagle: [
    { id: 'eagle_striker', name: 'Eagle Striker', shipId: 'confed_eagle', upgrades: ['predator', 'proton_torpedo', 'targeting_astromech'], pointCost: 72, description: 'Elite strike fighter', role: 'offense' },
    { id: 'eagle_defender', name: 'Eagle Defender', shipId: 'confed_eagle', upgrades: ['elusive', 'repair_astromech', 'shield_upgrade'], pointCost: 68, description: 'Durable defender build', role: 'defense' },
  ],
  confed_condor: [
    { id: 'condor_assault', name: 'Condor Assault', shipId: 'confed_condor', upgrades: ['marksman', 'heavy_laser_cannon', 'tactical_officer'], pointCost: 75, description: 'Heavy assault fighter', role: 'offense' },
    { id: 'condor_escort', name: 'Condor Escort', shipId: 'confed_condor', upgrades: ['shield_upgrade', 'hull_upgrade'], pointCost: 68, description: 'Escort fighter build', role: 'defense' },
  ],
  confed_owl: [
    { id: 'owl_infiltrator', name: 'Owl Infiltrator', shipId: 'confed_owl', upgrades: ['phantom_strike', 'advanced_sensors', 'stealth_device'], pointCost: 65, description: 'Stealth infiltrator', role: 'support' },
    { id: 'owl_scout', name: 'Owl Scout', shipId: 'confed_owl', upgrades: ['expert_handling', 'pattern_analyzer'], pointCost: 58, description: 'Recon specialist', role: 'defense' },
  ],
  confed_pelican: [
    { id: 'pelican_bomber', name: 'Pelican Bomber', shipId: 'confed_pelican', upgrades: ['proton_torpedo', 'proton_bomb', 'veteran_gunner'], pointCost: 72, description: 'Standard bomber', role: 'offense' },
    { id: 'pelican_minelayer', name: 'Pelican Minelayer', shipId: 'confed_pelican', upgrades: ['cluster_mine', 'hull_upgrade'], pointCost: 65, description: 'Mine deployment', role: 'support' },
  ],
  confed_albatross: [
    { id: 'albatross_siege', name: 'Albatross Siege', shipId: 'confed_albatross', upgrades: ['proton_torpedo', 'proton_torpedo', 'proton_bomb', 'veteran_gunner'], pointCost: 88, description: 'Heavy siege bomber', role: 'offense' },
    { id: 'albatross_assault', name: 'Albatross Assault', shipId: 'confed_albatross', upgrades: ['proton_torpedo', 'seismic_charge', 'hull_upgrade'], pointCost: 82, description: 'Assault bomber', role: 'balanced' },
  ],
  confed_thunderbird: [
    { id: 'thunderbird_fortress', name: 'Thunderbird Fortress', shipId: 'confed_thunderbird', upgrades: ['twin_laser_turret', 'quad_laser_turret', 'veteran_gunner'], pointCost: 95, description: 'Heavy gunship', role: 'offense' },
    { id: 'thunderbird_defender', name: 'Thunderbird Defender', shipId: 'confed_thunderbird', upgrades: ['ion_turret', 'shield_upgrade', 'hull_upgrade'], pointCost: 88, description: 'Defensive gunship', role: 'defense' },
  ],
  confed_harrier: [
    { id: 'harrier_strike', name: 'Harrier Strike', shipId: 'confed_harrier', upgrades: ['twin_laser_turret', 'heavy_laser_cannon', 'seeker_missile'], pointCost: 82, description: 'Strike gunship', role: 'offense' },
    { id: 'harrier_escort', name: 'Harrier Escort', shipId: 'confed_harrier', upgrades: ['ion_turret', 'hull_upgrade'], pointCost: 75, description: 'Escort gunship', role: 'balanced' },
  ],
  confed_crane: [
    { id: 'crane_coordinator', name: 'Crane Coordinator', shipId: 'confed_crane', upgrades: ['weapons_engineer', 'tactical_officer', 'advanced_sensors'], pointCost: 70, description: 'Fleet coordination', role: 'support' },
    { id: 'crane_support', name: 'Crane Support', shipId: 'confed_crane', upgrades: ['shield_upgrade', 'hull_upgrade'], pointCost: 65, description: 'Durable support', role: 'defense' },
  ],
  confed_heron: [
    { id: 'heron_command', name: 'Heron Command', shipId: 'confed_heron', upgrades: ['hull_upgrade', 'tactical_officer', 'weapons_engineer', 'advanced_sensors'], pointCost: 83, description: 'Fleet command ship', role: 'support' },
    { id: 'heron_relay', name: 'Heron Relay', shipId: 'confed_heron', upgrades: ['advanced_sensors', 'targeting_computer'], pointCost: 75, description: 'Sensor relay', role: 'support' },
  ],
  confed_liberty: [
    { id: 'liberty_flagship', name: 'Liberty Flagship', shipId: 'confed_liberty', upgrades: ['quad_laser_turret', 'heavy_laser_cannon', 'veteran_gunner', 'tactical_officer'], pointCost: 135, description: 'Fleet flagship', role: 'offense' },
    { id: 'liberty_command', name: 'Liberty Command', shipId: 'confed_liberty', upgrades: ['twin_laser_turret', 'coordinated_assault', 'tactical_officer'], pointCost: 128, description: 'Command ship', role: 'support' },
  ],
  confed_independence: [
    { id: 'independence_carrier', name: 'Independence Carrier', shipId: 'confed_independence', upgrades: ['twin_laser_turret', 'coordinated_assault', 'tactical_officer', 'weapons_engineer'], pointCost: 120, description: 'Carrier operations', role: 'support' },
    { id: 'independence_bastion', name: 'Independence Bastion', shipId: 'confed_independence', upgrades: ['ion_turret', 'shield_upgrade', 'hull_upgrade'], pointCost: 115, description: 'Defensive capital', role: 'defense' },
  ],
  confed_defiance: [
    { id: 'defiance_assault', name: 'Defiance Assault', shipId: 'confed_defiance', upgrades: ['quad_laser_turret', 'twin_laser_turret', 'veteran_gunner'], pointCost: 118, description: 'Assault cruiser', role: 'offense' },
    { id: 'defiance_screen', name: 'Defiance Screen', shipId: 'confed_defiance', upgrades: ['twin_laser_turret', 'shield_upgrade'], pointCost: 110, description: 'Fleet screen', role: 'defense' },
  ],

  // ==========================================
  // SYNTHETIC COLLECTIVE LOADOUTS
  // ==========================================

  synth_drone: [
    {
      id: 'drone_standard',
      name: 'Combat Drone',
      shipId: 'synth_drone',
      upgrades: ['jamming_beam'],
      pointCost: 32,
      description: 'Basic combat drone with ion disruption',
      role: 'swarm',
    },
    {
      id: 'drone_heavy',
      name: 'Heavy Drone',
      shipId: 'synth_drone',
      upgrades: ['ion_cannon', 'hull_upgrade'],
      pointCost: 38,
      description: 'Enhanced drone with ion cannon',
      role: 'offense',
    },
  ],

  synth_hunter: [
    {
      id: 'hunter_precision',
      name: 'Hunter Precision',
      shipId: 'synth_hunter',
      upgrades: ['heavy_laser_cannon', 'fire_control_system', 'targeting_computer'],
      pointCost: 72,
      description: 'Precise targeting with heavy firepower',
      role: 'offense',
    },
    {
      id: 'hunter_disruptor',
      name: 'Hunter Disruptor',
      shipId: 'synth_hunter',
      upgrades: ['ion_cannon', 'advanced_sensors', 'pattern_analyzer'],
      pointCost: 70,
      description: 'Control specialist with ion weapons',
      role: 'support',
    },
  ],

  synth_carrier: [
    {
      id: 'carrier_command',
      name: 'Carrier Command Node',
      shipId: 'synth_carrier',
      upgrades: ['coordinated_assault', 'tactical_officer', 'weapons_engineer', 'fire_control_system', 'targeting_computer'],
      pointCost: 98,
      description: 'Full coordination suite for drone swarms',
      role: 'support',
    },
    {
      id: 'carrier_assault',
      name: 'Carrier Assault Node',
      shipId: 'synth_carrier',
      upgrades: ['veteran_gunner', 'ion_turret', 'hull_upgrade', 'shield_upgrade'],
      pointCost: 95,
      description: 'Durable assault platform with turret',
      role: 'balanced',
    },
  ],

  synth_destroyer: [
    {
      id: 'destroyer_alpha',
      name: 'Destroyer Alpha Strike',
      shipId: 'synth_destroyer',
      upgrades: ['proton_torpedo', 'ion_torpedo', 'heavy_laser_cannon', 'fire_control_system'],
      pointCost: 92,
      description: 'Maximum ordnance for capital assault',
      role: 'offense',
    },
    {
      id: 'destroyer_ion',
      name: 'Destroyer Ion Barrage',
      shipId: 'synth_destroyer',
      upgrades: ['ion_torpedo', 'ion_torpedo', 'ion_cannon', 'collision_detector'],
      pointCost: 88,
      description: 'Ion weapon specialist for disabling targets',
      role: 'support',
    },
  ],

  synth_scout_drone: [
    { id: 'scout_recon', name: 'Scout Recon', shipId: 'synth_scout_drone', upgrades: ['advanced_sensors'], pointCost: 28, description: 'Reconnaissance drone', role: 'support' },
    { id: 'scout_basic', name: 'Scout Basic', shipId: 'synth_scout_drone', upgrades: [], pointCost: 22, description: 'Basic scout', role: 'swarm' },
  ],
  synth_heavy_drone: [
    { id: 'heavy_assault', name: 'Heavy Assault Drone', shipId: 'synth_heavy_drone', upgrades: ['heavy_laser_cannon', 'fire_control_system'], pointCost: 45, description: 'Heavy assault drone', role: 'offense' },
    { id: 'heavy_patrol', name: 'Heavy Patrol Drone', shipId: 'synth_heavy_drone', upgrades: ['hull_upgrade'], pointCost: 38, description: 'Durable patrol', role: 'defense' },
  ],
  synth_bomber_drone: [
    { id: 'bomber_strike', name: 'Bomber Strike Drone', shipId: 'synth_bomber_drone', upgrades: ['proton_torpedo', 'proton_bomb'], pointCost: 48, description: 'Ordnance drone', role: 'offense' },
    { id: 'bomber_basic', name: 'Bomber Basic', shipId: 'synth_bomber_drone', upgrades: ['proton_torpedo'], pointCost: 40, description: 'Basic bomber', role: 'offense' },
  ],
  synth_interceptor_drone: [
    { id: 'interceptor_hunter', name: 'Interceptor Hunter', shipId: 'synth_interceptor_drone', upgrades: ['ion_cannon', 'engine_upgrade'], pointCost: 38, description: 'Fast interceptor', role: 'offense' },
    { id: 'interceptor_swarm', name: 'Interceptor Swarm', shipId: 'synth_interceptor_drone', upgrades: [], pointCost: 28, description: 'Swarm interceptor', role: 'swarm' },
  ],
  synth_stalker: [
    { id: 'stalker_hunter', name: 'Stalker Hunter', shipId: 'synth_stalker', upgrades: ['heavy_laser_cannon', 'fire_control_system', 'targeting_computer'], pointCost: 68, description: 'Precision hunter', role: 'offense' },
    { id: 'stalker_ambush', name: 'Stalker Ambush', shipId: 'synth_stalker', upgrades: ['ion_cannon', 'pattern_analyzer'], pointCost: 62, description: 'Ion ambusher', role: 'support' },
  ],
  synth_ravager: [
    { id: 'ravager_assault', name: 'Ravager Assault', shipId: 'synth_ravager', upgrades: ['heavy_laser_cannon', 'heavy_laser_cannon'], pointCost: 75, description: 'Heavy assault', role: 'offense' },
    { id: 'ravager_ion', name: 'Ravager Ion', shipId: 'synth_ravager', upgrades: ['ion_cannon', 'ion_cannon'], pointCost: 70, description: 'Ion assault', role: 'support' },
  ],
  synth_predator: [
    { id: 'predator_strike', name: 'Predator Strike', shipId: 'synth_predator', upgrades: ['heavy_laser_cannon', 'seeker_missile', 'fire_control_system'], pointCost: 72, description: 'Strike hunter', role: 'offense' },
    { id: 'predator_patrol', name: 'Predator Patrol', shipId: 'synth_predator', upgrades: ['ion_cannon', 'shield_upgrade'], pointCost: 65, description: 'Patrol hunter', role: 'balanced' },
  ],
  synth_annihilator: [
    { id: 'annihilator_alpha', name: 'Annihilator Alpha', shipId: 'synth_annihilator', upgrades: ['proton_torpedo', 'proton_torpedo', 'heavy_laser_cannon', 'heavy_laser_cannon'], pointCost: 105, description: 'Maximum firepower', role: 'offense' },
    { id: 'annihilator_siege', name: 'Annihilator Siege', shipId: 'synth_annihilator', upgrades: ['proton_torpedo', 'ion_torpedo', 'fire_control_system'], pointCost: 98, description: 'Siege destroyer', role: 'offense' },
  ],
  synth_relay_node: [
    { id: 'relay_coordinator', name: 'Relay Coordinator', shipId: 'synth_relay_node', upgrades: ['coordinated_assault', 'tactical_officer', 'advanced_sensors'], pointCost: 68, description: 'Full network coordination', role: 'support' },
    { id: 'relay_support', name: 'Relay Support', shipId: 'synth_relay_node', upgrades: ['tactical_officer', 'advanced_sensors'], pointCost: 55, description: 'Enhanced support relay', role: 'support' },
    { id: 'relay_basic', name: 'Relay Basic', shipId: 'synth_relay_node', upgrades: ['advanced_sensors'], pointCost: 48, description: 'Basic relay', role: 'support' },
  ],
  synth_repair_node: [
    { id: 'repair_support', name: 'Repair Support', shipId: 'synth_repair_node', upgrades: ['tactical_officer', 'advanced_sensors', 'targeting_computer'], pointCost: 62, description: 'Support node', role: 'support' },
    { id: 'repair_basic', name: 'Repair Basic', shipId: 'synth_repair_node', upgrades: ['hull_upgrade'], pointCost: 52, description: 'Basic repair', role: 'defense' },
  ],
  synth_devastator: [
    { id: 'devastator_assault', name: 'Devastator Assault', shipId: 'synth_devastator', upgrades: ['twin_laser_turret', 'heavy_laser_cannon', 'heavy_laser_cannon'], pointCost: 88, description: 'Heavy assault', role: 'offense' },
    { id: 'devastator_ion', name: 'Devastator Ion', shipId: 'synth_devastator', upgrades: ['ion_turret', 'ion_cannon', 'ion_cannon'], pointCost: 82, description: 'Ion assault', role: 'support' },
  ],
  synth_eradicator: [
    { id: 'eradicator_fortress', name: 'Eradicator Fortress', shipId: 'synth_eradicator', upgrades: ['twin_laser_turret', 'quad_laser_turret', 'heavy_laser_cannon'], pointCost: 95, description: 'Fortress gunship', role: 'offense' },
    { id: 'eradicator_defender', name: 'Eradicator Defender', shipId: 'synth_eradicator', upgrades: ['ion_turret', 'ion_turret', 'shield_upgrade'], pointCost: 88, description: 'Defensive gunship', role: 'defense' },
  ],
  synth_nexus: [
    { id: 'nexus_command', name: 'Nexus Command', shipId: 'synth_nexus', upgrades: ['quad_laser_turret', 'coordinated_assault', 'tactical_officer', 'weapons_engineer'], pointCost: 135, description: 'Fleet command', role: 'support' },
    { id: 'nexus_assault', name: 'Nexus Assault', shipId: 'synth_nexus', upgrades: ['quad_laser_turret', 'heavy_laser_cannon', 'veteran_gunner'], pointCost: 130, description: 'Assault nexus', role: 'offense' },
  ],
  synth_overmind: [
    { id: 'overmind_coordinator', name: 'Overmind Coordinator', shipId: 'synth_overmind', upgrades: ['twin_laser_turret', 'coordinated_assault', 'tactical_officer', 'weapons_engineer'], pointCost: 125, description: 'Swarm coordination', role: 'support' },
    { id: 'overmind_bastion', name: 'Overmind Bastion', shipId: 'synth_overmind', upgrades: ['ion_turret', 'shield_upgrade', 'hull_upgrade'], pointCost: 118, description: 'Defensive command', role: 'defense' },
  ],
  synth_terminus: [
    { id: 'terminus_siege', name: 'Terminus Siege', shipId: 'synth_terminus', upgrades: ['quad_laser_turret', 'twin_laser_turret', 'heavy_laser_cannon', 'heavy_laser_cannon'], pointCost: 145, description: 'Siege capital', role: 'offense' },
    { id: 'terminus_assault', name: 'Terminus Assault', shipId: 'synth_terminus', upgrades: ['twin_laser_turret', 'heavy_laser_cannon', 'veteran_gunner'], pointCost: 138, description: 'Assault capital', role: 'offense' },
  ],
  synth_conduit: [
    { id: 'conduit_relay', name: 'Conduit Relay', shipId: 'synth_conduit', upgrades: ['twin_laser_turret', 'coordinated_assault', 'advanced_sensors', 'targeting_computer'], pointCost: 118, description: 'Network relay', role: 'support' },
    { id: 'conduit_defense', name: 'Conduit Defense', shipId: 'synth_conduit', upgrades: ['ion_turret', 'shield_upgrade', 'hull_upgrade'], pointCost: 112, description: 'Defensive relay', role: 'defense' },
  ],

  // ==========================================
  // VOID CORSAIRS LOADOUTS
  // ==========================================

  corsair_blade: [
    {
      id: 'blade_raider',
      name: 'Blade Raider',
      shipId: 'corsair_blade',
      upgrades: ['hull_upgrade', 'concussion_missile', 'engine_upgrade'],
      pointCost: 58,
      description: 'Hit-and-run striker with reinforced hull',
      role: 'offense',
    },
    {
      id: 'blade_ace',
      name: 'Blade Ace',
      shipId: 'corsair_blade',
      upgrades: ['elusive', 'stealth_device'],
      pointCost: 55,
      description: 'Elusive ace pilot build',
      role: 'defense',
    },
  ],

  corsair_marauder: [
    {
      id: 'marauder_assault',
      name: 'Marauder Assault',
      shipId: 'corsair_marauder',
      upgrades: ['predator', 'heavy_laser_cannon', 'seeker_missile', 'veteran_gunner'],
      pointCost: 82,
      description: 'Heavy assault with sustained firepower',
      role: 'offense',
    },
    {
      id: 'marauder_brawler',
      name: 'Marauder Brawler',
      shipId: 'corsair_marauder',
      upgrades: ['marksman', 'ion_cannon', 'hull_upgrade'],
      pointCost: 72,
      description: 'Close range brawler with ion disruption',
      role: 'balanced',
    },
  ],

  corsair_specter: [
    {
      id: 'specter_infiltrator',
      name: 'Specter Infiltrator',
      shipId: 'corsair_specter',
      upgrades: ['phantom_strike', 'pattern_analyzer', 'tactical_officer'],
      pointCost: 72,
      description: 'Stealth infiltrator with coordination',
      role: 'support',
    },
    {
      id: 'specter_assassin',
      name: 'Specter Assassin',
      shipId: 'corsair_specter',
      upgrades: ['predator', 'stealth_device', 'targeting_computer'],
      pointCost: 68,
      description: 'Silent assassin with precise targeting',
      role: 'offense',
    },
  ],

  corsair_reaver: [
    {
      id: 'reaver_devastator',
      name: 'Reaver Devastator',
      shipId: 'corsair_reaver',
      upgrades: ['veteran_gunner', 'twin_laser_turret', 'quad_laser_turret', 'heavy_laser_cannon'],
      pointCost: 105,
      description: 'Maximum firepower assault gunboat',
      role: 'offense',
    },
    {
      id: 'reaver_boarding',
      name: 'Reaver Boarding Party',
      shipId: 'corsair_reaver',
      upgrades: ['tactical_officer', 'light_laser_turret', 'ion_cannon', 'hull_upgrade'],
      pointCost: 92,
      description: 'Boarding assault with ion disruption',
      role: 'balanced',
    },
  ],

  corsair_fang: [
    { id: 'fang_raider', name: 'Fang Raider', shipId: 'corsair_fang', upgrades: ['predator', 'hull_upgrade'], pointCost: 42, description: 'Fast raider with reinforced hull', role: 'offense' },
    { id: 'fang_swarm', name: 'Fang Swarm', shipId: 'corsair_fang', upgrades: [], pointCost: 32, description: 'Swarm interceptor', role: 'swarm' },
  ],
  corsair_talon: [
    { id: 'talon_striker', name: 'Talon Striker', shipId: 'corsair_talon', upgrades: ['hull_upgrade', 'concussion_missile'], pointCost: 52, description: 'Reinforced strike interceptor', role: 'offense' },
    { id: 'talon_ace', name: 'Talon Ace', shipId: 'corsair_talon', upgrades: ['elusive', 'engine_upgrade'], pointCost: 48, description: 'Ace pilot build', role: 'defense' },
  ],
  corsair_venom: [
    { id: 'venom_assassin', name: 'Venom Assassin', shipId: 'corsair_venom', upgrades: ['elusive', 'hull_upgrade'], pointCost: 35, description: 'Nimble assassin with reinforced hull', role: 'offense' },
    { id: 'venom_swarm', name: 'Venom Swarm', shipId: 'corsair_venom', upgrades: [], pointCost: 28, description: 'Cheap swarm', role: 'swarm' },
  ],
  corsair_cutlass: [
    { id: 'cutlass_assault', name: 'Cutlass Assault', shipId: 'corsair_cutlass', upgrades: ['marksman', 'heavy_laser_cannon', 'seeker_missile'], pointCost: 68, description: 'Heavy assault', role: 'offense' },
    { id: 'cutlass_brawler', name: 'Cutlass Brawler', shipId: 'corsair_cutlass', upgrades: ['shield_upgrade', 'hull_upgrade'], pointCost: 58, description: 'Close range brawler', role: 'defense' },
  ],
  corsair_scimitar: [
    { id: 'scimitar_torpedo', name: 'Scimitar Torpedo', shipId: 'corsair_scimitar', upgrades: ['marksman', 'heavy_laser_cannon', 'proton_torpedo'], pointCost: 72, description: 'Torpedo fighter', role: 'offense' },
    { id: 'scimitar_assault', name: 'Scimitar Assault', shipId: 'corsair_scimitar', upgrades: ['heavy_laser_cannon', 'shield_upgrade'], pointCost: 65, description: 'Assault fighter', role: 'balanced' },
  ],
  corsair_saber: [
    { id: 'saber_duelist', name: 'Saber Duelist', shipId: 'corsair_saber', upgrades: ['predator', 'heavy_laser_cannon', 'stealth_device'], pointCost: 68, description: 'Duelist build', role: 'offense' },
    { id: 'saber_ace', name: 'Saber Ace', shipId: 'corsair_saber', upgrades: ['elusive', 'engine_upgrade'], pointCost: 58, description: 'Ace pilot', role: 'defense' },
  ],
  corsair_phantom: [
    { id: 'phantom_assassin', name: 'Phantom Assassin', shipId: 'corsair_phantom', upgrades: ['phantom_strike', 'stealth_device', 'targeting_computer'], pointCost: 62, description: 'Silent assassin', role: 'offense' },
    { id: 'phantom_infiltrator', name: 'Phantom Infiltrator', shipId: 'corsair_phantom', upgrades: ['expert_handling', 'pattern_analyzer'], pointCost: 55, description: 'Infiltrator', role: 'support' },
  ],
  corsair_shadow: [
    { id: 'shadow_assassin', name: 'Shadow Assassin', shipId: 'corsair_shadow', upgrades: ['phantom_strike', 'heavy_laser_cannon', 'stealth_device'], pointCost: 72, description: 'Heavy assassin', role: 'offense' },
    { id: 'shadow_ambush', name: 'Shadow Ambush', shipId: 'corsair_shadow', upgrades: ['ion_cannon', 'pattern_analyzer'], pointCost: 65, description: 'Ion ambusher', role: 'support' },
  ],
  corsair_pillager: [
    { id: 'pillager_fortress', name: 'Pillager Fortress', shipId: 'corsair_pillager', upgrades: ['twin_laser_turret', 'quad_laser_turret', 'heavy_laser_cannon', 'veteran_gunner'], pointCost: 98, description: 'Heavy gunship', role: 'offense' },
    { id: 'pillager_raider', name: 'Pillager Raider', shipId: 'corsair_pillager', upgrades: ['twin_laser_turret', 'ion_cannon', 'hull_upgrade'], pointCost: 88, description: 'Raider gunship', role: 'balanced' },
  ],
  corsair_ravager: [
    { id: 'ravager_assault', name: 'Ravager Assault', shipId: 'corsair_ravager', upgrades: ['twin_laser_turret', 'heavy_laser_cannon', 'heavy_laser_cannon', 'veteran_gunner'], pointCost: 92, description: 'Assault gunship', role: 'offense' },
    { id: 'ravager_ion', name: 'Ravager Ion', shipId: 'corsair_ravager', upgrades: ['ion_turret', 'ion_cannon', 'hull_upgrade'], pointCost: 82, description: 'Ion disruption', role: 'support' },
  ],
  corsair_bomber: [
    { id: 'bomber_raider', name: 'Bomber Raider', shipId: 'corsair_bomber', upgrades: ['proton_torpedo', 'proton_bomb', 'veteran_gunner'], pointCost: 68, description: 'Raider bomber', role: 'offense' },
    { id: 'bomber_minelayer', name: 'Bomber Minelayer', shipId: 'corsair_bomber', upgrades: ['cluster_mine', 'hull_upgrade'], pointCost: 58, description: 'Mine layer', role: 'support' },
  ],
  corsair_torpedo_boat: [
    { id: 'torpedo_strike', name: 'Torpedo Strike', shipId: 'corsair_torpedo_boat', upgrades: ['proton_torpedo', 'proton_torpedo'], pointCost: 55, description: 'Fast torpedo strike', role: 'offense' },
    { id: 'torpedo_hunter', name: 'Torpedo Hunter', shipId: 'corsair_torpedo_boat', upgrades: ['proton_torpedo', 'engine_upgrade'], pointCost: 50, description: 'Torpedo hunter', role: 'offense' },
  ],
  corsair_dreadnought: [
    { id: 'dreadnought_flagship', name: 'Dreadnought Flagship', shipId: 'corsair_dreadnought', upgrades: ['quad_laser_turret', 'twin_laser_turret', 'heavy_laser_cannon', 'veteran_gunner', 'tactical_officer'], pointCost: 148, description: 'Pirate flagship', role: 'offense' },
    { id: 'dreadnought_terror', name: 'Dreadnought Terror', shipId: 'corsair_dreadnought', upgrades: ['quad_laser_turret', 'heavy_laser_cannon', 'hull_upgrade'], pointCost: 140, description: 'Terror ship', role: 'offense' },
  ],
  corsair_galleon: [
    { id: 'galleon_raider', name: 'Galleon Raider', shipId: 'corsair_galleon', upgrades: ['twin_laser_turret', 'heavy_laser_cannon', 'veteran_gunner', 'tactical_officer'], pointCost: 118, description: 'Heavy raider', role: 'offense' },
    { id: 'galleon_cargo', name: 'Galleon Cargo', shipId: 'corsair_galleon', upgrades: ['ion_turret', 'shield_upgrade', 'hull_upgrade'], pointCost: 108, description: 'Cargo hauler', role: 'defense' },
  ],
  corsair_frigate: [
    { id: 'frigate_escort', name: 'Frigate Escort', shipId: 'corsair_frigate', upgrades: ['twin_laser_turret', 'heavy_laser_cannon', 'veteran_gunner'], pointCost: 95, description: 'Escort frigate', role: 'offense' },
    { id: 'frigate_patrol', name: 'Frigate Patrol', shipId: 'corsair_frigate', upgrades: ['ion_turret', 'shield_upgrade'], pointCost: 88, description: 'Patrol frigate', role: 'balanced' },
  ],
  corsair_tender: [
    { id: 'tender_support', name: 'Tender Support', shipId: 'corsair_tender', upgrades: ['weapons_engineer', 'tactical_officer', 'advanced_sensors'], pointCost: 70, description: 'Fleet support', role: 'support' },
    { id: 'tender_repair', name: 'Tender Repair', shipId: 'corsair_tender', upgrades: ['shield_upgrade', 'hull_upgrade'], pointCost: 65, description: 'Repair tender', role: 'defense' },
  ],

  // ==========================================
  // ASCENDANT EMPIRE LOADOUTS
  // ==========================================

  ascendant_seraph: [
    {
      id: 'seraph_champion',
      name: 'Seraph Champion',
      shipId: 'ascendant_seraph',
      upgrades: ['force_sensitive', 'precognition', 'advanced_sensors', 'stealth_device'],
      pointCost: 78,
      description: 'Force-enhanced elite with precognition',
      role: 'defense',
    },
    {
      id: 'seraph_warden',
      name: 'Seraph Warden',
      shipId: 'ascendant_seraph',
      upgrades: ['elusive', 'advanced_sensors', 'hull_upgrade'],
      pointCost: 68,
      description: 'Resilient warden with enhanced defenses',
      role: 'defense',
    },
  ],

  ascendant_templar: [
    {
      id: 'templar_crusader',
      name: 'Templar Crusader',
      shipId: 'ascendant_templar',
      upgrades: ['marksman', 'proton_torpedo', 'heavy_laser_cannon', 'fire_control_system'],
      pointCost: 82,
      description: 'Heavy assault templar with ordnance',
      role: 'offense',
    },
    {
      id: 'templar_guardian',
      name: 'Templar Guardian',
      shipId: 'ascendant_templar',
      upgrades: ['elusive', 'fire_control_system', 'hull_upgrade'],
      pointCost: 68,
      description: 'Durable guardian with enhanced survivability',
      role: 'defense',
    },
  ],

  ascendant_oracle: [
    {
      id: 'oracle_seer',
      name: 'Oracle Seer',
      shipId: 'ascendant_oracle',
      upgrades: ['coordinated_assault', 'squadron_leader', 'tactical_officer', 'advanced_sensors', 'targeting_computer'],
      pointCost: 88,
      description: 'Full coordination oracle with squad enhancement',
      role: 'support',
    },
    {
      id: 'oracle_shield',
      name: 'Oracle Shield',
      shipId: 'ascendant_oracle',
      upgrades: ['shield_upgrade', 'shield_upgrade', 'collision_detector'],
      pointCost: 72,
      description: 'Maximum durability support platform',
      role: 'defense',
    },
  ],

  ascendant_avatar: [
    {
      id: 'avatar_conquest',
      name: 'Avatar of Conquest',
      shipId: 'ascendant_avatar',
      upgrades: ['veteran_gunner', 'quad_laser_turret', 'heavy_laser_cannon', 'ion_cannon', 'ace_pilot_title'],
      pointCost: 115,
      description: 'Elite assault platform with full weapons',
      role: 'offense',
    },
    {
      id: 'avatar_bastion',
      name: 'Avatar Bastion',
      shipId: 'ascendant_avatar',
      upgrades: ['tactical_officer', 'ion_turret', 'shield_upgrade', 'hull_upgrade'],
      pointCost: 98,
      description: 'Durable command platform with support',
      role: 'balanced',
    },
  ],

  ascendant_cherub: [
    { id: 'cherub_ace', name: 'Cherub Ace', shipId: 'ascendant_cherub', upgrades: ['elusive', 'hull_upgrade'], pointCost: 32, description: 'Nimble ace with reinforced hull', role: 'defense' },
    { id: 'cherub_swarm', name: 'Cherub Swarm', shipId: 'ascendant_cherub', upgrades: [], pointCost: 25, description: 'Swarm interceptor', role: 'swarm' },
  ],
  ascendant_herald: [
    { id: 'herald_striker', name: 'Herald Striker', shipId: 'ascendant_herald', upgrades: ['predator', 'shield_upgrade'], pointCost: 48, description: 'Strike interceptor with shielding', role: 'offense' },
    { id: 'herald_scout', name: 'Herald Scout', shipId: 'ascendant_herald', upgrades: ['advanced_sensors', 'engine_upgrade'], pointCost: 42, description: 'Scout build', role: 'support' },
  ],
  ascendant_virtue: [
    { id: 'virtue_assault', name: 'Virtue Assault', shipId: 'ascendant_virtue', upgrades: ['predator', 'concussion_missile', 'stealth_device'], pointCost: 58, description: 'Assault interceptor', role: 'offense' },
    { id: 'virtue_pursuit', name: 'Virtue Pursuit', shipId: 'ascendant_virtue', upgrades: ['elusive', 'engine_upgrade'], pointCost: 50, description: 'Pursuit interceptor', role: 'defense' },
  ],
  ascendant_crusader: [
    { id: 'crusader_assault', name: 'Crusader Assault', shipId: 'ascendant_crusader', upgrades: ['marksman', 'heavy_laser_cannon', 'heavy_laser_cannon'], pointCost: 78, description: 'Heavy assault', role: 'offense' },
    { id: 'crusader_defender', name: 'Crusader Defender', shipId: 'ascendant_crusader', upgrades: ['heavy_laser_cannon', 'hull_upgrade'], pointCost: 68, description: 'Defender build', role: 'defense' },
  ],
  ascendant_paladin: [
    { id: 'paladin_champion', name: 'Paladin Champion', shipId: 'ascendant_paladin', upgrades: ['predator', 'heavy_laser_cannon', 'tactical_officer'], pointCost: 82, description: 'Champion build', role: 'offense' },
    { id: 'paladin_guardian', name: 'Paladin Guardian', shipId: 'ascendant_paladin', upgrades: ['elusive', 'shield_upgrade', 'hull_upgrade'], pointCost: 72, description: 'Guardian build', role: 'defense' },
  ],
  ascendant_inquisitor: [
    { id: 'inquisitor_hunter', name: 'Inquisitor Hunter', shipId: 'ascendant_inquisitor', upgrades: ['predator', 'heavy_laser_cannon', 'targeting_computer'], pointCost: 72, description: 'Hunter build', role: 'offense' },
    { id: 'inquisitor_interrogator', name: 'Inquisitor Interrogator', shipId: 'ascendant_inquisitor', upgrades: ['ion_cannon', 'pattern_analyzer'], pointCost: 65, description: 'Control build', role: 'support' },
  ],
  ascendant_prophet: [
    { id: 'prophet_seer', name: 'Prophet Seer', shipId: 'ascendant_prophet', upgrades: ['coordinated_assault', 'tactical_officer', 'weapons_engineer', 'advanced_sensors'], pointCost: 92, description: 'Fleet coordination', role: 'support' },
    { id: 'prophet_bastion', name: 'Prophet Bastion', shipId: 'ascendant_prophet', upgrades: ['shield_upgrade', 'hull_upgrade'], pointCost: 78, description: 'Defensive support', role: 'defense' },
  ],
  ascendant_acolyte: [
    { id: 'acolyte_support', name: 'Acolyte Support', shipId: 'ascendant_acolyte', upgrades: ['tactical_officer', 'advanced_sensors'], pointCost: 55, description: 'Basic support', role: 'support' },
    { id: 'acolyte_relay', name: 'Acolyte Relay', shipId: 'ascendant_acolyte', upgrades: ['targeting_computer'], pointCost: 48, description: 'Relay support', role: 'support' },
  ],
  ascendant_wrath: [
    { id: 'wrath_assault', name: 'Wrath Assault', shipId: 'ascendant_wrath', upgrades: ['twin_laser_turret', 'heavy_laser_cannon', 'heavy_laser_cannon', 'veteran_gunner'], pointCost: 92, description: 'Heavy assault', role: 'offense' },
    { id: 'wrath_ion', name: 'Wrath Ion', shipId: 'ascendant_wrath', upgrades: ['ion_turret', 'ion_cannon', 'hull_upgrade'], pointCost: 82, description: 'Ion disruption', role: 'support' },
  ],
  ascendant_judgment: [
    { id: 'judgment_fortress', name: 'Judgment Fortress', shipId: 'ascendant_judgment', upgrades: ['twin_laser_turret', 'quad_laser_turret', 'heavy_laser_cannon', 'veteran_gunner'], pointCost: 102, description: 'Heavy gunship', role: 'offense' },
    { id: 'judgment_defender', name: 'Judgment Defender', shipId: 'ascendant_judgment', upgrades: ['ion_turret', 'ion_turret', 'shield_upgrade'], pointCost: 92, description: 'Defensive gunship', role: 'defense' },
  ],
  ascendant_smiter: [
    { id: 'smiter_bomber', name: 'Smiter Bomber', shipId: 'ascendant_smiter', upgrades: ['proton_torpedo', 'proton_bomb', 'veteran_gunner'], pointCost: 72, description: 'Standard bomber', role: 'offense' },
    { id: 'smiter_strike', name: 'Smiter Strike', shipId: 'ascendant_smiter', upgrades: ['proton_torpedo', 'engine_upgrade'], pointCost: 62, description: 'Fast strike bomber', role: 'offense' },
  ],
  ascendant_purifier: [
    { id: 'purifier_siege', name: 'Purifier Siege', shipId: 'ascendant_purifier', upgrades: ['proton_torpedo', 'proton_torpedo', 'proton_bomb', 'veteran_gunner'], pointCost: 92, description: 'Heavy siege bomber', role: 'offense' },
    { id: 'purifier_assault', name: 'Purifier Assault', shipId: 'ascendant_purifier', upgrades: ['proton_torpedo', 'seismic_charge', 'hull_upgrade'], pointCost: 85, description: 'Assault bomber', role: 'balanced' },
  ],
  ascendant_divine: [
    { id: 'divine_flagship', name: 'Divine Flagship', shipId: 'ascendant_divine', upgrades: ['quad_laser_turret', 'twin_laser_turret', 'heavy_laser_cannon', 'veteran_gunner', 'tactical_officer'], pointCost: 155, description: 'Supreme flagship', role: 'offense' },
    { id: 'divine_command', name: 'Divine Command', shipId: 'ascendant_divine', upgrades: ['twin_laser_turret', 'coordinated_assault', 'tactical_officer', 'weapons_engineer'], pointCost: 148, description: 'Command vessel', role: 'support' },
  ],
  ascendant_glory: [
    { id: 'glory_assault', name: 'Glory Assault', shipId: 'ascendant_glory', upgrades: ['quad_laser_turret', 'twin_laser_turret', 'heavy_laser_cannon', 'veteran_gunner'], pointCost: 135, description: 'Assault capital', role: 'offense' },
    { id: 'glory_bastion', name: 'Glory Bastion', shipId: 'ascendant_glory', upgrades: ['twin_laser_turret', 'shield_upgrade', 'hull_upgrade'], pointCost: 125, description: 'Defensive capital', role: 'defense' },
  ],
  ascendant_sanctum: [
    { id: 'sanctum_command', name: 'Sanctum Command', shipId: 'ascendant_sanctum', upgrades: ['twin_laser_turret', 'coordinated_assault', 'tactical_officer', 'weapons_engineer', 'advanced_sensors'], pointCost: 128, description: 'Command capital', role: 'support' },
    { id: 'sanctum_support', name: 'Sanctum Support', shipId: 'ascendant_sanctum', upgrades: ['ion_turret', 'shield_upgrade', 'hull_upgrade'], pointCost: 118, description: 'Support capital', role: 'defense' },
  ],
  ascendant_bastion: [
    { id: 'bastion_fortress', name: 'Bastion Fortress', shipId: 'ascendant_bastion', upgrades: ['quad_laser_turret', 'twin_laser_turret', 'heavy_laser_cannon', 'veteran_gunner'], pointCost: 122, description: 'Fortress capital', role: 'offense' },
    { id: 'bastion_defender', name: 'Bastion Defender', shipId: 'ascendant_bastion', upgrades: ['ion_turret', 'ion_turret', 'shield_upgrade', 'hull_upgrade'], pointCost: 115, description: 'Defensive capital', role: 'defense' },
  ],
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get slot configuration for a ship
 */
export function getShipSlots(shipId: string): ShipSlotConfig | undefined {
  return SHIP_SLOTS[shipId];
}

/**
 * Get all loadouts for a ship
 */
export function getShipLoadouts(shipId: string): ShipLoadout[] {
  return SHIP_LOADOUTS[shipId] ?? [];
}

/**
 * Get a specific loadout by ID
 */
export function getLoadoutById(loadoutId: string): ShipLoadout | undefined {
  for (const loadouts of Object.values(SHIP_LOADOUTS)) {
    const found = loadouts.find(l => l.id === loadoutId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Get loadouts by role
 */
export function getLoadoutsByRole(role: ShipLoadout['role']): ShipLoadout[] {
  const result: ShipLoadout[] = [];
  for (const loadouts of Object.values(SHIP_LOADOUTS)) {
    result.push(...loadouts.filter(l => l.role === role));
  }
  return result;
}

/**
 * Get loadouts within a point budget
 */
export function getLoadoutsByBudget(maxPoints: number): ShipLoadout[] {
  const result: ShipLoadout[] = [];
  for (const loadouts of Object.values(SHIP_LOADOUTS)) {
    result.push(...loadouts.filter(l => l.pointCost <= maxPoints));
  }
  return result;
}

/**
 * Get recommended loadout for AI based on faction and role
 */
export function getAILoadout(
  shipId: string,
  preference: 'offense' | 'defense' | 'balanced' = 'balanced'
): ShipLoadout | undefined {
  const loadouts = SHIP_LOADOUTS[shipId];
  if (!loadouts || loadouts.length === 0) return undefined;

  // Try to find matching preference
  const preferred = loadouts.find(l => l.role === preference);
  if (preferred) return preferred;

  // Fall back to first loadout
  return loadouts[0];
}

/**
 * Calculate total squad cost for a list of loadouts
 */
export function calculateSquadCost(loadoutIds: string[]): number {
  return loadoutIds.reduce((total, id) => {
    const loadout = getLoadoutById(id);
    return total + (loadout?.pointCost ?? 0);
  }, 0);
}

/**
 * Build a random balanced squad within point limit
 */
export function buildRandomSquad(
  faction: string,
  pointLimit: number,
  preferredRole?: ShipLoadout['role']
): ShipLoadout[] {
  const squad: ShipLoadout[] = [];
  let remainingPoints = pointLimit;

  // Get all loadouts for this faction (by ship faction)
  const factionLoadouts: ShipLoadout[] = [];
  for (const [shipId, loadouts] of Object.entries(SHIP_LOADOUTS)) {
    // We'd need to check ship faction here - simplified for now
    factionLoadouts.push(...loadouts);
  }

  // Filter by budget
  const affordable = factionLoadouts.filter(l => l.pointCost <= remainingPoints);

  // Sort by preference
  const sorted = [...affordable].sort((a, b) => {
    if (preferredRole) {
      if (a.role === preferredRole && b.role !== preferredRole) return -1;
      if (b.role === preferredRole && a.role !== preferredRole) return 1;
    }
    return b.pointCost - a.pointCost; // Prefer higher cost (better equipped)
  });

  // Fill squad
  for (const loadout of sorted) {
    if (loadout.pointCost <= remainingPoints) {
      squad.push(loadout);
      remainingPoints -= loadout.pointCost;

      // Limit squad size
      if (squad.length >= 8) break;
    }
  }

  return squad;
}
