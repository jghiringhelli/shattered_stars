/**
 * radarSeamDraw — paints the arena-edge hint on the radar: a faint dashed
 * line with a small arrow showing that crossing it wraps to the far side.
 */

import type Phaser from "phaser";
import type { RadarSeam } from "./radarSeams";

/** Dash and gap length along the line (px). */
const DASH_PX = 4;
const GAP_PX = 4;
const LINE_WIDTH = 1;
/** Arrow half-width and length (px). */
const ARROW_WING_PX = 3;
const ARROW_LENGTH_PX = 5;
/** Offset of the arrow towards the player, so it sits beside the line. */
const ARROW_INSET_PX = 6;

/**
 * @param graphics - Radar blip graphics (radar-local coordinates).
 * @param seams - Seams from {@link radarSeamLines}.
 * @param color - Line colour.
 * @param alpha - Line opacity (keep it subtle).
 */
export function drawRadarSeams(
  graphics: Phaser.GameObjects.Graphics,
  seams: ReadonlyArray<RadarSeam>,
  color: number,
  alpha: number,
): void {
  graphics.lineStyle(LINE_WIDTH, color, alpha);
  for (const seam of seams) {
    drawDashed(graphics, seam);
    drawWrapArrow(graphics, seam);
  }
}

function drawDashed(graphics: Phaser.GameObjects.Graphics, seam: RadarSeam): void {
  const dx = seam.to.x - seam.from.x;
  const dy = seam.to.y - seam.from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return;
  const ux = dx / length;
  const uy = dy / length;
  for (let at = 0; at < length; at += DASH_PX + GAP_PX) {
    const end = Math.min(at + DASH_PX, length);
    graphics.lineBetween(
      seam.from.x + ux * at,
      seam.from.y + uy * at,
      seam.from.x + ux * end,
      seam.from.y + uy * end,
    );
  }
}

function drawWrapArrow(graphics: Phaser.GameObjects.Graphics, seam: RadarSeam): void {
  const { crossing, nearest } = seam;
  const tipX = nearest.x - crossing.x * ARROW_INSET_PX + crossing.x * ARROW_LENGTH_PX;
  const tipY = nearest.y - crossing.y * ARROW_INSET_PX + crossing.y * ARROW_LENGTH_PX;
  const baseX = tipX - crossing.x * ARROW_LENGTH_PX;
  const baseY = tipY - crossing.y * ARROW_LENGTH_PX;
  const sideX = -crossing.y * ARROW_WING_PX;
  const sideY = crossing.x * ARROW_WING_PX;
  graphics.lineBetween(baseX + sideX, baseY + sideY, tipX, tipY);
  graphics.lineBetween(baseX - sideX, baseY - sideY, tipX, tipY);
}
