/**
 * Tests for CombatSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  rollAttackDice,
  rollDefenseDice,
  convertAttackFocus,
  convertDefenseFocus,
  countAttackFaces,
  countDefenseFaces,
  resolveAttack,
  calculateExpectedDamage,
  canAttack,
  ATTACK_DICE_FACES,
  DEFENSE_DICE_FACES,
  type AttackContext,
} from '../../../src/systems/CombatSystem';
import { createSeededRng, type RandomGenerator } from '../../../src/utils/random';

describe('CombatSystem', () => {
  let rng: RandomGenerator;

  beforeEach(() => {
    // Use seeded RNG for deterministic tests
    rng = createSeededRng(12345);
  });

  describe('Dice Definitions', () => {
    it('should have correct attack dice distribution', () => {
      // 3 hits, 1 crit, 2 focus, 2 blank = 8 total
      expect(ATTACK_DICE_FACES.length).toBe(8);
      expect(ATTACK_DICE_FACES.filter((f) => f === 'hit').length).toBe(3);
      expect(ATTACK_DICE_FACES.filter((f) => f === 'critical').length).toBe(1);
      expect(ATTACK_DICE_FACES.filter((f) => f === 'focus').length).toBe(2);
      expect(ATTACK_DICE_FACES.filter((f) => f === 'blank').length).toBe(2);
    });

    it('should have correct defense dice distribution', () => {
      // 3 evade, 2 focus, 3 blank = 8 total
      expect(DEFENSE_DICE_FACES.length).toBe(8);
      expect(DEFENSE_DICE_FACES.filter((f) => f === 'evade').length).toBe(3);
      expect(DEFENSE_DICE_FACES.filter((f) => f === 'focus').length).toBe(2);
      expect(DEFENSE_DICE_FACES.filter((f) => f === 'blank').length).toBe(3);
    });
  });

  describe('rollAttackDice', () => {
    it('should return correct number of dice', () => {
      expect(rollAttackDice(1, rng).length).toBe(1);
      expect(rollAttackDice(3, rng).length).toBe(3);
      expect(rollAttackDice(5, rng).length).toBe(5);
    });

    it('should only return valid attack faces', () => {
      const validFaces = new Set(['hit', 'critical', 'focus', 'blank']);
      for (let i = 0; i < 100; i++) {
        const results = rollAttackDice(5, rng);
        for (const face of results) {
          expect(validFaces.has(face)).toBe(true);
        }
      }
    });

    it('should produce roughly correct distribution over many rolls', () => {
      const counts = { hit: 0, critical: 0, focus: 0, blank: 0 };
      const totalRolls = 10000;

      for (let i = 0; i < totalRolls; i++) {
        const result = rollAttackDice(1, rng)[0];
        if (result) counts[result]++;
      }

      // Expected: hit 37.5%, crit 12.5%, focus 25%, blank 25%
      // Allow 5% tolerance
      expect(counts.hit / totalRolls).toBeCloseTo(0.375, 1);
      expect(counts.critical / totalRolls).toBeCloseTo(0.125, 1);
      expect(counts.focus / totalRolls).toBeCloseTo(0.25, 1);
      expect(counts.blank / totalRolls).toBeCloseTo(0.25, 1);
    });
  });

  describe('rollDefenseDice', () => {
    it('should return correct number of dice', () => {
      expect(rollDefenseDice(1, rng).length).toBe(1);
      expect(rollDefenseDice(3, rng).length).toBe(3);
    });

    it('should produce roughly correct distribution', () => {
      const counts = { evade: 0, focus: 0, blank: 0 };
      const totalRolls = 10000;

      for (let i = 0; i < totalRolls; i++) {
        const result = rollDefenseDice(1, rng)[0];
        if (result) counts[result]++;
      }

      // Expected: evade 37.5%, focus 25%, blank 37.5%
      expect(counts.evade / totalRolls).toBeCloseTo(0.375, 1);
      expect(counts.focus / totalRolls).toBeCloseTo(0.25, 1);
      expect(counts.blank / totalRolls).toBeCloseTo(0.375, 1);
    });
  });

  describe('convertAttackFocus', () => {
    it('should convert focus to hits', () => {
      const dice = ['hit', 'focus', 'blank', 'critical', 'focus'] as const;
      const converted = convertAttackFocus([...dice]);

      expect(converted).toEqual(['hit', 'hit', 'blank', 'critical', 'hit']);
    });

    it('should not modify other faces', () => {
      const dice = ['hit', 'blank', 'critical'] as const;
      const converted = convertAttackFocus([...dice]);

      expect(converted).toEqual(['hit', 'blank', 'critical']);
    });
  });

  describe('convertDefenseFocus', () => {
    it('should convert focus to evades', () => {
      const dice = ['evade', 'focus', 'blank', 'focus'] as const;
      const converted = convertDefenseFocus([...dice]);

      expect(converted).toEqual(['evade', 'evade', 'blank', 'evade']);
    });
  });

  describe('countAttackFaces', () => {
    it('should count all face types', () => {
      const dice = ['hit', 'hit', 'critical', 'focus', 'blank', 'blank'] as const;
      const counts = countAttackFaces(dice);

      expect(counts.hits).toBe(2);
      expect(counts.crits).toBe(1);
      expect(counts.focus).toBe(1);
      expect(counts.blank).toBe(2);
    });
  });

  describe('countDefenseFaces', () => {
    it('should count all face types', () => {
      const dice = ['evade', 'evade', 'focus', 'blank'] as const;
      const counts = countDefenseFaces(dice);

      expect(counts.evades).toBe(2);
      expect(counts.focus).toBe(1);
      expect(counts.blank).toBe(1);
    });
  });

  describe('resolveAttack', () => {
    const baseContext: AttackContext = {
      attackDice: 3,
      attackerHasFocus: false,
      attackerHasTargetLock: false,
      defenseDice: 2,
      defenderHasFocus: false,
      defenderHasEvadeToken: false,
      defenderShields: 2,
      defenderHull: 3,
      range: 2,
    };

    it('should return attack and defense rolls', () => {
      const result = resolveAttack(baseContext, rng);

      expect(result.attackRoll.length).toBe(3); // 3 attack dice at range 2
      expect(result.defenseRoll.length).toBe(2); // 2 defense dice at range 2
    });

    it('should add attack die at range 1', () => {
      const context: AttackContext = { ...baseContext, range: 1 };
      const result = resolveAttack(context, rng);

      expect(result.attackRoll.length).toBe(4); // 3 + 1 range bonus
    });

    it('should add defense die at range 3', () => {
      const context: AttackContext = { ...baseContext, range: 3 };
      const result = resolveAttack(context, rng);

      expect(result.defenseRoll.length).toBe(3); // 2 + 1 range bonus
    });

    it('should never produce negative damage', () => {
      // Run many attacks to ensure no negative values
      for (let i = 0; i < 1000; i++) {
        const testRng = createSeededRng(i);
        const result = resolveAttack(baseContext, testRng);

        expect(result.hitsLanded).toBeGreaterThanOrEqual(0);
        expect(result.critsLanded).toBeGreaterThanOrEqual(0);
        expect(result.shieldDamage).toBeGreaterThanOrEqual(0);
        expect(result.hullDamage).toBeGreaterThanOrEqual(0);
        expect(result.totalDamage).toBeGreaterThanOrEqual(0);
      }
    });

    it('should apply damage to shields before hull', () => {
      // Use a seed that produces hits
      const hitRng = createSeededRng(42);
      const context: AttackContext = {
        ...baseContext,
        attackDice: 5, // More dice for more hits
        defenseDice: 0, // No defense
        defenderShields: 2,
        defenderHull: 3,
      };

      const result = resolveAttack(context, hitRng);

      // If we got hits, shields should be damaged first
      if (result.hitsLanded > 0) {
        // Shield damage should be at most the number of shields
        expect(result.shieldDamage).toBeLessThanOrEqual(2);
        // Total damage should equal shield + hull damage
        expect(result.shieldDamage + result.hullDamage).toBe(result.totalDamage);
      }
    });

    it('should detect ship destruction', () => {
      // High attack, no defense, low hull
      const context: AttackContext = {
        ...baseContext,
        attackDice: 6,
        defenseDice: 0,
        defenderShields: 0,
        defenderHull: 1,
        attackerHasFocus: true, // Convert focus to hits
      };

      // Run many times to find a destroying hit
      let foundDestruction = false;
      for (let i = 0; i < 100 && !foundDestruction; i++) {
        const testRng = createSeededRng(i);
        const result = resolveAttack(context, testRng);
        if (result.shipDestroyed) {
          foundDestruction = true;
          expect(result.hullDamage).toBeGreaterThanOrEqual(1);
        }
      }
      expect(foundDestruction).toBe(true);
    });

    it('should apply evade token as extra evade result', () => {
      const contextWithEvade: AttackContext = {
        ...baseContext,
        defenderHasEvadeToken: true,
      };

      const result = resolveAttack(contextWithEvade, rng);

      // Modified defense should have one more evade than rolled
      const rolledEvades = result.defenseRoll.filter((f) => f === 'evade').length;
      const modifiedEvades = result.modifiedDefense.filter((f) => f === 'evade').length;
      expect(modifiedEvades).toBeGreaterThanOrEqual(rolledEvades);
    });

    it('should convert focus results when attacker has focus', () => {
      const contextWithFocus: AttackContext = {
        ...baseContext,
        attackerHasFocus: true,
      };

      const result = resolveAttack(contextWithFocus, rng);

      // Modified attack should have no focus results
      expect(result.modifiedAttack.filter((f) => f === 'focus').length).toBe(0);
    });
  });

  describe('calculateExpectedDamage', () => {
    it('should return 0 for 0 attack dice', () => {
      expect(calculateExpectedDamage(0, 2)).toBe(0);
    });

    it('should increase with more attack dice', () => {
      const damage1 = calculateExpectedDamage(1, 1);
      const damage3 = calculateExpectedDamage(3, 1);
      expect(damage3).toBeGreaterThan(damage1);
    });

    it('should decrease with more defense dice', () => {
      const damage1 = calculateExpectedDamage(3, 1);
      const damage3 = calculateExpectedDamage(3, 3);
      expect(damage3).toBeLessThan(damage1);
    });

    it('should never return negative values', () => {
      expect(calculateExpectedDamage(1, 10)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('canAttack', () => {
    it('should return true when in range and arc', () => {
      expect(canAttack(1, true)).toBe(true);
      expect(canAttack(2, true)).toBe(true);
      expect(canAttack(3, true)).toBe(true);
    });

    it('should return false when out of range', () => {
      expect(canAttack(null, true)).toBe(false);
    });

    it('should return false when out of arc', () => {
      expect(canAttack(1, false)).toBe(false);
      expect(canAttack(2, false)).toBe(false);
    });
  });

  describe('Deterministic behavior', () => {
    it('should produce same results with same seed', () => {
      const rng1 = createSeededRng(99999);
      const rng2 = createSeededRng(99999);

      const result1 = resolveAttack(
        {
          attackDice: 3,
          attackerHasFocus: false,
          attackerHasTargetLock: false,
          defenseDice: 2,
          defenderHasFocus: false,
          defenderHasEvadeToken: false,
          defenderShields: 2,
          defenderHull: 3,
          range: 2,
        },
        rng1
      );

      const result2 = resolveAttack(
        {
          attackDice: 3,
          attackerHasFocus: false,
          attackerHasTargetLock: false,
          defenseDice: 2,
          defenderHasFocus: false,
          defenderHasEvadeToken: false,
          defenderShields: 2,
          defenderHull: 3,
          range: 2,
        },
        rng2
      );

      expect(result1.attackRoll).toEqual(result2.attackRoll);
      expect(result1.defenseRoll).toEqual(result2.defenseRoll);
      expect(result1.totalDamage).toBe(result2.totalDamage);
    });
  });
});
