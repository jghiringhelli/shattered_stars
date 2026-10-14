/**
 * radarSeams — where the wrapping arena's edges lie on the heading-up radar
 * (pure). The arena is a torus, so the left/right and top/bottom edges are
 * the same line; seen from the player the seam is a straight world-axis line
 * whose arrow says "cross here and you come out the other side".
 */

import {
  rotateToHeadingUp,
  type RadarProjectionOptions,
} from "./hudMath";
import type { HudPoint, HudPose } from "./types";

/** One arena-edge line within radar range, in radar-local px. */
export interface RadarSeam {
  readonly from: HudPoint;
  readonly to: HudPoint;
  /** Unit direction (radar-local) that crosses the seam away from the player. */
  readonly crossing: HudPoint;
  /** Where the line is closest to the player (arrow anchor). */
  readonly nearest: HudPoint;
}

/**
 * @param player - Player pose (radar centre, forward is up).
 * @param options - Radar range, radius and world size.
 * @returns The arena edges within range (at most two per axis); empty for an unwrapped world.
 */
export function radarSeamLines(
  player: HudPose,
  options: RadarProjectionOptions,
): RadarSeam[] {
  const { worldSize, rangePx, radiusPx } = options;
  if (!(worldSize > 0) || !(rangePx > 0)) return [];
  const scale = radiusPx / rangePx;
  const seams: RadarSeam[] = [];
  for (const axis of ["x", "y"] as const) {
    const position = player[axis];
    for (const offset of [-position, worldSize - position]) {
      if (Math.abs(offset) >= rangePx) continue;
      seams.push(buildSeam(axis, offset, player.angle, rangePx, scale));
    }
  }
  return seams;
}

function buildSeam(
  axis: "x" | "y",
  offset: number,
  angle: number,
  rangePx: number,
  scale: number,
): RadarSeam {
  const half = Math.sqrt(rangePx * rangePx - offset * offset);
  const at = (along: number): HudPoint => {
    const delta = axis === "x" ? { x: offset, y: along } : { x: along, y: offset };
    const local = rotateToHeadingUp(delta, angle);
    return { x: local.x * scale, y: local.y * scale };
  };
  const direction = Math.sign(offset) || 1;
  const across = rotateToHeadingUp(
    axis === "x" ? { x: direction, y: 0 } : { x: 0, y: direction },
    angle,
  );
  return { from: at(-half), to: at(half), crossing: across, nearest: at(0) };
}
