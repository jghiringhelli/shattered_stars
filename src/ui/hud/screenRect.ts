/**
 * Screen-space rectangle helpers — pure, no Phaser.
 *
 * Used to keep edge arrows off the bottom HUD cluster: an arrow whose edge
 * position falls inside a widget's bounds slides back along its own ray
 * (so it still points at its ship) until it leaves the widget.
 */

import type { Vector2 } from "./hudMath";

/** Axis-aligned rectangle in screen px. */
export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Grow (or shrink, with negative padding) a rect about its centre.
 *
 * @param rect - Source rect.
 * @param padding - Pixels added on every side.
 * @returns The new rect; size never goes below 0.
 */
export function inflateRect(rect: ScreenRect, padding: number): ScreenRect {
  const width = Math.max(0, rect.width + padding * 2);
  const height = Math.max(0, rect.height + padding * 2);
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

function strictlyInside(p: Vector2, rect: ScreenRect): boolean {
  return (
    p.x > rect.x &&
    p.x < rect.x + rect.width &&
    p.y > rect.y &&
    p.y < rect.y + rect.height
  );
}

/** Parameter t at which a 1D ray enters the slab [min, max]; -Infinity when parallel. */
function slabEntry(
  origin: number,
  direction: number,
  min: number,
  max: number,
): number {
  if (direction === 0) return Number.NEGATIVE_INFINITY;
  return Math.min((min - origin) / direction, (max - origin) / direction);
}

/**
 * Move `to` back toward `from` along the segment until it is no longer
 * strictly inside `rect`.
 *
 * @param from - Ray origin (screen centre).
 * @param to - Candidate point (arrow position).
 * @param rect - Obstacle.
 * @returns `to` if it is outside the rect; otherwise the point where the
 *   segment enters the rect (or `from` when `from` is itself inside).
 */
export function pullOutOfRect(
  from: Vector2,
  to: Vector2,
  rect: ScreenRect,
): Vector2 {
  if (!strictlyInside(to, rect)) return to;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const entry = Math.max(
    slabEntry(from.x, dx, rect.x, rect.x + rect.width),
    slabEntry(from.y, dy, rect.y, rect.y + rect.height),
  );
  const t = Math.min(1, Math.max(0, entry));
  return { x: from.x + dx * t, y: from.y + dy * t };
}
