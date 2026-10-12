/**
 * DuelPrimaryFire — the autofiring primary weapon of the duel scenes
 * (Dogfight, Ace Duel) on the X-Wing round tempo (CombatTempo): a ready gun
 * fires at its pilot's target when it is in range and arc (else the first
 * such enemy) that is not immune to it this cycle, then waits at least one
 * maneuver cycle before its next attack.
 *
 * Targets are picked by the shared torus-aware ArcTargeting picker.
 *
 * Pure: no Phaser.
 */

import { attackIntervalMs, type HitImmunityLedger } from "./CombatTempo";
import { isInFiringArc, nearestTargetInArc } from "./ArcTargeting";

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
  /** Map edge length (px): ranges and bearings wrap across the seam. */
  readonly worldSize: number;
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
 * @param worldSize - Map edge length (px).
 * @returns True when in range (strictly) and within half the arc of the nose.
 */
export function inPrimaryArc(
  gunner: PrimaryGunner,
  target: Pick<PrimaryCandidate, "x" | "y">,
  worldSize: number,
): boolean {
  return isInFiringArc(gunner, target, primaryEnvelope(gunner, worldSize));
}

/**
 * @param gunner - The firing ship.
 * @param worldSize - Map edge length (px).
 * @returns Its primary weapon's range and arc, for the shared picker.
 */
function primaryEnvelope(
  gunner: PrimaryGunner,
  worldSize: number,
): { rangePx: number; arcDeg: number; worldSize: number } {
  return {
    rangePx: gunner.combatStats.weaponRange,
    arcDeg: gunner.combatStats.firingArc,
    worldSize,
  };
}

/**
 * The enemy a ready primary weapon fires at: the pilot's preferred target
 * when it is eligible, otherwise the nearest living enemy in range and arc
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
  return nearestTargetInArc<T>(gunner, query.candidates, {
    ...primaryEnvelope(gunner, query.worldSize),
    isHostile: query.isEnemy,
    isEligible: (candidate) => !ledger.isImmune(gunner.id, candidate.id, nowMs),
    preferredId: query.preferredId ?? null,
  });
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
