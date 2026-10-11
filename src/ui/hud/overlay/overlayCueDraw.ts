/**
 * overlayCueDraw — the transient cues of the ship overlay: the damage flash
 * and the repair shimmer (+ glyph). Thin view code over the pure animator.
 *
 * Damage and repair never differ by colour alone: damage is a full-row
 * white flash (with the ghost trail drawn by overlayDraw), repair is a band
 * MOVING along the restored row up to its fill edge, a lit top edge, a
 * bright cap at the fill edge and a "+" glyph beside the row.
 */

import type Phaser from "phaser";
import { HOLO_PALETTE } from "../../theme/HoloTheme";
import {
  flashStrength,
  shimmerStrength,
  shimmerSweep,
  type ChannelAnimation,
} from "./overlayAnimator";
import type { OverlayRow, OverlayRowLayout } from "./overlayLayout";

/** Peak opacity of the damage flash. */
const FLASH_ALPHA = 0.85;
/** Peak opacity of the shimmer band. */
const SHIMMER_ALPHA = 0.8;
/** Shimmer band width as a fraction of the bar width. */
const SHIMMER_BAND_FRACTION = 0.14;
/** Narrowest shimmer band, in pixels. */
const SHIMMER_BAND_MIN = 3;
/** Stroke width of the "+" glyph. */
const GLYPH_STROKE = 1.5;

/** Where the "+" glyph sits and how big it is. */
export interface GlyphPlacement {
  /** Left edge of the glyph area (just past the frame). */
  readonly x: number;
  /** Glyph arm length. */
  readonly size: number;
}

/**
 * Damage flash over a row.
 * @param g - Target graphics.
 * @param box - Bar box.
 * @param row - Row.
 * @param channel - Its animation.
 */
export function drawDamageFlash(
  g: Phaser.GameObjects.Graphics,
  box: OverlayRowLayout,
  row: OverlayRow,
  channel: ChannelAnimation,
): void {
  const strength = flashStrength(channel);
  if (strength <= 0) return;
  g.fillStyle(HOLO_PALETTE.textPrimary, FLASH_ALPHA * strength);
  g.fillRect(box.left, row.y, box.width, row.height);
}

/**
 * "+" glyph centred vertically on a row.
 * @param g - Target graphics.
 * @param row - Row.
 * @param glyph - Placement.
 * @param color - Glyph colour.
 * @param alpha - Glyph opacity.
 */
function drawPlusGlyph(
  g: Phaser.GameObjects.Graphics,
  row: OverlayRow,
  glyph: GlyphPlacement,
  color: number,
  alpha: number,
): void {
  const cx = glyph.x + glyph.size / 2;
  const cy = row.y + row.height / 2;
  const half = glyph.size / 2;
  const stroke = GLYPH_STROKE / 2;
  g.fillStyle(color, alpha);
  g.fillRect(cx - half, cy - stroke, glyph.size, GLYPH_STROKE);
  g.fillRect(cx - stroke, cy - half, GLYPH_STROKE, glyph.size);
}

/**
 * Repair shimmer on a row: a band sweeping from the bar start to the fill
 * edge, a lit top edge, a bright fill-edge cap and a "+" glyph.
 * @param g - Target graphics.
 * @param box - Bar box.
 * @param row - Row being restored.
 * @param channel - Its animation.
 * @param color - Colour of the restored resource.
 * @param glyph - "+" glyph placement.
 */
export function drawRepairShimmer(
  g: Phaser.GameObjects.Graphics,
  box: OverlayRowLayout,
  row: OverlayRow,
  channel: ChannelAnimation,
  color: number,
  glyph: GlyphPlacement,
): void {
  const sweep = shimmerSweep(channel);
  if (sweep === null) return;
  const strength = shimmerStrength(channel);
  const fillWidth = box.width * channel.value;
  const band = Math.max(SHIMMER_BAND_MIN, box.width * SHIMMER_BAND_FRACTION);
  const center = box.left + sweep * fillWidth;
  const x0 = Math.max(box.left, center - band / 2);
  const x1 = Math.min(box.left + fillWidth, center + band / 2);
  g.fillStyle(HOLO_PALETTE.textPrimary, SHIMMER_ALPHA * strength);
  if (x1 > x0) g.fillRect(x0, row.y, x1 - x0, row.height);
  g.fillStyle(color, strength);
  g.fillRect(box.left, row.y - 1, fillWidth, 1);
  g.fillStyle(HOLO_PALETTE.textPrimary, strength);
  g.fillRect(box.left + fillWidth - 1, row.y - 1, 2, row.height + 2);
  drawPlusGlyph(g, row, glyph, color, strength);
}
