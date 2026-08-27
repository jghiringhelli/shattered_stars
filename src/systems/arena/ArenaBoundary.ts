/**
 * ArenaBoundary — pure model for the "asteroid belt" containment field.
 *
 * Non-competitive modes (Survival, Campaign) can't forfeit a fleeing player, so
 * instead the play area is ringed by an asteroid belt: harmless in the middle,
 * increasingly dense (and damaging) the farther out you drift, and effectively
 * impassable at the wall. This guarantees engagement without an abrupt kill wall.
 *
 * In Survival the belt tightens each wave ("cada vez más denso hasta que se
 * vuelve imposible"), squeezing the fight inward over time.
 *
 * This module owns the geometry/damage curve only; scenes own ship positions,
 * rendering, and applying the returned damage.
 */

/** Absolute floor for the safe radius so the belt can never fully collapse. */
export const MIN_SAFE_RADIUS = 200;

/** Per-step shrink of the safe zone when the belt tightens (px). */
export const SAFE_SHRINK_PER_STEP = 120;

/** Per-step shrink of the impassable wall when the belt tightens (px). */
export const WALL_SHRINK_PER_STEP = 100;

/** Per-step growth of the belt's max damage-per-second when it tightens. */
export const DAMAGE_GROWTH_PER_STEP = 1;

export interface BeltConfig {
  /** No belt damage within this radius from the arena center. */
  readonly safeRadius: number;
  /** At/beyond this radius the belt is at full density (impassable). */
  readonly wallRadius: number;
  /** Damage per second dealt at/beyond the wall. */
  readonly maxDamagePerSecond: number;
}

/**
 * Normalized belt intensity (0..1) at a distance from the arena center.
 * 0 inside the safe zone, 1 at/beyond the wall, quadratic in between so the
 * field feels "increasingly dense" rather than linearly ramping.
 */
export function beltIntensity(
  distFromCenter: number,
  config: BeltConfig,
): number {
  if (distFromCenter <= config.safeRadius) return 0;
  if (distFromCenter >= config.wallRadius) return 1;
  const span = config.wallRadius - config.safeRadius;
  const t = (distFromCenter - config.safeRadius) / span;
  return t * t;
}

/** Belt damage-per-second at a distance from the arena center. */
export function beltDamagePerSecond(
  distFromCenter: number,
  config: BeltConfig,
): number {
  return beltIntensity(distFromCenter, config) * config.maxDamagePerSecond;
}

/** Belt damage to apply for a frame of `deltaMs` at a distance from center. */
export function beltDamageForFrame(
  distFromCenter: number,
  config: BeltConfig,
  deltaMs: number,
): number {
  return (beltDamagePerSecond(distFromCenter, config) * deltaMs) / 1000;
}

/**
 * Tighten the belt by `steps` (e.g. the Survival wave index): shrink both radii
 * and raise damage. The safe radius floors at MIN_SAFE_RADIUS and the wall stays
 * a fixed margin outside it, so the arena squeezes inward without collapsing.
 */
export function tightenBelt(base: BeltConfig, steps: number): BeltConfig {
  const clampedSteps = Math.max(0, steps);
  const safeRadius = Math.max(
    MIN_SAFE_RADIUS,
    base.safeRadius - SAFE_SHRINK_PER_STEP * clampedSteps,
  );
  const margin = Math.max(
    WALL_SHRINK_PER_STEP,
    base.wallRadius - base.safeRadius,
  );
  const wallRadius = Math.max(
    safeRadius + margin,
    base.wallRadius - WALL_SHRINK_PER_STEP * clampedSteps,
  );
  const maxDamagePerSecond =
    base.maxDamagePerSecond + DAMAGE_GROWTH_PER_STEP * clampedSteps;
  return { safeRadius, wallRadius, maxDamagePerSecond };
}
