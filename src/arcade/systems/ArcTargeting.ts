/**
 * ArcTargeting — THE target picker of every battle mode's primary weapon:
 * the pilot's preferred target (its bot's choice, the squad mark) when it
 * is inside weapon range and the forward firing arc, else the nearest
 * hostile that is. Range and bearing are measured the short way across the
 * torus seam (FiringGeometry), so a ship at the map edge sees and shoots
 * an enemy just across it. Pure (no Phaser).
 */

import { inArcEnvelope, torusRangePx } from "../weapons/FiringGeometry";

const FULL_TURN_RAD = Math.PI * 2;

/** The firing ship: where it is, where it points, and its weapon envelope. */
export interface ArcShooter {
  readonly id: string;
  /** Default hostility test (any other faction); omit when sides are given. */
  readonly faction?: string;
  readonly x: number;
  readonly y: number;
  /** Heading in degrees, 0 = up, clockwise positive. */
  readonly angle: number;
}

/** A ship that may be fired at. */
export interface ArcCandidate {
  readonly id: string;
  readonly faction?: string;
  readonly x: number;
  readonly y: number;
  readonly hull: number;
  /** Hull radius (px) of a big body (creatures); omitted = a point. */
  readonly radiusPx?: number;
}

/** Weapon envelope and target filter. */
export interface ArcWeapon<T> {
  /** Maximum range in px (exclusive). */
  readonly rangePx: number;
  /** Full firing arc in degrees (half on each side of the nose). */
  readonly arcDeg: number;
  /** Map edge length (px): ranges and bearings wrap across the seam. */
  readonly worldSize: number;
  /** Extra filter, e.g. "not immune to this attacker"; default: all. */
  readonly isEligible?: (candidate: T) => boolean;
  /**
   * Who the shooter may fire at; default: any other faction. Squad scenes
   * side by owner (a mirror match fields the same faction on both sides).
   */
  readonly isHostile?: (candidate: T) => boolean;
  /**
   * The ship the pilot wants to shoot (its bot's target, the squad mark):
   * fired at whenever it is a valid target, even if another is nearer.
   */
  readonly preferredId?: string | null;
}

/**
 * Smallest absolute angle between two directions, in [0, π].
 *
 * @param a - Direction (rad).
 * @param b - Direction (rad).
 * @returns |a − b| folded onto the short way round.
 */
export function angleBetweenRad(a: number, b: number): number {
  const diff = (((a - b) % FULL_TURN_RAD) + FULL_TURN_RAD) % FULL_TURN_RAD;
  return Math.min(diff, FULL_TURN_RAD - diff);
}

/**
 * Whether a point lies inside a shooter's range and forward arc.
 *
 * @param shooter - The firing ship.
 * @param point - The point.
 * @param weapon - Range, arc and map size.
 * @returns True when the point can be fired at.
 */
export function isInFiringArc(
  shooter: ArcShooter,
  point: { readonly x: number; readonly y: number },
  weapon: Pick<ArcWeapon<unknown>, "rangePx" | "arcDeg" | "worldSize">,
  targetRadiusPx = 0,
): boolean {
  return inArcEnvelope(
    shooter,
    point,
    { maxRangePx: weapon.rangePx, arcDeg: weapon.arcDeg },
    weapon.worldSize,
    targetRadiusPx,
  );
}

/**
 * The nearest living hostile, wherever it is (no range or arc): what a
 * pilot closes on when nothing is in its sights.
 *
 * @param shooter - The ship asking.
 * @param candidates - Every ship on the field.
 * @param worldSize - Map edge length (px).
 * @param isHostile - Who counts as hostile; default: any other faction.
 * @returns The nearest hostile, or null when none is alive.
 */
export function nearestHostile<T extends ArcCandidate>(
  shooter: ArcShooter,
  candidates: Iterable<T>,
  worldSize: number,
  isHostile: (candidate: T) => boolean = (other) =>
    other.faction !== shooter.faction,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const other of candidates) {
    if (other.hull <= 0 || other.id === shooter.id || !isHostile(other)) {
      continue;
    }
    const distance = torusRangePx(shooter, other, worldSize);
    if (distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The living hostile the shooter fires at: its preferred target when that
 * one is in range and arc, otherwise the nearest one that is.
 *
 * @param shooter - The firing ship.
 * @param candidates - Every ship on the field.
 * @param weapon - Range, arc, map size, filters, preferred target.
 * @returns The target, or null when none is in range and arc.
 */
export function nearestTargetInArc<T extends ArcCandidate>(
  shooter: ArcShooter,
  candidates: Iterable<T>,
  weapon: ArcWeapon<T>,
): T | null {
  const isHostile =
    weapon.isHostile ?? ((other: T) => other.faction !== shooter.faction);
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const other of candidates) {
    if (other.hull <= 0 || other.id === shooter.id || !isHostile(other)) {
      continue;
    }
    const preferred = other.id === weapon.preferredId;
    const distance =
      torusRangePx(shooter, other, weapon.worldSize) - (other.radiusPx ?? 0);
    if (!preferred && distance >= bestDistance) continue;
    if (!isInFiringArc(shooter, other, weapon, other.radiusPx ?? 0)) continue;
    if (weapon.isEligible && !weapon.isEligible(other)) continue;
    if (preferred) return other;
    best = other;
    bestDistance = distance;
  }
  return best;
}
