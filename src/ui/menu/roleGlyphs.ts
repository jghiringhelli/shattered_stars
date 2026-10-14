/**
 * roleGlyphs — procedural silhouettes for the seven ship roles (no texture
 * assets), used on picker section headers, filter chips and tooltips. Like
 * MenuIcons, geometry is a fraction of the size centred on (cx, cy); the
 * caller owns the Graphics object.
 */

import type Phaser from "phaser";
import type { ShipRole } from "../../core/types";

/** Stroke width as a fraction of the glyph size (never below MIN_STROKE). */
const STROKE_FRACTION = 0.1;
const MIN_STROKE = 1.5;

/**
 * Draws a role's silhouette.
 *
 * @param g - Target graphics (strokes and fills use `color`).
 * @param role - The ship role.
 * @param centre - Glyph centre.
 * @param size - Glyph box size (px).
 * @param color - Colour (0xRRGGBB).
 */
export function drawRoleGlyph(
  g: Phaser.GameObjects.Graphics,
  role: ShipRole,
  centre: { readonly x: number; readonly y: number },
  size: number,
  color: number,
): void {
  const u = size / 2;
  const X = (x: number): number => centre.x + x * u;
  const Y = (y: number): number => centre.y + y * u;
  g.lineStyle(Math.max(MIN_STROKE, size * STROKE_FRACTION), color, 1);
  g.fillStyle(color, 1);
  const line = (x1: number, y1: number, x2: number, y2: number): void => {
    g.lineBetween(X(x1), Y(y1), X(x2), Y(y2));
  };
  const dart = (halfWidth: number): void => {
    g.fillTriangle(X(0), Y(-1), X(halfWidth), Y(0.9), X(-halfWidth), Y(0.9));
  };
  switch (role) {
    case "light_fighter":
      dart(0.6);
      break;
    case "heavy_fighter":
      dart(0.45);
      line(-1, 0.25, 1, 0.25);
      break;
    case "interceptor":
      line(-0.95, 0.95, 0, -1);
      line(0.95, 0.95, 0, -1);
      line(0, -0.6, 0, 0.8);
      break;
    case "bomber":
      g.fillTriangle(X(0), Y(-0.95), X(0.8), Y(0), X(-0.8), Y(0));
      g.fillTriangle(X(0), Y(0.95), X(0.8), Y(0), X(-0.8), Y(0));
      break;
    case "gunship":
      g.fillRect(X(-0.5), Y(-0.6), u, u * 1.5);
      g.strokeCircle(X(0), Y(-0.15), u * 0.35);
      line(0, -0.9, 0, -0.6);
      break;
    case "support":
      g.strokeCircle(X(0), Y(0), u * 0.9);
      line(0, -0.5, 0, 0.5);
      line(-0.5, 0, 0.5, 0);
      break;
    case "capital":
      g.fillRect(X(-0.35), Y(-1), u * 0.7, u * 2);
      line(-0.95, 0.5, 0.95, 0.5);
      line(-0.7, -0.2, 0.7, -0.2);
      break;
  }
}
