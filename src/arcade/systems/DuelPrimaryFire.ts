/**
 * DuelPrimaryFire — the autofiring primary weapon of the duel scenes
 * (Dogfight, Ace Duel) on the X-Wing round tempo (CombatTempo): a ready gun
 * fires at its pilot's target when it is in range and arc (else the first
 * such enemy) that is not immune to it this cycle, then waits at least one
 * maneuver cycle before its next attack.
 *
 * Pure: no Phaser.
 */

import { attackIntervalMs, type HitImmunityLedger } from "./CombatTempo";

const DEG_TO_RAD = Math.PI / 180;
const FULL_TURN_RAD = Math.PI * 2;
/** Ship angle 0 points up (north); screen-space atan2 0 points right. */
const NORTH_UP_OFFSET_DEG = 90;

/** The firing ship: pose and primary weapon stats. */
export interface PrimaryGunner {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Degrees, 0 = up/north, clockwise positive. */
  readonly angle: number;
  readonly combatStats: {
    readonly weaponRange: number;
    /** Full firing arc in degrees (half on each side of the nose). */
    readonly firingArc: number;
    /** The weapon's own cooldown (ms). */
    readonly weaponCooldown: number;
  };
}

/** A ship the gun may fire at. */
export interface PrimaryCandidate {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly hull: number;
}

/** Everything a ready gun needs to pick its target. */
export interface PrimaryShotQuery<T extends PrimaryCandidate> {
  readonly gunner: PrimaryGunner;
  /** Every ship on the field (the gunner itself is skipped). */
  readonly candidates: Iterable<T>;
  /** Whether a candidate flies for the other side. */
  readonly isEnemy: (candidate: T) => boolean;
  readonly ledger: HitImmunityLedger;
  /** Scene time (ms). */
  readonly nowMs: number;
  /**
   * The enemy the gunner's pilot is trying to shoot (BotPilot.targetId):
   * fired at whenever it is eligible, ahead of any other enemy in arc.
   */
  readonly preferredId?: string | null;
}

/**
 * Whether a target sits inside the gunner's range and firing arc.
 *
 * @param gunner - The firing ship.
 * @param target - The ship considered.
 * @returns True when in range (strictly) and within half the arc of the nose.
 */
export function inPrimaryArc(
  gunner: PrimaryGunner,
  target: Pick<PrimaryCandidate, "x" | "y">,
): boolean {
  const dx = target.x - gunner.x;
  const dy = target.y - gunner.y;
  if (Math.hypot(dx, dy) >= gunner.combatStats.weaponRange) return false;
  const bearing = Math.atan2(dy, dx);
  const facing = (gunner.angle - NORTH_UP_OFFSET_DEG) * DEG_TO_RAD;
  const halfArc = (gunner.combatStats.firingArc / 2) * DEG_TO_RAD;
  return Math.abs(wrapRadians(bearing - facing)) < halfArc;
}

/**
 * The enemy a ready primary weapon fires at: the pilot's preferred target
 * when it is eligible, otherwise the first living enemy in range and arc
 * that is not immune to this attacker this cycle.
 *
 * @param query - Gunner, candidates, side test, immunity ledger, time and
 *   the pilot's preferred target.
 * @returns The target, or null to hold fire (the cooldown is not spent).
 */
export function primaryShotTarget<T extends PrimaryCandidate>(
  query: PrimaryShotQuery<T>,
): T | null {
  const { gunner, ledger, nowMs } = query;
  let first: T | null = null;
  for (const candidate of query.candidates) {
    if (candidate.id === gunner.id || candidate.hull <= 0) continue;
    if (!query.isEnemy(candidate)) continue;
    if (ledger.isImmune(gunner.id, candidate.id, nowMs)) continue;
    if (!inPrimaryArc(gunner, candidate)) continue;
    if (candidate.id === query.preferredId) return candidate;
    first ??= candidate;
  }
  return first;
}

/**
 * How long the primary weapon waits after an attack: its own cooldown, but
 * never less than one maneuver cycle.
 *
 * @param gunner - The ship that just fired.
 * @returns Cooldown to set (ms).
 */
export function primaryCooldownAfterShot(gunner: PrimaryGunner): number {
  return attackIntervalMs(gunner.combatStats.weaponCooldown);
}

/**
 * Cooldown remaining as a fraction of the full attack interval, for HUD
 * sweeps: 0 = ready, 1 = just fired.
 *
 * @param remainingMs - Cooldown left (ms).
 * @param weaponCooldownMs - The weapon's own cooldown (ms).
 * @returns A fraction in [0, 1].
 */
export function primaryCooldownFraction(
  remainingMs: number,
  weaponCooldownMs: number,
): number {
  const fraction = remainingMs / attackIntervalMs(weaponCooldownMs);
  return Math.min(1, Math.max(0, fraction));
}

/**
 * @param radians - Any angle.
 * @returns The same angle in [-π, π).
 */
function wrapRadians(radians: number): number {
  const wrapped = (radians + Math.PI) % FULL_TURN_RAD;
  return (wrapped < 0 ? wrapped + FULL_TURN_RAD : wrapped) - Math.PI;
}
