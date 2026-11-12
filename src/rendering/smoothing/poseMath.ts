/**
 * Pose math for render smoothing — shortest-way interpolation of angles and
 * of positions on the wrapping arena. Pure, allocation-free.
 */

import { torusAxisDelta } from "../../core/Torus";
import { wrapIntoArena } from "../torus/torusFollowMath";

export { wrapIntoArena };

const FULL_TURN_DEGREES = 360;
const HALF_TURN_DEGREES = 180;

/**
 * @param from - Angle (degrees).
 * @param to - Angle (degrees).
 * @returns The signed shortest turn from `from` to `to`, in (-180, 180].
 */
export function shortestAngleDelta(from: number, to: number): number {
  const turn =
    (((to - from) % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
  return turn > HALF_TURN_DEGREES ? turn - FULL_TURN_DEGREES : turn;
}

/**
 * @param from - Angle (degrees).
 * @param to - Angle (degrees).
 * @param t - Blend, 0 = `from`, 1 = `to`.
 * @returns The angle `t` of the way round the short side.
 */
export function lerpAngleDegrees(from: number, to: number, t: number): number {
  return from + shortestAngleDelta(from, to) * t;
}

/**
 * @param from - Coordinate on one arena axis.
 * @param to - Coordinate on the same axis.
 * @param t - Blend, 0 = `from`, 1 = `to`.
 * @param size - Arena edge length.
 * @returns The coordinate `t` of the way along the short way across the seam,
 *   wrapped into [0, size).
 */
export function lerpTorusAxis(
  from: number,
  to: number,
  t: number,
  size: number,
): number {
  return wrapIntoArena(from + torusAxisDelta(from, to, size) * t, size);
}

/**
 * @param t - Progress 0..1 (clamped).
 * @returns Ease-out (quadratic) progress: fast first, settling at the end.
 */
export function easeOutQuad(t: number): number {
  const u = 1 - Math.min(1, Math.max(0, t));
  return 1 - u * u;
}

/**
 * Exponential smoothing gain for a frame: the fraction of the gap to close so
 * the result does not depend on the frame rate.
 *
 * @param dtMs - Frame time (ms).
 * @param timeConstantMs - Time to close ~63 % of a gap (ms).
 * @returns Fraction of the gap to close this frame, 0..1.
 */
export function smoothingGain(dtMs: number, timeConstantMs: number): number {
  if (dtMs <= 0) return 0;
  if (timeConstantMs <= 0) return 1;
  return 1 - Math.exp(-dtMs / timeConstantMs);
}
