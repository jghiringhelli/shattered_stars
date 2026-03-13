/**
 * AI Brain
 * Core decision-making system using utility-based AI
 */

import type { ShipState, ManeuverDefinition, ActionType } from '../core/types';
import type {
  AIContext,
  AIPersonality,
  ManeuverDecision,
  ActionDecision,
  TargetDecision,
  Consideration,
} from './AITypes';
import { FACTION_PERSONALITIES } from './AITypes';
import {
  createDamagePotentialConsideration,
  createTargetVulnerabilityConsideration,
  createThreatAssessmentConsideration,
  createAttackPositionConsideration,
  createRangeOptimizationConsideration,
  createDangerAvoidanceConsideration,
  createStressConsideration,
  createFormationConsideration,
  createFocusValueConsideration,
  createEvadeValueConsideration,
  createTargetLockValueConsideration,
} from './Considerations';
import { getValidManeuvers, angleToTarget } from '../systems/MovementSystem';
import { getAvailableActions } from '../systems/ActionsSystem';
import { getValidTargets } from '../systems/TargetingSystem';
import {
  type AIDifficultyLevel,
  DIFFICULTY_SETTINGS,
} from './AIDifficulty';

// ============================================
// Utility Calculation
// ============================================

/**
 * Calculate weighted score from considerations
 */
function calculateUtility(
  considerations: Consideration[],
  context: AIContext
): number {
  if (considerations.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const consideration of considerations) {
    const score = consideration.evaluate(context);
    const weight = consideration.weight;

    weightedSum += score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// ============================================
// Decision Functions
// ============================================

/**
 * Decide which maneuver to execute
 */
export function decideManeuver(
  ship: ShipState,
  availableManeuvers: readonly ManeuverDefinition[],
  allShips: readonly ShipState[],
  turnNumber: number,
  difficulty: AIDifficultyLevel = 'normal'
): ManeuverDecision {
  const personality = getPersonality(ship.faction);
  const context = createContext(ship, allShips, turnNumber, personality);

  const validManeuvers = getValidManeuvers(availableManeuvers, ship.isStressed);

  if (validManeuvers.length === 0) {
    // Fallback: straight speed 2
    return {
      type: 'maneuver',
      shipId: ship.id,
      maneuver: { direction: 'straight', speed: 2, difficulty: 'white' },
      score: 0,
      reasoning: 'No valid maneuvers, using fallback',
    };
  }

  const mods = DIFFICULTY_SETTINGS[difficulty];

  // On lower difficulties, randomly pick a maneuver instead of the optimal one
  if (Math.random() >= mods.maneuverQuality) {
    const randomIndex = Math.floor(Math.random() * validManeuvers.length);
    const randomManeuver = validManeuvers[randomIndex]!;
    return {
      type: 'maneuver',
      shipId: ship.id,
      maneuver: randomManeuver,
      score: 0,
      reasoning: `Random maneuver (difficulty: ${difficulty})`,
    };
  }

  // Score each maneuver
  const scored = validManeuvers.map((maneuver) => {
    const considerations: Consideration[] = [
      createAttackPositionConsideration(maneuver, context.enemies),
      createRangeOptimizationConsideration(
        maneuver,
        personality.positioning_aggressive > 0.5 ? 1 : 2,
        context.enemies
      ),
      createDangerAvoidanceConsideration(maneuver),
      createStressConsideration(maneuver),
      createFormationConsideration(maneuver),
    ];

    // Adjust weights based on personality
    considerations[0]!.weight = personality.aggression;
    considerations[1]!.weight = personality.positioning_aggressive;
    considerations[2]!.weight = personality.caution;
    considerations[3]!.weight = 1 - personality.maneuver_stress_tolerance;
    considerations[4]!.weight = personality.formation_cohesion;

    const score = calculateUtility(considerations, context);

    return { maneuver, score };
  });

  // Sort by score and pick best
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;

  return {
    type: 'maneuver',
    shipId: ship.id,
    maneuver: best.maneuver,
    score: best.score,
    reasoning: `Best maneuver: ${best.maneuver.direction} speed ${best.maneuver.speed} (score: ${best.score.toFixed(2)})`,
  };
}

/**
 * Decide which action to take after movement
 */
export function decideAction(
  ship: ShipState,
  actionBar: readonly ActionType[],
  allShips: readonly ShipState[],
  turnNumber: number,
  difficulty: AIDifficultyLevel = 'normal'
): ActionDecision | null {
  const personality = getPersonality(ship.faction);
  const context = createContext(ship, allShips, turnNumber, personality);

  const availableActions = getAvailableActions(ship, actionBar);

  if (availableActions.length === 0) {
    return null;
  }

  const mods = DIFFICULTY_SETTINGS[difficulty];

  // On lower difficulties, randomly pick an action
  if (Math.random() >= mods.decisionQuality) {
    const randomIndex = Math.floor(Math.random() * availableActions.length);
    const randomAction = availableActions[randomIndex]!;
    const result: ActionDecision = {
      type: 'action',
      shipId: ship.id,
      action: randomAction,
      score: 0,
      reasoning: `Random action (difficulty: ${difficulty})`,
    };
    // target_lock requires a valid target even in random mode
    if (randomAction === 'target_lock') {
      const targets = getValidTargets(ship, context.enemies, false);
      if (targets.length > 0) {
        const randomTarget = targets[Math.floor(Math.random() * targets.length)]!;
        return { ...result, targetId: randomTarget.targetId };
      }
      // No valid targets — fall through to optimal path
    } else {
      return result;
    }
  }

  const scored: Array<{ action: ActionType; score: number; targetId?: string }> = [];

  for (const action of availableActions) {
    switch (action) {
      case 'focus': {
        const consideration = createFocusValueConsideration();
        const score = consideration.evaluate(context) * personality.action_focus_preference;
        scored.push({ action, score });
        break;
      }

      case 'evade': {
        const consideration = createEvadeValueConsideration();
        const score = consideration.evaluate(context) * personality.action_evade_preference;
        scored.push({ action, score });
        break;
      }

      case 'target_lock': {
        // Find best target to lock
        const targets = getValidTargets(ship, context.enemies, false);
        for (const targetInfo of targets) {
          const target = context.enemies.find((e) => e.id === targetInfo.targetId);
          if (!target) continue;

          const consideration = createTargetLockValueConsideration(target);
          const score = consideration.evaluate(context) * personality.action_lock_preference;
          scored.push({ action, score, targetId: target.id });
        }
        break;
      }

      case 'barrel_roll':
      case 'boost': {
        // Repositioning actions - value based on positioning needs (using correct angle convention)
        const needsReposition =
          context.enemies.some((e) => {
            const angle = angleToTarget(ship.x, ship.y, e.x, e.y);
            return Math.abs(angle - ship.angle) > 60;
          });
        scored.push({ action, score: needsReposition ? 0.5 : 0.2 });
        break;
      }

      default:
        // Other actions get base score
        scored.push({ action, score: 0.3 });
    }
  }

  if (scored.length === 0) return null;

  // Sort and pick best
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;

  const result: ActionDecision = {
    type: 'action',
    shipId: ship.id,
    action: best.action,
    score: best.score,
    reasoning: `Best action: ${best.action} (score: ${best.score.toFixed(2)})`,
  };

  // Only add targetId if it exists
  if (best.targetId !== undefined) {
    return { ...result, targetId: best.targetId };
  }

  return result;
}

/**
 * Decide which target to attack
 */
export function decideTarget(
  ship: ShipState,
  allShips: readonly ShipState[],
  turnNumber: number,
  difficulty: AIDifficultyLevel = 'normal'
): TargetDecision | null {
  const personality = getPersonality(ship.faction);
  const context = createContext(ship, allShips, turnNumber, personality);

  const validTargets = getValidTargets(ship, context.enemies, true);

  if (validTargets.length === 0) {
    return null;
  }

  const mods = DIFFICULTY_SETTINGS[difficulty];

  // On lower difficulties, randomly pick a target
  if (Math.random() >= mods.targetSelectionQuality) {
    const randomIndex = Math.floor(Math.random() * validTargets.length);
    const randomTarget = validTargets[randomIndex]!;
    return {
      type: 'target',
      shipId: ship.id,
      targetId: randomTarget.targetId,
      score: 0,
      reasoning: `Random target (difficulty: ${difficulty})`,
    };
  }

  // Score each target
  const scored = validTargets.map((targetInfo) => {
    const target = context.enemies.find((e) => e.id === targetInfo.targetId)!;

    const considerations: Consideration[] = [
      createDamagePotentialConsideration(target),
      createTargetVulnerabilityConsideration(target),
      createThreatAssessmentConsideration(target),
    ];

    // Adjust weights based on personality
    considerations[0]!.weight = personality.aggression;
    considerations[1]!.weight = personality.target_priority_damaged;
    considerations[2]!.weight = personality.target_priority_threat;

    const score = calculateUtility(considerations, context);

    return { targetId: target.id, score };
  });

  // Apply focus fire - boost score if allies are also targeting
  if (personality.focus_fire > 0.5) {
    // Count how many allies might target each enemy
    // (Simplified: just prefer damaged targets as proxy for focus fire)
    for (const item of scored) {
      const target = context.enemies.find((e) => e.id === item.targetId);
      if (target && target.hull < target.maxHull) {
        item.score *= 1 + personality.focus_fire * 0.3;
      }
    }
  }

  // Sort and pick best
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;

  return {
    type: 'target',
    shipId: ship.id,
    targetId: best.targetId,
    score: best.score,
    reasoning: `Best target: ${best.targetId} (score: ${best.score.toFixed(2)})`,
  };
}

// ============================================
// Helper Functions
// ============================================

function getPersonality(faction: string): AIPersonality {
  return FACTION_PERSONALITIES[faction] ?? FACTION_PERSONALITIES.terran_hegemony!;
}

function createContext(
  ship: ShipState,
  allShips: readonly ShipState[],
  turnNumber: number,
  personality: AIPersonality
): AIContext {
  const allies = allShips.filter(
    (s) => s.id !== ship.id && s.faction === ship.faction && s.hull > 0
  );
  const enemies = allShips.filter(
    (s) => s.faction !== ship.faction && s.hull > 0
  );

  return {
    self: ship,
    allies,
    enemies,
    allShips,
    turnNumber,
    personality,
  };
}

// ============================================
// Batch Decision Making
// ============================================

/**
 * Make all planning phase decisions for AI ships
 */
export function planAIManeuvers(
  aiShips: readonly ShipState[],
  allShips: readonly ShipState[],
  getManeuverDial: (ship: ShipState) => readonly ManeuverDefinition[],
  turnNumber: number
): Map<string, ManeuverDefinition> {
  const decisions = new Map<string, ManeuverDefinition>();

  for (const ship of aiShips) {
    if (ship.hull <= 0) continue;

    const dial = getManeuverDial(ship);
    const decision = decideManeuver(ship, dial, allShips, turnNumber);
    decisions.set(ship.id, decision.maneuver);
  }

  return decisions;
}

/**
 * Make action decision for an AI ship
 */
export function planAIAction(
  ship: ShipState,
  actionBar: readonly ActionType[],
  allShips: readonly ShipState[],
  turnNumber: number
): ActionDecision | null {
  return decideAction(ship, actionBar, allShips, turnNumber);
}

/**
 * Make attack decision for an AI ship
 */
export function planAIAttack(
  ship: ShipState,
  allShips: readonly ShipState[],
  turnNumber: number
): TargetDecision | null {
  return decideTarget(ship, allShips, turnNumber);
}
