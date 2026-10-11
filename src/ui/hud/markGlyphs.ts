/**
 * markGlyphs — how the squad mark is drawn: a red bracket box with
 * crosshair ticks around a marked ship (in the world and on the radar), and
 * an edge arrow wearing the same brackets. Colour: HOLO_PALETTE.danger, so
 * a mark never reads as the amber locked-target ring.
 */

import type Phaser from "phaser";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { drawArrowGlyph } from "./HudIcons";
import { bracketSegments, crosshairTicks, type Segment } from "./markMath";

type Graphics = Phaser.GameObjects.Graphics;

/** The squad-mark colour (red — distinct from the amber locked target). */
export const MARK_COLOR = HOLO_PALETTE.danger;

/** Edge-arrow bracket half-size, in arrow-size units. */
const ARROW_BRACKET_RADIUS = 1.3;

/** Edge-arrow bracket stroke, in px at scale 1. */
const ARROW_BRACKET_LINE = 2;

/**
 * @param g - Target graphics (line style already set).
 * @param segments - Segments to stroke.
 */
function strokeSegments(g: Graphics, segments: readonly Segment[]): void {
  for (const s of segments) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
}

/**
 * Draw the mark reticle: corner brackets and crosshair ticks.
 *
 * @param g - Target graphics.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - Reticle radius.
 * @param lineWidth - Stroke width.
 */
export function drawMarkReticle(
  g: Graphics,
  cx: number,
  cy: number,
  radius: number,
  lineWidth: number,
): void {
  g.lineStyle(lineWidth, MARK_COLOR, 1);
  strokeSegments(g, bracketSegments(cx, cy, radius));
  strokeSegments(g, crosshairTicks(cx, cy, radius));
}

/**
 * Draw the marked-contact edge arrow: the side-coloured arrowhead inside the
 * mark's red brackets.
 *
 * @param g - Target graphics (glyph at the origin).
 * @param size - Arrow size.
 * @param color - Arrow (side) colour.
 */
export function drawMarkArrowGlyph(
  g: Graphics,
  size: number,
  color: number,
): void {
  drawArrowGlyph(g, size, color);
  drawMarkReticle(g, 0, 0, ARROW_BRACKET_RADIUS * size, ARROW_BRACKET_LINE);
}
