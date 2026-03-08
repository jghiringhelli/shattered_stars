/**
 * Tests for FactionAbilities System
 */

import { describe, it, expect } from 'vitest';
import {
  FACTION_ABILITIES,
  hasFormationBonus,
  canHitAndRun,
  hasNetworkedTargeting,
  getIntimidationPenalty,
  getPrescienceBonus,
  calculateFactionModifiers,
} from '../../../src/systems/FactionAbilities';
import type { FactionId } from '../../../src/config';

describe('FactionAbilities', () => {
  describe('FACTION_ABILITIES definitions', () => {
    const factions: FactionId[] = [
      'terran_hegemony',
      'free_confederation',
      'synthetic_collective',
      'void_corsairs',
      'ascendant_empire',
    ];

    it('should have abilities defined for all factions', () => {
      for (const faction of factions) {
        expect(FACTION_ABILITIES[faction]).toBeDefined();
        expect(FACTION_ABILITIES[faction].id).toBeDefined();
        expect(FACTION_ABILITIES[faction].name).toBeDefined();
        expect(FACTION_ABILITIES[faction].description).toBeDefined();
        expect(FACTION_ABILITIES[faction].faction).toBe(faction);
      }
    });

    it('should have valid effect types', () => {
      const validTypes = ['attack', 'defense', 'movement', 'support'];
      for (const faction of factions) {
        expect(validTypes).toContain(FACTION_ABILITIES[faction].effectType);
      }
    });
  });

  describe('hasFormationBonus (Terran Hegemony)', () => {
    it('should return true when Terran ship is within 150px of ally', () => {
      const allies = [
        { x: 100, y: 100, faction: 'terran_hegemony' as FactionId, hull: 5 },
      ];
      expect(hasFormationBonus(50, 50, 'terran_hegemony', allies)).toBe(true);
    });

    it('should return false when ally is too far', () => {
      const allies = [
        { x: 500, y: 500, faction: 'terran_hegemony' as FactionId, hull: 5 },
      ];
      expect(hasFormationBonus(50, 50, 'terran_hegemony', allies)).toBe(false);
    });

    it('should return false for non-Terran factions', () => {
      const allies = [
        { x: 100, y: 100, faction: 'free_confederation' as FactionId, hull: 5 },
      ];
      expect(hasFormationBonus(50, 50, 'free_confederation', allies)).toBe(false);
    });

    it('should return false when ally is destroyed (hull <= 0)', () => {
      const allies = [
        { x: 100, y: 100, faction: 'terran_hegemony' as FactionId, hull: 0 },
      ];
      expect(hasFormationBonus(50, 50, 'terran_hegemony', allies)).toBe(false);
    });

    it('should return false when ally is from different faction', () => {
      const allies = [
        { x: 100, y: 100, faction: 'void_corsairs' as FactionId, hull: 5 },
      ];
      expect(hasFormationBonus(50, 50, 'terran_hegemony', allies)).toBe(false);
    });

    it('should return true with multiple allies if any is in range', () => {
      const allies = [
        { x: 500, y: 500, faction: 'terran_hegemony' as FactionId, hull: 5 },
        { x: 100, y: 100, faction: 'terran_hegemony' as FactionId, hull: 5 },
      ];
      expect(hasFormationBonus(50, 50, 'terran_hegemony', allies)).toBe(true);
    });

    it('should calculate distance correctly at boundary', () => {
      // Exactly 150px away should still count
      const allies = [
        { x: 150, y: 0, faction: 'terran_hegemony' as FactionId, hull: 5 },
      ];
      expect(hasFormationBonus(0, 0, 'terran_hegemony', allies)).toBe(true);

      // 151px should not count
      const alliesTooFar = [
        { x: 151, y: 0, faction: 'terran_hegemony' as FactionId, hull: 5 },
      ];
      expect(hasFormationBonus(0, 0, 'terran_hegemony', alliesTooFar)).toBe(false);
    });
  });

  describe('canHitAndRun (Free Confederation)', () => {
    it('should return true for Confed when hit landed', () => {
      expect(canHitAndRun('free_confederation', true)).toBe(true);
    });

    it('should return false for Confed when no hit landed', () => {
      expect(canHitAndRun('free_confederation', false)).toBe(false);
    });

    it('should return false for non-Confed factions', () => {
      expect(canHitAndRun('terran_hegemony', true)).toBe(false);
      expect(canHitAndRun('void_corsairs', true)).toBe(false);
    });
  });

  describe('hasNetworkedTargeting (Synthetic Collective)', () => {
    it('should return true when ally has target lock on target', () => {
      const allies = [
        { faction: 'synthetic_collective' as FactionId, hasTargetLock: 'target_123', hull: 5 },
      ];
      expect(hasNetworkedTargeting('synthetic_collective', 'target_123', allies)).toBe(true);
    });

    it('should return false when no ally has lock on target', () => {
      const allies = [
        { faction: 'synthetic_collective' as FactionId, hasTargetLock: 'other_target', hull: 5 },
      ];
      expect(hasNetworkedTargeting('synthetic_collective', 'target_123', allies)).toBe(false);
    });

    it('should return false for non-Collective factions', () => {
      const allies = [
        { faction: 'terran_hegemony' as FactionId, hasTargetLock: 'target_123', hull: 5 },
      ];
      expect(hasNetworkedTargeting('terran_hegemony', 'target_123', allies)).toBe(false);
    });

    it('should return false when ally with lock is destroyed', () => {
      const allies = [
        { faction: 'synthetic_collective' as FactionId, hasTargetLock: 'target_123', hull: 0 },
      ];
      expect(hasNetworkedTargeting('synthetic_collective', 'target_123', allies)).toBe(false);
    });

    it('should return false when hasTargetLock is null', () => {
      const allies = [
        { faction: 'synthetic_collective' as FactionId, hasTargetLock: null, hull: 5 },
      ];
      expect(hasNetworkedTargeting('synthetic_collective', 'target_123', allies)).toBe(false);
    });
  });

  describe('getIntimidationPenalty (Void Corsairs)', () => {
    it('should return 1 when target is below 50% hull', () => {
      expect(getIntimidationPenalty('void_corsairs', 2, 5)).toBe(1);
      expect(getIntimidationPenalty('void_corsairs', 1, 5)).toBe(1);
      expect(getIntimidationPenalty('void_corsairs', 0, 5)).toBe(1);
    });

    it('should return 0 when target is at or above 50% hull', () => {
      expect(getIntimidationPenalty('void_corsairs', 5, 10)).toBe(0);
      expect(getIntimidationPenalty('void_corsairs', 6, 10)).toBe(0);
      expect(getIntimidationPenalty('void_corsairs', 10, 10)).toBe(0);
    });

    it('should return 0 for non-Corsair factions', () => {
      expect(getIntimidationPenalty('terran_hegemony', 1, 5)).toBe(0);
      expect(getIntimidationPenalty('free_confederation', 1, 5)).toBe(0);
    });

    it('should handle edge case at exactly 50%', () => {
      // Exactly 50% should NOT be intimidated (need to be LESS than 50%)
      expect(getIntimidationPenalty('void_corsairs', 5, 10)).toBe(0);
    });

    it('should handle division by zero gracefully', () => {
      // maxHull of 0 would cause division by zero
      // Current implementation would return Infinity < 0.5 = false = 0
      expect(getIntimidationPenalty('void_corsairs', 0, 0)).toBe(0);
    });
  });

  describe('getPrescienceBonus (Ascendant Empire)', () => {
    it('should return 0.05 for Ascendant Empire', () => {
      expect(getPrescienceBonus('ascendant_empire')).toBe(0.05);
    });

    it('should return 0 for other factions', () => {
      expect(getPrescienceBonus('terran_hegemony')).toBe(0);
      expect(getPrescienceBonus('free_confederation')).toBe(0);
      expect(getPrescienceBonus('synthetic_collective')).toBe(0);
      expect(getPrescienceBonus('void_corsairs')).toBe(0);
    });
  });

  describe('calculateFactionModifiers', () => {
    it('should return all zeros for faction with no applicable bonuses', () => {
      const modifiers = calculateFactionModifiers(
        'terran_hegemony',
        100, 100,
        'void_corsairs',
        'target_1',
        5, 5,
        [], // No allies
        false
      );

      expect(modifiers.attackDiceBonus).toBe(0);
      expect(modifiers.hitChanceBonus).toBe(0);
      expect(modifiers.defenseReduction).toBe(0);
      expect(modifiers.canBoostAfter).toBe(false);
    });

    it('should calculate Terran formation bonus correctly', () => {
      const allies = [
        { x: 150, y: 100, faction: 'terran_hegemony' as FactionId, hull: 5, hasTargetLock: null },
      ];

      const modifiers = calculateFactionModifiers(
        'terran_hegemony',
        100, 100,
        'void_corsairs',
        'target_1',
        5, 5,
        allies,
        false
      );

      expect(modifiers.attackDiceBonus).toBe(1);
    });

    it('should calculate Collective networked targeting correctly', () => {
      const allies = [
        { x: 500, y: 500, faction: 'synthetic_collective' as FactionId, hull: 5, hasTargetLock: 'target_1' },
      ];

      const modifiers = calculateFactionModifiers(
        'synthetic_collective',
        100, 100,
        'terran_hegemony',
        'target_1',
        5, 5,
        allies,
        false
      );

      expect(modifiers.hitChanceBonus).toBe(0.1);
    });

    it('should calculate Ascendant prescience bonus correctly', () => {
      const modifiers = calculateFactionModifiers(
        'ascendant_empire',
        100, 100,
        'terran_hegemony',
        'target_1',
        5, 5,
        [],
        false
      );

      expect(modifiers.hitChanceBonus).toBe(0.05);
    });

    it('should calculate Corsair intimidation penalty correctly', () => {
      const modifiers = calculateFactionModifiers(
        'void_corsairs',
        100, 100,
        'terran_hegemony',
        'target_1',
        2, 5, // Target at 40% hull
        [],
        false
      );

      expect(modifiers.defenseReduction).toBe(1);
    });

    it('should calculate Confed hit and run correctly', () => {
      const modifiers = calculateFactionModifiers(
        'free_confederation',
        100, 100,
        'terran_hegemony',
        'target_1',
        5, 5,
        [],
        true // Hit landed
      );

      expect(modifiers.canBoostAfter).toBe(true);
    });

    it('should not give Confed boost when no hit landed', () => {
      const modifiers = calculateFactionModifiers(
        'free_confederation',
        100, 100,
        'terran_hegemony',
        'target_1',
        5, 5,
        [],
        false // No hit
      );

      expect(modifiers.canBoostAfter).toBe(false);
    });
  });
});
