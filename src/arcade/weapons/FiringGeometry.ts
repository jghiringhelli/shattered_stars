/**
 * FiringGeometry — the one torus-aware geometry every weapon uses: range
 * and bearing the short way across the map seam, firing-arc envelopes with
 * an optional minimum range (X-Wing range bands), the point astern where
 * devices are dropped and the heading toward a target.
 *
 * Angles follow the ship convention: degrees, 0 = up/north, clockwise.
 * Pure: no Phaser.
 */

import { torusDelta } from "../../core/Torus";

/** Ship angle 0 points up; screen-space atan2 0 points right. */
const NORTH_UP_OFFSET_DEG = 90;
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const FULL_TURN_DEG = 360;
const HALF_TURN_DEG = 180;

/** Where a ship is and where its nose points. */
export interface FiringPose {
  readonly x: number;
  readonly y: number;
  /** Degrees, 0 = up/north, clockwise positive. */
  readonly angle: number;
}

/** A point on the map. */
export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

/** A weapon's reach: range band and arc centred on the nose. */
export interface ArcEnvelope {
  /** Targets closer than this cannot be engaged (default 0). */
  readonly minRangePx?: number;
  /** Targets at or beyond this cannot be engaged. */
  readonly maxRangePx: number;
  /** Full arc in degrees, half on each side of the nose; ≥360 = all-round. */
  readonly arcDeg: number;
}

/**
 * @param degrees - Any angle.
 * @returns The same angle in [-180, 180).
 */
export function wrapDegrees(degrees: number): number {
  const wrapped = (degrees + HALF_TURN_DEG) % FULL_TURN_DEG;
  return (wrapped < 0 ? wrapped + FULL_TURN_DEG : wrapped) - HALF_TURN_DEG;
}

/**
 * @param value - A coordinate.
 * @param worldSize - Map edge length (px).
 * @returns The coordinate wrapped into [0, worldSize).
 */
export function wrapCoordinatePx(value: number, worldSize: number): number {
  return ((value % worldSize) + worldSize) % worldSize;
}

/**
 * @param from - One point.
 * @param to - Another point.
 * @param worldSize - Map edge length (px).
 * @returns Distance the short way across the seam.
 */
export function torusRangePx(
  from: MapPoint,
  to: MapPoint,
  worldSize: number,
): number {
  const { dx, dy } = torusDelta(from.x, from.y, to.x, to.y, worldSize);
  return Math.hypot(dx, dy);
}

/**
 * @param from - The observer.
 * @param to - The point looked at.
 * @param worldSize - Map edge length (px).
 * @returns Heading (ship convention) from `from` toward `to`, in [0, 360).
 */
export function headingTowardDeg(
  from: MapPoint,
  to: MapPoint,
  worldSize: number,
): number {
  const { dx, dy } = torusDelta(from.x, from.y, to.x, to.y, worldSize);
  const heading = Math.atan2(dy, dx) * RAD_TO_DEG + NORTH_UP_OFFSET_DEG;
  return ((heading % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG;
}

/**
 * @param from - The ship.
 * @param to - The point.
 * @param worldSize - Map edge length (px).
 * @returns Signed angle of the point off the nose, in [-180, 180).
 */
export function bearingOffNoseDeg(
  from: FiringPose,
  to: MapPoint,
  worldSize: number,
): number {
  return wrapDegrees(headingTowardDeg(from, to, worldSize) - from.angle);
}

/**
 * Whether a point (or a hull of `targetRadiusPx` around it) sits inside a
 * weapon's range band and arc. A big hull counts from its edge: range to
 * the edge, and any part of it inside the arc.
 *
 * @param from - The firing ship.
 * @param to - The point (target centre).
 * @param envelope - Range band and arc.
 * @param worldSize - Map edge length (px).
 * @param targetRadiusPx - Hull radius of the target (default 0: a point).
 * @returns True when the point can be engaged.
 */
export function inArcEnvelope(
  from: FiringPose,
  to: MapPoint,
  envelope: ArcEnvelope,
  worldSize: number,
  targetRadiusPx = 0,
): boolean {
  const range = torusRangePx(from, to, worldSize);
  if (range - targetRadiusPx >= envelope.maxRangePx) return false;
  if (range < (envelope.minRangePx ?? 0)) return false;
  if (envelope.arcDeg >= FULL_TURN_DEG) return true;
  const hullHalfWidthDeg =
    range > targetRadiusPx
      ? Math.asin(targetRadiusPx / range) * RAD_TO_DEG
      : HALF_TURN_DEG;
  return (
    Math.abs(bearingOffNoseDeg(from, to, worldSize)) <
    envelope.arcDeg / 2 + hullHalfWidthDeg
  );
}

/**
 * @param pose - The ship.
 * @param distancePx - How far behind it.
 * @param worldSize - Map edge length (px).
 * @returns The point straight astern, wrapped onto the map.
 */
export function pointAstern(
  pose: FiringPose,
  distancePx: number,
  worldSize: number,
): MapPoint {
  return pointAlong(pose, -distancePx, worldSize);
}

/**
 * @param pose - Start point and heading.
 * @param distancePx - Distance along the heading (negative = backwards).
 * @param worldSize - Map edge length (px).
 * @returns The point reached, wrapped onto the map.
 */
export function pointAlong(
  pose: FiringPose,
  distancePx: number,
  worldSize: number,
): MapPoint {
  const rad = (pose.angle - NORTH_UP_OFFSET_DEG) * DEG_TO_RAD;
  return {
    x: wrapCoordinatePx(pose.x + Math.cos(rad) * distancePx, worldSize),
    y: wrapCoordinatePx(pose.y + Math.sin(rad) * distancePx, worldSize),
  };
}
