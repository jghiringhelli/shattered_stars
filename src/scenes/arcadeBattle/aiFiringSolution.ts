/**
 * aiFiringSolution — when an AI pilot spends its one primary attack per
 * maneuver cycle (X-Wing round tempo), and where the bolt goes.
 *
 * The AI fires only when the target's lead-intercept point lies within a
 * narrow cone of its nose and inside weapon range; the bolt then flies to
 * that intercept (gun convergence). Holding fire otherwise keeps the attack
 * for a moment it can land. Pure: no Phaser.
 */

import { CYCLE_DURATION_MS, SPEED_SCALE_FACTOR } from "../../config";
import { torusDelta } from "../../core/Torus";
import { bearingDeg, headingGapDeg } from "./arcTargeting";

/** Half-width of the cone (° off the nose) inside which the AI takes its shot. */
export const AI_AIM_CONE_DEG = 30;
/** Farthest target the AI shoots at (px) — same reach ArcadeAI uses. */
export const AI_MAX_FIRE_RANGE_PX = 1200;
/** Laser bolt speed (px/s) — createProjectile's non-homing speed. */
export const LASER_BOLT_SPEED_PX_PER_S = 2500;
/** Lead iterations; two converge well for bolts ~10x faster than ships. */
const LEAD_ITERATIONS = 2;
const MS_PER_SECOND = 1000;

/** Position, heading and dial speed of a ship. */
export interface FiringBody {
  readonly x: number;
  readonly y: number;
  /** Degrees, 0 = up, clockwise positive. */
  readonly angle: number;
  /** Dial speed (template units per cycle). */
  readonly speed: number;
}

/** Tuning for {@link aiFiringSolution}. */
export interface FiringEnvelope {
  /** Bolt speed (px/s). */
  readonly boltSpeed: number;
  /** Torus side length (<= 0 for a plane). */
  readonly worldSize: number;
  readonly coneDeg?: number;
  readonly maxRangePx?: number;
}

/**
 * A ship's ground speed in px/s from its dial speed.
 *
 * @param speed - Dial speed.
 * @returns Approximate px per second along its heading.
 */
export function groundSpeedPxPerSecond(speed: number): number {
  return (speed * SPEED_SCALE_FACTOR * MS_PER_SECOND) / CYCLE_DURATION_MS;
}

/**
 * Where to aim so a bolt meets a target flying straight on.
 *
 * @param shooter - The firing ship.
 * @param target - The target.
 * @param envelope - Bolt speed and world size.
 * @returns Offset from the shooter to the intercept point and its distance.
 */
export function leadIntercept(
  shooter: FiringBody,
  target: FiringBody,
  envelope: FiringEnvelope,
): { dx: number; dy: number; distance: number } {
  const offset =
    envelope.worldSize > 0
      ? torusDelta(shooter.x, shooter.y, target.x, target.y, envelope.worldSize)
      : { dx: target.x - shooter.x, dy: target.y - shooter.y };
  const heading = ((target.angle - 90) * Math.PI) / 180;
  const v = groundSpeedPxPerSecond(target.speed);
  let dx = offset.dx;
  let dy = offset.dy;
  for (let i = 0; i < LEAD_ITERATIONS; i++) {
    const flightSeconds = Math.hypot(dx, dy) / envelope.boltSpeed;
    dx = offset.dx + Math.cos(heading) * v * flightSeconds;
    dy = offset.dy + Math.sin(heading) * v * flightSeconds;
  }
  return { dx, dy, distance: Math.hypot(dx, dy) };
}

/**
 * The AI's shot, if it has one.
 *
 * @param shooter - The firing ship.
 * @param target - Its target.
 * @param envelope - Bolt speed, world size, cone and range.
 * @returns The bolt heading (°), or null to hold fire.
 */
export function aiFiringSolution(
  shooter: FiringBody,
  target: FiringBody,
  envelope: FiringEnvelope,
): number | null {
  const intercept = leadIntercept(shooter, target, envelope);
  if (intercept.distance > (envelope.maxRangePx ?? AI_MAX_FIRE_RANGE_PX))
    return null;
  const aim = bearingDeg(intercept.dx, intercept.dy);
  const cone = envelope.coneDeg ?? AI_AIM_CONE_DEG;
  return headingGapDeg(aim, shooter.angle) <= cone ? aim : null;
}
