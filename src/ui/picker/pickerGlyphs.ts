/**
 * pickerGlyphs — small vector marks used by the ship picker: the padlock on
 * XP-locked catalog cards and the hairline outline of tag chips.
 */

import type Phaser from "phaser";
import { drawHoloFrame } from "../menu/holoChrome";
import { HOLO_RADIUS } from "../theme/HoloTheme";

/** Tag chip height. */
export const TAG_CHIP_HEIGHT = 14;
/** Outline opacity of tag chips. */
const TAG_CHIP_BORDER_ALPHA = 0.6;

/**
 * Hairline (unfilled) tag chip outline.
 *
 * @param scene - Owning scene.
 * @param box - Chip left, vertical centre and width.
 * @param color - Outline colour.
 * @returns The graphics.
 */
export function drawTagChip(
  scene: Phaser.Scene,
  box: { readonly x: number; readonly centreY: number; readonly width: number },
  color: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawHoloFrame(
    g,
    {
      x: box.x,
      y: box.centreY - TAG_CHIP_HEIGHT / 2,
      width: box.width,
      height: TAG_CHIP_HEIGHT,
    },
    {
      accent: color,
      fillAlpha: 0,
      borderAlpha: TAG_CHIP_BORDER_ALPHA,
      radius: HOLO_RADIUS.sm,
    },
  );
  return g;
}

/** Padlock proportions relative to its size. */
const LOCK = {
  bodyWidth: 0.72,
  bodyHeight: 0.5,
  bodyTop: -0.02,
  shackleRadius: 0.22,
  shackleCentre: -0.08,
  stroke: 1.5,
} as const;

/**
 * Draw a small padlock glyph centred on (x, y).
 *
 * @param g - Target graphics.
 * @param centre - Glyph centre.
 * @param size - Glyph height in pixels.
 * @param color - Glyph colour.
 */
export function drawLockGlyph(
  g: Phaser.GameObjects.Graphics,
  centre: { readonly x: number; readonly y: number },
  size: number,
  color: number,
): void {
  const { x, y } = centre;
  const bodyW = size * LOCK.bodyWidth;
  g.fillStyle(color, 1);
  g.fillRoundedRect(
    x - bodyW / 2,
    y + size * LOCK.bodyTop,
    bodyW,
    size * LOCK.bodyHeight,
    HOLO_RADIUS.sm / 2,
  );
  const shackleY = y + size * LOCK.shackleCentre;
  const radius = size * LOCK.shackleRadius;
  g.lineStyle(LOCK.stroke, color, 1);
  g.beginPath();
  g.arc(x, shackleY, radius, Math.PI, Math.PI * 2, false);
  g.strokePath();
  g.lineBetween(x - radius, shackleY, x - radius, y + size * LOCK.bodyTop);
  g.lineBetween(x + radius, shackleY, x + radius, y + size * LOCK.bodyTop);
}
