/**
 * projectileLevers — the squad-mark and position levers (ShotLevers) for a
 * Skirmish projectile that has struck a ship.
 *
 * The dice modes apply the levers to a shot's hit chance and damage. Here
 * shots are real projectiles: whether a bolt hits is decided by the pilot's
 * aim and flight (the player's skill), so the hit-chance levers (rear-arc
 * bonus, head-on penalty, mark bonus) do not apply. Only the damage levers
 * do, on a hit:
 * - the target is the one the attacker's side marked: the bolt deals
 *   PROJECTILE_MARK_DAMAGE_MULTIPLIER times its damage (the dice modes' flat
 *   +5 was calibrated for dice damage; a ~2-damage laser would hit 3.5x);
 * - the projectile arrived from the target's tail (its rear arc): + the
 *   rear-arc damage bonus.
 *
 * Pure: no Phaser.
 */

import type { ShipPose } from "../../core/ArcadeControls";
import { torusDelta } from "../../core/Torus";
import { leverShot, shotPosition } from "../../arcade/ShotLevers";

/**
 * How far back along its track a projectile is traced to tell where it came
 * from (px). Larger than the hit radius, so the traced point is always on
 * the side the projectile arrived from.
 */
export const PROJECTILE_ORIGIN_TRACE_PX = 60;

/** Hit chance handed to leverShot: projectiles have already hit. */
const ALREADY_HIT = 1;

/** A bolt that hits the target its side marked deals this many times its damage. */
export const PROJECTILE_MARK_DAMAGE_MULTIPLIER = 2;

/** A projectile at the moment it struck. */
export interface StrikingProjectile {
  readonly x: number;
  readonly y: number;
  /** Heading of travel (°, 0 = up, clockwise). */
  readonly angle: number;
}

/** Inputs for {@link projectileLeverBonus}. */
export interface ProjectileLeverInput {
  readonly projectile: StrikingProjectile;
  readonly target: ShipPose;
  /** The target is the one the attacker's side has marked. */
  readonly marked: boolean;
  /** Torus side length (px). */
  readonly worldSize: number;
  /** The bolt's own damage, before levers. */
  readonly baseDamage: number;
}

/**
 * Where a projectile came from, as a pose next to the target: a point traced
 * back along its track, unwrapped onto the target's side of the torus.
 *
 * @param projectile - The projectile when it struck.
 * @param target - The ship struck.
 * @param worldSize - Torus side length (px).
 * @returns A pose on the projectile's incoming track, heading its way.
 */
export function projectileOrigin(
  projectile: StrikingProjectile,
  target: ShipPose,
  worldSize: number,
): ShipPose {
  const rad = ((projectile.angle - 90) * Math.PI) / 180;
  const backX = projectile.x - Math.cos(rad) * PROJECTILE_ORIGIN_TRACE_PX;
  const backY = projectile.y - Math.sin(rad) * PROJECTILE_ORIGIN_TRACE_PX;
  const { dx, dy } = torusDelta(target.x, target.y, backX, backY, worldSize);
  return { x: target.x + dx, y: target.y + dy, angle: projectile.angle };
}

/**
 * Extra damage a projectile hit earns from the levers (before the
 * defender's armour and mitigation, as in the dice modes).
 *
 * @param input - The projectile, the ship it struck, the mark and world size.
 * @returns The mark's extra damage (when marked) + rear-arc damage bonus
 *   (when it arrived from the target's tail); 0 otherwise. Head-on changes
 *   nothing.
 */
export function projectileLeverBonus(input: ProjectileLeverInput): number {
  const origin = projectileOrigin(
    input.projectile,
    input.target,
    input.worldSize,
  );
  const positional = leverShot({
    hitChance: ALREADY_HIT,
    position: shotPosition(origin, input.target),
    marked: false,
  }).damageBonus;
  const markExtra = input.marked
    ? input.baseDamage * (PROJECTILE_MARK_DAMAGE_MULTIPLIER - 1)
    : 0;
  return positional + markExtra;
}
