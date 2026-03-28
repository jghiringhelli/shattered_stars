/**
 * Squadron Presets
 *
 * Quick-build squads per faction and point budget, modeled after X-Wing 2.0
 * quick-play cards. Curated, internally consistent loadouts that let players
 * or AI field a competent squad without manual list-building.
 *
 * Validation rules (authoring-time):
 *   pilotId must be a valid PILOT_CARDS key piloting the same ship as loadoutId.
 *   totalCost = Σ(pilot.pointCost + loadout.pointCost) ≤ pointLimit.
 */

import type { FactionId } from '../config';
import { PILOT_CARDS } from '../systems/SquadBuilder';

/** Structurally compatible with SimShipSpec in BattleSimulator (no circular import). */
export interface SquadShipSpec {
  readonly shipId: string;
  readonly pilotId?: string;
  readonly loadoutId?: string;
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface QuickBuildShip {
  readonly pilotId: string;
  readonly loadoutId: string;
}

export interface QuickBuildSquad {
  readonly id: string;
  readonly factionId: FactionId;
  readonly pointLimit: number;
  readonly name: string;
  readonly style: 'aggressive' | 'balanced' | 'swarm' | 'control';
  readonly ships: ReadonlyArray<QuickBuildShip>;
  readonly totalCost: number;
}

// ─── Squad Data ───────────────────────────────────────────────────────────────

const SQUADS: ReadonlyArray<QuickBuildSquad> = [

  // ── TERRAN HEGEMONY ────────────────────────────────────────────────────────
  {
    id: 'th_100_iron_cadets', factionId: 'terran_hegemony', pointLimit: 100, totalCost: 100,
    name: 'Iron Cadets', style: 'swarm',
    ships: [
      { pilotId: 'stiletto_cadet', loadoutId: 'stiletto_basic' },    // 22+28=50
      { pilotId: 'stiletto_cadet', loadoutId: 'stiletto_basic' },    // 22+28=50
    ],
  },
  {
    id: 'th_150_patrol_alpha', factionId: 'terran_hegemony', pointLimit: 150, totalCost: 134,
    name: 'Patrol Alpha', style: 'balanced',
    ships: [
      { pilotId: 'stiletto_cadet', loadoutId: 'stiletto_basic' },    // 22+28=50
      { pilotId: 'viper_cadet', loadoutId: 'viper_pursuit' },        // 32+52=84
    ],
  },
  {
    id: 'th_200_iron_fist', factionId: 'terran_hegemony', pointLimit: 200, totalCost: 193,
    name: 'Iron Fist', style: 'balanced',
    ships: [
      { pilotId: 'iron_wolf', loadoutId: 'gladius_patrol' },         // 52+57=109
      { pilotId: 'viper_cadet', loadoutId: 'viper_pursuit' },        // 32+52=84
    ],
  },
  {
    id: 'th_300_battle_squadron', factionId: 'terran_hegemony', pointLimit: 300, totalCost: 300,
    name: 'Battle Squadron', style: 'balanced',
    ships: [
      { pilotId: 'viper_ace', loadoutId: 'viper_ace' },              // 40+58=98
      { pilotId: 'harbinger_crew', loadoutId: 'harbinger_coordinator' }, // 58+68=126
      { pilotId: 'viper_cadet', loadoutId: 'viper_pursuit' },        // 32+52=84
    ],
  },

  // ── FREE CONFEDERATION ─────────────────────────────────────────────────────
  {
    id: 'fc_100_scout_squadron', factionId: 'free_confederation', pointLimit: 100, totalCost: 94,
    name: 'Scout Squadron', style: 'swarm',
    ships: [
      { pilotId: 'wasp_rookie', loadoutId: 'wasp_swarm' },           // 20+25=45
      { pilotId: 'wasp_pilot', loadoutId: 'wasp_swarm' },            // 24+25=49
    ],
  },
  {
    id: 'fc_150_freedom_wing', factionId: 'free_confederation', pointLimit: 150, totalCost: 144,
    name: 'Freedom Wing', style: 'swarm',
    ships: [
      { pilotId: 'wasp_rookie', loadoutId: 'wasp_swarm' },           // 20+25=45
      { pilotId: 'wasp_pilot', loadoutId: 'wasp_swarm' },            // 24+25=49
      { pilotId: 'finch_pilot', loadoutId: 'finch_patrol' },         // 22+28=50
    ],
  },
  {
    id: 'fc_200_confederacy_strike', factionId: 'free_confederation', pointLimit: 200, totalCost: 189,
    name: 'Confederacy Strike', style: 'aggressive',
    ships: [
      { pilotId: 'falcon_pilot', loadoutId: 'falcon_striker' },      // 36+68=104
      { pilotId: 'kestrel_pilot', loadoutId: 'kestrel_striker' },    // 30+55=85
    ],
  },
  {
    id: 'fc_300_liberation_fleet', factionId: 'free_confederation', pointLimit: 300, totalCost: 290,
    name: 'Liberation Fleet', style: 'aggressive',
    ships: [
      { pilotId: 'hawk_rennick', loadoutId: 'hawk_assault' },        // 52+68=120
      { pilotId: 'falcon_veteran', loadoutId: 'falcon_striker' },    // 42+68=110
      { pilotId: 'sparrow_rookie', loadoutId: 'sparrow_swarm' },     // 22+38=60
    ],
  },

  // ── SYNTHETIC COLLECTIVE ───────────────────────────────────────────────────
  {
    id: 'sc_100_recon_cluster', factionId: 'synthetic_collective', pointLimit: 100, totalCost: 90,
    name: 'Recon Cluster', style: 'swarm',
    ships: [
      { pilotId: 'combat_drone_alpha', loadoutId: 'drone_standard' },  // 20+32=52
      { pilotId: 'scout_drone_alpha', loadoutId: 'scout_basic' },      // 16+22=38
    ],
  },
  {
    id: 'sc_150_hunter_pack', factionId: 'synthetic_collective', pointLimit: 150, totalCost: 146,
    name: 'Hunter Pack', style: 'aggressive',
    ships: [
      { pilotId: 'interceptor_drone_alpha', loadoutId: 'interceptor_swarm' }, // 24+28=52
      { pilotId: 'interceptor_drone_beta', loadoutId: 'interceptor_swarm' },  // 28+28=56
      { pilotId: 'scout_drone_alpha', loadoutId: 'scout_basic' },             // 16+22=38
    ],
  },
  {
    id: 'sc_200_precision_strike', factionId: 'synthetic_collective', pointLimit: 200, totalCost: 192,
    name: 'Precision Strike', style: 'balanced',
    ships: [
      { pilotId: 'pursuit_protocol', loadoutId: 'interceptor_hunter' }, // 38+38=76
      { pilotId: 'demolition_unit', loadoutId: 'bomber_basic' },         // 38+40=78
      { pilotId: 'scout_drone_alpha', loadoutId: 'scout_basic' },        // 16+22=38
    ],
  },
  {
    id: 'sc_300_hive_fleet', factionId: 'synthetic_collective', pointLimit: 300, totalCost: 296,
    name: 'Hive Fleet', style: 'balanced',
    ships: [
      { pilotId: 'pursuit_protocol', loadoutId: 'interceptor_hunter' }, // 38+38=76
      { pilotId: 'demolition_unit', loadoutId: 'bomber_basic' },         // 38+40=78
      { pilotId: 'interceptor_drone_alpha', loadoutId: 'interceptor_swarm' }, // 24+28=52
      { pilotId: 'relay_node_basic', loadoutId: 'relay_support' },      // 42+55=97 (improved from relay_basic 48 → relay_support 55 = +7pts moderate boost)
    ],
  },

  // ── VOID CORSAIRS ──────────────────────────────────────────────────────────
  {
    id: 'vc_100_fang_blade', factionId: 'void_corsairs', pointLimit: 100, totalCost: 90,
    name: 'Fang Blade', style: 'aggressive',
    ships: [
      { pilotId: 'poison_fang', loadoutId: 'fang_raider' },          // 48+42=90
    ],
  },
  {
    id: 'vc_150_corsair_raider', factionId: 'void_corsairs', pointLimit: 150, totalCost: 141,
    name: 'Corsair Raider', style: 'aggressive',
    ships: [
      { pilotId: 'fang_raider', loadoutId: 'fang_raider' },          // 30+42=72
      { pilotId: 'venom_pilot', loadoutId: 'venom_assassin' },       // 34+35=69
    ],
  },
  {
    id: 'vc_200_terror_squadron', factionId: 'void_corsairs', pointLimit: 200, totalCost: 192,
    name: 'Terror Squadron', style: 'aggressive',
    ships: [
      { pilotId: 'red_jenna', loadoutId: 'blade_raider' },           // 50+58=108
      { pilotId: 'talon_pilot', loadoutId: 'talon_striker' },        // 32+52=84
    ],
  },
  {
    id: 'vc_300_corsair_fleet', factionId: 'void_corsairs', pointLimit: 300, totalCost: 292,
    name: 'Corsair Fleet', style: 'balanced',
    ships: [
      { pilotId: 'tender_crew', loadoutId: 'tender_support' },       // 55+70=125
      { pilotId: 'red_jenna', loadoutId: 'blade_ace' },              // 50+55=105
      { pilotId: 'venom_pilot', loadoutId: 'venom_swarm' },          // 34+28=62
    ],
  },

  // ── ASCENDANT EMPIRE ───────────────────────────────────────────────────────
  {
    id: 'ae_100_holy_herald', factionId: 'ascendant_empire', pointLimit: 100, totalCost: 88,
    name: 'Holy Herald', style: 'aggressive',
    ships: [
      { pilotId: 'voice_of_glory', loadoutId: 'herald_striker' },    // 40+48=88
    ],
  },
  {
    id: 'ae_150_sacred_guard', factionId: 'ascendant_empire', pointLimit: 150, totalCost: 148,
    name: 'Sacred Guard', style: 'balanced',
    ships: [
      { pilotId: 'virtue_pilot', loadoutId: 'virtue_pursuit' },      // 36+50=86
      { pilotId: 'cherub_guardian', loadoutId: 'cherub_ace' },       // 30+32=62
    ],
  },
  {
    id: 'ae_200_crusader_host', factionId: 'ascendant_empire', pointLimit: 200, totalCost: 186,
    name: 'Crusader Host', style: 'aggressive',
    ships: [
      { pilotId: 'templar_knight', loadoutId: 'templar_guardian' },  // 42+68=110
      { pilotId: 'herald_pilot', loadoutId: 'herald_striker' },      // 28+48=76
    ],
  },
  {
    id: 'ae_300_holy_crusade', factionId: 'ascendant_empire', pointLimit: 300, totalCost: 299,
    name: 'Holy Crusade', style: 'control',
    ships: [
      { pilotId: 'crusader_pilot', loadoutId: 'crusader_defender' }, // 44+68=112
      { pilotId: 'acolyte_pilot', loadoutId: 'acolyte_support' },    // 38+55=93
      { pilotId: 'virtue_pilot', loadoutId: 'virtue_assault' },      // 36+58=94
    ],
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve the best quick-build squad for a faction and point budget.
 * Returns the squad with the highest pointLimit not exceeding budget, or
 * undefined if no preset exists for this faction below the given budget.
 */
export function getQuickBuild(faction: FactionId, budget: number): QuickBuildSquad | undefined {
  return SQUADS
    .filter(s => s.factionId === faction && s.pointLimit <= budget)
    .sort((a, b) => b.pointLimit - a.pointLimit)[0];
}

/**
 * Convert a quick-build squad to SquadShipSpec[] for BattleSimulator.
 * The return type is structurally compatible with SimShipSpec (structural typing).
 */
export function toSimSpecs(squad: QuickBuildSquad): SquadShipSpec[] {
  return squad.ships.map(ship => ({
    shipId: PILOT_CARDS[ship.pilotId]?.shipId ?? ship.pilotId,
    pilotId: ship.pilotId,
    loadoutId: ship.loadoutId,
  }));
}

/** Minimal ship config compatible with AIShipConfig (avoids circular import). */
export interface AIShipConfigLike {
  readonly shipId: string;
  readonly pilotId?: string;
  readonly loadoutId?: string;
}

/**
 * Convert a quick-build squad to AIShipConfig[] for AIShipFactory.createAISquad.
 */
export function toAIConfigs(squad: QuickBuildSquad): AIShipConfigLike[] {
  return squad.ships.map(ship => ({
    shipId: PILOT_CARDS[ship.pilotId]?.shipId ?? ship.pilotId,
    pilotId: ship.pilotId,
    loadoutId: ship.loadoutId,
  }));
}
