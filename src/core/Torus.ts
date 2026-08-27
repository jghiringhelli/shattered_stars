/**
 * Torus math — shortest-path deltas on a wraparound (toroidal) map.
 *
 * The arcade battlefield wraps at BATTLEFIELD_SIZE on both axes. Any code
 * that computes distance, heading, or collision between two points on the
 * map must use these helpers instead of raw subtraction, otherwise it will
 * measure the "long way" across the map and produce wrong steering,
 * targeting, and hit-tests near the seam.
 */

/** Shortest signed delta from `a` to `b` on a 1D torus of length `size`. */
export function torusAxisDelta(a: number, b: number, size: number): number {
  const half = size / 2;
  let d = (((b - a) % size) + size) % size;
  if (d > half) d -= size;
  return d;
}

/** Shortest 2D delta {dx, dy} from A→B on a torus of side `size`. */
export function torusDelta(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  size: number,
): { dx: number; dy: number } {
  return {
    dx: torusAxisDelta(ax, bx, size),
    dy: torusAxisDelta(ay, by, size),
  };
}

/** Shortest Euclidean distance between two points on a torus of side `size`. */
export function torusDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  size: number,
): number {
  const { dx, dy } = torusDelta(ax, ay, bx, by, size);
  return Math.sqrt(dx * dx + dy * dy);
}
