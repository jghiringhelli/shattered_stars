/**
 * Gameplay Metrics Tests
 *
 * Tests for the gameplay feel analysis system.
 * Validates TTK, pacing, skill expression, and fun factor metrics.
 */

import { describe, it, expect } from 'vitest';
import {
  GameplayMetricsAnalyzer,
  TTK_BENCHMARKS,
  PACING_TARGETS,
  SKILL_TARGETS,
  type GameplayFeelReport,
} from '../../src/simulation/GameplayMetrics';

describe('GameplayMetricsAnalyzer', () => {
  describe('TTK Analysis', () => {
    it('should calculate TTK metrics for all ships', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const ttk = analyzer.analyzeTTK();

      expect(ttk.averageTTK).toBeGreaterThan(0);
      expect(ttk.minTTK).toBeGreaterThan(0);
      expect(ttk.maxTTK).toBeGreaterThanOrEqual(ttk.minTTK);
      expect(ttk.shipBreakdown.size).toBeGreaterThan(0);
    });

    it('should rate TTK appropriately', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const ttk = analyzer.analyzeTTK();

      const validRatings = ['instant', 'fast', 'moderate', 'slow', 'glacial'];
      expect(validRatings).toContain(ttk.rating);
    });

    it('should have TTK in reasonable range for tactical game', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const ttk = analyzer.analyzeTTK();

      // TTK should be between 2-15 turns for a playable tactical game
      expect(ttk.averageTTK).toBeGreaterThanOrEqual(2);
      expect(ttk.averageTTK).toBeLessThanOrEqual(15);
    });

    it('should track per-ship TTK breakdown', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const ttk = analyzer.analyzeTTK();

      for (const [shipId, data] of ttk.shipBreakdown) {
        expect(data.shipId).toBe(shipId);
        expect(data.effectiveHealth).toBeGreaterThan(0);
        expect(data.averageTTK).toBeGreaterThan(0);
      }
    });
  });

  describe('Pacing Analysis', () => {
    it('should calculate pacing metrics', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const ttk = analyzer.analyzeTTK();
      const pacing = analyzer.analyzePacing(ttk);

      expect(pacing.engagementDelay).toBeGreaterThan(0);
      expect(pacing.decisionsPerMinute).toBeGreaterThan(0);
      expect(pacing.averageBattleLength).toBeGreaterThan(0);
      expect(pacing.combatDensity).toBeGreaterThan(0);
      expect(pacing.combatDensity).toBeLessThanOrEqual(1);
    });

    it('should rate pacing appropriately', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const ttk = analyzer.analyzeTTK();
      const pacing = analyzer.analyzePacing(ttk);

      const validRatings = ['frantic', 'fast', 'balanced', 'deliberate', 'slow'];
      expect(validRatings).toContain(pacing.rating);
    });

    it('should provide reasonable turn timer recommendation', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const ttk = analyzer.analyzeTTK();
      const pacing = analyzer.analyzePacing(ttk);

      // Turn timer should be between 5-30 seconds for playable game
      expect(pacing.recommendedTurnTimer).toBeGreaterThanOrEqual(5);
      expect(pacing.recommendedTurnTimer).toBeLessThanOrEqual(30);
    });

    it('should have different pacing for turn-based vs continuous', () => {
      const continuousAnalyzer = new GameplayMetricsAnalyzer('continuous');
      const turnBasedAnalyzer = new GameplayMetricsAnalyzer('turn_based');

      const continuousTTK = continuousAnalyzer.analyzeTTK();
      const turnBasedTTK = turnBasedAnalyzer.analyzeTTK();

      const continuousPacing = continuousAnalyzer.analyzePacing(continuousTTK);
      const turnBasedPacing = turnBasedAnalyzer.analyzePacing(turnBasedTTK);

      // Continuous should have higher DPM than turn-based
      expect(continuousPacing.decisionsPerMinute).toBeGreaterThan(
        turnBasedPacing.decisionsPerMinute
      );
    });
  });

  describe('Skill Expression Analysis', () => {
    it('should calculate skill expression metrics', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const skill = analyzer.analyzeSkillExpression();

      // All components should sum to 1
      const total =
        skill.positioningImpact +
        skill.actionImpact +
        skill.maneuverImpact +
        skill.statDominance +
        skill.compositionImpact;

      expect(total).toBeCloseTo(1.0, 2);
    });

    it('should rate skill expression appropriately', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const skill = analyzer.analyzeSkillExpression();

      const validRatings = ['chess', 'tactical', 'balanced', 'accessible', 'casual'];
      expect(validRatings).toContain(skill.rating);
    });

    it('should indicate positioning can outmaneuver stats for tactical game', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const skill = analyzer.analyzeSkillExpression();

      // For a good tactical game, positioning should matter more than raw stats
      expect(skill.breakdown.canOutmaneuver).toBe(true);
    });

    it('should have multiple viable choices per turn', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const skill = analyzer.analyzeSkillExpression();

      // Should have at least 3 meaningful choices per turn
      expect(skill.breakdown.averageViableChoices).toBeGreaterThanOrEqual(3);
    });

    it('should reward optimal play more than punish mistakes', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const skill = analyzer.analyzeSkillExpression();

      // Game should be more about rewarding good play than punishing mistakes
      expect(skill.breakdown.optimalPlayReward).toBeGreaterThanOrEqual(
        skill.breakdown.mistakePunishment
      );
    });
  });

  describe('Fun Factor Analysis', () => {
    it('should calculate fun factor metrics', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const ttk = analyzer.analyzeTTK();
      const pacing = analyzer.analyzePacing(ttk);
      const skill = analyzer.analyzeSkillExpression();
      const fun = analyzer.analyzeFunFactor(ttk, pacing, skill);

      expect(fun.comebackPotential).toBeGreaterThanOrEqual(0);
      expect(fun.comebackPotential).toBeLessThanOrEqual(1);
      expect(fun.reversalRate).toBeGreaterThanOrEqual(0);
      expect(fun.outcomeVariance).toBeGreaterThanOrEqual(0);
      expect(fun.tensionRating).toBeGreaterThanOrEqual(0);
    });

    it('should rate fun factor appropriately', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const ttk = analyzer.analyzeTTK();
      const pacing = analyzer.analyzePacing(ttk);
      const skill = analyzer.analyzeSkillExpression();
      const fun = analyzer.analyzeFunFactor(ttk, pacing, skill);

      const validRatings = ['excellent', 'good', 'decent', 'mixed', 'needs_work'];
      expect(validRatings).toContain(fun.rating);
    });

    it('should have reasonable comeback potential', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const ttk = analyzer.analyzeTTK();
      const pacing = analyzer.analyzePacing(ttk);
      const skill = analyzer.analyzeSkillExpression();
      const fun = analyzer.analyzeFunFactor(ttk, pacing, skill);

      // Comeback potential should be at least 20% for engaging gameplay
      expect(fun.comebackPotential).toBeGreaterThanOrEqual(0.2);
    });

    it('should return warnings array', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const ttk = analyzer.analyzeTTK();
      const pacing = analyzer.analyzePacing(ttk);
      const skill = analyzer.analyzeSkillExpression();
      const fun = analyzer.analyzeFunFactor(ttk, pacing, skill);

      expect(Array.isArray(fun.warnings)).toBe(true);
    });
  });

  describe('Full Report Generation', () => {
    it('should generate complete gameplay feel report', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const report = analyzer.analyzeGameplayFeel();

      expect(report.ttk).toBeDefined();
      expect(report.pacing).toBeDefined();
      expect(report.skillExpression).toBeDefined();
      expect(report.funFactor).toBeDefined();
      expect(report.overallAssessment).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should provide overall assessment', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const report = analyzer.analyzeGameplayFeel();

      const validArchetypes = ['action', 'tactical', 'strategic', 'hybrid'];
      expect(validArchetypes).toContain(report.overallAssessment.archetype);
      expect(report.overallAssessment.similarTo.length).toBeGreaterThan(0);
      expect(report.overallAssessment.targetAudience).toBeTruthy();
      expect(report.overallAssessment.healthScore).toBeGreaterThanOrEqual(0);
      expect(report.overallAssessment.healthScore).toBeLessThanOrEqual(100);
    });

    it('should provide recommendations array', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const report = analyzer.analyzeGameplayFeel();

      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should generate formatted text report', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const textReport = analyzer.generateReport();

      expect(textReport).toContain('GAMEPLAY FEEL ANALYSIS REPORT');
      expect(textReport).toContain('TIME-TO-KILL');
      expect(textReport).toContain('PACING ANALYSIS');
      expect(textReport).toContain('SKILL EXPRESSION');
      expect(textReport).toContain('FUN FACTOR');
      expect(textReport).toContain('OVERALL ASSESSMENT');
      expect(textReport).toContain('HEALTH SCORE');
    });
  });

  describe('Benchmark References', () => {
    it('should have valid TTK benchmarks', () => {
      expect(TTK_BENCHMARKS.xwingMiniatures.ttk).toBeGreaterThan(0);
      expect(TTK_BENCHMARKS.starWarsSquadrons.ttk).toBeGreaterThan(0);
      expect(TTK_BENCHMARKS.ftl.ttk).toBeGreaterThan(0);
    });

    it('should have valid pacing targets', () => {
      expect(PACING_TARGETS.decisionsPerMinute.min).toBeLessThan(
        PACING_TARGETS.decisionsPerMinute.ideal
      );
      expect(PACING_TARGETS.decisionsPerMinute.ideal).toBeLessThan(
        PACING_TARGETS.decisionsPerMinute.max
      );
    });

    it('should have skill targets summing to 1', () => {
      const total =
        SKILL_TARGETS.positioningImpact +
        SKILL_TARGETS.actionImpact +
        SKILL_TARGETS.maneuverImpact +
        SKILL_TARGETS.statDominance +
        SKILL_TARGETS.compositionImpact;

      expect(total).toBeCloseTo(1.0, 2);
    });
  });

  describe('Integration with Game Balance', () => {
    it('should have turn-based TTK in strategic range', () => {
      const analyzer = new GameplayMetricsAnalyzer('turn_based');
      const ttk = analyzer.analyzeTTK();

      // Turn-based mode: strategic, longer battles (6-15 turns like FTL)
      expect(ttk.averageTTK).toBeGreaterThanOrEqual(4);
      expect(ttk.averageTTK).toBeLessThanOrEqual(15);

      console.log(`Turn-based TTK: ${ttk.averageTTK.toFixed(1)} turns`);
    });

    it('should have arcade (continuous) TTK closer to X-Wing reference', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const ttk = analyzer.analyzeTTK();

      // Arcade mode: faster, action-oriented (2-8 hits)
      // With tuning: hullMult 0.6, shieldMult 0.5, attackBase 1.5
      // Target ~4-6 like X-Wing
      const xwingTTK = TTK_BENCHMARKS.xwingMiniatures.ttk;
      expect(ttk.averageTTK).toBeGreaterThanOrEqual(2);
      expect(ttk.averageTTK).toBeLessThanOrEqual(10);

      console.log(`Arcade TTK: ${ttk.averageTTK.toFixed(1)} hits (X-Wing reference: ${xwingTTK})`);
    });

    it('should have health score above 50 for viable game', () => {
      const analyzer = new GameplayMetricsAnalyzer('continuous');
      const report = analyzer.analyzeGameplayFeel();

      // A viable game should score at least 50/100
      expect(report.overallAssessment.healthScore).toBeGreaterThanOrEqual(50);
    });
  });
});
