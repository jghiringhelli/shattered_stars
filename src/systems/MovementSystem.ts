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
} from "../core/types";
import {
  SPEED_SCALE_FACTOR,
  SUSTAINED_TURN_DEGREES_PER_CYCLE,
} from "../config";
import type { MovementProfile } from "../data/ShipDefinitions";

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
  readonly pathType: "straight" | "curve" | "kturn" | "segnor" | "tallon";
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
    pathType: "straight",
  },
  // Sustained shallow turn used by held arcade steering. The displacement
  // vector is offset by half the turn angle (15°) so the arc is tangent to
  // both the entry and exit headings, matching how turn_* is built.
  drift_left: {
    deltaX: -0.2588,
    deltaY: -0.9659,
    deltaAngle: -SUSTAINED_TURN_DEGREES_PER_CYCLE,
    pathType: "curve",
  },
  drift_right: {
    deltaX: 0.2588,
    deltaY: -0.9659,
    deltaAngle: SUSTAINED_TURN_DEGREES_PER_CYCLE,
    pathType: "curve",
  },
  bank_left: {
    deltaX: -0.5,
    deltaY: -0.866, // cos(30°) ≈ 0.866
    deltaAngle: -45,
    pathType: "curve",
  },
  bank_right: {
    deltaX: 0.5,
    deltaY: -0.866,
    deltaAngle: 45,
    pathType: "curve",
  },
  turn_left: {
    deltaX: -0.707, // sin(45°)
    deltaY: -0.707, // cos(45°)
    deltaAngle: -90,
    pathType: "curve",
  },
  turn_right: {
    deltaX: 0.707,
    deltaY: -0.707,
    deltaAngle: 90,
    pathType: "curve",
  },
  kturn: {
    deltaX: 0,
    deltaY: -1,
    deltaAngle: 180,
    pathType: "kturn",
  },
  segnor_left: {
    deltaX: -0.5,
    deltaY: -0.866,
    deltaAngle: -135, // Bank path but end facing back-left
    pathType: "segnor",
  },
  segnor_right: {
    deltaX: 0.5,
    deltaY: -0.866,
    deltaAngle: 135,
    pathType: "segnor",
  },
  tallon_left: {
    deltaX: -0.707,
    deltaY: -0.707,
    deltaAngle: -180, // Turn path but end facing back
    pathType: "tallon",
  },
  tallon_right: {
    deltaX: 0.707,
    deltaY: -0.707,
    deltaAngle: 180,
    pathType: "tallon",
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
  angleDegrees: number,
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
 * Resolve a maneuver to get the final position and angle.
 *
 * The template length follows X-Wing TMG geometry: the template starts at the
 * front of the ship's base and ends at the back of the destination, so the
 * total displacement is (speed × SPEED_SCALE_FACTOR) + baseSize pixels.
 *
 * @param startX    - Starting X position
 * @param startY    - Starting Y position
 * @param startAngle - Starting angle in degrees (0 = up/north)
 * @param maneuver  - The maneuver to execute
 * @param baseSize  - Ship base size in pixels (SHIP_SIZES[size]); defaults to 0
 * @returns The resulting position and angle
 */
export function resolveManeuver(
  startX: number,
  startY: number,
  startAngle: number,
  maneuver: ManeuverDefinition,
  baseSize: number = 0,
): ManeuverResult {
  const template = MANEUVER_TEMPLATES[maneuver.direction];

  // Template unit vectors are already unit-length, so multiply by total length.
  const templateLength = maneuver.speed * SPEED_SCALE_FACTOR + baseSize;
  const scaledDeltaX = template.deltaX * templateLength;
  const scaledDeltaY = template.deltaY * templateLength;

  // Rotate the movement vector by the ship's current facing
  const rotated = rotatePoint(scaledDeltaX, scaledDeltaY, startAngle);

  return {
    targetX: startX + rotated.x,
    targetY: startY + rotated.y,
    targetAngle: normalizeAngle(startAngle + template.deltaAngle),
    difficulty: maneuver.difficulty,
  };
}

/**
 * Generate intermediate path points for smooth animation.
 *
 * @param startX    - Starting X position
 * @param startY    - Starting Y position
 * @param startAngle - Starting angle in degrees
 * @param maneuver  - The maneuver to execute
 * @param numPoints - Number of intermediate waypoints (default 10)
 * @param baseSize  - Ship base size in pixels (see resolveManeuver)
 * @param profile   - Movement profile: "fighter" (default) or "capital" (boat easing)
 * @returns Array of {x, y, angle} points from start to end
 */
export function generateManeuverPath(
  startX: number,
  startY: number,
  startAngle: number,
  maneuver: ManeuverDefinition,
  numPoints: number = 10,
  baseSize: number = 0,
  profile: MovementProfile = "fighter",
): Array<{ x: number; y: number; angle: number }> {
  const result = resolveManeuver(
    startX,
    startY,
    startAngle,
    maneuver,
    baseSize,
  );
  const template = MANEUVER_TEMPLATES[maneuver.direction];
  const points: Array<{ x: number; y: number; angle: number }> = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints; // 0 to 1

    if (template.pathType === "straight") {
      // Linear interpolation for straight moves
      points.push({
        x: startX + (result.targetX - startX) * t,
        y: startY + (result.targetY - startY) * t,
        angle: startAngle, // Angle stays constant for straight
      });
    } else if (
      template.pathType === "curve" ||
      template.pathType === "segnor" ||
      template.pathType === "tallon"
    ) {
      // Capital ships: quadratic ease-in (committed turn, no snap)
      // Fighter ships: smoothstep position, linear angle (unchanged)
      const easeT = profile === "capital" ? t * t : t * t * (3 - 2 * t);
      const angleT = profile === "capital" ? t * t : t;
      points.push({
        x: startX + (result.targetX - startX) * easeT,
        y: startY + (result.targetY - startY) * easeT,
        angle: normalizeAngle(startAngle + template.deltaAngle * angleT),
      });
    } else {
      // K-turn: move straight forward, then flip 180° at the end.
      if (profile === "capital") {
        // Capital: gradual rotation across full cycle (no late snap)
        const movePhase = Math.min(t * 1.5, 1);
        const rotatePhase = t * t;
        points.push({
          x: startX + (result.targetX - startX) * movePhase,
          y: startY + (result.targetY - startY) * movePhase,
          angle: normalizeAngle(startAngle + 180 * rotatePhase),
        });
      } else {
        const movePhase = Math.min(t * 1.5, 1);
        const rotatePhase = Math.max((t - 0.6) * 2.5, 0);
        points.push({
          x: startX + (result.targetX - startX) * movePhase,
          y: startY + (result.targetY - startY) * movePhase,
          angle: normalizeAngle(startAngle + 180 * rotatePhase),
        });
      }
    }
  }

  return points;
}

/**
 * Calculate distance between two points
 */
export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
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
  range3Max: number = 300,
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
  arcSize: number,
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
  toY: number,
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
  targetY: number,
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
  availableManeuvers: readonly ManeuverDefinition[],
): boolean {
  // Check if maneuver is in the ship's dial
  const inDial = availableManeuvers.some(
    (m) => m.direction === maneuver.direction && m.speed === maneuver.speed,
  );
  if (!inDial) return false;

  // Stressed ships cannot perform red maneuvers
  if (isStressed && maneuver.difficulty === "red") {
    return false;
  }

  return true;
}

/**
 * Get all valid maneuvers for a ship given its state
 */
export function getValidManeuvers(
  availableManeuvers: readonly ManeuverDefinition[],
  isStressed: boolean,
): ManeuverDefinition[] {
  return availableManeuvers.filter((m) =>
    isManeuverValid(m, isStressed, availableManeuvers),
  );
}
