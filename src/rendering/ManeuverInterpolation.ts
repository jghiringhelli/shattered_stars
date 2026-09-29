/**
 * ManeuverInterpolation — shared lerp-alpha math for animating a ship from its
 * pre-maneuver position/angle toward the post-maneuver target every frame.
 * Pure math only; scenes own applying the result to position/angle/sprites.
 */

/**
 * Computes how far to lerp a ship toward its maneuver target this frame.
 * @param deltaMs - Milliseconds elapsed since the last frame.
 * @param durationMs - Nominal duration of a full maneuver animation.
 * @param speedMultiplier - Speed-up factor applied on top of the raw ratio.
 * @returns A value in [0, 1] safe to pass to Phaser.Math.Linear.
 */
export function maneuverLerpAlpha(
  deltaMs: number,
  durationMs: number,
  speedMultiplier: number,
): number {
  return Math.min(1, (deltaMs / durationMs) * speedMultiplier);
}
