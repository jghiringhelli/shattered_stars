/**
 * objectiveGeometry — torus-aware distances and path following shared by the
 * objective models. Pure.
 */

import { torusDelta, torusDistance } from "../../core/Torus";
import type { ObjectivePoint } from "./objectiveTypes";

export type { ObjectivePoint };

/** A point on a path with the heading of the leg it lies on. */
export interface PathPose {
  readonly x: number;
  readonly y: number;
  /** Degrees, 0 = up/north, clockwise. */
  readonly angle: number;
}

/**
 * @param a - First point.
 * @param b - Second point.
 * @param worldSize - Torus side (<= 0 for a plane).
 * @returns Shortest distance between them.
 */
export function distanceBetween(
  a: ObjectivePoint,
  b: ObjectivePoint,
  worldSize: number,
): number {
  if (worldSize <= 0) return Math.hypot(b.x - a.x, b.y - a.y);
  return torusDistance(a.x, a.y, b.x, b.y, worldSize);
}

/**
 * @param a - A point.
 * @param b - The centre.
 * @param radius - Range.
 * @param worldSize - Torus side.
 * @returns Whether `a` lies within `radius` of `b`.
 */
export function withinRange(
  a: ObjectivePoint,
  b: ObjectivePoint,
  radius: number,
  worldSize: number,
): boolean {
  return distanceBetween(a, b, worldSize) <= radius;
}

/**
 * @param from - Start.
 * @param to - End.
 * @returns Heading in degrees (0 = up, clockwise).
 */
export function headingTo(from: ObjectivePoint, to: ObjectivePoint): number {
  const degrees = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/**
 * @param path - Polyline (plain coordinates — paths never cross the seam).
 * @returns Its total length.
 */
export function pathLength(path: readonly ObjectivePoint[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(
      path[i]!.x - path[i - 1]!.x,
      path[i]!.y - path[i - 1]!.y,
    );
  }
  return total;
}

/**
 * The pose `distance` px along a path (clamped to its ends).
 *
 * @param path - Polyline with at least one point.
 * @param distance - Distance travelled from the first point.
 * @returns Position and leg heading.
 */
export function poseAlongPath(
  path: readonly ObjectivePoint[],
  distance: number,
): PathPose {
  const first = path[0] ?? { x: 0, y: 0 };
  if (path.length < 2) return { x: first.x, y: first.y, angle: 0 };
  let remaining = Math.max(0, distance);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const leg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= leg || i === path.length - 1) {
      const t = leg > 0 ? Math.min(1, remaining / leg) : 1;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle: headingTo(a, b),
      };
    }
    remaining -= leg;
  }
  return { x: first.x, y: first.y, angle: 0 };
}

/**
 * @param from - A point.
 * @param to - Another point.
 * @param worldSize - Torus side.
 * @returns Shortest delta from `from` to `to`.
 */
export function deltaBetween(
  from: ObjectivePoint,
  to: ObjectivePoint,
  worldSize: number,
): { dx: number; dy: number } {
  if (worldSize <= 0) return { dx: to.x - from.x, dy: to.y - from.y };
  return torusDelta(from.x, from.y, to.x, to.y, worldSize);
}

/**
 * @param value - Any number.
 * @returns It clamped to 0..1.
 */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
