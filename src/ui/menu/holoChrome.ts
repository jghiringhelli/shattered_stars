/**
 * holoChrome — Graphics drawing helpers for menu surfaces in the holo look:
 * translucent frames, button faces, gauges and accent rules. Pure draw
 * commands; callers own the Graphics object and its clear().
 */

import type Phaser from "phaser";
import {
  HOLO_ALPHA,
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
} from "../theme/HoloTheme";
import type { ButtonVisual } from "../hud/holoButtonStyle";

type Graphics = Phaser.GameObjects.Graphics;

/** Axis-aligned rectangle (top-left origin). */
export interface HoloRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Frame styling; every field defaults to the neutral panel look. */
export interface HoloFrameOptions {
  readonly accent?: number;
  readonly fill?: number;
  readonly fillAlpha?: number;
  readonly radius?: number;
  readonly borderWidth?: number;
  readonly borderAlpha?: number;
  /** Bright L-ticks at each corner (selected / featured panels). */
  readonly cornerTicks?: boolean;
}

/** Length of corner ticks in pixels. */
const CORNER_TICK = 8;
/** Gap between a control and its keyboard-focus ring. */
export const FOCUS_RING_OFFSET = 3;
/** Width of the bright centre segment of an accent rule. */
const RULE_HIGHLIGHT = 160;

/**
 * Draw a translucent rounded frame (fill + thin border).
 *
 * @param g - Target graphics.
 * @param rect - Frame bounds.
 * @param options - Accent, fill and border overrides.
 */
export function drawHoloFrame(
  g: Graphics,
  rect: HoloRect,
  options: HoloFrameOptions = {},
): void {
  const radius = Math.min(
    options.radius ?? HOLO_RADIUS.md,
    rect.height / 2,
    rect.width / 2,
  );
  const accent = options.accent ?? HOLO_PALETTE.border;
  g.fillStyle(
    options.fill ?? HOLO_PALETTE.panelFill,
    options.fillAlpha ?? HOLO_PALETTE.panelAlpha,
  );
  g.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, radius);
  g.lineStyle(
    options.borderWidth ?? HOLO_BORDER.hairline,
    accent,
    options.borderAlpha ?? HOLO_PALETTE.borderAlpha,
  );
  g.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, radius);
  if (options.cornerTicks === true) drawCornerTicks(g, rect, accent);
}

/**
 * Bright L-shaped ticks at the four corners of a rect.
 *
 * @param g - Target graphics.
 * @param rect - Bounds.
 * @param color - Tick colour.
 */
export function drawCornerTicks(
  g: Graphics,
  rect: HoloRect,
  color: number,
): void {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const inset = HOLO_RADIUS.md;
  const reach = inset + CORNER_TICK;
  g.lineStyle(HOLO_BORDER.regular, color, 1);
  for (const [x, y, dx, dy] of [
    [rect.x, rect.y, 1, 1],
    [right, rect.y, -1, 1],
    [rect.x, bottom, 1, -1],
    [right, bottom, -1, -1],
  ] as const) {
    g.lineBetween(x, y + dy * inset, x, y + dy * reach);
    g.lineBetween(x + dx * inset, y, x + dx * reach, y);
  }
}

/** Options for {@link drawHoloButtonFace}. */
export interface ButtonFaceOptions {
  readonly width: number;
  readonly height: number;
  readonly radius?: number;
  /** Multiplies fill/border alpha (disabled controls). Default 1. */
  readonly alpha?: number;
  readonly focused?: boolean;
}

/**
 * Clear and draw a button face centred on the graphics origin.
 *
 * @param g - Target graphics (cleared first).
 * @param visual - Colours for the current variant/state.
 * @param options - Size, radius, alpha and focus.
 */
export function drawHoloButtonFace(
  g: Graphics,
  visual: ButtonVisual,
  options: ButtonFaceOptions,
): void {
  const { width: w, height: h } = options;
  const radius = Math.min(options.radius ?? HOLO_RADIUS.md, h / 2, w / 2);
  const alpha = options.alpha ?? 1;
  g.clear();
  g.fillStyle(visual.fill, visual.fillAlpha * alpha);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  g.lineStyle(visual.borderWidth, visual.border, alpha);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  if (options.focused !== true) return;
  const fw = w + FOCUS_RING_OFFSET * 2;
  const fh = h + FOCUS_RING_OFFSET * 2;
  g.lineStyle(HOLO_BORDER.focus, HOLO_PALETTE.accent, 1);
  g.strokeRoundedRect(-fw / 2, -fh / 2, fw, fh, radius + FOCUS_RING_OFFSET);
}

/**
 * Draw a horizontal gauge: faint track plus a filled portion.
 *
 * @param g - Target graphics.
 * @param rect - Track bounds.
 * @param fraction - Filled fraction, clamped to [0, 1].
 * @param color - Fill colour.
 */
export function drawHoloGauge(
  g: Graphics,
  rect: HoloRect,
  fraction: number,
  color: number,
): void {
  const radius = Math.min(HOLO_RADIUS.sm, rect.height / 2);
  const filled = Math.max(0, Math.min(1, fraction)) * rect.width;
  g.fillStyle(HOLO_PALETTE.track, HOLO_PALETTE.trackAlpha);
  g.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, radius);
  if (filled <= 0) return;
  g.fillStyle(color, 1);
  g.fillRoundedRect(
    rect.x,
    rect.y,
    Math.max(filled, radius * 2),
    rect.height,
    radius,
  );
}

/**
 * Hairline divider with a brighter centre segment (header underline).
 *
 * @param g - Target graphics.
 * @param rect - Rule extent: x/width span, y is the line; height ignored.
 * @param accent - Rule colour.
 */
export function drawAccentRule(
  g: Graphics,
  rect: HoloRect,
  accent: number,
): void {
  const centre = rect.x + rect.width / 2;
  g.lineStyle(HOLO_BORDER.hairline, accent, HOLO_ALPHA.structure);
  g.lineBetween(rect.x, rect.y, rect.x + rect.width, rect.y);
  g.lineStyle(HOLO_BORDER.regular, accent, 1);
  g.lineBetween(
    centre - RULE_HIGHLIGHT / 2,
    rect.y,
    centre + RULE_HIGHLIGHT / 2,
    rect.y,
  );
}
