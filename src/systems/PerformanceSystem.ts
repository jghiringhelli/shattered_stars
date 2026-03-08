/**
 * Performance System
 *
 * Monitors FPS and adapts visual quality settings dynamically.
 * Designed for epic multiplayer battles with dozens of ships.
 *
 * Features:
 * - FPS monitoring and smoothing
 * - Automatic quality level adjustment
 * - Per-effect toggles
 * - Multi-player awareness (degrade gracefully)
 * - Quality presets for different battle sizes
 */

// ============================================
// Performance Thresholds
// ============================================

export const FPS_THRESHOLDS = {
  EXCELLENT: 60, // Full quality
  GOOD: 45, // Slight reductions
  ACCEPTABLE: 30, // Moderate reductions
  POOR: 20, // Significant reductions
  CRITICAL: 15, // Minimal effects
} as const;

export const QUALITY_LEVELS = {
  ULTRA: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  MINIMUM: 1,
} as const;

export type QualityLevel = (typeof QUALITY_LEVELS)[keyof typeof QUALITY_LEVELS];

// ============================================
// Effect Categories
// ============================================

export interface EffectSettings {
  // Particle effects
  particleCount: number; // Multiplier (0-1)
  particleQuality: QualityLevel;
  engineTrails: boolean;
  explosionDetail: QualityLevel;
  debrisCount: number;

  // Lighting & post-processing
  dynamicLighting: boolean;
  bloomEffect: boolean;
  motionBlur: boolean;
  screenShake: boolean;
  ambientOcclusion: boolean;

  // Weapon effects
  laserDetail: QualityLevel;
  missileTrails: boolean;
  shieldFlicker: boolean;
  hitSparks: boolean;

  // Ship rendering
  shipLOD: QualityLevel; // Level of detail
  shadowQuality: QualityLevel;
  reflections: boolean;
  shipTextures: QualityLevel;

  // UI & HUD
  hudAnimations: boolean;
  minimapDetail: QualityLevel;
  damageIndicators: boolean;

  // Audio (can affect performance too)
  spatialAudio: boolean;
  simultaneousSounds: number;
}

// ============================================
// Quality Presets
// ============================================

export const QUALITY_PRESETS: Record<QualityLevel, EffectSettings> = {
  [QUALITY_LEVELS.ULTRA]: {
    particleCount: 1.0,
    particleQuality: QUALITY_LEVELS.ULTRA,
    engineTrails: true,
    explosionDetail: QUALITY_LEVELS.ULTRA,
    debrisCount: 50,
    dynamicLighting: true,
    bloomEffect: true,
    motionBlur: true,
    screenShake: true,
    ambientOcclusion: true,
    laserDetail: QUALITY_LEVELS.ULTRA,
    missileTrails: true,
    shieldFlicker: true,
    hitSparks: true,
    shipLOD: QUALITY_LEVELS.ULTRA,
    shadowQuality: QUALITY_LEVELS.ULTRA,
    reflections: true,
    shipTextures: QUALITY_LEVELS.ULTRA,
    hudAnimations: true,
    minimapDetail: QUALITY_LEVELS.ULTRA,
    damageIndicators: true,
    spatialAudio: true,
    simultaneousSounds: 32,
  },
  [QUALITY_LEVELS.HIGH]: {
    particleCount: 0.8,
    particleQuality: QUALITY_LEVELS.HIGH,
    engineTrails: true,
    explosionDetail: QUALITY_LEVELS.HIGH,
    debrisCount: 30,
    dynamicLighting: true,
    bloomEffect: true,
    motionBlur: true,
    screenShake: true,
    ambientOcclusion: false,
    laserDetail: QUALITY_LEVELS.HIGH,
    missileTrails: true,
    shieldFlicker: true,
    hitSparks: true,
    shipLOD: QUALITY_LEVELS.HIGH,
    shadowQuality: QUALITY_LEVELS.HIGH,
    reflections: true,
    shipTextures: QUALITY_LEVELS.HIGH,
    hudAnimations: true,
    minimapDetail: QUALITY_LEVELS.HIGH,
    damageIndicators: true,
    spatialAudio: true,
    simultaneousSounds: 24,
  },
  [QUALITY_LEVELS.MEDIUM]: {
    particleCount: 0.5,
    particleQuality: QUALITY_LEVELS.MEDIUM,
    engineTrails: true,
    explosionDetail: QUALITY_LEVELS.MEDIUM,
    debrisCount: 15,
    dynamicLighting: true,
    bloomEffect: true,
    motionBlur: false,
    screenShake: true,
    ambientOcclusion: false,
    laserDetail: QUALITY_LEVELS.MEDIUM,
    missileTrails: true,
    shieldFlicker: true,
    hitSparks: true,
    shipLOD: QUALITY_LEVELS.MEDIUM,
    shadowQuality: QUALITY_LEVELS.MEDIUM,
    reflections: false,
    shipTextures: QUALITY_LEVELS.MEDIUM,
    hudAnimations: true,
    minimapDetail: QUALITY_LEVELS.MEDIUM,
    damageIndicators: true,
    spatialAudio: true,
    simultaneousSounds: 16,
  },
  [QUALITY_LEVELS.LOW]: {
    particleCount: 0.25,
    particleQuality: QUALITY_LEVELS.LOW,
    engineTrails: false,
    explosionDetail: QUALITY_LEVELS.LOW,
    debrisCount: 5,
    dynamicLighting: false,
    bloomEffect: false,
    motionBlur: false,
    screenShake: true,
    ambientOcclusion: false,
    laserDetail: QUALITY_LEVELS.LOW,
    missileTrails: false,
    shieldFlicker: false,
    hitSparks: true,
    shipLOD: QUALITY_LEVELS.LOW,
    shadowQuality: QUALITY_LEVELS.LOW,
    reflections: false,
    shipTextures: QUALITY_LEVELS.LOW,
    hudAnimations: false,
    minimapDetail: QUALITY_LEVELS.LOW,
    damageIndicators: true,
    spatialAudio: false,
    simultaneousSounds: 8,
  },
  [QUALITY_LEVELS.MINIMUM]: {
    particleCount: 0.1,
    particleQuality: QUALITY_LEVELS.MINIMUM,
    engineTrails: false,
    explosionDetail: QUALITY_LEVELS.MINIMUM,
    debrisCount: 0,
    dynamicLighting: false,
    bloomEffect: false,
    motionBlur: false,
    screenShake: false,
    ambientOcclusion: false,
    laserDetail: QUALITY_LEVELS.MINIMUM,
    missileTrails: false,
    shieldFlicker: false,
    hitSparks: false,
    shipLOD: QUALITY_LEVELS.MINIMUM,
    shadowQuality: QUALITY_LEVELS.MINIMUM,
    reflections: false,
    shipTextures: QUALITY_LEVELS.MINIMUM,
    hudAnimations: false,
    minimapDetail: QUALITY_LEVELS.MINIMUM,
    damageIndicators: true,
    spatialAudio: false,
    simultaneousSounds: 4,
  },
};

// ============================================
// Battle Size Profiles
// ============================================

export interface BattleSizeProfile {
  readonly name: string;
  readonly maxShips: number;
  readonly recommendedQuality: QualityLevel;
  readonly minQuality: QualityLevel;
  readonly effectMultiplier: number;
}

export const BATTLE_SIZE_PROFILES: BattleSizeProfile[] = [
  {
    name: 'Skirmish',
    maxShips: 8,
    recommendedQuality: QUALITY_LEVELS.ULTRA,
    minQuality: QUALITY_LEVELS.HIGH,
    effectMultiplier: 1.0,
  },
  {
    name: 'Standard',
    maxShips: 16,
    recommendedQuality: QUALITY_LEVELS.HIGH,
    minQuality: QUALITY_LEVELS.MEDIUM,
    effectMultiplier: 0.9,
  },
  {
    name: 'Large',
    maxShips: 32,
    recommendedQuality: QUALITY_LEVELS.MEDIUM,
    minQuality: QUALITY_LEVELS.LOW,
    effectMultiplier: 0.7,
  },
  {
    name: 'Epic',
    maxShips: 64,
    recommendedQuality: QUALITY_LEVELS.LOW,
    minQuality: QUALITY_LEVELS.MINIMUM,
    effectMultiplier: 0.5,
  },
  {
    name: 'Massive',
    maxShips: 128,
    recommendedQuality: QUALITY_LEVELS.MINIMUM,
    minQuality: QUALITY_LEVELS.MINIMUM,
    effectMultiplier: 0.3,
  },
];

// ============================================
// Performance Monitor State
// ============================================

export interface PerformanceState {
  // FPS tracking
  currentFPS: number;
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  fpsHistory: number[];

  // Frame timing
  frameTimeMs: number;
  frameTimes: number[];

  // Quality settings
  currentQuality: QualityLevel;
  targetQuality: QualityLevel;
  effectSettings: EffectSettings;

  // Adaptive mode
  isAdaptive: boolean;
  qualityLocked: boolean;
  lastQualityChange: number;
  qualityStabilityTime: number;

  // Battle context
  shipCount: number;
  activeEffectCount: number;

  // Memory (if available)
  memoryUsageMB: number;

  // Network (for multiplayer)
  networkLatencyMs: number;
  packetLoss: number;
}

// ============================================
// Performance Monitor
// ============================================

const FPS_SAMPLE_SIZE = 60;
const FRAME_TIME_SAMPLE_SIZE = 30;
const QUALITY_CHANGE_COOLDOWN_MS = 3000;
const STABILITY_TIME_BEFORE_UPGRADE = 5000;

/**
 * Create initial performance state
 */
export function createPerformanceState(): PerformanceState {
  return {
    currentFPS: 60,
    averageFPS: 60,
    minFPS: 60,
    maxFPS: 60,
    fpsHistory: [],
    frameTimeMs: 16.67,
    frameTimes: [],
    currentQuality: QUALITY_LEVELS.HIGH,
    targetQuality: QUALITY_LEVELS.HIGH,
    effectSettings: { ...QUALITY_PRESETS[QUALITY_LEVELS.HIGH] },
    isAdaptive: true,
    qualityLocked: false,
    lastQualityChange: 0,
    qualityStabilityTime: 0,
    shipCount: 0,
    activeEffectCount: 0,
    memoryUsageMB: 0,
    networkLatencyMs: 0,
    packetLoss: 0,
  };
}

/**
 * Update FPS tracking
 */
export function updateFPS(state: PerformanceState, deltaMs: number): PerformanceState {
  const fps = 1000 / deltaMs;
  const newState = { ...state };

  // Add to history
  newState.fpsHistory = [...state.fpsHistory, fps].slice(-FPS_SAMPLE_SIZE);
  newState.frameTimes = [...state.frameTimes, deltaMs].slice(-FRAME_TIME_SAMPLE_SIZE);

  // Calculate metrics
  newState.currentFPS = fps;
  newState.frameTimeMs = deltaMs;

  if (newState.fpsHistory.length > 0) {
    newState.averageFPS = newState.fpsHistory.reduce((a, b) => a + b, 0) / newState.fpsHistory.length;
    newState.minFPS = Math.min(...newState.fpsHistory);
    newState.maxFPS = Math.max(...newState.fpsHistory);
  }

  return newState;
}

/**
 * Evaluate and potentially adjust quality level
 */
export function evaluateQuality(
  state: PerformanceState,
  currentTime: number
): PerformanceState {
  if (state.qualityLocked || !state.isAdaptive) {
    return state;
  }

  const newState = { ...state };
  const timeSinceLastChange = currentTime - state.lastQualityChange;

  // Don't change too frequently
  if (timeSinceLastChange < QUALITY_CHANGE_COOLDOWN_MS) {
    return newState;
  }

  const avgFPS = state.averageFPS;
  let newQuality = state.currentQuality;

  // Determine if we need to downgrade
  if (avgFPS < FPS_THRESHOLDS.CRITICAL) {
    newQuality = QUALITY_LEVELS.MINIMUM;
  } else if (avgFPS < FPS_THRESHOLDS.POOR) {
    newQuality = Math.max(QUALITY_LEVELS.MINIMUM, state.currentQuality - 1) as QualityLevel;
  } else if (avgFPS < FPS_THRESHOLDS.ACCEPTABLE) {
    if (state.currentQuality > QUALITY_LEVELS.LOW) {
      newQuality = (state.currentQuality - 1) as QualityLevel;
    }
  }
  // Determine if we can upgrade
  else if (avgFPS >= FPS_THRESHOLDS.EXCELLENT && state.minFPS >= FPS_THRESHOLDS.GOOD) {
    newState.qualityStabilityTime += QUALITY_CHANGE_COOLDOWN_MS;

    if (newState.qualityStabilityTime >= STABILITY_TIME_BEFORE_UPGRADE) {
      if (state.currentQuality < QUALITY_LEVELS.ULTRA) {
        newQuality = (state.currentQuality + 1) as QualityLevel;
        newState.qualityStabilityTime = 0;
      }
    }
  } else {
    // Reset stability timer if not consistently excellent
    newState.qualityStabilityTime = 0;
  }

  // Apply quality change
  if (newQuality !== state.currentQuality) {
    newState.currentQuality = newQuality;
    newState.targetQuality = newQuality;
    newState.effectSettings = { ...QUALITY_PRESETS[newQuality] };
    newState.lastQualityChange = currentTime;
  }

  return newState;
}

/**
 * Get recommended quality for battle size
 */
export function getRecommendedQuality(
  shipCount: number,
  playerFPSHistory?: number[]
): QualityLevel {
  // Find appropriate battle size profile
  const profile = BATTLE_SIZE_PROFILES.find(p => shipCount <= p.maxShips)
    ?? BATTLE_SIZE_PROFILES[BATTLE_SIZE_PROFILES.length - 1]!;

  // If we have FPS history, use it to adjust
  if (playerFPSHistory && playerFPSHistory.length > 0) {
    const avgFPS = playerFPSHistory.reduce((a, b) => a + b, 0) / playerFPSHistory.length;

    // Player has shown they can handle higher quality
    if (avgFPS >= FPS_THRESHOLDS.EXCELLENT) {
      return Math.min(QUALITY_LEVELS.ULTRA, profile.recommendedQuality + 1) as QualityLevel;
    }

    // Player is struggling
    if (avgFPS < FPS_THRESHOLDS.ACCEPTABLE) {
      return profile.minQuality;
    }
  }

  return profile.recommendedQuality;
}

/**
 * Set quality level manually
 */
export function setQualityLevel(
  state: PerformanceState,
  quality: QualityLevel,
  lockQuality: boolean = false
): PerformanceState {
  return {
    ...state,
    currentQuality: quality,
    targetQuality: quality,
    effectSettings: { ...QUALITY_PRESETS[quality] },
    qualityLocked: lockQuality,
    lastQualityChange: Date.now(),
  };
}

/**
 * Apply battle size scaling to effect settings
 */
export function applyBattleSizeScaling(
  settings: EffectSettings,
  shipCount: number
): EffectSettings {
  const profile = BATTLE_SIZE_PROFILES.find(p => shipCount <= p.maxShips)
    ?? BATTLE_SIZE_PROFILES[BATTLE_SIZE_PROFILES.length - 1]!;

  const multiplier = profile.effectMultiplier;

  return {
    ...settings,
    particleCount: settings.particleCount * multiplier,
    debrisCount: Math.floor(settings.debrisCount * multiplier),
    simultaneousSounds: Math.floor(settings.simultaneousSounds * multiplier),
  };
}

/**
 * Get effect count budget based on current quality
 */
export function getEffectBudget(quality: QualityLevel): {
  maxParticles: number;
  maxTrails: number;
  maxLights: number;
  maxSounds: number;
} {
  const budgets: Record<QualityLevel, ReturnType<typeof getEffectBudget>> = {
    [QUALITY_LEVELS.ULTRA]: {
      maxParticles: 10000,
      maxTrails: 200,
      maxLights: 50,
      maxSounds: 32,
    },
    [QUALITY_LEVELS.HIGH]: {
      maxParticles: 5000,
      maxTrails: 100,
      maxLights: 30,
      maxSounds: 24,
    },
    [QUALITY_LEVELS.MEDIUM]: {
      maxParticles: 2000,
      maxTrails: 50,
      maxLights: 15,
      maxSounds: 16,
    },
    [QUALITY_LEVELS.LOW]: {
      maxParticles: 500,
      maxTrails: 20,
      maxLights: 5,
      maxSounds: 8,
    },
    [QUALITY_LEVELS.MINIMUM]: {
      maxParticles: 100,
      maxTrails: 5,
      maxLights: 2,
      maxSounds: 4,
    },
  };

  return budgets[quality];
}

// ============================================
// Per-Player Quality (Multiplayer)
// ============================================

export interface PlayerPerformanceProfile {
  playerId: string;
  qualityLevel: QualityLevel;
  averageFPS: number;
  networkLatency: number;
  isLagging: boolean;
}

/**
 * Calculate optimal quality per player in multiplayer
 */
export function calculatePlayerQualities(
  players: PlayerPerformanceProfile[],
  totalShipCount: number
): Map<string, EffectSettings> {
  const result = new Map<string, EffectSettings>();

  for (const player of players) {
    let quality = player.qualityLevel;

    // Downgrade if player is lagging
    if (player.isLagging || player.averageFPS < FPS_THRESHOLDS.POOR) {
      quality = Math.max(QUALITY_LEVELS.MINIMUM, quality - 1) as QualityLevel;
    }

    // Downgrade for high latency (reduces visual complexity to help sync)
    if (player.networkLatency > 150) {
      quality = Math.max(QUALITY_LEVELS.MINIMUM, quality - 1) as QualityLevel;
    }

    let settings = { ...QUALITY_PRESETS[quality] };
    settings = applyBattleSizeScaling(settings, totalShipCount);

    result.set(player.playerId, settings);
  }

  return result;
}

// ============================================
// Diagnostic Output
// ============================================

export interface PerformanceDiagnostics {
  fps: string;
  quality: string;
  particles: string;
  memory: string;
  recommendations: string[];
}

/**
 * Get human-readable diagnostics
 */
export function getDiagnostics(state: PerformanceState): PerformanceDiagnostics {
  const recommendations: string[] = [];

  if (state.averageFPS < FPS_THRESHOLDS.POOR) {
    recommendations.push('Consider reducing battle size');
    recommendations.push('Disable post-processing effects');
  } else if (state.averageFPS < FPS_THRESHOLDS.ACCEPTABLE) {
    recommendations.push('Some visual effects have been reduced');
  }

  if (state.memoryUsageMB > 1500) {
    recommendations.push('High memory usage detected');
  }

  if (state.networkLatencyMs > 100) {
    recommendations.push('Network latency may affect gameplay');
  }

  const qualityNames: Record<QualityLevel, string> = {
    [QUALITY_LEVELS.ULTRA]: 'Ultra',
    [QUALITY_LEVELS.HIGH]: 'High',
    [QUALITY_LEVELS.MEDIUM]: 'Medium',
    [QUALITY_LEVELS.LOW]: 'Low',
    [QUALITY_LEVELS.MINIMUM]: 'Minimum',
  };

  return {
    fps: `${Math.round(state.averageFPS)} FPS (${Math.round(state.minFPS)}-${Math.round(state.maxFPS)})`,
    quality: `${qualityNames[state.currentQuality]}${state.qualityLocked ? ' (Locked)' : state.isAdaptive ? ' (Adaptive)' : ''}`,
    particles: `${Math.round(state.effectSettings.particleCount * 100)}% particle density`,
    memory: state.memoryUsageMB > 0 ? `${Math.round(state.memoryUsageMB)} MB` : 'N/A',
    recommendations,
  };
}

/**
 * Toggle specific effect
 */
export function toggleEffect<K extends keyof EffectSettings>(
  state: PerformanceState,
  effectKey: K,
  value: EffectSettings[K]
): PerformanceState {
  return {
    ...state,
    effectSettings: {
      ...state.effectSettings,
      [effectKey]: value,
    },
  };
}

/**
 * Reset to defaults for quality level
 */
export function resetToDefaults(
  state: PerformanceState,
  quality?: QualityLevel
): PerformanceState {
  const q = quality ?? state.currentQuality;
  return {
    ...state,
    currentQuality: q,
    targetQuality: q,
    effectSettings: { ...QUALITY_PRESETS[q] },
    qualityLocked: false,
  };
}
