/**
 * Campaign Pilot Manager
 *
 * Pure TypeScript module managing pilot progression in the campaign:
 * XP tracking, pilot skill levels (1-6), ability unlocks,
 * and ship evolution choices. Inspired by Heroes of the Aturi Cluster.
 *
 * No Phaser dependency — fully unit-testable.
 */

import type { FactionId } from '../config';
import type { CampaignPilotState } from './CampaignSaveManager';
import type { CampaignPilot } from '../data/PilotData';
import type { EvolutionOption } from '../data/CampaignData';
import { CAMPAIGN_PILOTS } from '../data/PilotData';

// ============================================
// XP / Level Thresholds
// ============================================

/**
 * XP required to reach each level.
 * Index is the level (1-based). Index 0 is unused.
 * e.g. XP_THRESHOLDS[2] = 100 means level 2 requires 100 XP.
 */
export const XP_THRESHOLDS: readonly number[] = [0, 0, 100, 300, 650, 1150, 1900];

export const MAX_PILOT_SKILL = 6;

// ============================================
// Event Types
// ============================================

export interface LevelUpEvent {
  pilotId: string;
  newSkill: number;
  newAbilityId: string;
}

// ============================================
// Core Progression Functions
// ============================================

/**
 * Derive pilot skill level (1-6) from total XP.
 */
export function getPilotSkill(xp: number): number {
  for (let level = MAX_PILOT_SKILL; level >= 1; level--) {
    if (xp >= (XP_THRESHOLDS[level] ?? 0)) {
      return level;
    }
  }
  return 1;
}

/**
 * Returns the XP needed to reach the next level,
 * or null if already at max level.
 */
export function xpToNextLevel(xp: number): number | null {
  const currentSkill = getPilotSkill(xp);
  if (currentSkill >= MAX_PILOT_SKILL) return null;
  const nextThreshold = XP_THRESHOLDS[currentSkill + 1] ?? 0;
  return nextThreshold - xp;
}

/**
 * Maximum number of abilities a pilot can have equipped,
 * based on their pilot skill. Formula: ceil(skill / 2).
 */
export function getMaxEquippedAbilities(pilotSkill: number): number {
  return Math.ceil(pilotSkill / 2);
}

// ============================================
// Initialization
// ============================================

/**
 * Create initial pilot states for the given faction.
 * Called when starting a new campaign.
 */
export function initializePilots(factionId: FactionId): CampaignPilotState[] {
  const pilotDefs = CAMPAIGN_PILOTS[factionId] ?? [];
  return pilotDefs.map((def) => ({
    pilotId: def.id,
    currentShipId: def.defaultShipId,
    pilotSkill: 1,
    xp: 0,
    unlockedAbilityIds: [...def.startingAbilityIds],
    equippedAbilityIds: [...def.startingAbilityIds].slice(0, getMaxEquippedAbilities(1)),
    statBonuses: { hull: 0, shields: 0, attack: 0, agility: 0 },
    evolutionChoiceIds: [],
  }));
}

// ============================================
// XP Award
// ============================================

/**
 * Award XP to a single pilot, unlocking abilities on level-up.
 * Returns the updated pilot state, levels gained, and new ability IDs.
 */
export function awardXpToPilot(
  pilot: CampaignPilotState,
  pilotDef: CampaignPilot,
  xpAmount: number
): { updated: CampaignPilotState; levelsGained: number[]; newAbilities: string[] } {
  const oldSkill = pilot.pilotSkill;
  const newXp = pilot.xp + xpAmount;
  const newSkill = getPilotSkill(newXp);

  const levelsGained: number[] = [];
  const newAbilities: string[] = [];
  const newUnlockedIds = [...pilot.unlockedAbilityIds];

  // Check each newly gained level for ability unlocks
  for (let level = oldSkill + 1; level <= newSkill; level++) {
    levelsGained.push(level);
    const abilityId = pilotDef.levelAbilityMap[level];
    if (abilityId && !newUnlockedIds.includes(abilityId)) {
      newUnlockedIds.push(abilityId);
      newAbilities.push(abilityId);
    }
  }

  // Auto-equip newly unlocked abilities if slots are available
  const maxEquipped = getMaxEquippedAbilities(newSkill);
  const newEquippedIds = [...pilot.equippedAbilityIds];
  for (const abilityId of newAbilities) {
    if (newEquippedIds.length < maxEquipped && !newEquippedIds.includes(abilityId)) {
      newEquippedIds.push(abilityId);
    }
  }

  const updated: CampaignPilotState = {
    ...pilot,
    xp: newXp,
    pilotSkill: newSkill,
    unlockedAbilityIds: newUnlockedIds,
    equippedAbilityIds: newEquippedIds,
  };

  return { updated, levelsGained, newAbilities };
}

// ============================================
// XP Distribution
// ============================================

/**
 * Distribute mission XP across all pilots.
 * All pilots receive full mission XP.
 * The protagonist (role: 'protagonist') additionally receives bonus XP
 * for completing optional objectives.
 */
export function distributeMissionXp(
  pilots: CampaignPilotState[],
  pilotDefs: CampaignPilot[],
  missionXp: number,
  protagonistBonusXp: number = 0
): { updatedPilots: CampaignPilotState[]; levelUpEvents: LevelUpEvent[] } {
  const updatedPilots: CampaignPilotState[] = [];
  const levelUpEvents: LevelUpEvent[] = [];

  for (const pilot of pilots) {
    const def = pilotDefs.find((d) => d.id === pilot.pilotId);
    if (!def) {
      updatedPilots.push(pilot);
      continue;
    }

    const isProtagonist = def.role === 'protagonist';
    const totalXp = missionXp + (isProtagonist ? protagonistBonusXp : 0);

    const { updated, levelsGained, newAbilities } = awardXpToPilot(pilot, def, totalXp);
    updatedPilots.push(updated);

    for (let i = 0; i < levelsGained.length; i++) {
      const newLevel = levelsGained[i]!;
      const newAbility = newAbilities[i] ?? '';
      levelUpEvents.push({
        pilotId: pilot.pilotId,
        newSkill: newLevel,
        newAbilityId: newAbility,
      });
    }
  }

  return { updatedPilots, levelUpEvents };
}

// ============================================
// Evolution
// ============================================

/**
 * Apply an evolution choice to a pilot.
 * Updates ship ID if the option changes it, adds stat bonuses,
 * grants the specified ability, and records the choice.
 */
export function applyEvolution(
  pilot: CampaignPilotState,
  option: EvolutionOption
): CampaignPilotState {
  const newShipId = option.keepCurrentShip ? pilot.currentShipId : (option.newShipId ?? pilot.currentShipId);

  const newStatBonuses = {
    hull: pilot.statBonuses.hull + (option.statBonuses.hull ?? 0),
    shields: pilot.statBonuses.shields + (option.statBonuses.shields ?? 0),
    attack: pilot.statBonuses.attack + (option.statBonuses.attack ?? 0),
    agility: pilot.statBonuses.agility + (option.statBonuses.agility ?? 0),
  };

  const newUnlockedIds = [...pilot.unlockedAbilityIds];
  if (option.grantAbilityId && !newUnlockedIds.includes(option.grantAbilityId)) {
    newUnlockedIds.push(option.grantAbilityId);
  }

  const maxEquipped = getMaxEquippedAbilities(pilot.pilotSkill);
  const newEquippedIds = [...pilot.equippedAbilityIds];
  if (
    option.grantAbilityId &&
    newEquippedIds.length < maxEquipped &&
    !newEquippedIds.includes(option.grantAbilityId)
  ) {
    newEquippedIds.push(option.grantAbilityId);
  }

  return {
    ...pilot,
    currentShipId: newShipId,
    statBonuses: newStatBonuses,
    unlockedAbilityIds: newUnlockedIds,
    equippedAbilityIds: newEquippedIds,
    evolutionChoiceIds: [...pilot.evolutionChoiceIds, option.id],
  };
}

// ============================================
// Lookup Helpers
// ============================================

/**
 * Get a pilot definition by faction and pilot ID.
 */
export function getPilotDefinition(
  factionId: FactionId,
  pilotId: string
): CampaignPilot | undefined {
  return (CAMPAIGN_PILOTS[factionId] ?? []).find((p) => p.id === pilotId);
}

/**
 * Get the protagonist pilot for a faction.
 */
export function getProtagonist(factionId: FactionId): CampaignPilot | undefined {
  return (CAMPAIGN_PILOTS[factionId] ?? []).find((p) => p.role === 'protagonist');
}

/**
 * Compute the effective stat bonuses for a pilot
 * (the accumulated hull/shield/attack/agility bonuses from evolution choices).
 */
export function getPilotEffectiveStats(
  pilot: CampaignPilotState
): { hull: number; shields: number; attack: number; agility: number } {
  return { ...pilot.statBonuses };
}
