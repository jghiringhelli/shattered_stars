/**
 * ArenaGeometry — torus-aware relative geometry for the skill arena: range,
 * bearing off the nose, firing/rear arcs, where an attacker sits around its
 * target, and short-horizon extrapolation of an observed ship.
 *
 * The battlefield wraps (BATTLEFIELD_SIZE), so every relation goes through
 * the shortest torus delta. Pure: no Phaser.
 */

import { torusDelta } from "../../core/Torus";
import { REAR_ARC_HALF_DEG } from "../ShotConditions";
import type { PerceivedShip, Pose } from "./BotTypes";

/** A point on the battlefield. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Where an attacker sits relative to its target's arcs. */
export type ArcPosition = "front" | "flank" | "rear";

/** Shortest offset between two points on the torus. */
export interface TorusOffset {
  readonly dx: number;
  readonly dy: number;
  readonly distance: number;
}

/** Integration step for pose extrapolation (ms). */
const EXTRAPOLATION_STEP_MS = 50;

/**
 * @param degrees - Any angle (°).
 * @returns The same angle in (-180, 180].
 */
export function signedAngle(degrees: number): number {
  const wrapped = (((degrees + 180) % 360) + 360) % 360;
  return wrapped === 0 ? 180 : wrapped - 180;
}

/**
 * @param from - Origin.
 * @param to - Destination.
 * @param worldSize - Torus edge length (px).
 * @returns Shortest offset and distance from `from` to `to`.
 */
export function torusOffset(
  from: Point,
  to: Point,
  worldSize: number,
): TorusOffset {
  const { dx, dy } = torusDelta(from.x, from.y, to.x, to.y, worldSize);
  return { dx, dy, distance: Math.hypot(dx, dy) };
}

/**
 * Signed bearing of a point off a ship's nose (positive = to the right).
 *
 * @param from - The ship's pose.
 * @param to - The point.
 * @param worldSize - Torus edge length (px).
 * @returns Bearing off the nose (°), in (-180, 180].
 */
export function offNoseDeg(from: Pose, to: Point, worldSize: number): number {
  const { dx, dy } = torusOffset(from, to, worldSize);
  const bearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return signedAngle(bearing - from.angle);
}

/** A shooter: pose, arc width and range. */
export interface Shooter extends Pose {
  readonly firingArcDeg: number;
  readonly weaponRange: number;
}

/**
 * @param shooter - The firing ship.
 * @param target - The point it would fire at.
 * @param worldSize - Torus edge length (px).
 * @returns True when the target is inside the arc and strictly in range.
 */
export function inFiringArc(
  shooter: Shooter,
  target: Point,
  worldSize: number,
): boolean {
  const { distance } = torusOffset(shooter, target, worldSize);
  if (distance >= shooter.weaponRange) return false;
  return (
    Math.abs(offNoseDeg(shooter, target, worldSize)) < shooter.firingArcDeg / 2
  );
}

/**
 * Which of the target's arcs the attacker sits in.
 *
 * @param attacker - Attacker position.
 * @param target - Target pose and firing arc width.
 * @param worldSize - Torus edge length (px).
 * @returns front (target can shoot back), rear (X-Wing rear arc) or flank.
 */
export function arcPositionOf(
  attacker: Point,
  target: Pose & { readonly firingArcDeg: number },
  worldSize: number,
): ArcPosition {
  const bearing = Math.abs(offNoseDeg(target, attacker, worldSize));
  if (bearing < target.firingArcDeg / 2) return "front";
  if (bearing >= 180 - REAR_ARC_HALF_DEG) return "rear";
  return "flank";
}

/**
 * A point moved next to an anchor (unwrapped across the seam), so planar
 * helpers that ignore the torus see the true relation.
 *
 * @param anchor - Reference point.
 * @param point - Point to bring next to it.
 * @param worldSize - Torus edge length (px).
 * @returns The point's coordinates in the anchor's unwrapped frame.
 */
export function unwrapNear<T extends Point>(
  anchor: Point,
  point: T,
  worldSize: number,
): T {
  const { dx, dy } = torusOffset(anchor, point, worldSize);
  return { ...point, x: anchor.x + dx, y: anchor.y + dy };
}

/**
 * Where an observed ship will be if it keeps its speed and turn rate.
 *
 * @param ship - Perceived ship with observed motion.
 * @param horizonMs - How far ahead (ms).
 * @returns Predicted pose (unwrapped: may lie outside the field).
 */
export function extrapolatePose(ship: PerceivedShip, horizonMs: number): Pose {
  const speed = Math.hypot(ship.vx, ship.vy);
  let { x, y, angle } = ship;
  let heading =
    speed > 0 ? (Math.atan2(ship.vx, -ship.vy) * 180) / Math.PI : angle;
  for (let t = 0; t < horizonMs; t += EXTRAPOLATION_STEP_MS) {
    const dt = Math.min(EXTRAPOLATION_STEP_MS, horizonMs - t);
    heading += ship.turnRateDegPerMs * dt;
    angle += ship.turnRateDegPerMs * dt;
    const rad = (heading * Math.PI) / 180;
    x += Math.sin(rad) * speed * dt;
    y -= Math.cos(rad) * speed * dt;
  }
  return { x, y, angle: ((angle % 360) + 360) % 360 };
}
