/**
 * arcTargeting — the nearest ship inside a forward arc on the torus. Shared
 * by homing ordnance (which ship a missile locks) and the HUD (which ship is
 * marked as the player's target), so the two always agree. Pure.
 */

import { torusDelta } from "../../core/Torus";

/** A ship that can be picked as a target. */
export interface ArcCandidate {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly faction: string;
}

/**
 * Bearing from one point to another in ship-angle convention.
 *
 * @param dx - Torus-shortest x offset.
 * @param dy - Torus-shortest y offset.
 * @returns Degrees in [0, 360): 0 = up/north, clockwise positive.
 */
export function bearingDeg(dx: number, dy: number): number {
  return ((((Math.atan2(dy, dx) * 180) / Math.PI + 90) % 360) + 360) % 360;
}

/**
 * Smallest absolute difference between two headings.
 *
 * @param a - Heading (°).
 * @param b - Heading (°).
 * @returns Degrees in [0, 180].
 */
export function headingGapDeg(a: number, b: number): number {
  const diff = Math.abs((((a - b) % 360) + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Nearest candidate within ±halfArcDeg of the heading.
 *
 * @param origin - The looking ship's position.
 * @param headingDeg - Its facing (°, 0 = up, clockwise).
 * @param candidates - Ships to choose from (already filtered to enemies).
 * @param halfArcDeg - Half-width of the arc (°).
 * @param worldSize - Torus side length (<= 0 for a plane).
 * @returns The nearest candidate in arc, or null.
 */
export function nearestInArc<T extends ArcCandidate>(
  origin: { readonly x: number; readonly y: number },
  headingDeg: number,
  candidates: Iterable<T>,
  halfArcDeg: number,
  worldSize: number,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const { dx, dy } =
      worldSize > 0
        ? torusDelta(origin.x, origin.y, candidate.x, candidate.y, worldSize)
        : { dx: candidate.x - origin.x, dy: candidate.y - origin.y };
    if (headingGapDeg(bearingDeg(dx, dy), headingDeg) > halfArcDeg) continue;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}
