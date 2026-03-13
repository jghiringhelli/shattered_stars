/**
 * Tests for PerformanceSystem - adaptive quality for large battles
 */

import { describe, it, expect } from 'vitest';
import {
  FPS_THRESHOLDS,
  QUALITY_LEVELS,
  QUALITY_PRESETS,
  BATTLE_SIZE_PROFILES,
  createPerformanceState,
  updateFPS,
  evaluateQuality,
  getRecommendedQuality,
  setQualityLevel,
  applyBattleSizeScaling,
  getEffectBudget,
  calculatePlayerQualities,
  getDiagnostics,
  toggleEffect,
  resetToDefaults,
  type QualityLevel,
  type PlayerPerformanceProfile,
} from '../../../src/systems/PerformanceSystem';

describe('PerformanceSystem', () => {
  describe('constants', () => {
    it('FPS_THRESHOLDS should have expected values', () => {
      expect(FPS_THRESHOLDS.EXCELLENT).toBe(60);
      expect(FPS_THRESHOLDS.GOOD).toBe(45);
      expect(FPS_THRESHOLDS.ACCEPTABLE).toBe(30);
      expect(FPS_THRESHOLDS.POOR).toBe(20);
      expect(FPS_THRESHOLDS.CRITICAL).toBe(15);
    });

    it('QUALITY_LEVELS should have 5 levels', () => {
      expect(QUALITY_LEVELS.ULTRA).toBe(5);
      expect(QUALITY_LEVELS.HIGH).toBe(4);
      expect(QUALITY_LEVELS.MEDIUM).toBe(3);
      expect(QUALITY_LEVELS.LOW).toBe(2);
      expect(QUALITY_LEVELS.MINIMUM).toBe(1);
    });

    it('QUALITY_PRESETS should have presets for all quality levels', () => {
      for (const level of Object.values(QUALITY_LEVELS)) {
        expect(QUALITY_PRESETS[level as QualityLevel]).toBeDefined();
        expect(typeof QUALITY_PRESETS[level as QualityLevel].particleCount).toBe('number');
      }
    });

    it('higher quality should have more particles', () => {
      expect(QUALITY_PRESETS[QUALITY_LEVELS.ULTRA].particleCount).toBeGreaterThan(
        QUALITY_PRESETS[QUALITY_LEVELS.HIGH].particleCount
      );
      expect(QUALITY_PRESETS[QUALITY_LEVELS.HIGH].particleCount).toBeGreaterThan(
        QUALITY_PRESETS[QUALITY_LEVELS.LOW].particleCount
      );
    });

    it('BATTLE_SIZE_PROFILES should be sorted by maxShips', () => {
      for (let i = 1; i < BATTLE_SIZE_PROFILES.length; i++) {
        expect(BATTLE_SIZE_PROFILES[i]!.maxShips).toBeGreaterThan(BATTLE_SIZE_PROFILES[i - 1]!.maxShips);
      }
    });
  });

  describe('createPerformanceState', () => {
    it('should return valid initial state', () => {
      const state = createPerformanceState();

      expect(state.currentFPS).toBe(60);
      expect(state.averageFPS).toBe(60);
      expect(state.currentQuality).toBe(QUALITY_LEVELS.HIGH);
      expect(state.isAdaptive).toBe(true);
      expect(state.qualityLocked).toBe(false);
      expect(state.fpsHistory).toEqual([]);
    });
  });

  describe('updateFPS', () => {
    it('should calculate FPS from delta time', () => {
      const state = createPerformanceState();
      const updated = updateFPS(state, 16.67); // 60 FPS

      expect(updated.currentFPS).toBeCloseTo(60, 0);
      expect(updated.frameTimeMs).toBe(16.67);
    });

    it('should accumulate FPS history', () => {
      let state = createPerformanceState();
      state = updateFPS(state, 16.67);
      state = updateFPS(state, 16.67);
      state = updateFPS(state, 16.67);

      expect(state.fpsHistory.length).toBe(3);
    });

    it('should update averageFPS from history', () => {
      let state = createPerformanceState();

      // 5 frames at 60 FPS
      for (let i = 0; i < 5; i++) {
        state = updateFPS(state, 16.67);
      }

      expect(state.averageFPS).toBeCloseTo(60, 0);
    });

    it('should track min and max FPS', () => {
      let state = createPerformanceState();
      state = updateFPS(state, 20); // 50 FPS
      state = updateFPS(state, 33.33); // 30 FPS
      state = updateFPS(state, 10); // 100 FPS

      expect(state.maxFPS).toBeGreaterThan(state.minFPS);
      expect(state.minFPS).toBeLessThan(50);
    });

    it('should cap history at 60 samples', () => {
      let state = createPerformanceState();

      for (let i = 0; i < 70; i++) {
        state = updateFPS(state, 16.67);
      }

      expect(state.fpsHistory.length).toBe(60);
    });

    it('should not mutate original state', () => {
      const original = createPerformanceState();
      const updated = updateFPS(original, 16.67);

      expect(updated).not.toBe(original);
      expect(original.fpsHistory.length).toBe(0);
    });
  });

  describe('evaluateQuality', () => {
    it('should not change quality if locked', () => {
      let state = createPerformanceState();
      state = { ...state, qualityLocked: true, averageFPS: 5 }; // Very low fps but locked

      const result = evaluateQuality(state, 99999);
      expect(result.currentQuality).toBe(state.currentQuality);
    });

    it('should not change quality if not adaptive', () => {
      let state = createPerformanceState();
      state = { ...state, isAdaptive: false, averageFPS: 5 };

      const result = evaluateQuality(state, 99999);
      expect(result.currentQuality).toBe(state.currentQuality);
    });

    it('should not change quality within cooldown period', () => {
      let state = createPerformanceState();
      state = { ...state, averageFPS: 5, lastQualityChange: 100000 };

      const result = evaluateQuality(state, 102000); // Only 2s since last change
      expect(result.currentQuality).toBe(state.currentQuality);
    });

    it('should drop to MINIMUM quality when FPS is critical', () => {
      let state = createPerformanceState();
      state = { ...state, averageFPS: 10, currentQuality: QUALITY_LEVELS.ULTRA };

      const result = evaluateQuality(state, 99999);
      expect(result.currentQuality).toBe(QUALITY_LEVELS.MINIMUM);
    });

    it('should reduce quality one step when FPS is poor', () => {
      let state = createPerformanceState();
      state = { ...state, averageFPS: 18, currentQuality: QUALITY_LEVELS.HIGH };

      const result = evaluateQuality(state, 99999);
      expect(result.currentQuality).toBeLessThan(QUALITY_LEVELS.HIGH);
    });

    it('should reduce quality when FPS is acceptable but not poor', () => {
      let state = createPerformanceState();
      state = { ...state, averageFPS: 25, currentQuality: QUALITY_LEVELS.ULTRA };

      const result = evaluateQuality(state, 99999);
      expect(result.currentQuality).toBeLessThan(QUALITY_LEVELS.ULTRA);
    });

    it('should NOT reduce quality below LOW when FPS is between acceptable and poor', () => {
      let state = createPerformanceState();
      state = { ...state, averageFPS: 25, currentQuality: QUALITY_LEVELS.LOW };

      const result = evaluateQuality(state, 99999);
      expect(result.currentQuality).toBe(QUALITY_LEVELS.LOW);
    });

    it('should upgrade quality when FPS is excellent and stable', () => {
      let state = createPerformanceState();
      // Start at LOW, excellent and stable FPS
      state = {
        ...state,
        averageFPS: 65,
        minFPS: 55,
        currentQuality: QUALITY_LEVELS.LOW,
        qualityStabilityTime: 6000, // Already stable
      };

      const result = evaluateQuality(state, 99999);
      expect(result.currentQuality).toBeGreaterThan(QUALITY_LEVELS.LOW);
    });

    it('should not upgrade past ULTRA', () => {
      let state = createPerformanceState();
      state = {
        ...state,
        averageFPS: 65,
        minFPS: 55,
        currentQuality: QUALITY_LEVELS.ULTRA,
        qualityStabilityTime: 6000,
      };

      const result = evaluateQuality(state, 99999);
      expect(result.currentQuality).toBe(QUALITY_LEVELS.ULTRA);
    });
  });

  describe('getRecommendedQuality', () => {
    it('should return ULTRA for very small battles', () => {
      const quality = getRecommendedQuality(4);
      expect(quality).toBe(QUALITY_LEVELS.ULTRA);
    });

    it('should return lower quality for larger battles', () => {
      const small = getRecommendedQuality(8);
      const large = getRecommendedQuality(64);

      expect(large).toBeLessThan(small);
    });

    it('should return MINIMUM for very large battles', () => {
      const quality = getRecommendedQuality(128);
      expect(quality).toBe(QUALITY_LEVELS.MINIMUM);
    });

    it('should upgrade when player has excellent FPS history', () => {
      const withoutFps = getRecommendedQuality(16);
      const withExcellentFps = getRecommendedQuality(16, [70, 70, 70]);

      expect(withExcellentFps).toBeGreaterThanOrEqual(withoutFps);
    });

    it('should degrade to minimum when player has poor FPS history', () => {
      const quality = getRecommendedQuality(16, [15, 15, 15]); // Very poor FPS

      // Should be at minimum quality for this profile
      const profile = BATTLE_SIZE_PROFILES.find(p => 16 <= p.maxShips)!;
      expect(quality).toBe(profile.minQuality);
    });

    it('should handle very large ship count beyond all profiles', () => {
      const quality = getRecommendedQuality(1000);
      expect(quality).toBe(QUALITY_LEVELS.MINIMUM);
    });
  });

  describe('setQualityLevel', () => {
    it('should set the quality level', () => {
      const state = createPerformanceState();
      const updated = setQualityLevel(state, QUALITY_LEVELS.LOW);

      expect(updated.currentQuality).toBe(QUALITY_LEVELS.LOW);
      expect(updated.targetQuality).toBe(QUALITY_LEVELS.LOW);
    });

    it('should update effect settings to match preset', () => {
      const state = createPerformanceState();
      const updated = setQualityLevel(state, QUALITY_LEVELS.MINIMUM);

      expect(updated.effectSettings.particleCount).toBe(QUALITY_PRESETS[QUALITY_LEVELS.MINIMUM].particleCount);
    });

    it('should lock quality when lockQuality is true', () => {
      const state = createPerformanceState();
      const updated = setQualityLevel(state, QUALITY_LEVELS.ULTRA, true);

      expect(updated.qualityLocked).toBe(true);
    });

    it('should not lock by default', () => {
      const state = createPerformanceState();
      const updated = setQualityLevel(state, QUALITY_LEVELS.MEDIUM);

      expect(updated.qualityLocked).toBe(false);
    });
  });

  describe('applyBattleSizeScaling', () => {
    it('should reduce particle count for large battles', () => {
      const baseSettings = { ...QUALITY_PRESETS[QUALITY_LEVELS.ULTRA] };

      const scaled8Ships = applyBattleSizeScaling(baseSettings, 8); // Skirmish (1.0 multiplier)
      const scaled64Ships = applyBattleSizeScaling(baseSettings, 64); // Epic (0.5 multiplier)

      expect(scaled64Ships.particleCount).toBeLessThan(scaled8Ships.particleCount);
    });

    it('should scale debris count', () => {
      const baseSettings = { ...QUALITY_PRESETS[QUALITY_LEVELS.HIGH] };

      const small = applyBattleSizeScaling(baseSettings, 8);
      const large = applyBattleSizeScaling(baseSettings, 128);

      expect(large.debrisCount).toBeLessThan(small.debrisCount);
    });

    it('should scale simultaneous sounds', () => {
      const baseSettings = { ...QUALITY_PRESETS[QUALITY_LEVELS.HIGH] };

      const small = applyBattleSizeScaling(baseSettings, 8);
      const massive = applyBattleSizeScaling(baseSettings, 128);

      expect(massive.simultaneousSounds).toBeLessThan(small.simultaneousSounds);
    });

    it('should use Massive profile for ship counts beyond all profiles', () => {
      const baseSettings = { ...QUALITY_PRESETS[QUALITY_LEVELS.ULTRA] };
      const scaled = applyBattleSizeScaling(baseSettings, 999);

      // Massive profile has 0.3 multiplier
      expect(scaled.particleCount).toBe(baseSettings.particleCount * 0.3);
    });
  });

  describe('getEffectBudget', () => {
    it('should return budgets for all quality levels', () => {
      for (const level of Object.values(QUALITY_LEVELS)) {
        const budget = getEffectBudget(level as QualityLevel);
        expect(budget.maxParticles).toBeGreaterThan(0);
        expect(budget.maxTrails).toBeGreaterThan(0);
        expect(budget.maxLights).toBeGreaterThan(0);
        expect(budget.maxSounds).toBeGreaterThan(0);
      }
    });

    it('ULTRA should have more budget than MINIMUM', () => {
      const ultra = getEffectBudget(QUALITY_LEVELS.ULTRA);
      const minimum = getEffectBudget(QUALITY_LEVELS.MINIMUM);

      expect(ultra.maxParticles).toBeGreaterThan(minimum.maxParticles);
      expect(ultra.maxSounds).toBeGreaterThan(minimum.maxSounds);
    });
  });

  describe('calculatePlayerQualities', () => {
    it('should return settings for each player', () => {
      const players: PlayerPerformanceProfile[] = [
        { playerId: 'p1', qualityLevel: QUALITY_LEVELS.HIGH, averageFPS: 60, networkLatency: 30, isLagging: false },
        { playerId: 'p2', qualityLevel: QUALITY_LEVELS.MEDIUM, averageFPS: 40, networkLatency: 50, isLagging: false },
      ];

      const result = calculatePlayerQualities(players, 8);

      expect(result.size).toBe(2);
      expect(result.has('p1')).toBe(true);
      expect(result.has('p2')).toBe(true);
    });

    it('should downgrade quality for lagging player', () => {
      const normalPlayer: PlayerPerformanceProfile = {
        playerId: 'normal', qualityLevel: QUALITY_LEVELS.HIGH, averageFPS: 60, networkLatency: 30, isLagging: false,
      };
      const laggingPlayer: PlayerPerformanceProfile = {
        playerId: 'lagging', qualityLevel: QUALITY_LEVELS.HIGH, averageFPS: 15, networkLatency: 30, isLagging: true,
      };

      const result = calculatePlayerQualities([normalPlayer, laggingPlayer], 8);

      const normalSettings = result.get('normal')!;
      const laggingSettings = result.get('lagging')!;

      // Lagging player gets fewer effects
      expect(laggingSettings.particleCount).toBeLessThan(normalSettings.particleCount);
    });

    it('should downgrade quality for high network latency', () => {
      const lowLatency: PlayerPerformanceProfile = {
        playerId: 'low', qualityLevel: QUALITY_LEVELS.HIGH, averageFPS: 60, networkLatency: 30, isLagging: false,
      };
      const highLatency: PlayerPerformanceProfile = {
        playerId: 'high', qualityLevel: QUALITY_LEVELS.HIGH, averageFPS: 60, networkLatency: 200, isLagging: false,
      };

      const result = calculatePlayerQualities([lowLatency, highLatency], 8);

      expect(result.get('high')!.particleCount).toBeLessThan(result.get('low')!.particleCount);
    });
  });

  describe('getDiagnostics', () => {
    it('should return fps string', () => {
      const state = { ...createPerformanceState(), averageFPS: 45, minFPS: 30, maxFPS: 60 };
      const diag = getDiagnostics(state);

      expect(diag.fps).toContain('45');
    });

    it('should show quality level name', () => {
      const state = createPerformanceState();
      const diag = getDiagnostics(state);

      expect(diag.quality).toContain('High');
    });

    it('should show Adaptive when isAdaptive is true', () => {
      const state = { ...createPerformanceState(), isAdaptive: true };
      const diag = getDiagnostics(state);

      expect(diag.quality).toContain('Adaptive');
    });

    it('should show Locked when qualityLocked is true', () => {
      const state = { ...createPerformanceState(), qualityLocked: true };
      const diag = getDiagnostics(state);

      expect(diag.quality).toContain('Locked');
    });

    it('should recommend reductions for poor FPS', () => {
      const state = { ...createPerformanceState(), averageFPS: 15 };
      const diag = getDiagnostics(state);

      expect(diag.recommendations.length).toBeGreaterThan(0);
    });

    it('should recommend effects reduction for acceptable FPS', () => {
      const state = { ...createPerformanceState(), averageFPS: 25 };
      const diag = getDiagnostics(state);

      expect(diag.recommendations.length).toBeGreaterThan(0);
    });

    it('should warn about high memory usage', () => {
      const state = { ...createPerformanceState(), memoryUsageMB: 2000 };
      const diag = getDiagnostics(state);

      expect(diag.recommendations.some(r => r.includes('memory'))).toBe(true);
    });

    it('should warn about high network latency', () => {
      const state = { ...createPerformanceState(), networkLatencyMs: 150 };
      const diag = getDiagnostics(state);

      expect(diag.recommendations.some(r => r.includes('latency'))).toBe(true);
    });

    it('should show N/A for memory when zero', () => {
      const state = { ...createPerformanceState(), memoryUsageMB: 0 };
      const diag = getDiagnostics(state);

      expect(diag.memory).toBe('N/A');
    });

    it('should show particle density percentage', () => {
      const state = createPerformanceState();
      const diag = getDiagnostics(state);

      expect(diag.particles).toContain('%');
    });
  });

  describe('toggleEffect', () => {
    it('should toggle a boolean effect', () => {
      const state = createPerformanceState();
      const withBloom = toggleEffect(state, 'bloomEffect', false);

      expect(withBloom.effectSettings.bloomEffect).toBe(false);
      expect(state.effectSettings.bloomEffect).toBe(true); // Original unchanged
    });

    it('should adjust a numeric effect', () => {
      const state = createPerformanceState();
      const adjusted = toggleEffect(state, 'particleCount', 0.25);

      expect(adjusted.effectSettings.particleCount).toBe(0.25);
    });

    it('should not mutate original state', () => {
      const state = createPerformanceState();
      toggleEffect(state, 'motionBlur', true);

      // Original state should be untouched
      expect(state.effectSettings).toEqual(QUALITY_PRESETS[QUALITY_LEVELS.HIGH]);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset to current quality preset', () => {
      let state = createPerformanceState();
      state = toggleEffect(state, 'bloomEffect', false);

      const reset = resetToDefaults(state);
      expect(reset.effectSettings.bloomEffect).toBe(QUALITY_PRESETS[QUALITY_LEVELS.HIGH].bloomEffect);
    });

    it('should reset to specified quality if provided', () => {
      const state = createPerformanceState();
      const reset = resetToDefaults(state, QUALITY_LEVELS.MINIMUM);

      expect(reset.currentQuality).toBe(QUALITY_LEVELS.MINIMUM);
      expect(reset.effectSettings).toEqual(QUALITY_PRESETS[QUALITY_LEVELS.MINIMUM]);
    });

    it('should unlock quality', () => {
      const state = { ...createPerformanceState(), qualityLocked: true };
      const reset = resetToDefaults(state);

      expect(reset.qualityLocked).toBe(false);
    });
  });
});
