/**
 * Ship Encyclopedia
 *
 * Provides normalized display stats, lore text, and SD art prompt hints
 * for all 100 ships. Stats are computed algorithmically from ShipDefinition data.
 * Lore is generated from faction + role template tables — no per-ship hand-authoring.
 */

import { SHIP_DEFINITIONS } from './ShipDefinitions';
import type { ShipDefinition } from '../core/types';
import type { FactionId } from '../config';

export interface EncyclopediaStats {
  readonly speed: number;
  readonly maneuverability: number;
  readonly attack: number;
  readonly defense: number;
  readonly payload: number;
  /** Scale ceiling: 5 for regular ships, 10 for large/huge capitals. */
  readonly maxStat: 5 | 10;
}

export interface EncyclopediaEntry {
  readonly shipId: string;
  readonly lore: string;
  readonly stats: EncyclopediaStats;
  /** Texture key for cinematic art: ship_art_{shipId} */
  readonly artKey: string;
  /** Short SD prompt hint used by scripts/generate_ship_art.py */
  readonly artPromptHint: string;
}

// ============================================
// Template tables
// ============================================

const FACTION_INTRO: Record<FactionId, string> = {
  terran_hegemony: 'Fielded by the iron-disciplined Terran Hegemony,',
  free_confederation: 'Cobbled together by the tenacious Free Confederation,',
  synthetic_collective: "Manufactured by the Synthetic Collective's networked intelligence,",
  void_corsairs: 'Favored by the ruthless raiders of the Void Corsairs,',
  ascendant_empire: 'Blessed by the zealous artisans of the Ascendant Empire,',
};

const ROLE_FLAVOR: Record<string, string> = {
  light_fighter: 'it is the most expendable unit on the front line, valued for numbers over endurance',
  heavy_fighter:
    'it forms the backbone of the fleet, balancing firepower and staying power in prolonged engagements',
  interceptor:
    'it is built for raw speed, designed to run down fleeing enemies and shatter formations before they consolidate',
  bomber: 'it trades agility for devastating ordnance capacity, threading past screens to hit high-value targets',
  support: 'it keeps allied ships fighting longer through coordination, jamming, and rapid logistics',
  gunship: 'it brings overwhelming firepower and resilient armor to sustained line engagements',
  capital:
    'it anchors entire battle fleets — its massive frame housing weapons, shields, and crew enough to prosecute a war alone',
};

const SPEED_ADJ = ['motionless', 'glacially slow', 'deliberate', 'steady', 'swift', 'blazing fast'];
const DEFENSE_ADJ = [
  'paper-thin',
  'lightly armored',
  'moderately armored',
  'well-armored',
  'heavily armored',
  'fortress-hulled',
];

const ROLE_CONTEXT: Record<string, string> = {
  light_fighter: 'swarming attacks and swift attrition',
  heavy_fighter: 'head-on brawls and sustained fire exchange',
  interceptor: 'pursuit, harassment, and breaking enemy cohesion',
  bomber: 'delivering decisive payload strikes against hardened targets',
  support: 'keeping allied ships in peak fighting condition',
  gunship: 'anchoring battle lines and grinding down opposition',
  capital: 'projecting strategic power across an entire engagement zone',
};

/** Hangar/combat atmosphere used as the SD base prompt for each faction. */
export const FACTION_ART_CTX: Record<FactionId, string> = {
  terran_hegemony:
    'military space hangar, gray reinforced steel walls, uniformed ground crew, harsh overhead lighting, sci-fi military doctrine',
  free_confederation:
    'rebel base hangar carved into an asteroid, diverse crew in patchwork gear, warm amber lighting, improvised technology',
  synthetic_collective:
    'deep space formation, maintenance drones swarming the hull, blue neon geometric structures, no organic crew visible',
  void_corsairs:
    'ramshackle pirate dock, salvaged bulkheads, rogues and brigands, dim sickly-green lighting, skull insignia',
  ascendant_empire:
    'sacred temple hangar, golden columns, incense haze glowing green, robed acolytes, divine geometry etched on the floor',
};

const ROLE_COMBAT_CTX: Record<string, string> = {
  light_fighter: 'fast attack run through asteroid debris field',
  heavy_fighter: 'aggressive combat formation, laser cannons firing',
  interceptor: 'high-speed intercept maneuver, afterburner plasma trails',
  bomber: 'ordnance bay open, missile contrails streaking behind',
  support: 'broadcasting coordination signals, escort formation',
  gunship: 'broadside engagement, multiple turrets firing simultaneously',
  capital: 'epic scale in deep space, tiny escort fighters visible alongside',
};

// ============================================
// Stat computation
// ============================================

/**
 * Compute normalized display stats from a raw ShipDefinition.
 *
 * Regular ships (tiny/small/medium): 1–5 scale.
 * Capitals (large/huge): 1–10 scale (raw values multiplied by 2).
 *
 * @param def - The ship definition to compute stats for.
 * @returns Normalized EncyclopediaStats.
 */
export function computeEncyclopediaStats(def: ShipDefinition): EncyclopediaStats {
  const s = def.baseStats;
  const isCapital = s.size === 'large' || s.size === 'huge';
  const scale: 5 | 10 = isCapital ? 10 : 5;
  const mult = isCapital ? 2 : 1;

  const hasBoost = s.actions.includes('boost');
  const hasBarrel = s.actions.includes('barrel_roll');
  const hasCloak = s.actions.includes('cloak');
  const hasReload = s.actions.includes('reload');

  const rawManu = s.agility + (hasBoost ? 1 : 0) + (hasBarrel ? 0.5 : 0) + (hasCloak ? 0.5 : 0);
  const rawDefense = s.hull / 3 + s.shields / 4 + s.agility * 0.3;
  const rawPayload = hasReload ? Math.min(5, s.attack + 1) : s.attack > 3 ? 2 : 1;
  const sat = (v: number): number => Math.max(1, Math.min(scale, Math.round(v * mult)));

  return {
    speed: sat(s.speed.max),
    maneuverability: sat(rawManu),
    attack: sat(s.attack),
    defense: sat(rawDefense),
    payload: sat(rawPayload),
    maxStat: scale,
  };
}

// ============================================
// Lore generation
// ============================================

/**
 * Generate a 2-sentence lore paragraph from faction + role templates.
 * @param def - The ship definition.
 * @returns Human-readable lore string.
 */
export function generateLore(def: ShipDefinition): string {
  const stats = computeEncyclopediaStats(def);
  const speedIdx = Math.min(5, def.baseStats.speed.max);
  const defIdx = Math.min(5, stats.defense);
  const intro = FACTION_INTRO[def.faction];
  const flavor = ROLE_FLAVOR[def.role] ?? 'it fills a specialized role in fleet operations';
  const speedAdj = SPEED_ADJ[speedIdx] ?? 'capable';
  const defAdj = DEFENSE_ADJ[defIdx] ?? 'averagely protected';
  const ctx = ROLE_CONTEXT[def.role] ?? 'general combat duties';
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  return `${intro} the ${def.name} ${flavor}. ${cap(speedAdj)} and ${defAdj}, it excels at ${ctx}.`;
}

// ============================================
// Entry cache
// ============================================

/** Module-level read-only cache for computed entries (static data, no side effects). */
let cache: EncyclopediaEntry[] | null = null;
const byId = new Map<string, EncyclopediaEntry>();

/**
 * Return all encyclopedia entries for all ships, built once and cached.
 * @returns Readonly array of all entries.
 */
export function getAllEncyclopediaEntries(): readonly EncyclopediaEntry[] {
  if (cache) return cache;
  cache = Object.values(SHIP_DEFINITIONS).map((def) => {
    const entry: EncyclopediaEntry = {
      shipId: def.id,
      lore: generateLore(def),
      stats: computeEncyclopediaStats(def),
      artKey: `ship_art_${def.id}`,
      artPromptHint: `${def.name} spacecraft, ${FACTION_ART_CTX[def.faction]}, ${ROLE_COMBAT_CTX[def.role] ?? 'dramatic space scene'}`,
    };
    byId.set(def.id, entry);
    return entry;
  });
  return cache;
}

/**
 * Return the encyclopedia entry for a single ship by ID.
 * Falls back to a placeholder entry if the ship ID is not found.
 * @param shipId - The ship definition ID (e.g. 'terran_viper').
 * @returns The EncyclopediaEntry for this ship.
 */
export function getEncyclopediaEntry(shipId: string): EncyclopediaEntry {
  if (byId.size === 0) getAllEncyclopediaEntries();
  return (
    byId.get(shipId) ?? {
      shipId,
      lore: 'Unknown vessel. No records found in the archive.',
      stats: { speed: 1, maneuverability: 1, attack: 1, defense: 1, payload: 1, maxStat: 5 },
      artKey: `ship_art_${shipId}`,
      artPromptHint: 'unknown spacecraft, deep space',
    }
  );
}
