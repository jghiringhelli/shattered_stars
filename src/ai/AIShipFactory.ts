/**
 * AI Ship Factory
 *
 * Creates AI-controlled ships with proper loadouts and configurations.
 * Integrates with the ShipLoadouts system to spawn enemies with
 * appropriate equipment based on difficulty and battle context.
 */

import type { ShipState } from '../core/types';
import type { FactionId } from '../config';
import type { AIDifficultyLevel } from './AIDifficulty';
import { SHIP_DEFINITIONS, getShipsByFaction } from '../data/ShipDefinitions';
import { SHIP_LOADOUTS, getAILoadout, getShipSlots, type ShipLoadout } from '../data/ShipLoadouts';
import { UPGRADE_DEFINITIONS, type UpgradeDefinition } from '../systems/UpgradeSystem';
import { PILOT_CARDS, type PilotCard, getPilotsForShip } from '../systems/SquadBuilder';

// ============================================
// AI Ship Configuration
// ============================================

export interface AIShipConfig {
  readonly shipId: string;
  readonly pilotId?: string;
  readonly loadoutId?: string;
  readonly preferredRole?: 'offense' | 'defense' | 'balanced';
  readonly position?: { x: number; y: number };
  readonly angle?: number;
}

export interface AISquadConfig {
  readonly faction: FactionId;
  readonly difficulty: AIDifficultyLevel;
  readonly pointBudget: number;
  readonly preferredRole?: 'offense' | 'defense' | 'balanced' | 'swarm';
  readonly shipConfigs?: readonly AIShipConfig[];
}

// ============================================
// Ship Creation
// ============================================

let nextShipId = 1000; // Start AI ships at 1000 to avoid player ID conflicts

/**
 * Reset the ship ID counter — call at the start of each new battle to prevent ID drift
 */
export function resetShipIdCounter(startFrom: number = 1000): void {
  nextShipId = startFrom;
}

/**
 * Create a single AI ship with loadout
 */
export function createAIShip(
  config: AIShipConfig,
  faction: FactionId,
  difficulty: AIDifficultyLevel
): ShipState | null {
  const shipDef = SHIP_DEFINITIONS[config.shipId];
  if (!shipDef) return null;

  // Get pilot (or default generic)
  const pilot = config.pilotId
    ? PILOT_CARDS[config.pilotId]
    : getDefaultPilot(config.shipId, faction);

  // Get loadout
  const loadout = config.loadoutId
    ? getLoadoutById(config.loadoutId)
    : getAILoadout(config.shipId, config.preferredRole ?? 'balanced');

  // Get upgrades from loadout
  const upgrades = loadout
    ? loadout.upgrades.map(id => UPGRADE_DEFINITIONS[id]).filter((u): u is UpgradeDefinition => u !== undefined)
    : [];

  // Calculate stat bonuses from upgrades
  const bonuses = calculateUpgradeBonuses(upgrades);

  const shipState: ShipState = {
    id: `ai_ship_${nextShipId++}`,
    definitionId: config.shipId,
    faction,
    owner: 'ai',
    x: config.position?.x ?? 400,
    y: config.position?.y ?? 300,
    angle: config.angle ?? 0,
    hull: shipDef.baseStats.hull + bonuses.hull,
    maxHull: shipDef.baseStats.hull + bonuses.hull,
    shields: shipDef.baseStats.shields + bonuses.shields,
    maxShields: shipDef.baseStats.shields + bonuses.shields,
    isStressed: false,
    hasFocus: false,
    hasEvade: false,
    hasTargetLock: null,
    isCloaked: false,
    currentManeuver: null,
    maneuverProgress: 0,
    mobileArcDirection: 'front',
    charges: getShipSlots(config.shipId)?.charges ?? pilot?.charges ?? 0,
    maxCharges: getShipSlots(config.shipId)?.charges ?? pilot?.charges ?? 0,
  };

  return shipState;
}

/**
 * Create a squad of AI ships within point budget
 */
export function createAISquad(config: AISquadConfig): ShipState[] {
  const ships: ShipState[] = [];

  if (config.shipConfigs && config.shipConfigs.length > 0) {
    // Use provided ship configs
    for (const shipConfig of config.shipConfigs) {
      const ship = createAIShip(shipConfig, config.faction, config.difficulty);
      if (ship) ships.push(ship);
    }
  } else {
    // Auto-generate squad based on budget
    const generatedConfigs = generateSquadConfigs(
      config.faction,
      config.pointBudget,
      config.preferredRole ?? 'balanced'
    );
    for (const shipConfig of generatedConfigs) {
      const ship = createAIShip(shipConfig, config.faction, config.difficulty);
      if (ship) ships.push(ship);
    }
  }

  return ships;
}

// ============================================
// Squad Generation
// ============================================

interface ShipWithLoadout {
  shipId: string;
  loadout: ShipLoadout | undefined;
  pilotId: string | undefined;
  cost: number;
}

/**
 * Generate ship configurations for a squad within budget
 */
function generateSquadConfigs(
  faction: FactionId,
  pointBudget: number,
  preferredRole: 'offense' | 'defense' | 'balanced' | 'swarm'
): AIShipConfig[] {
  const factionShips = getShipsByFaction(faction);
  if (factionShips.length === 0) return [];

  const configs: AIShipConfig[] = [];
  let remainingPoints = pointBudget;

  // Build list of options sorted by role preference
  const options: ShipWithLoadout[] = [];

  for (const ship of factionShips) {
    const loadouts = SHIP_LOADOUTS[ship.id] ?? [];
    const pilots = getPilotsForShip(ship.id);

    if (loadouts.length > 0) {
      for (const loadout of loadouts) {
        for (const pilot of pilots) {
          options.push({
            shipId: ship.id,
            loadout,
            pilotId: pilot.id,
            cost: loadout.pointCost + pilot.pointCost,
          });
        }
      }
    } else {
      // Ship has no loadouts, use base cost
      for (const pilot of pilots) {
        options.push({
          shipId: ship.id,
          loadout: undefined,
          pilotId: pilot.id,
          cost: ship.baseStats.pointCost + pilot.pointCost,
        });
      }
    }
  }

  // Sort by role preference
  const sortedOptions = [...options].sort((a, b) => {
    const roleA = a.loadout?.role ?? 'balanced';
    const roleB = b.loadout?.role ?? 'balanced';

    // Prefer matching role
    if (roleA === preferredRole && roleB !== preferredRole) return -1;
    if (roleB === preferredRole && roleA !== preferredRole) return 1;

    // For swarm, prefer cheaper ships
    if (preferredRole === 'swarm') {
      return a.cost - b.cost;
    }

    // Otherwise prefer more expensive (better equipped)
    return b.cost - a.cost;
  });

  // Fill squad
  let position = 0;
  while (remainingPoints > 0 && configs.length < 8) {
    // Find affordable option
    const affordable = sortedOptions.filter(o => o.cost <= remainingPoints);
    if (affordable.length === 0) break;

    // Pick one (with some randomness for variety)
    const pickIndex = Math.floor(Math.random() * Math.min(3, affordable.length));
    const picked = affordable[pickIndex]!;

    // Calculate position in formation
    const formationPos = getFormationPosition(configs.length, faction);

    const newConfig: AIShipConfig = {
      shipId: picked.shipId,
      position: formationPos,
      angle: 180, // Facing left (toward player starting position)
    };
    // Only add optional properties if they have values
    if (picked.pilotId !== undefined) {
      (newConfig as { pilotId: string }).pilotId = picked.pilotId;
    }
    if (picked.loadout?.id !== undefined) {
      (newConfig as { loadoutId: string }).loadoutId = picked.loadout.id;
    }
    configs.push(newConfig);

    remainingPoints -= picked.cost;
    position++;
  }

  return configs;
}

/**
 * Get formation position for a ship in the squad
 */
function getFormationPosition(index: number, _faction: FactionId): { x: number; y: number } {
  // Standard formation: two columns
  const baseX = 700;
  const baseY = 200;
  const spacingX = 80;
  const spacingY = 100;

  const column = index % 2;
  const row = Math.floor(index / 2);

  return {
    x: baseX + column * spacingX,
    y: baseY + row * spacingY,
  };
}

// ============================================
// Helper Functions
// ============================================

function getDefaultPilot(shipId: string, faction: FactionId): PilotCard | undefined {
  const pilots = getPilotsForShip(shipId);
  // Find lowest initiative (generic) pilot
  const sorted = [...pilots].sort((a, b) => a.initiative - b.initiative);
  return sorted[0];
}

function getLoadoutById(loadoutId: string): ShipLoadout | undefined {
  for (const loadouts of Object.values(SHIP_LOADOUTS)) {
    const found = loadouts.find(l => l.id === loadoutId);
    if (found) return found;
  }
  return undefined;
}

interface UpgradeBonuses {
  hull: number;
  shields: number;
  attack: number;
  agility: number;
}

function calculateUpgradeBonuses(upgrades: UpgradeDefinition[]): UpgradeBonuses {
  return upgrades.reduce(
    (acc, upgrade) => ({
      hull: acc.hull + (upgrade.effects?.hullBonus ?? 0),
      shields: acc.shields + (upgrade.effects?.shieldBonus ?? 0),
      attack: acc.attack + (upgrade.effects?.attackBonus ?? 0),
      agility: acc.agility + (upgrade.effects?.agilityBonus ?? 0),
    }),
    { hull: 0, shields: 0, attack: 0, agility: 0 }
  );
}

// ============================================
// Mission-Specific Spawning
// ============================================

export interface MissionEnemyWave {
  readonly waveNumber: number;
  readonly delay: number; // ms before spawning this wave
  readonly ships: readonly AIShipConfig[];
}

/**
 * Create enemy waves for a mission
 */
export function createMissionWaves(
  faction: FactionId,
  difficulty: AIDifficultyLevel,
  missionDifficulty: number // 1-10
): MissionEnemyWave[] {
  const waves: MissionEnemyWave[] = [];

  // Scale point budget based on mission difficulty
  const basePoints = 80 + missionDifficulty * 30;
  const numWaves = Math.min(4, 1 + Math.floor(missionDifficulty / 3));

  for (let wave = 0; wave < numWaves; wave++) {
    const wavePoints = Math.floor(basePoints * (1 + wave * 0.3));
    const configs = generateSquadConfigs(faction, wavePoints, wave === 0 ? 'balanced' : 'offense');

    // Adjust positions for wave
    const adjustedConfigs = configs.map((config, index) => ({
      ...config,
      position: {
        x: 850 + Math.random() * 100,
        y: 100 + index * 120 + Math.random() * 40,
      },
    }));

    waves.push({
      waveNumber: wave + 1,
      delay: wave * 30000, // 30 seconds between waves
      ships: adjustedConfigs,
    });
  }

  return waves;
}

/**
 * Spawn a wave of enemies
 */
export function spawnWave(
  wave: MissionEnemyWave,
  faction: FactionId,
  difficulty: AIDifficultyLevel
): ShipState[] {
  const ships: ShipState[] = [];

  for (const config of wave.ships) {
    const ship = createAIShip(config, faction, difficulty);
    if (ship) ships.push(ship);
  }

  return ships;
}
