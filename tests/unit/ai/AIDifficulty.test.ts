/**
 * AI Difficulty System Tests
 *
 * Tests for difficulty levels and their modifiers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DIFFICULTY_SETTINGS,
  DIFFICULTY_NAMES,
  DIFFICULTY_DESCRIPTIONS,
  applyDifficultyToPersonality,
  shouldMakeOptimalDecision,
  getModifiedCooldown,
  getModifiedHitChance,
  getModifiedDamage,
  shouldPickOptimalTarget,
  shouldPickOptimalManeuver,
  type AIDifficultyLevel,
  type AIDifficultyModifiers,
} from '../../../src/ai/AIDifficulty';
import type { AIPersonality } from '../../../src/ai/AITypes';

describe('AIDifficulty', () => {
  describe('DIFFICULTY_SETTINGS', () => {
    const difficulties: AIDifficultyLevel[] = ['easy', 'normal', 'hard', 'brutal'];

    it('should have settings for all difficulty levels', () => {
      for (const diff of difficulties) {
        expect(DIFFICULTY_SETTINGS[diff]).toBeDefined();
      }
    });

    it('should have all required modifiers for each difficulty', () => {
      const requiredKeys: (keyof AIDifficultyModifiers)[] = [
        'decisionQuality',
        'reactionTimeMultiplier',
        'accuracyMultiplier',
        'targetSelectionQuality',
        'maneuverQuality',
        'coordinationBonus',
        'aggressionMultiplier',
        'damageMultiplier',
        'damageTakenMultiplier',
      ];

      for (const diff of difficulties) {
        for (const key of requiredKeys) {
          expect(DIFFICULTY_SETTINGS[diff][key]).toBeDefined();
        }
      }
    });

    it('should have increasing decision quality from easy to brutal', () => {
      expect(DIFFICULTY_SETTINGS.easy.decisionQuality).toBeLessThan(
        DIFFICULTY_SETTINGS.normal.decisionQuality
      );
      expect(DIFFICULTY_SETTINGS.normal.decisionQuality).toBeLessThan(
        DIFFICULTY_SETTINGS.hard.decisionQuality
      );
      expect(DIFFICULTY_SETTINGS.hard.decisionQuality).toBeLessThan(
        DIFFICULTY_SETTINGS.brutal.decisionQuality
      );
    });

    it('should have decreasing reaction time from easy to brutal', () => {
      expect(DIFFICULTY_SETTINGS.easy.reactionTimeMultiplier).toBeGreaterThan(
        DIFFICULTY_SETTINGS.normal.reactionTimeMultiplier
      );
      expect(DIFFICULTY_SETTINGS.normal.reactionTimeMultiplier).toBeGreaterThan(
        DIFFICULTY_SETTINGS.hard.reactionTimeMultiplier
      );
      expect(DIFFICULTY_SETTINGS.hard.reactionTimeMultiplier).toBeGreaterThan(
        DIFFICULTY_SETTINGS.brutal.reactionTimeMultiplier
      );
    });

    it('should have increasing accuracy from easy to brutal', () => {
      expect(DIFFICULTY_SETTINGS.easy.accuracyMultiplier).toBeLessThan(
        DIFFICULTY_SETTINGS.normal.accuracyMultiplier
      );
      expect(DIFFICULTY_SETTINGS.normal.accuracyMultiplier).toBeLessThan(
        DIFFICULTY_SETTINGS.hard.accuracyMultiplier
      );
      expect(DIFFICULTY_SETTINGS.hard.accuracyMultiplier).toBeLessThan(
        DIFFICULTY_SETTINGS.brutal.accuracyMultiplier
      );
    });

    it('should have brutal with perfect decision quality', () => {
      expect(DIFFICULTY_SETTINGS.brutal.decisionQuality).toBe(1.0);
      expect(DIFFICULTY_SETTINGS.brutal.targetSelectionQuality).toBe(1.0);
      expect(DIFFICULTY_SETTINGS.brutal.maneuverQuality).toBe(1.0);
    });
  });

  describe('DIFFICULTY_NAMES', () => {
    it('should have names for all difficulties', () => {
      expect(DIFFICULTY_NAMES.easy).toBe('Easy');
      expect(DIFFICULTY_NAMES.normal).toBe('Normal');
      expect(DIFFICULTY_NAMES.hard).toBe('Hard');
      expect(DIFFICULTY_NAMES.brutal).toBe('Brutal');
    });
  });

  describe('DIFFICULTY_DESCRIPTIONS', () => {
    it('should have descriptions for all difficulties', () => {
      expect(DIFFICULTY_DESCRIPTIONS.easy).toBeTruthy();
      expect(DIFFICULTY_DESCRIPTIONS.normal).toBeTruthy();
      expect(DIFFICULTY_DESCRIPTIONS.hard).toBeTruthy();
      expect(DIFFICULTY_DESCRIPTIONS.brutal).toBeTruthy();
    });
  });

  describe('applyDifficultyToPersonality', () => {
    const basePersonality: AIPersonality = {
      aggression: 0.5,
      caution: 0.5,
      focus_fire: 0.3,
      target_priority: 'weakest',
      formation_cohesion: 0.4,
      ability_usage: 0.6,
    };

    it('should modify personality based on difficulty', () => {
      const easyPersonality = applyDifficultyToPersonality(basePersonality, 'easy');
      const brutalPersonality = applyDifficultyToPersonality(basePersonality, 'brutal');

      // Easy should reduce aggression
      expect(easyPersonality.aggression).toBeLessThan(basePersonality.aggression);

      // Brutal should increase aggression
      expect(brutalPersonality.aggression).toBeGreaterThan(basePersonality.aggression);
    });

    it('should increase focus_fire and formation_cohesion with coordination bonus', () => {
      const hardPersonality = applyDifficultyToPersonality(basePersonality, 'hard');

      // Hard has coordination bonus of 0.5
      expect(hardPersonality.focus_fire).toBeGreaterThan(basePersonality.focus_fire);
      expect(hardPersonality.formation_cohesion).toBeGreaterThan(
        basePersonality.formation_cohesion
      );
    });

    it('should cap values at 1.0', () => {
      const highAggression: AIPersonality = {
        ...basePersonality,
        aggression: 0.9,
        focus_fire: 0.9,
        formation_cohesion: 0.9,
      };

      const brutalPersonality = applyDifficultyToPersonality(highAggression, 'brutal');

      expect(brutalPersonality.aggression).toBeLessThanOrEqual(1);
      expect(brutalPersonality.focus_fire).toBeLessThanOrEqual(1);
      expect(brutalPersonality.formation_cohesion).toBeLessThanOrEqual(1);
    });

    it('should preserve other personality properties', () => {
      const modified = applyDifficultyToPersonality(basePersonality, 'normal');

      expect(modified.caution).toBe(basePersonality.caution);
      expect(modified.target_priority).toBe(basePersonality.target_priority);
      expect(modified.ability_usage).toBe(basePersonality.ability_usage);
    });
  });

  describe('shouldMakeOptimalDecision', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return true when random is below decision quality', () => {
      vi.mocked(Math.random).mockReturnValue(0.3);
      expect(shouldMakeOptimalDecision('normal')).toBe(true); // 0.3 < 0.7
    });

    it('should return false when random is above decision quality', () => {
      vi.mocked(Math.random).mockReturnValue(0.8);
      expect(shouldMakeOptimalDecision('normal')).toBe(false); // 0.8 >= 0.7
    });

    it('should always return true for brutal at low random values', () => {
      vi.mocked(Math.random).mockReturnValue(0.99);
      expect(shouldMakeOptimalDecision('brutal')).toBe(true); // 0.99 < 1.0
    });

    it('should often return false for easy difficulty', () => {
      vi.mocked(Math.random).mockReturnValue(0.5);
      expect(shouldMakeOptimalDecision('easy')).toBe(false); // 0.5 >= 0.4
    });
  });

  describe('getModifiedCooldown', () => {
    it('should increase cooldown for easy difficulty', () => {
      const baseCooldown = 1000;
      const modified = getModifiedCooldown(baseCooldown, 'easy');

      expect(modified).toBeGreaterThan(baseCooldown);
    });

    it('should keep cooldown same for normal difficulty', () => {
      const baseCooldown = 1000;
      const modified = getModifiedCooldown(baseCooldown, 'normal');

      expect(modified).toBe(baseCooldown);
    });

    it('should decrease cooldown for hard/brutal difficulty', () => {
      const baseCooldown = 1000;
      const hardModified = getModifiedCooldown(baseCooldown, 'hard');
      const brutalModified = getModifiedCooldown(baseCooldown, 'brutal');

      expect(hardModified).toBeLessThan(baseCooldown);
      expect(brutalModified).toBeLessThan(hardModified);
    });

    it('should round to integer', () => {
      const baseCooldown = 333;
      const modified = getModifiedCooldown(baseCooldown, 'easy');

      expect(Number.isInteger(modified)).toBe(true);
    });
  });

  describe('getModifiedHitChance', () => {
    it('should reduce hit chance for easy difficulty', () => {
      const baseChance = 0.7;
      const modified = getModifiedHitChance(baseChance, 'easy');

      expect(modified).toBeLessThan(baseChance);
    });

    it('should increase hit chance for hard/brutal difficulty', () => {
      const baseChance = 0.7;
      const hardModified = getModifiedHitChance(baseChance, 'hard');
      const brutalModified = getModifiedHitChance(baseChance, 'brutal');

      expect(hardModified).toBeGreaterThan(baseChance);
      expect(brutalModified).toBeGreaterThan(hardModified);
    });

    it('should cap hit chance at 0.95', () => {
      const baseChance = 0.9;
      const modified = getModifiedHitChance(baseChance, 'brutal');

      expect(modified).toBeLessThanOrEqual(0.95);
    });
  });

  describe('getModifiedDamage', () => {
    it('should reduce AI damage on easy when AI attacking', () => {
      const baseDamage = 10;
      const modified = getModifiedDamage(baseDamage, 'easy', true);

      expect(modified).toBeLessThan(baseDamage);
    });

    it('should increase player damage to AI on easy', () => {
      const baseDamage = 10;
      const modified = getModifiedDamage(baseDamage, 'easy', false);

      expect(modified).toBeGreaterThan(baseDamage);
    });

    it('should increase AI damage on brutal when AI attacking', () => {
      const baseDamage = 10;
      const modified = getModifiedDamage(baseDamage, 'brutal', true);

      expect(modified).toBeGreaterThan(baseDamage);
    });

    it('should reduce player damage to AI on brutal', () => {
      const baseDamage = 10;
      const modified = getModifiedDamage(baseDamage, 'brutal', false);

      expect(modified).toBeLessThan(baseDamage);
    });

    it('should keep damage same for normal difficulty', () => {
      const baseDamage = 10;
      const attackModified = getModifiedDamage(baseDamage, 'normal', true);
      const defendModified = getModifiedDamage(baseDamage, 'normal', false);

      expect(attackModified).toBe(baseDamage);
      expect(defendModified).toBe(baseDamage);
    });

    it('should round to integer', () => {
      const baseDamage = 7;
      const modified = getModifiedDamage(baseDamage, 'easy', true);

      expect(Number.isInteger(modified)).toBe(true);
    });
  });

  describe('shouldPickOptimalTarget', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return true when random is below target selection quality', () => {
      vi.mocked(Math.random).mockReturnValue(0.5);
      expect(shouldPickOptimalTarget('normal')).toBe(true); // 0.5 < 0.6
    });

    it('should return false when random exceeds target selection quality', () => {
      vi.mocked(Math.random).mockReturnValue(0.5);
      expect(shouldPickOptimalTarget('easy')).toBe(false); // 0.5 >= 0.3
    });

    it('should always return true for brutal', () => {
      vi.mocked(Math.random).mockReturnValue(0.99);
      expect(shouldPickOptimalTarget('brutal')).toBe(true);
    });
  });

  describe('shouldPickOptimalManeuver', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return true when random is below maneuver quality', () => {
      vi.mocked(Math.random).mockReturnValue(0.6);
      expect(shouldPickOptimalManeuver('normal')).toBe(true); // 0.6 < 0.7
    });

    it('should return false when random exceeds maneuver quality', () => {
      vi.mocked(Math.random).mockReturnValue(0.5);
      expect(shouldPickOptimalManeuver('easy')).toBe(false); // 0.5 >= 0.4
    });

    it('should always return true for brutal', () => {
      vi.mocked(Math.random).mockReturnValue(0.99);
      expect(shouldPickOptimalManeuver('brutal')).toBe(true);
    });
  });
});
