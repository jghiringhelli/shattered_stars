/**
 * overlayDraw — draws one ship's hull/shield overlay into a Graphics object
 * from the pure layout + animation state. Thin view code: no game rules.
 *
 * Reading order (top to bottom): shield segments (one per X-Wing shield
 * token) over a hull bar with a tick per miniature hull point. Side is told
 * by SHAPE as well as colour: player = filled chevron, ally = hollow
 * diamond, enemy = reticle corner brackets (amber when targeted). Damage
 * leaves a pale ghost trail that drains; the flash and repair shimmer are
 * drawn by overlayCueDraw.
 */

import type Phaser from "phaser";
import {
  HOLO_PALETTE,
  SIDE_COLORS,
  type HoloSide,
} from "../../theme/HoloTheme";
import type { ChannelAnimation } from "./overlayAnimator";
import { drawDamageFlash, drawRepairShimmer } from "./overlayCueDraw";
import {
  hullStateOf,
  type HullState,
  type OverlayGeometry,
  type OverlayRow,
  type OverlayRowLayout,
  type SegmentFill,
} from "./overlayLayout";

/** Frame padding around the bars. */
const FRAME_PAD = 1;
/** Frame fill opacity (dark translucent holo panel). */
const FRAME_ALPHA = 0.7;
/** Lit segment / hull fill opacity. */
const FILL_ALPHA = 0.95;
/** Partly recharged shield segment opacity. */
const PARTIAL_ALPHA = 0.45;
/** Ghost trail opacity. */
const GHOST_ALPHA = 0.55;
/** Gap between the frame and the side marker / "+" glyph. */
const MARKER_GAP = 2;
/** Stroke width of the side markers. */
const MARKER_STROKE = 1.5;
/** Opacity of the hull tick separators. */
const TICK_ALPHA = 0.85;
/** Chevron half-height as a fraction of the marker size. */
const CHEVRON_HALF_HEIGHT = 0.7;

/** Hull fill colour per condition band. */
const HULL_COLORS: Readonly<Record<HullState, number>> = {
  healthy: HOLO_PALETTE.success,
  damaged: HOLO_PALETTE.warning,
  critical: HOLO_PALETTE.danger,
};

/** Everything needed to draw one overlay frame. */
export interface OverlayDrawState {
  readonly geometry: OverlayGeometry;
  /** Row layout (layoutOverlayRows, computed once per overlay). */
  readonly layout: OverlayRowLayout;
  readonly side: HoloSide;
  readonly targeted: boolean;
  readonly segmentCount: number;
  readonly shieldFill: SegmentFill;
  readonly hullTicks: number;
  readonly shield: ChannelAnimation;
  readonly hull: ChannelAnimation;
}

/**
 * Dark frame with a side-coloured hairline border.
 * @param g - Target graphics.
 * @param box - Bar box.
 * @param side - Allegiance.
 */
function drawFrame(
  g: Phaser.GameObjects.Graphics,
  box: OverlayRowLayout,
  side: HoloSide,
): void {
  const x = box.left - FRAME_PAD;
  const y = box.top - FRAME_PAD;
  const w = box.width + FRAME_PAD * 2;
  const h = box.height + FRAME_PAD * 2;
  g.fillStyle(HOLO_PALETTE.panelFill, FRAME_ALPHA);
  g.fillRect(x, y, w, h);
  g.lineStyle(1, SIDE_COLORS[side], HOLO_PALETTE.borderAlpha);
  g.strokeRect(x, y, w, h);
}

/**
 * Reticle corner brackets around the frame (enemy / targeted marker).
 * @param g - Target graphics.
 * @param box - Bar box.
 * @param size - Bracket arm length.
 * @param color - Bracket colour.
 */
function drawBrackets(
  g: Phaser.GameObjects.Graphics,
  box: OverlayRowLayout,
  size: number,
  color: number,
): void {
  const x0 = box.left - FRAME_PAD - MARKER_GAP;
  const x1 = box.left + box.width + FRAME_PAD + MARKER_GAP;
  const y0 = box.top - FRAME_PAD - MARKER_GAP;
  const y1 = box.top + box.height + FRAME_PAD + MARKER_GAP;
  g.lineStyle(MARKER_STROKE, color, 1);
  g.lineBetween(x0, y0, x0 + size, y0);
  g.lineBetween(x0, y0, x0, y0 + size);
  g.lineBetween(x1, y0, x1 - size, y0);
  g.lineBetween(x1, y0, x1, y0 + size);
  g.lineBetween(x0, y1, x0 + size, y1);
  g.lineBetween(x0, y1, x0, y1 - size);
  g.lineBetween(x1, y1, x1 - size, y1);
  g.lineBetween(x1, y1, x1, y1 - size);
}

/**
 * Side marker: chevron (player), diamond (ally), brackets (enemy/target).
 * @param g - Target graphics.
 * @param box - Bar box.
 * @param state - Draw state (side, targeted, marker size).
 */
function drawSideMarker(
  g: Phaser.GameObjects.Graphics,
  box: OverlayRowLayout,
  state: OverlayDrawState,
): void {
  const size = state.geometry.markerSize;
  const tip = box.left - FRAME_PAD - MARKER_GAP;
  if (state.side === "player") {
    const half = size * CHEVRON_HALF_HEIGHT;
    g.fillStyle(SIDE_COLORS.player, 1);
    g.fillTriangle(tip - size, -half, tip - size, half, tip, 0);
  } else if (state.side === "ally") {
    const cx = tip - size / 2;
    const half = size / 2;
    g.lineStyle(MARKER_STROKE, SIDE_COLORS.ally, 1);
    g.beginPath();
    g.moveTo(cx, -half);
    g.lineTo(cx + half, 0);
    g.lineTo(cx, half);
    g.lineTo(cx - half, 0);
    g.closePath();
    g.strokePath();
  }
  if (state.side === "enemy" || state.targeted) {
    const color = state.targeted ? HOLO_PALETTE.target : SIDE_COLORS.enemy;
    drawBrackets(g, box, size, color);
  }
}

/**
 * Ghost trail over part of a span (fractions of `width`).
 * @param g - Target graphics.
 * @param x - Span start.
 * @param width - Span width.
 * @param row - Row.
 * @param from - Ghost start fraction (the current value).
 * @param to - Ghost end fraction.
 */
function drawGhostSpan(
  g: Phaser.GameObjects.Graphics,
  x: number,
  width: number,
  row: OverlayRow,
  from: number,
  to: number,
): void {
  if (to <= from) return;
  g.fillStyle(HOLO_PALETTE.textPrimary, GHOST_ALPHA);
  g.fillRect(x + from * width, row.y, (to - from) * width, row.height);
}

/**
 * Shield segments: empty track, lit, partly recharged, ghost trail.
 * @param g - Target graphics.
 * @param box - Bar box.
 * @param row - Shield row.
 * @param state - Draw state.
 */
function drawShieldRow(
  g: Phaser.GameObjects.Graphics,
  box: OverlayRowLayout,
  row: OverlayRow,
  state: OverlayDrawState,
): void {
  const count = state.segmentCount;
  const gap = state.geometry.segmentGap;
  const segmentWidth = (box.width - gap * (count - 1)) / count;
  const { lit, partial } = state.shieldFill;
  for (let i = 0; i < count; i++) {
    const x = box.left + i * (segmentWidth + gap);
    g.fillStyle(HOLO_PALETTE.track, HOLO_PALETTE.trackAlpha);
    g.fillRect(x, row.y, segmentWidth, row.height);
    if (i < lit) {
      g.fillStyle(HOLO_PALETTE.shield, FILL_ALPHA);
      g.fillRect(x, row.y, segmentWidth, row.height);
    } else if (i === lit && partial > 0) {
      g.fillStyle(HOLO_PALETTE.shield, PARTIAL_ALPHA);
      g.fillRect(x, row.y, segmentWidth * partial, row.height);
    }
    const from = Math.max(state.shield.value * count - i, 0);
    const to = Math.min(state.shield.ghost * count - i, 1);
    drawGhostSpan(g, x, segmentWidth, row, from, to);
  }
}

/**
 * Hull bar: track, ghost trail, fill, point ticks, critical outline.
 * @param g - Target graphics.
 * @param box - Bar box.
 * @param state - Draw state.
 */
function drawHullRow(
  g: Phaser.GameObjects.Graphics,
  box: OverlayRowLayout,
  state: OverlayDrawState,
): void {
  const row = box.hullRow;
  const value = state.hull.value;
  const hullState = hullStateOf(value);
  g.fillStyle(HOLO_PALETTE.track, HOLO_PALETTE.trackAlpha);
  g.fillRect(box.left, row.y, box.width, row.height);
  drawGhostSpan(g, box.left, box.width, row, value, state.hull.ghost);
  g.fillStyle(HULL_COLORS[hullState], FILL_ALPHA);
  g.fillRect(box.left, row.y, box.width * value, row.height);
  g.fillStyle(HOLO_PALETTE.panelFill, TICK_ALPHA);
  for (let k = 1; k < state.hullTicks; k++) {
    const x = box.left + (box.width * k) / state.hullTicks;
    g.fillRect(x - 0.5, row.y, 1, row.height);
  }
  if (hullState === "critical") {
    g.lineStyle(1, HOLO_PALETTE.danger, 1);
    g.strokeRect(box.left, row.y, box.width, row.height);
  }
}

/**
 * Draw a full overlay frame (clears the graphics first).
 *
 * @param g - Target graphics, positioned at the bar centre.
 * @param state - Layout, side and animation state.
 */
export function drawShipOverlay(
  g: Phaser.GameObjects.Graphics,
  state: OverlayDrawState,
): void {
  g.clear();
  const box = state.layout;
  const glyph = {
    x: box.left + box.width + FRAME_PAD + MARKER_GAP,
    size: state.geometry.markerSize + 1,
  };
  drawFrame(g, box, state.side);
  drawSideMarker(g, box, state);
  if (box.shieldRow) {
    drawShieldRow(g, box, box.shieldRow, state);
    drawDamageFlash(g, box, box.shieldRow, state.shield);
    drawRepairShimmer(
      g,
      box,
      box.shieldRow,
      state.shield,
      HOLO_PALETTE.shield,
      glyph,
    );
  }
  drawHullRow(g, box, state);
  drawDamageFlash(g, box, box.hullRow, state.hull);
  drawRepairShimmer(
    g,
    box,
    box.hullRow,
    state.hull,
    HOLO_PALETTE.success,
    glyph,
  );
}
