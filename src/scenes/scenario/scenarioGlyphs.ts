/**
 * scenarioGlyphs — how a scenario objective is drawn, everywhere it appears
 * (battlefield, radar, edge arrows): the shape names the kind (satellite ◆,
 * node ⬡, crate ■) and the owner is shown three ways, never by colour
 * alone — colour (live side tokens), fill (owned = solid, open = hollow,
 * contested = hollow with a cross) and frame (ours wears the friendly ring,
 * theirs is bare, as sideGlyphs marks contacts).
 */

import type Phaser from "phaser";
import type { ObjectiveOwner } from "../../arcade/scenarios";
import { HOLO_PALETTE, SIDE_COLORS } from "../../ui/theme/HoloTheme";
import type { GlyphKind } from "./scenarioHudModel";

type Graphics = Phaser.GameObjects.Graphics;

/** Fill opacity of an owned objective's shape. */
const OWNED_FILL_ALPHA = 0.85;
/** Friendly ring radius relative to the glyph size. */
const RING_SCALE = 1.6;
/** Stroke width of glyph outlines (px at scale 1). */
const GLYPH_LINE = 1.5;
/** Hexagon corners. */
const HEX_SIDES = 6;
/** Contested cross half-size relative to the glyph size. */
const CROSS_SCALE = 0.55;

/**
 * @param owner - Who holds an objective.
 * @returns Its colour (live palette tokens).
 */
export function ownerColor(owner: ObjectiveOwner): number {
  if (owner === "player") return SIDE_COLORS.player;
  if (owner === "enemy") return SIDE_COLORS.enemy;
  if (owner === "contested") return HOLO_PALETTE.warning;
  return SIDE_COLORS.neutral;
}

/**
 * Draw an objective glyph centred on (x, y).
 *
 * @param g - Target graphics.
 * @param glyph - Kind and owner.
 * @param at - Centre and size (half-extent, px).
 * @param alpha - Overall opacity.
 */
export function drawObjectiveGlyph(
  g: Graphics,
  glyph: { readonly kind: GlyphKind; readonly owner: ObjectiveOwner },
  at: { readonly x: number; readonly y: number; readonly size: number },
  alpha = 1,
): void {
  const color = ownerColor(glyph.owner);
  const points = shapePoints(glyph.kind, at.x, at.y, at.size);
  const owned = glyph.owner === "player" || glyph.owner === "enemy";
  if (owned) {
    g.fillStyle(color, OWNED_FILL_ALPHA * alpha);
    g.fillPoints(points, true);
  }
  g.lineStyle(GLYPH_LINE, color, alpha);
  g.strokePoints(points, true);
  if (glyph.owner === "contested") {
    const c = at.size * CROSS_SCALE;
    g.lineBetween(at.x - c, at.y - c, at.x + c, at.y + c);
    g.lineBetween(at.x - c, at.y + c, at.x + c, at.y - c);
  }
  if (glyph.owner === "player")
    g.strokeCircle(at.x, at.y, at.size * RING_SCALE);
}

/**
 * Draw a progress arc (clockwise from 12 o'clock).
 *
 * @param g - Target graphics.
 * @param at - Centre and radius.
 * @param fraction - 0–1.
 * @param color - Arc colour.
 * @param width - Line width.
 */
export function drawProgressArc(
  g: Graphics,
  at: { readonly x: number; readonly y: number; readonly radius: number },
  fraction: number,
  color: number,
  width: number,
): void {
  if (fraction <= 0) return;
  const start = -Math.PI / 2;
  g.lineStyle(width, color, 1);
  g.beginPath();
  g.arc(at.x, at.y, at.radius, start, start + fraction * Math.PI * 2, false);
  g.strokePath();
}

/**
 * @returns The outline of a glyph kind as points.
 */
function shapePoints(
  kind: GlyphKind,
  x: number,
  y: number,
  size: number,
): { x: number; y: number }[] {
  if (kind === "satellite") {
    return [
      { x, y: y - size },
      { x: x + size, y },
      { x, y: y + size },
      { x: x - size, y },
    ];
  }
  if (kind === "crate") {
    const s = size * Math.SQRT1_2;
    return [
      { x: x - s, y: y - s },
      { x: x + s, y: y - s },
      { x: x + s, y: y + s },
      { x: x - s, y: y + s },
    ];
  }
  return Array.from({ length: HEX_SIDES }, (_, i) => {
    const a = (i / HEX_SIDES) * Math.PI * 2 - Math.PI / 2;
    return { x: x + Math.cos(a) * size, y: y + Math.sin(a) * size };
  });
}
