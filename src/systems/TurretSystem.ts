/**
 * Turret System
 *
 * Handles turret weapons that can rotate independently of ship facing.
 * Supports different turret types: single, dual, and 360° turrets.
 */

import type { ShipState } from "../core/types";
import type { RandomGenerator } from "../utils/random";
import { getDefaultRng } from "../utils/random";
import { distance } from "./MovementSystem";
import { isInArc, angleToTarget } from "./MovementSystem";

// ============================================
// Turret Types
// ============================================

export type TurretArcType = "single" | "double" | "full";

export interface TurretDefinition {
  readonly id: string;
  readonly name: string;
  readonly arcType: TurretArcType;
  readonly arcSize: number; // Degrees (90 for single, 180 for double, 360 for full)

  // Combat stats
  readonly attackDice: number;
  readonly range: { min: number; max: number };
  readonly bonusAtRange1: number; // Extra dice at range 1

  // Requirements
  readonly requiresTargetLock: boolean;

  // Point cost
  readonly pointCost: number;

  // Description
  readonly description: string;
}

// ============================================
// Turret Definitions
// ============================================

export const TURRET_DEFINITIONS: Record<string, TurretDefinition> = {
  // Single arc turrets (90°)
  light_turret: {
    id: "light_turret",
    name: "Light Turret",
    arcType: "single",
    arcSize: 90,
    attackDice: 2,
    range: { min: 1, max: 2 },
    bonusAtRange1: 1,
    requiresTargetLock: false,
    pointCost: 3,
    description: "Rotatable 90° arc. +1 die at range 1",
  },

  ion_cannon_turret: {
    id: "ion_cannon_turret",
    name: "Ion Cannon Turret",
    arcType: "single",
    arcSize: 90,
    attackDice: 3,
    range: { min: 1, max: 3 },
    bonusAtRange1: 0,
    requiresTargetLock: false,
    pointCost: 5,
    description: "Apply ion tokens equal to damage dealt",
  },

  // Double arc turrets (180° - front and back, or left and right)
  dorsal_turret: {
    id: "dorsal_turret",
    name: "Dorsal Turret",
    arcType: "double",
    arcSize: 180,
    attackDice: 2,
    range: { min: 1, max: 2 },
    bonusAtRange1: 1,
    requiresTargetLock: false,
    pointCost: 4,
    description: "Covers front and rear arcs",
  },

  ventral_turret: {
    id: "ventral_turret",
    name: "Ventral Turret",
    arcType: "double",
    arcSize: 180,
    attackDice: 2,
    range: { min: 1, max: 2 },
    bonusAtRange1: 1,
    requiresTargetLock: false,
    pointCost: 4,
    description: "Covers left and right arcs",
  },

  // Full 360° turrets
  agile_gunner: {
    id: "agile_gunner",
    name: "Agile Gunner",
    arcType: "full",
    arcSize: 360,
    attackDice: 2,
    range: { min: 1, max: 2 },
    bonusAtRange1: 0,
    requiresTargetLock: false,
    pointCost: 6,
    description: "Full 360° arc coverage",
  },

  veteran_turret_gunner: {
    id: "veteran_turret_gunner",
    name: "Veteran Turret Gunner",
    arcType: "full",
    arcSize: 360,
    attackDice: 3,
    range: { min: 1, max: 3 },
    bonusAtRange1: 0,
    requiresTargetLock: false,
    pointCost: 8,
    description: "Full arc, long range, may attack after performing action",
  },

  // Special turrets
  blaster_turret: {
    id: "blaster_turret",
    name: "Blaster Turret",
    arcType: "single",
    arcSize: 90,
    attackDice: 3,
    range: { min: 1, max: 2 },
    bonusAtRange1: 0,
    requiresTargetLock: true, // Requires lock to fire
    pointCost: 4,
    description: "Requires target lock. High firepower",
  },

  heavy_laser_turret: {
    id: "heavy_laser_turret",
    name: "Heavy Laser Turret",
    arcType: "single",
    arcSize: 90,
    attackDice: 4,
    range: { min: 2, max: 3 },
    bonusAtRange1: 0, // Can't fire at range 1!
    requiresTargetLock: false,
    pointCost: 7,
    description: "Cannot attack at range 1. High damage at range",
  },
};

// ============================================
// Turret State
// ============================================

export interface TurretState {
  readonly definitionId: string;
  /** Current turret facing in degrees (0 = front, 90 = right, 180 = rear, 270 = left) */
  facing: number;
  /** Is the turret jammed/disabled? */
  isDisabled: boolean;
  /** Has this turret fired this round? */
  hasFired: boolean;
}

// ============================================
// Turret Functions
// ============================================

/**
 * Create initial turret state
 */
export function createTurretState(definitionId: string): TurretState {
  return {
    definitionId,
    facing: 0, // Start facing front
    isDisabled: false,
    hasFired: false,
  };
}

/**
 * Get the absolute angle range covered by a turret
 */
export function getTurretArcRange(
  shipAngle: number,
  turret: TurretState,
  definition: TurretDefinition,
): { start: number; end: number } {
  if (definition.arcType === "full") {
    return { start: 0, end: 360 };
  }

  // Calculate arc center based on ship angle + turret facing
  const arcCenter = (shipAngle + turret.facing + 360) % 360;
  const halfArc = definition.arcSize / 2;

  const start = (arcCenter - halfArc + 360) % 360;
  const end = (arcCenter + halfArc + 360) % 360;

  return { start, end };
}

/**
 * Check if a target is in a turret's arc
 */
export function isTargetInTurretArc(
  ship: ShipState,
  target: ShipState,
  turret: TurretState,
  definition: TurretDefinition,
): boolean {
  if (definition.arcType === "full") {
    return true; // 360° turret can hit anything
  }

  // Calculate angle from ship to target
  const angleTo = angleToTarget(ship.x, ship.y, target.x, target.y);

  // Get turret's absolute arc center
  const arcCenter = (ship.angle + turret.facing + 360) % 360;

  // For double turrets, check both arcs (front/back or left/right)
  if (definition.arcType === "double") {
    // Check primary arc
    if (isInArc(arcCenter, angleTo, definition.arcSize / 2)) {
      return true;
    }
    // Check opposite arc (180° rotated)
    const oppositeCenter = (arcCenter + 180) % 360;
    return isInArc(oppositeCenter, angleTo, definition.arcSize / 2);
  }

  // Single arc
  return isInArc(arcCenter, angleTo, definition.arcSize);
}

/**
 * Check if turret can fire at target
 */
export function canTurretFire(
  ship: ShipState,
  target: ShipState,
  turret: TurretState,
  definition: TurretDefinition,
): { valid: boolean; reason?: string } {
  // Check if disabled
  if (turret.isDisabled) {
    return { valid: false, reason: "Turret is disabled" };
  }

  // Check if already fired
  if (turret.hasFired) {
    return { valid: false, reason: "Turret has already fired this round" };
  }

  // Check range
  const dist = distance(ship.x, ship.y, target.x, target.y);
  const rangeBand = dist <= 100 ? 1 : dist <= 200 ? 2 : dist <= 300 ? 3 : null;

  if (rangeBand === null) {
    return { valid: false, reason: "Target out of range" };
  }

  if (rangeBand < definition.range.min) {
    return {
      valid: false,
      reason: `Cannot fire at range ${rangeBand} (minimum ${definition.range.min})`,
    };
  }

  if (rangeBand > definition.range.max) {
    return {
      valid: false,
      reason: `Target beyond maximum range ${definition.range.max}`,
    };
  }

  // Check arc
  if (!isTargetInTurretArc(ship, target, turret, definition)) {
    return { valid: false, reason: "Target not in turret arc" };
  }

  // Check target lock requirement
  if (definition.requiresTargetLock && ship.hasTargetLock !== target.id) {
    return { valid: false, reason: "Requires target lock on defender" };
  }

  return { valid: true };
}

/**
 * Rotate turret to a new facing
 */
export function rotateTurret(
  turret: TurretState,
  newFacing: number,
): TurretState {
  // Normalize to 0-360
  const normalizedFacing = ((newFacing % 360) + 360) % 360;

  return {
    ...turret,
    facing: normalizedFacing,
  };
}

/**
 * Auto-rotate turret toward a target
 */
export function autoRotateTurretToTarget(
  ship: ShipState,
  target: ShipState,
  turret: TurretState,
  definition: TurretDefinition,
): TurretState {
  if (definition.arcType === "full") {
    return turret; // No rotation needed for 360° turret
  }

  // Calculate desired facing (relative to ship)
  const absoluteAngle = angleToTarget(ship.x, ship.y, target.x, target.y);
  const relativeFacing = (absoluteAngle - ship.angle + 360) % 360;

  // Snap to nearest valid position
  let snappedFacing: number;
  if (definition.arcType === "double") {
    // Double turrets can face front/rear or left/right
    // Snap to nearest 90° increment
    snappedFacing = Math.round(relativeFacing / 90) * 90;
  } else {
    // Single turrets can face any direction - no snapping needed
    snappedFacing = relativeFacing;
  }

  return rotateTurret(turret, snappedFacing);
}

/**
 * Get valid rotation options for a turret
 */
export function getTurretRotationOptions(
  turret: TurretState,
  definition: TurretDefinition,
): number[] {
  if (definition.arcType === "full") {
    return []; // No rotation options for 360°
  }

  // Standard positions: front, right, rear, left
  const positions = [0, 90, 180, 270];

  // Filter out current position
  return positions.filter((pos) => pos !== turret.facing);
}

/**
 * Fire turret at target
 */
export function fireTurret(
  ship: ShipState,
  target: ShipState,
  turret: TurretState,
  definition: TurretDefinition,
  rng: RandomGenerator = getDefaultRng(),
): {
  success: boolean;
  hits: number;
  crits: number;
  ionTokens: number;
  message: string;
} {
  // Calculate dice
  const dist = distance(ship.x, ship.y, target.x, target.y);
  const rangeBand = dist <= 100 ? 1 : dist <= 200 ? 2 : 3;

  let diceCount = definition.attackDice;

  // Add bonus at range 1
  if (rangeBand === 1) {
    diceCount += definition.bonusAtRange1;
  }

  // Roll dice
  let hits = 0;
  let crits = 0;

  for (let i = 0; i < diceCount; i++) {
    const roll = rng.next();
    if (roll < 0.125) {
      crits++;
    } else if (roll < 0.5) {
      hits++;
    }
  }

  const totalHits = hits + crits;

  // Ion cannon turret special: ion tokens equal to damage
  const ionTokens = definition.id === "ion_cannon_turret" ? totalHits : 0;

  return {
    success: totalHits > 0,
    hits,
    crits,
    ionTokens,
    message:
      totalHits > 0
        ? `${definition.name} hit! ${hits} hits, ${crits} crits`
        : `${definition.name} missed!`,
  };
}

/**
 * Reset turret state at start of round
 */
export function resetTurretForRound(turret: TurretState): TurretState {
  return {
    ...turret,
    hasFired: false,
  };
}

/**
 * Mark turret as having fired
 */
export function markTurretFired(turret: TurretState): TurretState {
  return {
    ...turret,
    hasFired: true,
  };
}

/**
 * Calculate optimal turret facing to cover the most enemies
 */
export function calculateOptimalTurretFacing(
  ship: ShipState,
  enemies: readonly ShipState[],
  definition: TurretDefinition,
): number {
  if (definition.arcType === "full" || enemies.length === 0) {
    return 0; // Default facing
  }

  // Calculate angle to each enemy
  const enemyAngles = enemies
    .filter((e) => e.hull > 0)
    .map((e) => {
      const absAngle = angleToTarget(ship.x, ship.y, e.x, e.y);
      return (absAngle - ship.angle + 360) % 360;
    });

  // Try each standard facing and count enemies in arc
  const facings = [0, 90, 180, 270];
  let bestFacing = 0;
  let bestCount = 0;

  for (const facing of facings) {
    let count = 0;
    for (const enemyAngle of enemyAngles) {
      const arcCenter = facing;
      const halfArc = definition.arcSize / 2;

      // Check if enemy is in this arc
      let diff = Math.abs(enemyAngle - arcCenter);
      if (diff > 180) diff = 360 - diff;

      if (diff <= halfArc) {
        count++;
      }

      // For double turrets, check opposite arc too
      if (definition.arcType === "double") {
        const oppositeCenter = (arcCenter + 180) % 360;
        let oppDiff = Math.abs(enemyAngle - oppositeCenter);
        if (oppDiff > 180) oppDiff = 360 - oppDiff;

        if (oppDiff <= halfArc) {
          count++;
        }
      }
    }

    if (count > bestCount) {
      bestCount = count;
      bestFacing = facing;
    }
  }

  return bestFacing;
}
