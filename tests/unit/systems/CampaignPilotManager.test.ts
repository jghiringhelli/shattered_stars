/**
 * Tests for CampaignPilotManager
 */

import { describe, it, expect } from 'vitest';
import {
  XP_THRESHOLDS,
  MAX_PILOT_SKILL,
  getPilotSkill,
  xpToNextLevel,
  getMaxEquippedAbilities,
  initializePilots,
  awardXpToPilot,
  distributeMissionXp,
  applyEvolution,
  getPilotDefinition,
  getProtagonist,
  getPilotEffectiveStats,
} from '../../../src/systems/CampaignPilotManager';
import type { CampaignPilotState } from '../../../src/systems/CampaignSaveManager';
import { CAMPAIGN_PILOTS } from '../../../src/data/PilotData';
import type { EvolutionOption } from '../../../src/data/CampaignData';
import type { FactionId } from '../../../src/config';

// ============================================
// XP_THRESHOLDS / getPilotSkill
// ============================================

describe('XP_THRESHOLDS', () => {
  it('should have 7 entries (index 0-6)', () => {
    expect(XP_THRESHOLDS.length).toBe(7);
  });

  it('levels 1-6 should be non-negative', () => {
    for (let i = 1; i <= MAX_PILOT_SKILL; i++) {
      expect(XP_THRESHOLDS[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it('thresholds should be in ascending order', () => {
    for (let i = 2; i <= MAX_PILOT_SKILL; i++) {
      expect(XP_THRESHOLDS[i]!).toBeGreaterThan(XP_THRESHOLDS[i - 1]!);
    }
  });
});

describe('getPilotSkill', () => {
  it('should return 1 for 0 XP', () => {
    expect(getPilotSkill(0)).toBe(1);
  });

  it('should return 1 for XP below level 2 threshold', () => {
    expect(getPilotSkill(99)).toBe(1);
  });

  it('should return 2 at the exact level 2 threshold', () => {
    expect(getPilotSkill(XP_THRESHOLDS[2]!)).toBe(2);
  });

  it('should return 3 at the exact level 3 threshold', () => {
    expect(getPilotSkill(XP_THRESHOLDS[3]!)).toBe(3);
  });

  it('should return 4 at the exact level 4 threshold', () => {
    expect(getPilotSkill(XP_THRESHOLDS[4]!)).toBe(4);
  });

  it('should return 5 at the exact level 5 threshold', () => {
    expect(getPilotSkill(XP_THRESHOLDS[5]!)).toBe(5);
  });

  it('should return 6 at the exact level 6 threshold', () => {
    expect(getPilotSkill(XP_THRESHOLDS[6]!)).toBe(6);
  });

  it('should return 6 for very high XP', () => {
    expect(getPilotSkill(99999)).toBe(6);
  });

  it('should return 6 for XP just over the level 6 threshold', () => {
    expect(getPilotSkill(XP_THRESHOLDS[6]! + 1)).toBe(6);
  });

  it('should return 1 for negative XP (edge case)', () => {
    expect(getPilotSkill(-100)).toBe(1);
  });
});

// ============================================
// xpToNextLevel
// ============================================

describe('xpToNextLevel', () => {
  it('should return positive number at level 1', () => {
    const needed = xpToNextLevel(0);
    expect(needed).not.toBeNull();
    expect(needed!).toBeGreaterThan(0);
  });

  it('should return XP_THRESHOLDS[2] for 0 XP', () => {
    expect(xpToNextLevel(0)).toBe(XP_THRESHOLDS[2]);
  });

  it('should decrease as XP increases within a level', () => {
    const at0 = xpToNextLevel(0)!;
    const at50 = xpToNextLevel(50)!;
    expect(at50).toBeLessThan(at0);
  });

  it('should return 0 at exactly the next level threshold', () => {
    // At exactly level 2 threshold, we are now level 2 so xpToNextLevel gives to level 3
    const xpAtLevel2 = XP_THRESHOLDS[2]!;
    const result = xpToNextLevel(xpAtLevel2);
    expect(result).toBe(XP_THRESHOLDS[3]! - xpAtLevel2);
  });

  it('should return null at max level (level 6)', () => {
    const result = xpToNextLevel(XP_THRESHOLDS[6]!);
    expect(result).toBeNull();
  });

  it('should return null for XP well beyond level 6', () => {
    expect(xpToNextLevel(99999)).toBeNull();
  });
});

// ============================================
// getMaxEquippedAbilities
// ============================================

describe('getMaxEquippedAbilities', () => {
  it('skill 1 → 1 ability', () => {
    expect(getMaxEquippedAbilities(1)).toBe(1);
  });

  it('skill 2 → 1 ability', () => {
    expect(getMaxEquippedAbilities(2)).toBe(1);
  });

  it('skill 3 → 2 abilities', () => {
    expect(getMaxEquippedAbilities(3)).toBe(2);
  });

  it('skill 4 → 2 abilities', () => {
    expect(getMaxEquippedAbilities(4)).toBe(2);
  });

  it('skill 5 → 3 abilities', () => {
    expect(getMaxEquippedAbilities(5)).toBe(3);
  });

  it('skill 6 → 3 abilities', () => {
    expect(getMaxEquippedAbilities(6)).toBe(3);
  });
});

// ============================================
// initializePilots
// ============================================

describe('initializePilots', () => {
  it('should return 3 pilots for terran_hegemony', () => {
    const pilots = initializePilots('terran_hegemony');
    expect(pilots.length).toBe(3);
  });

  it('all pilots should start at skill 1', () => {
    const pilots = initializePilots('terran_hegemony');
    for (const pilot of pilots) {
      expect(pilot.pilotSkill).toBe(1);
    }
  });

  it('all pilots should start at 0 XP', () => {
    const pilots = initializePilots('terran_hegemony');
    for (const pilot of pilots) {
      expect(pilot.xp).toBe(0);
    }
  });

  it('protagonist should have correct default ship', () => {
    const pilots = initializePilots('terran_hegemony');
    const chen = pilots.find((p) => p.pilotId === 'admiral_chen');
    expect(chen).toBeDefined();
    expect(chen!.currentShipId).toBe('terran_raptor');
  });

  it('striker should have correct default ship', () => {
    const pilots = initializePilots('terran_hegemony');
    const striker = pilots.find((p) => p.pilotId === 'striker');
    expect(striker).toBeDefined();
    expect(striker!.currentShipId).toBe('terran_viper');
  });

  it('whisper should have correct default ship', () => {
    const pilots = initializePilots('terran_hegemony');
    const whisper = pilots.find((p) => p.pilotId === 'whisper');
    expect(whisper).toBeDefined();
    expect(whisper!.currentShipId).toBe('terran_gladius');
  });

  it('all pilots should have starting abilities unlocked', () => {
    const pilots = initializePilots('terran_hegemony');
    const defs = CAMPAIGN_PILOTS['terran_hegemony']!;
    for (const pilot of pilots) {
      const def = defs.find((d) => d.id === pilot.pilotId)!;
      for (const abilityId of def.startingAbilityIds) {
        expect(pilot.unlockedAbilityIds).toContain(abilityId);
      }
    }
  });

  it('should return 3 pilots for all factions', () => {
    const factions: FactionId[] = ['free_confederation', 'synthetic_collective', 'void_corsairs', 'ascendant_empire'];
    for (const faction of factions) {
      const pilots = initializePilots(faction);
      expect(pilots).toHaveLength(3);
    }
  });

  it('stat bonuses should all start at 0', () => {
    const pilots = initializePilots('terran_hegemony');
    for (const pilot of pilots) {
      expect(pilot.statBonuses.hull).toBe(0);
      expect(pilot.statBonuses.shields).toBe(0);
      expect(pilot.statBonuses.attack).toBe(0);
      expect(pilot.statBonuses.agility).toBe(0);
    }
  });
});

// ============================================
// awardXpToPilot
// ============================================

describe('awardXpToPilot', () => {
  const defs = CAMPAIGN_PILOTS['terran_hegemony']!;
  const chenDef = defs.find((d) => d.id === 'admiral_chen')!;

  const basePilot = (): CampaignPilotState => ({
    pilotId: 'admiral_chen',
    currentShipId: 'terran_raptor',
    pilotSkill: 1,
    xp: 0,
    unlockedAbilityIds: ['marksman'],
    equippedAbilityIds: ['marksman'],
    statBonuses: { hull: 0, shields: 0, attack: 0, agility: 0 },
    evolutionChoiceIds: [],
  });

  it('should increase xp by awarded amount', () => {
    const { updated } = awardXpToPilot(basePilot(), chenDef, 50);
    expect(updated.xp).toBe(50);
  });

  it('should not level up if XP is below threshold', () => {
    const { updated, levelsGained } = awardXpToPilot(basePilot(), chenDef, 50);
    expect(updated.pilotSkill).toBe(1);
    expect(levelsGained).toHaveLength(0);
  });

  it('should level up to 2 when XP reaches threshold', () => {
    const { updated, levelsGained, newAbilities } = awardXpToPilot(basePilot(), chenDef, XP_THRESHOLDS[2]!);
    expect(updated.pilotSkill).toBe(2);
    expect(levelsGained).toContain(2);
    expect(newAbilities.length).toBeGreaterThan(0);
  });

  it('level 2 ability for chen should be predatory_instinct', () => {
    const { newAbilities } = awardXpToPilot(basePilot(), chenDef, XP_THRESHOLDS[2]!);
    expect(newAbilities).toContain('predatory_instinct');
  });

  it('should unlock the ability on level up', () => {
    const { updated } = awardXpToPilot(basePilot(), chenDef, XP_THRESHOLDS[2]!);
    expect(updated.unlockedAbilityIds).toContain('predatory_instinct');
  });

  it('should skip directly to level 3 if enough XP given at once', () => {
    const { updated, levelsGained, newAbilities } = awardXpToPilot(basePilot(), chenDef, XP_THRESHOLDS[3]!);
    expect(updated.pilotSkill).toBe(3);
    expect(levelsGained).toContain(2);
    expect(levelsGained).toContain(3);
    expect(newAbilities.length).toBeGreaterThanOrEqual(2);
  });

  it('should not duplicate ability if already unlocked', () => {
    const pilot = { ...basePilot(), unlockedAbilityIds: ['marksman', 'predatory_instinct'] };
    const { updated } = awardXpToPilot(pilot, chenDef, XP_THRESHOLDS[2]!);
    const count = updated.unlockedAbilityIds.filter((id) => id === 'predatory_instinct').length;
    expect(count).toBe(1);
  });

  it('newAbilities and levelsGained should be empty arrays when no level up', () => {
    const { levelsGained, newAbilities } = awardXpToPilot(basePilot(), chenDef, 10);
    expect(levelsGained).toEqual([]);
    expect(newAbilities).toEqual([]);
  });

  it('should not modify the original pilot object (immutability)', () => {
    const pilot = basePilot();
    awardXpToPilot(pilot, chenDef, XP_THRESHOLDS[2]!);
    expect(pilot.xp).toBe(0);
    expect(pilot.pilotSkill).toBe(1);
  });
});

// ============================================
// distributeMissionXp
// ============================================

describe('distributeMissionXp', () => {
  const defs = CAMPAIGN_PILOTS['terran_hegemony']!;

  const basePilots = (): CampaignPilotState[] => initializePilots('terran_hegemony');

  it('should update all pilots with mission XP', () => {
    const { updatedPilots } = distributeMissionXp(basePilots(), defs, 50);
    for (const p of updatedPilots) {
      expect(p.xp).toBeGreaterThanOrEqual(50);
    }
  });

  it('protagonist should receive bonus XP', () => {
    const { updatedPilots } = distributeMissionXp(basePilots(), defs, 50, 25);
    const chen = updatedPilots.find((p) => p.pilotId === 'admiral_chen')!;
    const supporter = updatedPilots.find((p) => p.pilotId === 'striker')!;
    expect(chen.xp).toBe(75); // 50 + 25 bonus
    expect(supporter.xp).toBe(50); // no bonus
  });

  it('should return levelUpEvents on level-up', () => {
    const { levelUpEvents } = distributeMissionXp(basePilots(), defs, XP_THRESHOLDS[2]!);
    expect(levelUpEvents.length).toBeGreaterThan(0);
  });

  it('should return empty levelUpEvents if no level-ups occur', () => {
    const { levelUpEvents } = distributeMissionXp(basePilots(), defs, 10);
    expect(levelUpEvents).toEqual([]);
  });

  it('should correctly record pilot ID in level-up event', () => {
    const { levelUpEvents } = distributeMissionXp(basePilots(), defs, XP_THRESHOLDS[2]!);
    for (const event of levelUpEvents) {
      expect(typeof event.pilotId).toBe('string');
      expect(event.newSkill).toBeGreaterThan(1);
    }
  });

  it('should not modify original pilot array', () => {
    const original = basePilots();
    const originalXp = original[0]!.xp;
    distributeMissionXp(original, defs, 100);
    expect(original[0]!.xp).toBe(originalXp);
  });
});

// ============================================
// applyEvolution
// ============================================

describe('applyEvolution', () => {
  const makeOption = (overrides: Partial<EvolutionOption> = {}): EvolutionOption => ({
    id: 'test_option',
    label: 'Test',
    description: 'Test option',
    keepCurrentShip: true,
    statBonuses: {},
    grantAbilityId: 'predator',
    flavorText: 'Test flavor',
    ...overrides,
  });

  const basePilot = (): CampaignPilotState => ({
    pilotId: 'admiral_chen',
    currentShipId: 'terran_raptor',
    pilotSkill: 3,
    xp: XP_THRESHOLDS[3]!,
    unlockedAbilityIds: ['marksman'],
    equippedAbilityIds: ['marksman', 'predatory_instinct'],
    statBonuses: { hull: 0, shields: 0, attack: 0, agility: 0 },
    evolutionChoiceIds: [],
  });

  it('should keep current ship when keepCurrentShip is true', () => {
    const option = makeOption({ keepCurrentShip: true });
    const result = applyEvolution(basePilot(), option);
    expect(result.currentShipId).toBe('terran_raptor');
  });

  it('should change ship when keepCurrentShip is false', () => {
    const option = makeOption({ keepCurrentShip: false, newShipId: 'terran_praetorian' });
    const result = applyEvolution(basePilot(), option);
    expect(result.currentShipId).toBe('terran_praetorian');
  });

  it('should add hull stat bonus', () => {
    const option = makeOption({ statBonuses: { hull: 2 } });
    const result = applyEvolution(basePilot(), option);
    expect(result.statBonuses.hull).toBe(2);
  });

  it('should accumulate stat bonuses from multiple evolutions', () => {
    const option1 = makeOption({ id: 'opt1', statBonuses: { hull: 1 }, grantAbilityId: 'predator' });
    const option2 = makeOption({ id: 'opt2', statBonuses: { hull: 2, attack: 1 }, grantAbilityId: 'marksman' });
    const after1 = applyEvolution(basePilot(), option1);
    const after2 = applyEvolution(after1, option2);
    expect(after2.statBonuses.hull).toBe(3);
    expect(after2.statBonuses.attack).toBe(1);
  });

  it('should unlock the granted ability', () => {
    const option = makeOption({ grantAbilityId: 'elusive' });
    const result = applyEvolution(basePilot(), option);
    expect(result.unlockedAbilityIds).toContain('elusive');
  });

  it('should record the evolution choice ID', () => {
    const option = makeOption({ id: 'iron_discipline' });
    const result = applyEvolution(basePilot(), option);
    expect(result.evolutionChoiceIds).toContain('iron_discipline');
  });

  it('should not duplicate granted ability if already unlocked', () => {
    const pilot = { ...basePilot(), unlockedAbilityIds: ['marksman', 'predator'] };
    const option = makeOption({ grantAbilityId: 'predator' });
    const result = applyEvolution(pilot, option);
    const count = result.unlockedAbilityIds.filter((id) => id === 'predator').length;
    expect(count).toBe(1);
  });

  it('should not modify the original pilot (immutability)', () => {
    const pilot = basePilot();
    applyEvolution(pilot, makeOption({ statBonuses: { hull: 5 } }));
    expect(pilot.statBonuses.hull).toBe(0);
  });
});

// ============================================
// getPilotDefinition / getProtagonist
// ============================================

describe('getPilotDefinition', () => {
  it('should return definition for known pilot ID', () => {
    const def = getPilotDefinition('terran_hegemony', 'admiral_chen');
    expect(def).toBeDefined();
    expect(def!.id).toBe('admiral_chen');
  });

  it('should return undefined for unknown pilot ID', () => {
    const def = getPilotDefinition('terran_hegemony', 'unknown_xyz');
    expect(def).toBeUndefined();
  });

  it('should return undefined for faction with no pilots', () => {
    const def = getPilotDefinition('free_confederation', 'anyone');
    expect(def).toBeUndefined();
  });
});

describe('getProtagonist', () => {
  it('should return admiral_chen for terran_hegemony', () => {
    const protagonist = getProtagonist('terran_hegemony');
    expect(protagonist).toBeDefined();
    expect(protagonist!.id).toBe('admiral_chen');
    expect(protagonist!.role).toBe('protagonist');
  });

  it('should return the protagonist for all factions', () => {
    const factions: FactionId[] = ['free_confederation', 'synthetic_collective', 'void_corsairs', 'ascendant_empire'];
    for (const faction of factions) {
      const protagonist = getProtagonist(faction);
      expect(protagonist).not.toBeUndefined();
      expect(protagonist!.role).toBe('protagonist');
    }
  });
});

// ============================================
// getPilotEffectiveStats
// ============================================

describe('getPilotEffectiveStats', () => {
  it('should return all zeros for a fresh pilot', () => {
    const pilots = initializePilots('terran_hegemony');
    const stats = getPilotEffectiveStats(pilots[0]!);
    expect(stats.hull).toBe(0);
    expect(stats.shields).toBe(0);
    expect(stats.attack).toBe(0);
    expect(stats.agility).toBe(0);
  });

  it('should reflect accumulated stat bonuses after evolution', () => {
    const pilots = initializePilots('terran_hegemony');
    const option: EvolutionOption = {
      id: 'test',
      label: 'Test',
      description: '',
      keepCurrentShip: true,
      statBonuses: { hull: 2, shields: 1 },
      grantAbilityId: 'predator',
      flavorText: '',
    };
    const evolved = applyEvolution(pilots[0]!, option);
    const stats = getPilotEffectiveStats(evolved);
    expect(stats.hull).toBe(2);
    expect(stats.shields).toBe(1);
    expect(stats.attack).toBe(0);
    expect(stats.agility).toBe(0);
  });
});
