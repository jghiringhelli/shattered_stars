/**
 * AI System Types
 * Defines types for the utility-based AI system
 */

import type { ShipState, ManeuverDefinition, ActionType } from '../core/types';

// ============================================
// AI Decision Types
// ============================================

export type AIDecisionType =
  | 'maneuver'
  | 'action'
  | 'target'
  | 'attack';

export interface AIDecision {
  readonly type: AIDecisionType;
  readonly shipId: string;
  readonly score: number;
  readonly reasoning: string;
}

export interface ManeuverDecision extends AIDecision {
  readonly type: 'maneuver';
  readonly maneuver: ManeuverDefinition;
}

export interface ActionDecision extends AIDecision {
  readonly type: 'action';
  readonly action: ActionType;
  readonly targetId?: string; // For target lock, coordinate, jam
}

export interface TargetDecision extends AIDecision {
  readonly type: 'target';
  readonly targetId: string;
}

export interface AttackDecision extends AIDecision {
  readonly type: 'attack';
  readonly targetId: string;
  readonly useTargetLock: boolean;
  readonly useFocus: boolean;
}

// ============================================
// Utility Considerations
// ============================================

/**
 * A consideration is a factor that influences AI decisions
 * Each returns a normalized score (0-1)
 */
export interface Consideration {
  readonly name: string;
  weight: number; // Mutable for personality adjustments
  evaluate(context: AIContext): number;
}

/**
 * Context provided to AI for decision making
 */
export interface AIContext {
  readonly self: ShipState;
  readonly allies: readonly ShipState[];
  readonly enemies: readonly ShipState[];
  readonly allShips: readonly ShipState[];
  readonly turnNumber: number;
  readonly personality: AIPersonality;
}

// ============================================
// AI Personality (Faction-Specific Weights)
// ============================================

export interface AIPersonality {
  readonly id: string;
  readonly name: string;

  // Combat preferences (0-1)
  readonly aggression: number; // Higher = prioritize damage over survival
  readonly caution: number; // Higher = prioritize survival over damage
  readonly focus_fire: number; // Higher = coordinate attacks on single target
  readonly target_priority_damaged: number; // Higher = prioritize finishing wounded targets
  readonly target_priority_threat: number; // Higher = prioritize high-damage enemies

  // Movement preferences
  readonly positioning_aggressive: number; // Higher = close range preference
  readonly positioning_flanking: number; // Higher = try to get behind enemies
  readonly formation_cohesion: number; // Higher = stay near allies

  // Action preferences
  readonly action_focus_preference: number; // How much to value focus token
  readonly action_evade_preference: number; // How much to value evade token
  readonly action_lock_preference: number; // How much to value target lock

  // Maneuver preferences
  readonly maneuver_speed_preference: number; // 0 = slow, 1 = fast
  readonly maneuver_stress_tolerance: number; // How willing to take stress
}

// ============================================
// Default Faction Personalities
// ============================================

export const FACTION_PERSONALITIES: Record<string, AIPersonality> = {
  terran_hegemony: {
    id: 'terran_hegemony',
    name: 'Terran Hegemony',
    aggression: 0.6,
    caution: 0.5,
    focus_fire: 0.7, // Military discipline
    target_priority_damaged: 0.6,
    target_priority_threat: 0.7,
    positioning_aggressive: 0.5,
    positioning_flanking: 0.4,
    formation_cohesion: 0.8, // Strong formation tactics
    action_focus_preference: 0.7,
    action_evade_preference: 0.5,
    action_lock_preference: 0.8, // Precise targeting
    maneuver_speed_preference: 0.5,
    maneuver_stress_tolerance: 0.4,
  },

  free_confederation: {
    id: 'free_confederation',
    name: 'Free Confederation',
    aggression: 0.5,
    caution: 0.6,
    focus_fire: 0.5,
    target_priority_damaged: 0.5,
    target_priority_threat: 0.6,
    positioning_aggressive: 0.4,
    positioning_flanking: 0.6, // Guerrilla tactics
    formation_cohesion: 0.5,
    action_focus_preference: 0.6,
    action_evade_preference: 0.7, // Survivability focus
    action_lock_preference: 0.5,
    maneuver_speed_preference: 0.6,
    maneuver_stress_tolerance: 0.5,
  },

  synthetic_collective: {
    id: 'synthetic_collective',
    name: 'Synthetic Collective',
    aggression: 0.7,
    caution: 0.3, // Expendable units
    focus_fire: 0.9, // Perfect coordination
    target_priority_damaged: 0.8, // Efficient elimination
    target_priority_threat: 0.5,
    positioning_aggressive: 0.7,
    positioning_flanking: 0.3,
    formation_cohesion: 0.9, // Hive mind
    action_focus_preference: 0.8, // Calculate/focus
    action_evade_preference: 0.2,
    action_lock_preference: 0.7,
    maneuver_speed_preference: 0.5,
    maneuver_stress_tolerance: 0.7, // Don't feel stress
  },

  void_corsairs: {
    id: 'void_corsairs',
    name: 'Void Corsairs',
    aggression: 0.8, // Aggressive raiders
    caution: 0.4,
    focus_fire: 0.4, // Chaotic
    target_priority_damaged: 0.7, // Finish prey
    target_priority_threat: 0.4,
    positioning_aggressive: 0.8, // Close and personal
    positioning_flanking: 0.7, // Ambush tactics
    formation_cohesion: 0.3, // Loose organization
    action_focus_preference: 0.5,
    action_evade_preference: 0.4,
    action_lock_preference: 0.4,
    maneuver_speed_preference: 0.8, // Fast and aggressive
    maneuver_stress_tolerance: 0.6,
  },

  ascendant_empire: {
    id: 'ascendant_empire',
    name: 'Ascendant Empire',
    aggression: 0.5,
    caution: 0.7, // Preserve valuable ships
    focus_fire: 0.6,
    target_priority_damaged: 0.5,
    target_priority_threat: 0.8, // Remove threats to elites
    positioning_aggressive: 0.3,
    positioning_flanking: 0.5,
    formation_cohesion: 0.7,
    action_focus_preference: 0.8, // Force powers
    action_evade_preference: 0.6,
    action_lock_preference: 0.6,
    maneuver_speed_preference: 0.4, // Measured approach
    maneuver_stress_tolerance: 0.3, // Avoid disrupting focus
  },
};

// ============================================
// AI State Tracking
// ============================================

export interface AIState {
  readonly personality: AIPersonality;
  readonly lastDecisions: Map<string, AIDecision>;
  readonly targetPriority: Map<string, number>;
  readonly threatAssessment: Map<string, number>;
}

export function createInitialAIState(personality: AIPersonality): AIState {
  return {
    personality,
    lastDecisions: new Map(),
    targetPriority: new Map(),
    threatAssessment: new Map(),
  };
}
