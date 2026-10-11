/**
 * Pure geometry for the battle HUD — no Phaser.
 *
 * Conventions:
 *  - World headings are degrees, 0 = up, clockwise positive (ShipState).
 *  - Screen/radar y grows downward; returned rotation angles are radians in
 *    Phaser's convention (0 = +x, clockwise positive).
 *  - The battlefield is a torus: every world delta goes through
 *    {@link shortestDelta}, never raw subtraction.
 */

import { torusAxisDelta } from "../../core/Torus";
import type { CameraViewSnapshot, HudPoint, HudPose } from "./types";

const DEG_TO_RAD = Math.PI / 180;

/** A 2D vector. */
export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

/**
 * Shortest world delta from `from` to `to` on a torus of side `worldSize`.
 * A non-positive or non-finite size means an unwrapped plane.
 *
 * @param from - Origin point.
 * @param to - Destination point.
 * @param worldSize - Torus side length in world pixels.
 * @returns The delta to add to `from` to reach the nearest image of `to`.
 */
export function shortestDelta(
  from: HudPoint,
  to: HudPoint,
  worldSize: number,
): Vector2 {
  if (!(worldSize > 0) || !Number.isFinite(worldSize)) {
    return { x: to.x - from.x, y: to.y - from.y };
  }
  return {
    x: torusAxisDelta(from.x, to.x, worldSize),
    y: torusAxisDelta(from.y, to.y, worldSize),
  };
}

/**
 * Rotate a world delta into a heading-up frame: the ship's forward vector
 * maps to (0, -1) ("up"), its right wing to (+1, 0).
 *
 * @param delta - World delta (y down).
 * @param headingDeg - Ship heading in degrees, 0 = up, clockwise.
 * @returns The delta in the ship-relative frame.
 */
export function rotateToHeadingUp(delta: Vector2, headingDeg: number): Vector2 {
  const a = headingDeg * DEG_TO_RAD;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return {
    x: delta.x * cos + delta.y * sin,
    y: -delta.x * sin + delta.y * cos,
  };
}

/** Radar projection parameters. */
export interface RadarProjectionOptions {
  /** World distance mapped to the radar rim. */
  readonly rangePx: number;
  /** Radar radius in screen pixels. */
  readonly radiusPx: number;
  /** Torus side length (<= 0 for an unwrapped plane). */
  readonly worldSize: number;
}

/** A contact's place on the radar, relative to the radar centre. */
export interface RadarProjection {
  readonly x: number;
  readonly y: number;
  /** False when the contact lies beyond range and was clamped to the rim. */
  readonly inRange: boolean;
  /** Shortest world distance from the player. */
  readonly distance: number;
}

/**
 * Project a contact onto a heading-up circular radar.
 *
 * @param player - Player pose (radar centre, "forward" is up).
 * @param contact - Contact world position.
 * @param options - Range, radius and world size.
 * @returns Radar-local coordinates plus range flag and distance.
 */
export function projectToRadar(
  player: HudPose,
  contact: HudPoint,
  options: RadarProjectionOptions,
): RadarProjection {
  const delta = shortestDelta(player, contact, options.worldSize);
  const distance = Math.hypot(delta.x, delta.y);
  if (distance === 0) return { x: 0, y: 0, inRange: true, distance };
  const local = rotateToHeadingUp(delta, player.angle);
  const radius = Math.max(0, options.radiusPx);
  const inRange = options.rangePx > 0 && distance <= options.rangePx;
  const scale = inRange ? radius / options.rangePx : radius / distance;
  return { x: local.x * scale, y: local.y * scale, inRange, distance };
}

/** Inset of the edge-arrow track from each screen edge, in screen pixels. */
export interface EdgeInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Which screen edge an arrow sits on. */
export type ScreenEdge = "top" | "right" | "bottom" | "left";

/** Where to draw an off-screen arrow. */
export interface EdgeArrowPlacement {
  /** Screen x (viewport-local). */
  readonly x: number;
  /** Screen y (viewport-local). */
  readonly y: number;
  /** Arrow rotation, radians, 0 = pointing right, clockwise. */
  readonly angle: number;
  readonly edge: ScreenEdge;
  /** Shortest world distance from the view centre. */
  readonly worldDistance: number;
  /** World distance past the visible edge along the same ray. */
  readonly beyondEdgeDistance: number;
}

interface BoxExtents {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

interface RayHit {
  readonly t: number;
  readonly edge: ScreenEdge;
}

/** Scale factor at which ray (sx, sy) from the box centre meets the box. Ties go to left/right. */
function rayToBox(sx: number, sy: number, box: BoxExtents): RayHit {
  const tx = sx > 0 ? box.right / sx : sx < 0 ? box.left / -sx : Infinity;
  const ty = sy > 0 ? box.bottom / sy : sy < 0 ? box.top / -sy : Infinity;
  if (tx <= ty) return { t: tx, edge: sx > 0 ? "right" : "left" };
  return { t: ty, edge: sy > 0 ? "bottom" : "top" };
}

/**
 * Place an edge arrow for a world point outside the camera view.
 *
 * @param view - Camera centre (world), zoom and viewport size.
 * @param target - World position of the off-screen ship.
 * @param insets - Margin between the arrow track and each screen edge.
 * @param worldSize - Torus side length (<= 0 for an unwrapped plane).
 * @returns The arrow placement, or null when the point is on screen
 *   (edges inclusive) or the view is degenerate.
 */
export function placeEdgeArrow(
  view: CameraViewSnapshot,
  target: HudPoint,
  insets: EdgeInsets,
  worldSize: number,
): EdgeArrowPlacement | null {
  if (!(view.zoom > 0) || !(view.width > 0) || !(view.height > 0)) return null;
  const delta = shortestDelta(
    { x: view.centerX, y: view.centerY },
    target,
    worldSize,
  );
  const sx = delta.x * view.zoom;
  const sy = delta.y * view.zoom;
  const halfW = view.width / 2;
  const halfH = view.height / 2;
  if (Math.abs(sx) <= halfW && Math.abs(sy) <= halfH) return null;
  const boundary = rayToBox(sx, sy, {
    left: halfW,
    right: halfW,
    top: halfH,
    bottom: halfH,
  });
  const inset = rayToBox(sx, sy, {
    left: Math.max(0, halfW - insets.left),
    right: Math.max(0, halfW - insets.right),
    top: Math.max(0, halfH - insets.top),
    bottom: Math.max(0, halfH - insets.bottom),
  });
  const worldDistance = Math.hypot(delta.x, delta.y);
  return {
    x: halfW + sx * inset.t,
    y: halfH + sy * inset.t,
    angle: Math.atan2(sy, sx),
    edge: inset.edge,
    worldDistance,
    beyondEdgeDistance: Math.max(0, worldDistance * (1 - boundary.t)),
  };
}

/** Position and uniform scale for a screen-space root container. */
export interface RootTransform {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/**
 * Transform that cancels camera zoom for a scrollFactor(0) container.
 *
 * Phaser scales scrollFactor(0) objects about the viewport centre by the
 * camera zoom. Placing the HUD root at this transform makes its children
 * render at their plain screen-pixel coordinates at any zoom.
 *
 * @param zoom - Camera zoom; non-positive values yield the identity.
 * @param viewWidth - Viewport width in screen pixels.
 * @param viewHeight - Viewport height in screen pixels.
 * @returns Root position and scale.
 */
export function hudRootTransform(
  zoom: number,
  viewWidth: number,
  viewHeight: number,
): RootTransform {
  if (!(zoom > 0) || !Number.isFinite(zoom)) return { x: 0, y: 0, scale: 1 };
  const inverse = 1 / zoom;
  return {
    x: (viewWidth / 2) * (1 - inverse),
    y: (viewHeight / 2) * (1 - inverse),
    scale: inverse,
  };
}

/** The subset of a Phaser camera needed to build a {@link CameraViewSnapshot}. */
export interface CameraLike {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly zoom: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Snapshot a camera. Phaser's view centre is scroll + half the viewport,
 * independent of zoom.
 *
 * @param camera - A Phaser camera (or any object with the same fields).
 * @returns The camera view snapshot.
 */
export function cameraViewFrom(camera: CameraLike): CameraViewSnapshot {
  return {
    centerX: camera.scrollX + camera.width / 2,
    centerY: camera.scrollY + camera.height / 2,
    zoom: camera.zoom,
    width: camera.width,
    height: camera.height,
  };
}
