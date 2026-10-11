/**
 * sideGlyphs — non-colour side markers, so friend vs foe never relies on
 * colour alone (colourblind players, high-glare screens):
 * - friendly (player/ally) radar blips wear a thin ring; hostiles are bare;
 *   neutrals wear a square frame (NATO-style frame shapes);
 * - friendly edge arrows carry a tail bar across their back.
 */

import type Phaser from "phaser";
import type { HoloSide } from "../theme/HoloTheme";

type Graphics = Phaser.GameObjects.Graphics;

/** Frame shape drawn around a contact of a side. */
export type SideFrame = "ring" | "none" | "square";

/** Ring/square radius relative to the blip radius. */
const FRAME_SCALE = 1.7;
/** Frame stroke width in px. */
const FRAME_LINE = 1;
/** Tail bar half-length and offset behind the arrow origin, in arrow-size units. */
const TAIL = { halfLength: 0.55, offset: 0.95, width: 2 } as const;

/**
 * @param side - Contact allegiance.
 * @returns The frame that identifies it without colour.
 */
export function sideFrame(side: HoloSide): SideFrame {
  if (side === "enemy") return "none";
  return side === "neutral" ? "square" : "ring";
}

/**
 * Stroke a contact's side frame around a radar blip.
 *
 * @param g - Target graphics.
 * @param side - Contact allegiance.
 * @param at - Blip centre and nominal radius.
 * @param color - Stroke colour.
 * @param alpha - Stroke opacity.
 */
export function drawSideFrame(
  g: Graphics,
  side: HoloSide,
  at: { readonly x: number; readonly y: number; readonly radius: number },
  color: number,
  alpha: number,
): void {
  const frame = sideFrame(side);
  if (frame === "none") return;
  const r = at.radius * FRAME_SCALE;
  g.lineStyle(FRAME_LINE, color, alpha);
  if (frame === "ring") g.strokeCircle(at.x, at.y, r);
  else g.strokeRect(at.x - r, at.y - r, r * 2, r * 2);
}

/**
 * Draw the friendly tail bar on an edge arrow (glyph at the origin
 * pointing +x); hostile arrows stay plain.
 *
 * @param g - Target graphics.
 * @param side - Contact allegiance.
 * @param size - Arrow size.
 * @param color - Bar colour.
 */
export function drawSideTail(
  g: Graphics,
  side: HoloSide,
  size: number,
  color: number,
): void {
  if (sideFrame(side) === "none") return;
  const x = -TAIL.offset * size;
  const half = TAIL.halfLength * size;
  g.lineStyle(TAIL.width, color, 1);
  g.lineBetween(x, -half, x, half);
}
