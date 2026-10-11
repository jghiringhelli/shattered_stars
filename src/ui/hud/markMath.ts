/**
 * markMath — geometry of the squad-mark reticle (pure, unit-tested): which
 * contacts are marked, where a marked ship's nearest torus image is relative
 * to the camera, how big its reticle is at a zoom, and the bracket and
 * crosshair segments that draw it.
 */

import { SHIP_SIZES } from "../../config";
import { shortestDelta } from "./hudMath";
import type { ContactHudState, HudPoint, HudSizeClass } from "./types";

/** In-world reticle radius as a multiple of the ship's base size. */
export const MARK_RETICLE_SIZE_FACTOR = 0.9;

/** The in-world reticle never shrinks below this on screen (px). */
export const MARK_RETICLE_MIN_SCREEN_PX = 18;

/** Bracket arm length as a fraction of the reticle radius. */
export const MARK_BRACKET_ARM = 0.45;

/** Crosshair ticks run from this fraction of the radius... */
export const MARK_TICK_INNER = 0.55;

/** ...to this fraction (they poke out past the brackets). */
export const MARK_TICK_OUTER = 1.25;

/** A line segment. */
export interface Segment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * @param contacts - HUD contacts.
 * @returns The live marked ones.
 */
export function markedContacts(
  contacts: ReadonlyArray<ContactHudState>,
): ContactHudState[] {
  return contacts.filter((c) => c.alive && c.isMarked === true);
}

/**
 * The image of a point nearest an anchor on the torus — where to draw a
 * world-space overlay so it sits on the ship the camera actually shows.
 *
 * @param anchor - Reference point (camera centre).
 * @param point - Wrapped world point.
 * @param worldSize - Torus side length (<= 0 for an unwrapped plane).
 * @returns World coordinates of the nearest image.
 */
export function nearestImage(
  anchor: HudPoint,
  point: HudPoint,
  worldSize: number,
): HudPoint {
  const d = shortestDelta(anchor, point, worldSize);
  return { x: anchor.x + d.x, y: anchor.y + d.y };
}

/**
 * @param sizeClass - The marked ship's size class.
 * @param zoom - Camera zoom (> 0).
 * @returns Reticle radius in world px: hugs the ship, never smaller on
 *   screen than {@link MARK_RETICLE_MIN_SCREEN_PX}.
 */
export function markReticleWorldRadius(
  sizeClass: HudSizeClass,
  zoom: number,
): number {
  return Math.max(
    SHIP_SIZES[sizeClass] * MARK_RETICLE_SIZE_FACTOR,
    MARK_RETICLE_MIN_SCREEN_PX / zoom,
  );
}

/**
 * Four corner brackets around a centre (two arms each, pointing inward).
 *
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - Half the bracket box side.
 * @returns Eight segments.
 */
export function bracketSegments(
  cx: number,
  cy: number,
  radius: number,
): Segment[] {
  const arm = radius * MARK_BRACKET_ARM;
  const segments: Segment[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x = cx + sx * radius;
      const y = cy + sy * radius;
      segments.push({ x1: x, y1: y, x2: x - sx * arm, y2: y });
      segments.push({ x1: x, y1: y, x2: x, y2: y - sy * arm });
    }
  }
  return segments;
}

/**
 * Four crosshair ticks (up, right, down, left) around a centre.
 *
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - Reticle radius.
 * @returns Four segments.
 */
export function crosshairTicks(
  cx: number,
  cy: number,
  radius: number,
): Segment[] {
  const inner = radius * MARK_TICK_INNER;
  const outer = radius * MARK_TICK_OUTER;
  return [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ].map(([dx, dy]) => ({
    x1: cx + dx! * inner,
    y1: cy + dy! * inner,
    x2: cx + dx! * outer,
    y2: cy + dy! * outer,
  }));
}
