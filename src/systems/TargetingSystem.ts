/**
 * Targeting System
 * Handles arc detection, range calculation, and target validation
 * Based on X-Wing Miniatures arc and targeting rules
 */

import type { ShipState } from '../core/types';
import { distance, calculateRangeBand, angleToTarget, isInArc } from './MovementSystem';

// ============================================
// Arc Definitions
// ============================================

export type ArcType = 'front' | 'rear' | 'left' | 'right' | 'full_front' | 'bullseye' | 'turret';

export interface ArcDefinition {
  readonly type: ArcType;
  /** Arc size in degrees (e.g., 90 for standard front arc) */
  readonly size: number;
  /** Offset from ship facing in degrees (0 = front, 180 = rear) */
  readonly offset: number;
}

/**
 * Standard arc definitions
 */
export const STANDARD_ARCS: Record<ArcType, ArcDefinition> = {
  front: { type: 'front', size: 90, offset: 0 },
  rear: { type: 'rear', size: 90, offset: 180 },
  left: { type: 'left', size: 90, offset: 270 },
  right: { type: 'right', size: 90, offset: 90 },
  full_front: { type: 'full_front', size: 180, offset: 0 },
  bullseye: { type: 'bullseye', size: 20, offset: 0 },
  turret: { type: 'turret', size: 360, offset: 0 },
};

// ============================================
// Target Information
// ============================================

export interface TargetInfo {
  readonly targetId: string;
  readonly range: 1 | 2 | 3 | null;
  readonly distance: number;
  readonly angleToTarget: number;
  readonly inFrontArc: boolean;
  readonly inRearArc: boolean;
  readonly inBullseye: boolean;
  readonly inTurretArc: boolean;
  readonly canAttackPrimary: boolean;
}

// ============================================
// Targeting Functions
// ============================================

/**
 * Check if a target is in a specific arc from a ship's perspective
 *
 * @param ship - The ship with the arc
 * @param target - The target to check
 * @param arc - The arc definition
 * @returns true if target is within the arc
 */
export function isTargetInArc(
  ship: ShipState,
  target: ShipState,
  arc: ArcDefinition
): boolean {
  // Calculate angle from ship to target
  const angleTo = angleToTarget(ship.x, ship.y, target.x, target.y);

  // Adjust for arc offset (convert ship facing + offset to arc center direction)
  const arcCenter = ship.angle + arc.offset;

  return isInArc(arcCenter, angleTo, arc.size);
}

/**
 * Get complete targeting information for a ship-target pair
 *
 * @param attacker - The attacking ship
 * @param defender - The defending ship
 * @returns Complete targeting information
 */
export function getTargetInfo(attacker: ShipState, defender: ShipState): TargetInfo {
  const dist = distance(attacker.x, attacker.y, defender.x, defender.y);
  const range = calculateRangeBand(attacker.x, attacker.y, defender.x, defender.y);
  const angleTo = angleToTarget(attacker.x, attacker.y, defender.x, defender.y);

  const inFrontArc = isTargetInArc(attacker, defender, STANDARD_ARCS.front);
  const inRearArc = isTargetInArc(attacker, defender, STANDARD_ARCS.rear);
  const inBullseye = isTargetInArc(attacker, defender, STANDARD_ARCS.bullseye);
  const inTurretArc = true; // Turret always hits if in range

  // Standard primary weapon can attack if in front arc and in range
  const canAttackPrimary = range !== null && inFrontArc;

  return {
    targetId: defender.id,
    range,
    distance: dist,
    angleToTarget: angleTo,
    inFrontArc,
    inRearArc,
    inBullseye,
    inTurretArc,
    canAttackPrimary,
  };
}

/**
 * Get all valid targets for a ship
 *
 * @param attacker - The attacking ship
 * @param potentialTargets - Array of all potential target ships
 * @param requireArc - Only include targets in firing arc (default true)
 * @returns Array of target info for valid targets
 */
export function getValidTargets(
  attacker: ShipState,
  potentialTargets: readonly ShipState[],
  requireArc: boolean = true
): TargetInfo[] {
  return potentialTargets
    .filter((target) => target.id !== attacker.id) // Can't target self
    .filter((target) => target.faction !== attacker.faction) // Can't target allies
    .filter((target) => target.hull > 0) // Can't target destroyed ships
    .map((target) => getTargetInfo(attacker, target))
    .filter((info) => info.range !== null) // Must be in range
    .filter((info) => !requireArc || info.canAttackPrimary); // Must be in arc if required
}

/**
 * Find the closest valid target
 *
 * @param attacker - The attacking ship
 * @param potentialTargets - Array of all potential target ships
 * @returns Target info for closest valid target, or null if none
 */
export function getClosestTarget(
  attacker: ShipState,
  potentialTargets: readonly ShipState[]
): TargetInfo | null {
  const validTargets = getValidTargets(attacker, potentialTargets, true);

  if (validTargets.length === 0) return null;

  // Sort by distance and return closest
  validTargets.sort((a, b) => a.distance - b.distance);
  return validTargets[0] ?? null;
}

/**
 * Find targets with the most advantageous attack setup
 * Prefers: range 1 > bullseye > range 2 > range 3
 *
 * @param attacker - The attacking ship
 * @param potentialTargets - Array of all potential target ships
 * @returns Sorted array of targets by priority
 */
export function getPrioritizedTargets(
  attacker: ShipState,
  potentialTargets: readonly ShipState[]
): TargetInfo[] {
  const validTargets = getValidTargets(attacker, potentialTargets, true);

  // Score each target
  const scored = validTargets.map((target) => {
    let score = 0;

    // Range scoring (lower is better, range 1 gives +1 attack die)
    if (target.range === 1) score += 30;
    else if (target.range === 2) score += 20;
    else if (target.range === 3) score += 10;

    // Bullseye bonus (some abilities trigger on bullseye)
    if (target.inBullseye) score += 15;

    return { target, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.target);
}

// ============================================
// Target Lock Functions
// ============================================

/**
 * Check if a target lock is still valid
 * (Target must be in range 0-3 to maintain lock)
 *
 * @param attacker - Ship with the lock
 * @param target - Locked target
 * @returns true if lock is still valid
 */
export function isTargetLockValid(attacker: ShipState, target: ShipState): boolean {
  if (target.hull <= 0) return false; // Destroyed ships can't be locked

  const range = calculateRangeBand(attacker.x, attacker.y, target.x, target.y);
  return range !== null;
}

/**
 * Get all ships that can be target locked by a ship
 *
 * @param attacker - Ship acquiring lock
 * @param potentialTargets - All potential targets
 * @returns Ships that can be locked (in range, enemy)
 */
export function getTargetLockableShips(
  attacker: ShipState,
  potentialTargets: readonly ShipState[]
): ShipState[] {
  return potentialTargets
    .filter((target) => target.id !== attacker.id)
    .filter((target) => target.faction !== attacker.faction)
    .filter((target) => target.hull > 0)
    .filter((target) => {
      const range = calculateRangeBand(attacker.x, attacker.y, target.x, target.y);
      return range !== null;
    });
}

// ============================================
// Obstruction (Future: Obstacles)
// ============================================

/**
 * Check if line of sight between two ships is obstructed by obstacles.
 * Uses ray-circle intersection to detect if any obstacle blocks the line.
 *
 * @param attacker - Attacking ship
 * @param target - Target ship
 * @param obstacles - Array of obstacle positions with radius
 * @returns true if obstructed
 */
export function isLineOfSightObstructed(
  attacker: ShipState,
  target: ShipState,
  obstacles: readonly { x: number; y: number; radius: number }[] = []
): boolean {
  if (obstacles.length === 0) return false;

  // Line segment from attacker to target
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  // Avoid division by zero for ships at same position
  if (lineLength === 0) return false;

  // Check each obstacle for intersection
  for (const obstacle of obstacles) {
    if (lineIntersectsCircle(
      attacker.x, attacker.y,
      target.x, target.y,
      obstacle.x, obstacle.y,
      obstacle.radius
    )) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a line segment intersects a circle.
 * Uses closest point on line to circle center calculation.
 *
 * @param x1, y1 - Line start point
 * @param x2, y2 - Line end point
 * @param cx, cy - Circle center
 * @param radius - Circle radius
 * @returns true if line segment intersects circle
 */
function lineIntersectsCircle(
  x1: number, y1: number,
  x2: number, y2: number,
  cx: number, cy: number,
  radius: number
): boolean {
  // Vector from start to end
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Vector from start to circle center
  const fx = x1 - cx;
  const fy = y1 - cy;

  // Quadratic coefficients for intersection
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;

  // Discriminant
  const discriminant = b * b - 4 * a * c;

  // No intersection if discriminant is negative
  if (discriminant < 0) return false;

  // Check if intersection points are within the line segment [0, 1]
  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  // Intersection occurs if either t value is within [0, 1]
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

// ============================================
// Utility
// ============================================

/**
 * Calculate the angle between two ships (from first to second)
 * Useful for determining relative positions
 */
export function getRelativeAngle(from: ShipState, to: ShipState): number {
  return angleToTarget(from.x, from.y, to.x, to.y);
}

/**
 * Check if target is behind the attacker
 */
export function isTargetBehind(attacker: ShipState, target: ShipState): boolean {
  return isTargetInArc(attacker, target, STANDARD_ARCS.rear);
}

/**
 * Check if target is flanking (in side arcs)
 */
export function isTargetFlanking(attacker: ShipState, target: ShipState): boolean {
  return (
    isTargetInArc(attacker, target, STANDARD_ARCS.left) ||
    isTargetInArc(attacker, target, STANDARD_ARCS.right)
  );
}
