/**
 * Pose sampling along a maneuver path (split out of ArcadeControls, which
 * re-exports it).
 */

/**
 * Pose at a fraction of a sampled maneuver path, interpolated between the two
 * nearest waypoints so motion is smooth at any tick rate (no 25 ms steps).
 *
 * @param path - Waypoints from start to end of the cycle.
 * @param progress - Fraction of the cycle elapsed, 0–1.
 * @returns The interpolated pose, or null for an empty path.
 */
export function samplePath(
  path: ReadonlyArray<{ x: number; y: number; angle: number }>,
  progress: number,
): { x: number; y: number; angle: number } | null {
  if (path.length === 0) return null;
  const scaled = Math.max(0, Math.min(1, progress)) * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(scaled));
  const from = path[Math.max(0, index)]!;
  const to = path[Math.max(0, index) + 1] ?? from;
  const f = scaled - Math.max(0, index);
  const turn = ((to.angle - from.angle + 540) % 360) - 180;
  return {
    x: from.x + (to.x - from.x) * f,
    y: from.y + (to.y - from.y) * f,
    angle: (((from.angle + turn * f) % 360) + 360) % 360,
  };
}
