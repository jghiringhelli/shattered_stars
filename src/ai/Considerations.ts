/**
 * AI Considerations
 * Individual factors that evaluate options for AI decisions
 * Each returns a normalized 0-1 score
 */

import type { ShipState, ManeuverDefinition } from '../core/types';
import type { AIContext, Consideration } from './AITypes';
import { distance, calculateRangeBand, angleToTarget, isInArc } from '../systems/MovementSystem';
import { resolveManeuver } from '../systems/MovementSystem';
import { getTargetInfo } from '../systems/TargetingSystem';

// ============================================
// Combat Considerations
// ============================================

/**
 * How much damage can we deal to a target?
 */
export function createDamagePotentialConsideration(
  target: ShipState
): Consideration {
  return {
    name: 'damage_potential',
    weight: 1.0,
    evaluate(context: AIContext): number {
      const info = getTargetInfo(context.self, target);

      if (!info.canAttackPrimary) return 0;

      // Base score from range (closer = more dice)
      let score = 0.5;
      if (info.range === 1) score = 1.0; // +1 attack die
      else if (info.range === 2) score = 0.7;
      else if (info.range === 3) score = 0.4;

      // Bonus for bullseye
      if (info.inBullseye) score += 0.2;

      // Penalty if target has evade
      if (target.hasEvade) score *= 0.8;

      return Math.min(1, score);
    },
  };
}

/**
 * How vulnerable is the target?
 */
export function createTargetVulnerabilityConsideration(
  target: ShipState
): Consideration {
  return {
    name: 'target_vulnerability',
    weight: 1.0,
    evaluate(_context: AIContext): number {
      // Low hull = more vulnerable
      const hullRatio = target.hull / target.maxHull;
      const hullScore = 1 - hullRatio;

      // No shields = more vulnerable
      const shieldScore = target.shields === 0 ? 0.3 : 0;

      // Stressed = can't do red maneuvers
      const stressScore = target.isStressed ? 0.2 : 0;

      return Math.min(1, hullScore * 0.5 + shieldScore + stressScore);
    },
  };
}

/**
 * How threatening is an enemy?
 */
export function createThreatAssessmentConsideration(
  enemy: ShipState
): Consideration {
  return {
    name: 'threat_assessment',
    weight: 1.0,
    evaluate(context: AIContext): number {
      const range = calculateRangeBand(context.self.x, context.self.y, enemy.x, enemy.y);

      // Closer = more threatening
      let score = range === null ? 0 : (4 - range) / 3;

      // Enemy has target lock on us = very threatening
      if (enemy.hasTargetLock === context.self.id) score += 0.3;

      // Enemy is in their attack arc towards us = threatening
      const angleToUs = angleToTarget(enemy.x, enemy.y, context.self.x, context.self.y);
      if (isInArc(enemy.angle, angleToUs, 90)) score += 0.2;

      // We have low hull = everything is more threatening
      const ourVulnerability = 1 - context.self.hull / context.self.maxHull;
      score *= 1 + ourVulnerability * 0.5;

      return Math.min(1, score);
    },
  };
}

// ============================================
// Movement Considerations
// ============================================

/**
 * Does this maneuver keep us in attack range?
 */
export function createAttackPositionConsideration(
  maneuver: ManeuverDefinition,
  targets: readonly ShipState[]
): Consideration {
  return {
    name: 'attack_position',
    weight: 1.0,
    evaluate(context: AIContext): number {
      if (targets.length === 0) return 0.5;

      // Simulate where we'd end up
      const result = resolveManeuver(
        context.self.x,
        context.self.y,
        context.self.angle,
        maneuver
      );

      // Check how many targets we'd have in arc
      let inArcCount = 0;
      let inRangeCount = 0;

      for (const target of targets) {
        const newRange = calculateRangeBand(
          result.targetX,
          result.targetY,
          target.x,
          target.y
        );

        if (newRange !== null) inRangeCount++;

        const angleToTarget_ = angleToTarget(
          result.targetX,
          result.targetY,
          target.x,
          target.y
        );
        if (isInArc(result.targetAngle, angleToTarget_, 90)) inArcCount++;
      }

      const arcScore = inArcCount / targets.length;
      const rangeScore = inRangeCount / targets.length;

      return arcScore * 0.7 + rangeScore * 0.3;
    },
  };
}

/**
 * Does this maneuver get us to optimal range?
 */
export function createRangeOptimizationConsideration(
  maneuver: ManeuverDefinition,
  preferredRange: number, // 1, 2, or 3
  targets: readonly ShipState[]
): Consideration {
  return {
    name: 'range_optimization',
    weight: 1.0,
    evaluate(context: AIContext): number {
      if (targets.length === 0) return 0.5;

      const result = resolveManeuver(
        context.self.x,
        context.self.y,
        context.self.angle,
        maneuver
      );

      // Find closest enemy and check range
      let bestScore = 0;
      for (const target of targets) {
        const newRange = calculateRangeBand(
          result.targetX,
          result.targetY,
          target.x,
          target.y
        );

        if (newRange === null) continue;

        // Score based on how close to preferred range
        const rangeDiff = Math.abs(newRange - preferredRange);
        const score = 1 - rangeDiff * 0.3;
        bestScore = Math.max(bestScore, score);
      }

      return bestScore;
    },
  };
}

/**
 * Does this maneuver avoid danger?
 */
export function createDangerAvoidanceConsideration(
  maneuver: ManeuverDefinition
): Consideration {
  return {
    name: 'danger_avoidance',
    weight: 1.0,
    evaluate(context: AIContext): number {
      const result = resolveManeuver(
        context.self.x,
        context.self.y,
        context.self.angle,
        maneuver
      );

      // Count enemies that would have us in arc
      let dangerCount = 0;
      for (const enemy of context.enemies) {
        const angleToUs = angleToTarget(
          enemy.x,
          enemy.y,
          result.targetX,
          result.targetY
        );
        if (isInArc(enemy.angle, angleToUs, 90)) {
          const range = calculateRangeBand(
            enemy.x,
            enemy.y,
            result.targetX,
            result.targetY
          );
          if (range !== null) dangerCount++;
        }
      }

      // Fewer enemies in position to attack = safer
      if (context.enemies.length === 0) return 1;
      return 1 - dangerCount / context.enemies.length;
    },
  };
}

/**
 * Does this maneuver cause stress?
 */
export function createStressConsideration(
  maneuver: ManeuverDefinition
): Consideration {
  return {
    name: 'stress_avoidance',
    weight: 1.0,
    evaluate(context: AIContext): number {
      // Already stressed? Avoid red maneuvers completely
      if (context.self.isStressed && maneuver.difficulty === 'red') {
        return 0;
      }

      // Score based on difficulty
      switch (maneuver.difficulty) {
        case 'green':
          return 1.0; // Removes stress
        case 'white':
          return 0.7;
        case 'red':
          return 0.3 * context.personality.maneuver_stress_tolerance;
        default:
          return 0.5;
      }
    },
  };
}

/**
 * Does this maneuver keep formation with allies?
 */
export function createFormationConsideration(
  maneuver: ManeuverDefinition
): Consideration {
  return {
    name: 'formation_cohesion',
    weight: 1.0,
    evaluate(context: AIContext): number {
      if (context.allies.length === 0) return 0.5;

      const result = resolveManeuver(
        context.self.x,
        context.self.y,
        context.self.angle,
        maneuver
      );

      // Calculate average distance to allies after maneuver
      let totalDist = 0;
      for (const ally of context.allies) {
        totalDist += distance(result.targetX, result.targetY, ally.x, ally.y);
      }
      const avgDist = totalDist / context.allies.length;

      // Optimal formation distance is ~150 pixels
      const optimalDist = 150;
      const distDiff = Math.abs(avgDist - optimalDist);

      // Score decreases as we get further from optimal
      return Math.max(0, 1 - distDiff / 300);
    },
  };
}

// ============================================
// Action Considerations
// ============================================

/**
 * How useful is taking focus?
 */
export function createFocusValueConsideration(): Consideration {
  return {
    name: 'focus_value',
    weight: 1.0,
    evaluate(context: AIContext): number {
      // Already have focus = no value
      if (context.self.hasFocus) return 0;

      // Have targets in arc = focus is valuable
      let targetsInArc = 0;
      for (const enemy of context.enemies) {
        const info = getTargetInfo(context.self, enemy);
        if (info.canAttackPrimary) targetsInArc++;
      }

      const attackValue = targetsInArc > 0 ? 0.5 : 0;

      // Defense value depends on threats
      let threatLevel = 0;
      for (const enemy of context.enemies) {
        const range = calculateRangeBand(
          context.self.x,
          context.self.y,
          enemy.x,
          enemy.y
        );
        if (range !== null && range <= 2) threatLevel += 0.2;
      }

      const defenseValue = Math.min(0.5, threatLevel);

      return attackValue + defenseValue;
    },
  };
}

/**
 * How useful is taking evade?
 */
export function createEvadeValueConsideration(): Consideration {
  return {
    name: 'evade_value',
    weight: 1.0,
    evaluate(context: AIContext): number {
      // Already have evade = no value
      if (context.self.hasEvade) return 0;

      // Count threats
      let threatScore = 0;
      for (const enemy of context.enemies) {
        const range = calculateRangeBand(
          context.self.x,
          context.self.y,
          enemy.x,
          enemy.y
        );
        const angleToUs = angleToTarget(
          enemy.x,
          enemy.y,
          context.self.x,
          context.self.y
        );

        if (range !== null && isInArc(enemy.angle, angleToUs, 90)) {
          threatScore += range === 1 ? 0.4 : range === 2 ? 0.3 : 0.2;
        }
      }

      // Low hull = evade more valuable
      const hullFactor = 1 - context.self.hull / context.self.maxHull;

      return Math.min(1, threatScore * (1 + hullFactor));
    },
  };
}

/**
 * How useful is acquiring a target lock?
 */
export function createTargetLockValueConsideration(
  target: ShipState
): Consideration {
  return {
    name: 'target_lock_value',
    weight: 1.0,
    evaluate(context: AIContext): number {
      // Already have lock on this target = some value (keep it)
      if (context.self.hasTargetLock === target.id) return 0.3;

      // Already have lock on different target = low value to switch
      if (context.self.hasTargetLock !== null) return 0.2;

      // Value based on whether we can attack
      const info = getTargetInfo(context.self, target);
      if (!info.canAttackPrimary) return 0.2;

      // Range 1 = less need for lock (already have bonus die)
      // Range 2-3 = lock more valuable
      let rangeValue = 0.5;
      if (info.range === 1) rangeValue = 0.4;
      else if (info.range === 2) rangeValue = 0.7;
      else if (info.range === 3) rangeValue = 0.8;

      // Vulnerable target = lock more valuable
      const vulnerabilityBonus = target.shields === 0 ? 0.2 : 0;

      return Math.min(1, rangeValue + vulnerabilityBonus);
    },
  };
}
