/**
 * AI Difficulty System
 *
 * Provides difficulty levels that modify AI behavior:
 * - Easy: Makes more mistakes, slower reactions, poor targeting
 * - Normal: Balanced gameplay, occasional mistakes
 * - Hard: Optimal decisions, good targeting, efficient
 * - Brutal: Perfect play, focus fire, no mercy
 */

import type { AIPersonality } from './AITypes';

export type AIDifficultyLevel = 'easy' | 'normal' | 'hard' | 'brutal';

export interface AIDifficultyModifiers {
  // Decision quality (0-1): Chance of making optimal decisions
  decisionQuality: number;

  // Reaction time multiplier: Higher = slower reactions (affects weapon cooldown)
  reactionTimeMultiplier: number;

  // Accuracy modifier: Multiplier on hit chance
  accuracyMultiplier: number;

  // Target selection quality: Chance of picking optimal target vs random
  targetSelectionQuality: number;

  // Maneuver quality: Chance of picking optimal maneuver
  maneuverQuality: number;

  // Coordination: How well AI ships work together (affects focus fire)
  coordinationBonus: number;

  // Aggression modifier: Scales personality aggression
  aggressionMultiplier: number;

  // Damage dealt multiplier (direct balance lever)
  damageMultiplier: number;

  // Damage taken multiplier (direct balance lever)
  damageTakenMultiplier: number;
}

export const DIFFICULTY_SETTINGS: Record<AIDifficultyLevel, AIDifficultyModifiers> = {
  easy: {
    decisionQuality: 0.4,
    reactionTimeMultiplier: 1.5,
    accuracyMultiplier: 0.7,
    targetSelectionQuality: 0.3,
    maneuverQuality: 0.4,
    coordinationBonus: 0,
    aggressionMultiplier: 0.8,
    damageMultiplier: 0.75,
    damageTakenMultiplier: 1.25,
  },
  normal: {
    decisionQuality: 0.7,
    reactionTimeMultiplier: 1.0,
    accuracyMultiplier: 1.0,
    targetSelectionQuality: 0.6,
    maneuverQuality: 0.7,
    coordinationBonus: 0.2,
    aggressionMultiplier: 1.0,
    damageMultiplier: 1.0,
    damageTakenMultiplier: 1.0,
  },
  hard: {
    decisionQuality: 0.9,
    reactionTimeMultiplier: 0.8,
    accuracyMultiplier: 1.15,
    targetSelectionQuality: 0.85,
    maneuverQuality: 0.9,
    coordinationBonus: 0.5,
    aggressionMultiplier: 1.1,
    damageMultiplier: 1.15,
    damageTakenMultiplier: 0.9,
  },
  brutal: {
    decisionQuality: 1.0,
    reactionTimeMultiplier: 0.6,
    accuracyMultiplier: 1.3,
    targetSelectionQuality: 1.0,
    maneuverQuality: 1.0,
    coordinationBonus: 1.0,
    aggressionMultiplier: 1.25,
    damageMultiplier: 1.3,
    damageTakenMultiplier: 0.75,
  },
};

export const DIFFICULTY_NAMES: Record<AIDifficultyLevel, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  brutal: 'Brutal',
};

export const DIFFICULTY_DESCRIPTIONS: Record<AIDifficultyLevel, string> = {
  easy: 'AI makes frequent mistakes and deals less damage',
  normal: 'Balanced challenge for most players',
  hard: 'AI plays efficiently with faster reactions',
  brutal: 'Perfect AI play - no mercy given',
};

/**
 * Apply difficulty modifiers to a personality
 */
export function applyDifficultyToPersonality(
  personality: AIPersonality,
  difficulty: AIDifficultyLevel
): AIPersonality {
  const mods = DIFFICULTY_SETTINGS[difficulty];

  return {
    ...personality,
    aggression: Math.min(1, personality.aggression * mods.aggressionMultiplier),
    focus_fire: Math.min(1, personality.focus_fire + mods.coordinationBonus * 0.3),
    formation_cohesion: Math.min(1, personality.formation_cohesion + mods.coordinationBonus * 0.2),
  };
}

/**
 * Check if AI should make optimal decision based on difficulty
 */
export function shouldMakeOptimalDecision(difficulty: AIDifficultyLevel): boolean {
  const mods = DIFFICULTY_SETTINGS[difficulty];
  return Math.random() < mods.decisionQuality;
}

/**
 * Get modified weapon cooldown based on difficulty
 */
export function getModifiedCooldown(baseCooldown: number, difficulty: AIDifficultyLevel): number {
  const mods = DIFFICULTY_SETTINGS[difficulty];
  return Math.round(baseCooldown * mods.reactionTimeMultiplier);
}

/**
 * Get modified hit chance based on difficulty
 */
export function getModifiedHitChance(baseChance: number, difficulty: AIDifficultyLevel): number {
  const mods = DIFFICULTY_SETTINGS[difficulty];
  return Math.min(0.95, baseChance * mods.accuracyMultiplier);
}

/**
 * Get modified damage based on difficulty
 */
export function getModifiedDamage(
  baseDamage: number,
  difficulty: AIDifficultyLevel,
  isAIAttacking: boolean
): number {
  const mods = DIFFICULTY_SETTINGS[difficulty];
  if (isAIAttacking) {
    return Math.round(baseDamage * mods.damageMultiplier);
  } else {
    // AI taking damage - apply inverse modifier
    return Math.round(baseDamage * mods.damageTakenMultiplier);
  }
}

/**
 * Should AI pick optimal target or random?
 */
export function shouldPickOptimalTarget(difficulty: AIDifficultyLevel): boolean {
  const mods = DIFFICULTY_SETTINGS[difficulty];
  return Math.random() < mods.targetSelectionQuality;
}

/**
 * Should AI pick optimal maneuver or random valid one?
 */
export function shouldPickOptimalManeuver(difficulty: AIDifficultyLevel): boolean {
  const mods = DIFFICULTY_SETTINGS[difficulty];
  return Math.random() < mods.maneuverQuality;
}
