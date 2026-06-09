/**
 * FormationAI — Pure math helpers for wingman formation flying.
 *
 * Wingmen hold an offset behind and beside their leader when no enemies are nearby.
 * As enemies close inside ENGAGE_RADIUS, the wingman blends toward full combat
 * steering so the formation dissolves naturally into a dogfight.
 */

// ============================================
// Formation slot definitions
// ============================================

export interface FormationSlot {
  /** Local-space X offset from leader (positive = starboard). */
  readonly offsetX: number;
  /** Local-space Y offset from leader (positive = behind in Phaser up-is-negative coords). */
  readonly offsetY: number;
}

/**
 * Two escort slots: port and starboard wing, trailing the leader.
 * Index matches the wingman's slot assignment (0 or 1).
 */
export const WING_SLOTS: readonly FormationSlot[] = [
  { offsetX: -40, offsetY: 60 },
  { offsetX: 40, offsetY: 60 },
];

/** Distance at which a wingman fully breaks off to engage the enemy. */
export const ENGAGE_RADIUS = 350;

// ============================================
// Position helpers
// ============================================

/**
 * Returns the world-space position a wingman should fly toward to hold its
 * formation slot. Rotates the slot offset by the leader's current heading so
 * the slot rotates with the leader.
 *
 * @param leaderX        - Leader world X.
 * @param leaderY        - Leader world Y.
 * @param leaderAngleDeg - Leader heading in Phaser degrees (0 = up, CW positive).
 * @param slot           - The formation slot to compute.
 * @returns World-space target position.
 */
export function getFormationTarget(
  leaderX: number,
  leaderY: number,
  leaderAngleDeg: number,
  slot: FormationSlot,
): { readonly x: number; readonly y: number } {
  const rad = ((leaderAngleDeg - 90) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: leaderX + slot.offsetX * cos - slot.offsetY * sin,
    y: leaderY + slot.offsetX * sin + slot.offsetY * cos,
  };
}

/**
 * Blends between a formation hold position and an enemy chase position based
 * on how close the nearest enemy is. Beyond ENGAGE_RADIUS the wingman holds
 * formation; inside it transitions smoothly to full combat pursuit.
 *
 * @param formationTarget    - Desired world position to hold formation.
 * @param enemyTarget        - World position of the priority enemy target.
 * @param distToNearestEnemy - Distance to the closest enemy.
 * @param engageRadius       - Threshold at which full combat mode begins.
 * @returns Blended world-space steering target.
 */
export function blendFormationTarget(
  formationTarget: { readonly x: number; readonly y: number },
  enemyTarget: { readonly x: number; readonly y: number },
  distToNearestEnemy: number,
  engageRadius: number,
): { readonly x: number; readonly y: number } {
  const blend = Math.min(1, Math.max(0, 1 - distToNearestEnemy / engageRadius));
  return {
    x: formationTarget.x + (enemyTarget.x - formationTarget.x) * blend,
    y: formationTarget.y + (enemyTarget.y - formationTarget.y) * blend,
  };
}
