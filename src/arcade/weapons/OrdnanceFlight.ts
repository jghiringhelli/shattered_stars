/**
 * OrdnanceFlight — missiles and torpedoes in flight. A shot leaves the
 * launcher's nose on the ship's heading (the pilot aims the launcher: with
 * ORDNANCE_DAMAGE_SCALE making a hit decisive, a lock alone must not be),
 * steers for the intercept point of
 * its locked target (lead guidance: the target's velocity is tracked from
 * frame to frame; pure pursuit on the first frame) the short way across the
 * torus seam at its turn rate until its turn budget is spent (then flies
 * straight), wraps onto the map and burns out at the end of its lifetime.
 * A target that out-turns the warhead's turn rate still escapes it. It strikes the first hostile hull its path
 * crosses this frame (swept test: no tunnelling at any frame length).
 *
 * Pure: no Phaser.
 */

import { torusDelta } from "../../core/Torus";
import {
  headingTowardDeg,
  pointAlong,
  wrapDegrees,
  type FiringPose,
  type MapPoint,
} from "./FiringGeometry";
import type { LauncherKind, LauncherSpec } from "./weaponSpecs";
import type { WeaponBody } from "./weaponTypes";

/** Launch point ahead of the ship's centre (px). */
export const LAUNCH_NOSE_OFFSET_PX = 20;
/** Hit radius of a fighter hull for ordnance (px, incl. warhead size). */
export const DEFAULT_HULL_RADIUS_PX = 20;
const MS_PER_S = 1000;

/** A missile or torpedo in flight. */
export interface OrdnanceShot {
  readonly id: string;
  readonly ownerId: string;
  readonly ownerSide: string;
  readonly kind: LauncherKind;
  /** The locked target it homes on (null = unguided). */
  readonly targetId: string | null;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly speedPxPerS: number;
  readonly lifetimeMs: number;
  readonly homingTurnRate: number;
  readonly homingTurnBudget: number;
  readonly damage: number;
  readonly stressOnHit: number;
  /** Attack dice it rolls against the struck ship's agility. */
  readonly attackDice: number;
  /** Where its target was last frame (velocity tracking), or null. */
  readonly targetFix: MapPoint | null;
}

/** The locked target at launch. */
export interface LockedTarget extends MapPoint {
  readonly id: string;
}

/** A launcher pose with its side. */
export interface Launcher extends FiringPose {
  readonly id: string;
  readonly side: string;
}

/**
 * @param launcher - The firing ship.
 * @param spec - The launcher's rules.
 * @param target - Locked target (null = unguided).
 * @param worldSize - Map edge length (px).
 * @param id - The battle's next shot id (per-battle, see FieldOrdnance).
 * @returns The shot, at the nose on the ship's heading, tracking its target.
 */
export function launchShot(
  launcher: Launcher,
  spec: LauncherSpec,
  target: LockedTarget | null,
  worldSize: number,
  id: string,
): OrdnanceShot {
  const nose = pointAlong(launcher, LAUNCH_NOSE_OFFSET_PX, worldSize);
  return {
    id,
    ownerId: launcher.id,
    ownerSide: launcher.side,
    kind: spec.kind,
    targetId: target?.id ?? null,
    x: nose.x,
    y: nose.y,
    angle: launcher.angle,
    speedPxPerS: spec.speedPxPerS,
    lifetimeMs: spec.lifetimeMs,
    homingTurnRate: spec.homingTurnRate,
    homingTurnBudget: spec.homingTurnBudget,
    damage: spec.damage,
    stressOnHit: spec.stressOnHit,
    attackDice: spec.attackDice,
    targetFix: target ? { x: target.x, y: target.y } : null,
  };
}

/**
 * One frame of flight.
 *
 * @param shot - The shot before the frame.
 * @param target - Where its target is now (null = no guidance).
 * @param deltaMs - Frame length (ms).
 * @param worldSize - Map edge length (px).
 * @returns The shot after the frame.
 */
export function flyShot(
  shot: OrdnanceShot,
  target: MapPoint | null,
  deltaMs: number,
  worldSize: number,
): OrdnanceShot {
  let angle = shot.angle;
  let budget = shot.homingTurnBudget;
  if (target && budget > 0) {
    const aim = interceptPoint(shot, target, deltaMs, worldSize);
    const wanted = wrapDegrees(headingTowardDeg(shot, aim, worldSize) - angle);
    const turn = Math.min(
      Math.abs(wanted),
      (shot.homingTurnRate * deltaMs) / MS_PER_S,
      budget,
    );
    angle = (((angle + Math.sign(wanted) * turn) % 360) + 360) % 360;
    budget -= turn;
  }
  const moved = pointAlong(
    { x: shot.x, y: shot.y, angle },
    (shot.speedPxPerS * deltaMs) / MS_PER_S,
    worldSize,
  );
  return {
    ...shot,
    ...moved,
    angle,
    homingTurnBudget: budget,
    lifetimeMs: shot.lifetimeMs - deltaMs,
    targetFix: target ? { x: target.x, y: target.y } : null,
  };
}

/**
 * Where to steer to meet the target: its position plus its tracked
 * velocity times the time a straight run at the shot's speed needs to
 * meet it. Without a fix (first frame), or with no meeting point within
 * the shot's lifetime, the target itself (pure pursuit).
 *
 * @param shot - The shot (its speed, lifetime and last target fix).
 * @param target - Where the target is now.
 * @param deltaMs - Frame length (ms) since the fix.
 * @param worldSize - Map edge length (px).
 * @returns The aim point.
 */
export function interceptPoint(
  shot: OrdnanceShot,
  target: MapPoint,
  deltaMs: number,
  worldSize: number,
): MapPoint {
  if (!shot.targetFix || deltaMs <= 0) return target;
  const seconds = deltaMs / MS_PER_S;
  const moved = torusDelta(
    shot.targetFix.x,
    shot.targetFix.y,
    target.x,
    target.y,
    worldSize,
  );
  const vx = moved.dx / seconds;
  const vy = moved.dy / seconds;
  const rel = torusDelta(shot.x, shot.y, target.x, target.y, worldSize);
  const t = meetingTimeS(rel, { vx, vy }, shot.speedPxPerS);
  if (t === null || t * MS_PER_S > shot.lifetimeMs) return target;
  return {
    x: shot.x + rel.dx + vx * t,
    y: shot.y + rel.dy + vy * t,
  };
}

/**
 * Earliest time (s) a straight run at `speed` from the origin meets a point
 * starting at `rel` moving at `velocity`: |rel + v·t| = speed·t.
 *
 * @param rel - Target offset from the shot (px).
 * @param velocity - Target velocity (px/s).
 * @param speed - Shot speed (px/s).
 * @returns The time, or null when it can never meet it.
 */
function meetingTimeS(
  rel: { readonly dx: number; readonly dy: number },
  velocity: { readonly vx: number; readonly vy: number },
  speed: number,
): number | null {
  const a = velocity.vx ** 2 + velocity.vy ** 2 - speed ** 2;
  const b = 2 * (rel.dx * velocity.vx + rel.dy * velocity.vy);
  const c = rel.dx ** 2 + rel.dy ** 2;
  if (Math.abs(a) < Number.EPSILON) return b < 0 ? -c / b : null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const times = [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter(
    (t) => t > 0,
  );
  return times.length > 0 ? Math.min(...times) : null;
}

/**
 * @param from - Shot position before the frame.
 * @param to - Shot position after the frame.
 * @param point - A hull centre.
 * @param worldSize - Map edge length (px).
 * @returns Closest distance from the hull centre to the swept path.
 */
function sweptDistance(
  from: MapPoint,
  to: MapPoint,
  point: MapPoint,
  worldSize: number,
): number {
  const path = torusDelta(from.x, from.y, to.x, to.y, worldSize);
  const rel = torusDelta(from.x, from.y, point.x, point.y, worldSize);
  const lengthSq = path.dx * path.dx + path.dy * path.dy;
  const t =
    lengthSq > 0
      ? Math.max(
          0,
          Math.min(1, (rel.dx * path.dx + rel.dy * path.dy) / lengthSq),
        )
      : 0;
  return Math.hypot(rel.dx - path.dx * t, rel.dy - path.dy * t);
}

/**
 * The hostile hull a shot struck this frame: its locked target first, else
 * the first other hostile on its path.
 *
 * @param before - The shot before the frame.
 * @param after - The shot after the frame.
 * @param bodies - Every ship on the field.
 * @param worldSize - Map edge length (px).
 * @returns The ship struck, or null.
 */
export function shotImpact(
  before: OrdnanceShot,
  after: OrdnanceShot,
  bodies: Iterable<WeaponBody>,
  worldSize: number,
): WeaponBody | null {
  let struck: WeaponBody | null = null;
  for (const body of bodies) {
    if (body.hull <= 0 || body.side === before.ownerSide) continue;
    const radius = body.hitRadiusPx ?? DEFAULT_HULL_RADIUS_PX;
    if (sweptDistance(before, after, body, worldSize) > radius) continue;
    if (body.id === before.targetId) return body;
    struck ??= body;
  }
  return struck;
}
