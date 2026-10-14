/**
 * creatureMath — small angle and wrap helpers shared by the creature
 * modules. Angles follow the ship convention (degrees, 0 = up, clockwise);
 * distances and bearings across the map seam come from FiringGeometry.
 */

import { wrapDegrees } from "../weapons/FiringGeometry";

/** Degrees to radians. */
export const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const FULL_TURN_DEG = 360;
const MS_PER_S = 1000;

/**
 * @param angleDeg - A heading.
 * @returns The x component of its unit vector (0 = up, clockwise).
 */
export function forwardX(angleDeg: number): number {
  return Math.sin(angleDeg * DEG_TO_RAD);
}

/**
 * @param angleDeg - A heading.
 * @returns The y component of its unit vector (screen y grows downward).
 */
export function forwardY(angleDeg: number): number {
  return -Math.cos(angleDeg * DEG_TO_RAD);
}

/**
 * @param dx - Vector x.
 * @param dy - Vector y.
 * @returns The heading of the vector in [0, 360).
 */
export function headingOfVector(dx: number, dy: number): number {
  const heading = Math.atan2(dx, -dy) * RAD_TO_DEG;
  return ((heading % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG;
}

/**
 * @param current - Current heading.
 * @param desired - Wanted heading.
 * @param maxStepDeg - Largest turn this step.
 * @returns The heading after turning the short way, in [0, 360).
 */
export function turnToward(
  current: number,
  desired: number,
  maxStepDeg: number,
): number {
  const delta = wrapDegrees(desired - current);
  const step = Math.max(-maxStepDeg, Math.min(maxStepDeg, delta));
  return (((current + step) % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG;
}

/**
 * @param value - A number.
 * @param low - Lower bound.
 * @param high - Upper bound.
 * @returns The value clamped.
 */
export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * @param deltaMs - A frame length.
 * @returns It in seconds.
 */
export function seconds(deltaMs: number): number {
  return deltaMs / MS_PER_S;
}
