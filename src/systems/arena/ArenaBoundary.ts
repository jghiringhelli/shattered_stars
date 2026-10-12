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

/** How a belt's damage grows as it tightens. */
export interface BeltDamageRamp {
  /** Max damage-per-second added per squeeze. */
  readonly perStep: number;
  /** Max damage-per-second the belt never exceeds, however tight. */
  readonly maxPerSecond: number;
}

/** The default ramp: +DAMAGE_GROWTH_PER_STEP per squeeze, uncapped. */
export const DEFAULT_DAMAGE_RAMP: BeltDamageRamp = {
  perStep: DAMAGE_GROWTH_PER_STEP,
  maxPerSecond: Number.POSITIVE_INFINITY,
};

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
 * Belt damage for one full turn at a distance from center. Turn-based modes
 * (Campaign) apply the belt once per turn, treating `maxDamagePerSecond` as the
 * damage dealt at the wall each turn.
 */
export function beltDamagePerTurn(
  distFromCenter: number,
  config: BeltConfig,
): number {
  return beltIntensity(distFromCenter, config) * config.maxDamagePerSecond;
}

/**
 * Tighten the belt by `steps` (e.g. the Survival wave index): shrink both radii
 * and raise damage along `ramp` (capped at its max). The safe radius floors at
 * MIN_SAFE_RADIUS and the wall stays a fixed margin outside it, so the arena
 * squeezes inward without collapsing.
 *
 * @param base - The belt before any squeeze.
 * @param steps - Squeezes to apply (negative = none).
 * @param ramp - How damage grows per squeeze (default: +1/s, uncapped).
 * @returns The tightened belt.
 */
export function tightenBelt(
  base: BeltConfig,
  steps: number,
  ramp: BeltDamageRamp = DEFAULT_DAMAGE_RAMP,
): BeltConfig {
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
  const maxDamagePerSecond = Math.min(
    ramp.maxPerSecond,
    base.maxDamagePerSecond + ramp.perStep * clampedSteps,
  );
  return { safeRadius, wallRadius, maxDamagePerSecond };
}

/**
 * How far inside the safe radius an AI pilot starts heading back to the
 * centre (px): a little over two maneuver cycles of a fast ship, so it turns
 * before the belt bites.
 */
export const BELT_AVOID_MARGIN_PX = 300;

/** Fraction of the safe radius that always stays free to fight in. */
const MIN_OPEN_FRACTION = 0.5;

/**
 * @param config - The current belt.
 * @returns How far inside the safe radius pilots should turn back (px): the
 *   avoid margin, shrunk on a tight belt so half the safe zone stays open.
 */
export function beltAvoidMargin(config: BeltConfig): number {
  return Math.min(BELT_AVOID_MARGIN_PX, config.safeRadius * MIN_OPEN_FRACTION);
}

/** How close a ship is to the belt: safe, within the avoid margin, or in it. */
export type BeltWarningLevel = "clear" | "near" | "inside";

/**
 * @param position - The ship's position.
 * @param center - The arena centre.
 * @param config - The current belt.
 * @returns "inside" past the safe radius (taking damage), "near" within the
 *   avoid margin (where AI pilots turn back), else "clear".
 */
export function beltWarningLevel(
  position: { readonly x: number; readonly y: number },
  center: { readonly x: number; readonly y: number },
  config: BeltConfig,
): BeltWarningLevel {
  const dist = Math.hypot(position.x - center.x, position.y - center.y);
  if (dist > config.safeRadius) return "inside";
  return dist > config.safeRadius - beltAvoidMargin(config) ? "near" : "clear";
}

/**
 * Where an AI pilot should fly to stay out of the belt.
 *
 * @param position - The ship's position.
 * @param center - The arena centre.
 * @param config - The current belt.
 * @returns The arena centre when the ship is within the avoid margin of the
 *   belt (or in it); null while it is safely inside. On a tight belt the
 *   margin shrinks so half the safe zone stays open.
 */
export function beltRetreatPoint(
  position: { readonly x: number; readonly y: number },
  center: { readonly x: number; readonly y: number },
  config: BeltConfig,
): { x: number; y: number } | null {
  return beltWarningLevel(position, center, config) === "clear"
    ? null
    : { x: center.x, y: center.y };
}
