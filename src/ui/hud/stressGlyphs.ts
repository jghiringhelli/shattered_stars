/**
 * Stress state glyphs — a shape per state so the readout never relies on
 * colour alone: circle (calm/normal), down chevron (recovering), warning
 * triangle with "!" (stressed).
 */

import type Phaser from "phaser";
import type { StressKind } from "./stressState";

type Graphics = Phaser.GameObjects.Graphics;

const LINE = 0.14;
const TRIANGLE = { halfWidth: 0.5, top: -0.5, bottom: 0.42 } as const;
const BANG = { top: -0.1, bottom: 0.14, dot: 0.3, dotRadius: 0.05 } as const;
const CHEVRON = { half: 0.38, depth: 0.3, gap: 0.5 } as const;
const CIRCLE = { radius: 0.4, dotRadius: 0.16 } as const;

/** Where and how a glyph is drawn. */
export interface GlyphBox {
  readonly cx: number;
  readonly cy: number;
  readonly size: number;
  readonly color: number;
}

/**
 * Draw a stress-state glyph centred on (cx, cy).
 *
 * @param g - Target graphics.
 * @param kind - Stress state.
 * @param box - Centre, size and colour of the icon.
 */
export function drawStressGlyph(
  g: Graphics,
  kind: StressKind,
  box: GlyphBox,
): void {
  const { cx, cy, size, color } = box;
  g.lineStyle(LINE * size, color, 1);
  g.fillStyle(color, 1);
  if (kind === "stressed") {
    const { halfWidth, top, bottom } = TRIANGLE;
    g.strokeTriangle(
      cx,
      cy + top * size,
      cx - halfWidth * size,
      cy + bottom * size,
      cx + halfWidth * size,
      cy + bottom * size,
    );
    g.lineBetween(cx, cy + BANG.top * size, cx, cy + BANG.bottom * size);
    g.fillCircle(cx, cy + BANG.dot * size, BANG.dotRadius * size);
    return;
  }
  if (kind === "recovering") {
    for (const dy of [-CHEVRON.gap / 2, CHEVRON.gap / 2]) {
      const y = cy + dy * size - (CHEVRON.depth * size) / 2;
      g.lineBetween(cx - CHEVRON.half * size, y, cx, y + CHEVRON.depth * size);
      g.lineBetween(cx, y + CHEVRON.depth * size, cx + CHEVRON.half * size, y);
    }
    return;
  }
  g.strokeCircle(cx, cy, CIRCLE.radius * size);
  if (kind === "normal") g.fillCircle(cx, cy, CIRCLE.dotRadius * size);
}
