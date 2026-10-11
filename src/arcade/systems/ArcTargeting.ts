/**
 * ArcTargeting — pick the ship a primary weapon fires at: the nearest
 * hostile inside weapon range and the forward firing arc. Pure (no Phaser),
 * shared by the squad battle scenes (Survival, Campaign).
 */

/** Degrees → radians. */
const DEG_TO_RAD = Math.PI / 180;
/** Ship angles are 0 = up; screen angles are 0 = right. */
const HEADING_TO_SCREEN_DEG = 90;
const FULL_TURN_RAD = Math.PI * 2;

/** The firing ship: where it is, where it points, and its weapon envelope. */
export interface ArcShooter {
  readonly id: string;
  readonly faction: string;
  readonly x: number;
  readonly y: number;
  /** Heading in degrees, 0 = up, clockwise positive. */
  readonly angle: number;
}

/** A ship that may be fired at. */
export interface ArcCandidate {
  readonly id: string;
  readonly faction: string;
  readonly x: number;
  readonly y: number;
  readonly hull: number;
}

/** Weapon envelope and target filter. */
export interface ArcWeapon<T> {
  /** Maximum range in px (exclusive). */
  readonly rangePx: number;
  /** Full firing arc in degrees (half on each side of the nose). */
  readonly arcDeg: number;
  /** Extra filter, e.g. "not immune to this attacker"; default: all. */
  readonly isEligible?: (candidate: T) => boolean;
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
 * @param weapon - Range and arc.
 * @returns True when the point can be fired at.
 */
export function isInFiringArc(
  shooter: ArcShooter,
  point: { readonly x: number; readonly y: number },
  weapon: Pick<ArcWeapon<unknown>, "rangePx" | "arcDeg">,
): boolean {
  const dx = point.x - shooter.x;
  const dy = point.y - shooter.y;
  if (Math.hypot(dx, dy) >= weapon.rangePx) return false;
  const facing = (shooter.angle - HEADING_TO_SCREEN_DEG) * DEG_TO_RAD;
  const halfArc = (weapon.arcDeg / 2) * DEG_TO_RAD;
  return angleBetweenRad(Math.atan2(dy, dx), facing) < halfArc;
}

/**
 * The nearest living hostile (other faction) the shooter can fire at.
 *
 * @param shooter - The firing ship.
 * @param candidates - Every ship on the field.
 * @param weapon - Range, arc and an optional eligibility filter.
 * @returns The target, or null when none is in range and arc.
 */
export function nearestTargetInArc<T extends ArcCandidate>(
  shooter: ArcShooter,
  candidates: Iterable<T>,
  weapon: ArcWeapon<T>,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const other of candidates) {
    if (other.faction === shooter.faction || other.hull <= 0) continue;
    const distance = Math.hypot(other.x - shooter.x, other.y - shooter.y);
    if (distance >= bestDistance) continue;
    if (!isInFiringArc(shooter, other, weapon)) continue;
    if (weapon.isEligible && !weapon.isEligible(other)) continue;
    best = other;
    bestDistance = distance;
  }
  return best;
}
