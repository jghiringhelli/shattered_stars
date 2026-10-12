/**
 * radarBoundary — a circular arena boundary (Survival's asteroid-belt safe
 * radius) projected onto the heading-up radar as polylines (pure). Only the
 * stretches within radar range are kept, so the ring shows up as the
 * player nears it and never spills past the radar rim.
 */

import {
  rotateToHeadingUp,
  shortestDelta,
  type RadarProjectionOptions,
} from "./hudMath";
import type { HudBoundaryRing, HudPoint, HudPose } from "./types";

/** Points sampled around the boundary circle. */
const RING_SAMPLES = 180;

/**
 * @param player - Player pose (radar centre, forward is up).
 * @param boundary - The boundary circle.
 * @param options - Radar range, radius and world size.
 * @returns Radar-local polylines of the boundary within range (each with at
 *   least two points); empty when none of it is in range.
 */
export function radarBoundaryPaths(
  player: HudPose,
  boundary: HudBoundaryRing,
  options: RadarProjectionOptions,
): HudPoint[][] {
  const scale = options.radiusPx / options.rangePx;
  const paths: HudPoint[][] = [];
  let current: HudPoint[] = [];
  let firstStartsAtZero = false;
  for (let i = 0; i < RING_SAMPLES; i++) {
    const theta = (i / RING_SAMPLES) * 2 * Math.PI;
    const world = {
      x: boundary.center.x + boundary.radius * Math.cos(theta),
      y: boundary.center.y + boundary.radius * Math.sin(theta),
    };
    const delta = shortestDelta(player, world, options.worldSize);
    if (Math.hypot(delta.x, delta.y) > options.rangePx) {
      if (current.length > 0) paths.push(current);
      current = [];
      continue;
    }
    if (i === 0) firstStartsAtZero = true;
    const local = rotateToHeadingUp(delta, player.angle);
    current.push({ x: local.x * scale, y: local.y * scale });
  }
  return closeRing(paths, current, firstStartsAtZero);
}

/**
 * @param paths - Finished stretches, in sample order.
 * @param last - The stretch still open at the last sample.
 * @param firstStartsAtZero - True when the first stretch began at sample 0.
 * @returns The stretches with the ring's seam joined (a stretch running
 *   through sample 0 is one path; a full ring is closed), each ≥ 2 points.
 */
function closeRing(
  paths: HudPoint[][],
  last: HudPoint[],
  firstStartsAtZero: boolean,
): HudPoint[][] {
  if (paths.length === 0 && last.length === RING_SAMPLES)
    return [[...last, last[0]!]];
  const [first, ...rest] = paths;
  const joined =
    first && last.length > 0 && firstStartsAtZero
      ? [[...last, ...first], ...rest]
      : last.length > 0
        ? [...paths, last]
        : paths;
  return joined.filter((path) => path.length >= 2);
}
