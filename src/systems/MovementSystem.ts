/**
 * Movement System
 * Handles maneuver template resolution and path calculation
 * Based on X-Wing Miniatures movement mechanics
 */

import type {
  ManeuverDefinition,
  ManeuverDirection,
  ManeuverDifficulty,
  ManeuverResult,
} from '../core/types';
import { SPEED_SCALE_FACTOR } from '../config';

// ============================================
// Maneuver Templates
// ============================================

/**
 * Base maneuver template defining the geometric transformation
 * Values are normalized (for speed 1), scaled by speed at runtime
 */
interface ManeuverTemplate {
  /** X offset (negative = left, positive = right) */
  readonly deltaX: number;
  /** Y offset (negative = forward in screen coords where Y increases downward) */
  readonly deltaY: number;
  /** Angle change in degrees (negative = left turn, positive = right turn) */
  readonly deltaAngle: number;
  /** Path type for animation */
  readonly pathType: 'straight' | 'curve' | 'kturn' | 'segnor' | 'tallon';
}

/**
 * Maneuver templates for each direction
 * Base values for speed 1, multiply by speed for actual movement
 */
export const MANEUVER_TEMPLATES: Record<ManeuverDirection, ManeuverTemplate> = {
  straight: {
    deltaX: 0,
    deltaY: -1, // Forward (up on screen)
    deltaAngle: 0,
    pathType: 'straight',
  },
  bank_left: {
    deltaX: -0.5,
    deltaY: -0.866, // cos(30°) ≈ 0.866
    deltaAngle: -45,
    pathType: 'curve',
  },
  bank_right: {
    deltaX: 0.5,
    deltaY: -0.866,
    deltaAngle: 45,
    pathType: 'curve',
  },
  turn_left: {
    deltaX: -0.707, // sin(45°)
    deltaY: -0.707, // cos(45°)
    deltaAngle: -90,
    pathType: 'curve',
  },
  turn_right: {
    deltaX: 0.707,
    deltaY: -0.707,
    deltaAngle: 90,
    pathType: 'curve',
  },
  kturn: {
    deltaX: 0,
    deltaY: -1,
    deltaAngle: 180,
    pathType: 'kturn',
  },
  segnor_left: {
    deltaX: -0.5,
    deltaY: -0.866,
    deltaAngle: -135, // Bank path but end facing back-left
    pathType: 'segnor',
  },
  segnor_right: {
    deltaX: 0.5,
    deltaY: -0.866,
    deltaAngle: 135,
    pathType: 'segnor',
  },
  tallon_left: {
    deltaX: -0.707,
    deltaY: -0.707,
    deltaAngle: -180, // Turn path but end facing back
    pathType: 'tallon',
  },
  tallon_right: {
    deltaX: 0.707,
    deltaY: -0.707,
    deltaAngle: 180,
    pathType: 'tallon',
  },
};

// ============================================
// Movement Functions (Pure)
// ============================================

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(angle: number): number {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  // Ensure we return +0 not -0
  return Object.is(angle, -0) ? 0 : angle;
}

/**
 * Rotate a point around the origin by the given angle (in degrees)
 */
export function rotatePoint(
  x: number,
  y: number,
  angleDegrees: number
): { x: number; y: number } {
  const rad = degToRad(angleDegrees);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

/**
 * Resolve a maneuver to get the final position and angle
 *
 * @param startX - Starting X position
 * @param startY - Starting Y position
 * @param startAngle - Starting angle in degrees (0 = up/north)
 * @param maneuver - The maneuver to execute
 * @returns The resulting position and angle
 */
export function resolveManeuver(
  startX: number,
  startY: number,
  startAngle: number,
  maneuver: ManeuverDefinition
): ManeuverResult {
  const template = MANEUVER_TEMPLATES[maneuver.direction];
  const speed = maneuver.speed;

  // Scale movement by speed
  const scaledDeltaX = template.deltaX * speed * SPEED_SCALE_FACTOR;
  const scaledDeltaY = template.deltaY * speed * SPEED_SCALE_FACTOR;

  // Rotate the movement vector by the ship's current facing
  const rotated = rotatePoint(scaledDeltaX, scaledDeltaY, startAngle);

  // Calculate final position
  const targetX = startX + rotated.x;
  const targetY = startY + rotated.y;

  // Calculate final angle
  const targetAngle = normalizeAngle(startAngle + template.deltaAngle);

  return {
    targetX,
    targetY,
    targetAngle,
    difficulty: maneuver.difficulty,
  };
}

/**
 * Generate intermediate path points for smooth animation
 * Returns points from start to end for tweening
 *
 * @param startX - Starting X position
 * @param startY - Starting Y position
 * @param startAngle - Starting angle in degrees
 * @param maneuver - The maneuver to execute
 * @param numPoints - Number of intermediate points (default 10)
 * @returns Array of {x, y, angle} points
 */
export function generateManeuverPath(
  startX: number,
  startY: number,
  startAngle: number,
  maneuver: ManeuverDefinition,
  numPoints: number = 10
): Array<{ x: number; y: number; angle: number }> {
  const result = resolveManeuver(startX, startY, startAngle, maneuver);
  const template = MANEUVER_TEMPLATES[maneuver.direction];
  const points: Array<{ x: number; y: number; angle: number }> = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints; // 0 to 1

    if (template.pathType === 'straight') {
      // Linear interpolation for straight moves
      points.push({
        x: startX + (result.targetX - startX) * t,
        y: startY + (result.targetY - startY) * t,
        angle: startAngle, // Angle stays constant for straight
      });
    } else if (template.pathType === 'curve') {
      // Bezier-like curve for banks and turns
      // Use quadratic easing for smoother curves
      const easeT = t * t * (3 - 2 * t); // Smoothstep
      points.push({
        x: startX + (result.targetX - startX) * easeT,
        y: startY + (result.targetY - startY) * easeT,
        angle: normalizeAngle(startAngle + template.deltaAngle * t),
      });
    } else {
      // K-turn, Segnor, Tallon: move forward first, then rotate at end
      const movePhase = Math.min(t * 1.5, 1); // Move faster
      const rotatePhase = Math.max((t - 0.6) * 2.5, 0); // Rotate later

      // For K-turn: move straight, then flip
      // For Segnor/Tallon: move along curve, then add extra rotation
      const baseAngle = startAngle;
      let currentAngle: number;

      if (template.pathType === 'kturn') {
        // K-turn: 180° flip happens mostly at the end
        currentAngle = normalizeAngle(baseAngle + 180 * rotatePhase);
      } else {
        // Segnor/Tallon: gradual rotation throughout
        currentAngle = normalizeAngle(baseAngle + template.deltaAngle * t);
      }

      points.push({
        x: startX + (result.targetX - startX) * movePhase,
        y: startY + (result.targetY - startY) * movePhase,
        angle: currentAngle,
      });
    }
  }

  return points;
}

/**
 * Calculate distance between two points
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate range band (1, 2, or 3) between two ships
 * Returns null if out of range 3
 */
export function calculateRangeBand(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  range1Max: number = 100,
  range2Max: number = 200,
  range3Max: number = 300
): 1 | 2 | 3 | null {
  const dist = distance(x1, y1, x2, y2);

  if (dist <= range1Max) return 1;
  if (dist <= range2Max) return 2;
  if (dist <= range3Max) return 3;
  return null;
}

/**
 * Check if a target angle is within a firing arc
 *
 * @param shipAngle - The ship's facing angle in degrees
 * @param targetAngle - The angle to the target in degrees
 * @param arcSize - The arc size in degrees (e.g., 90 for front arc)
 * @returns true if target is within arc
 */
export function isInArc(
  shipAngle: number,
  targetAngle: number,
  arcSize: number
): boolean {
  // Normalize both angles
  const normalizedShip = normalizeAngle(shipAngle);
  const normalizedTarget = normalizeAngle(targetAngle);

  // Calculate the difference
  let diff = normalizedTarget - normalizedShip;

  // Normalize to -180 to 180 range
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  // Check if within half arc on either side
  const halfArc = arcSize / 2;
  return Math.abs(diff) <= halfArc;
}

/**
 * Calculate the angle from one point to another
 * Returns angle in degrees where 0 = up/north
 */
export function angleToTarget(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): number {
  const dx = toX - fromX;
  const dy = toY - fromY;

  // atan2 gives angle from positive X axis
  // We want angle from negative Y axis (up)
  // So we swap dx/dy and adjust
  const radians = Math.atan2(dx, -dy);
  return normalizeAngle(radToDeg(radians));
}

/**
 * Compute the signed turn angle (degrees, -180 to +180) a ship must rotate
 * from its current Phaser heading to face a target position.
 * Positive = turn clockwise (right), negative = counterclockwise (left).
 */
export function headingDiffToTarget(
  shipX: number,
  shipY: number,
  shipAngle: number,
  targetX: number,
  targetY: number
): number {
  let diff = angleToTarget(shipX, shipY, targetX, targetY) - shipAngle;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

// ============================================
// Maneuver Validation
// ============================================

/**
 * Check if a maneuver is valid for a ship given its current state
 */
export function isManeuverValid(
  maneuver: ManeuverDefinition,
  isStressed: boolean,
  availableManeuvers: readonly ManeuverDefinition[]
): boolean {
  // Check if maneuver is in the ship's dial
  const inDial = availableManeuvers.some(
    (m) => m.direction === maneuver.direction && m.speed === maneuver.speed
  );
  if (!inDial) return false;

  // Stressed ships cannot perform red maneuvers
  if (isStressed && maneuver.difficulty === 'red') {
    return false;
  }

  return true;
}

/**
 * Get all valid maneuvers for a ship given its state
 */
export function getValidManeuvers(
  availableManeuvers: readonly ManeuverDefinition[],
  isStressed: boolean
): ManeuverDefinition[] {
  return availableManeuvers.filter((m) =>
    isManeuverValid(m, isStressed, availableManeuvers)
  );
}
