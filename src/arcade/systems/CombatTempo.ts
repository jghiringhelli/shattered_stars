/**
 * CombatTempo — the X-Wing "round" in real time: a weapon attacks at most
 * once per maneuver cycle, and a target struck by an attacker is immune to
 * that attacker (any of its weapons) until the next cycle. Together with
 * DURABILITY_SCALE this turns per-frame trading into round-by-round attacks.
 */

import { CYCLE_DURATION_MS } from "../../config";

/** The shortest time between two attacks of one weapon: one cycle. */
export const ATTACK_INTERVAL_MS = CYCLE_DURATION_MS;

/** How long a struck target ignores further hits from the same attacker. */
export const HIT_IMMUNITY_MS = CYCLE_DURATION_MS;

/**
 * A weapon's time between attacks, never faster than once per cycle.
 *
 * @param weaponCooldownMs - The weapon's own cooldown (ms).
 * @returns The interval to wait before its next attack (ms).
 */
export function attackIntervalMs(weaponCooldownMs: number): number {
  return Math.max(ATTACK_INTERVAL_MS, weaponCooldownMs);
}

/** Which attacker struck which target, and until when the target is immune. */
export class HitImmunityLedger {
  private readonly immuneUntil = new Map<string, number>();

  /**
   * @param attackerId - The attacking ship.
   * @param targetId - The target.
   * @param nowMs - Scene time (ms).
   * @returns True while the target ignores this attacker's hits.
   */
  isImmune(attackerId: string, targetId: string, nowMs: number): boolean {
    return (
      nowMs < (this.immuneUntil.get(key(attackerId, targetId)) ?? -Infinity)
    );
  }

  /**
   * Record a damaging hit: the target ignores this attacker for a cycle.
   * @param attackerId - The attacking ship.
   * @param targetId - The target.
   * @param nowMs - Scene time of the hit (ms).
   */
  recordHit(attackerId: string, targetId: string, nowMs: number): void {
    this.immuneUntil.set(key(attackerId, targetId), nowMs + HIT_IMMUNITY_MS);
  }

  /**
   * Drop every immunity a ship is part of (destroyed or despawned).
   * @param shipId - The ship.
   */
  forget(shipId: string): void {
    for (const pair of [...this.immuneUntil.keys()]) {
      const [attacker, target] = pair.split(SEPARATOR);
      if (attacker === shipId || target === shipId)
        this.immuneUntil.delete(pair);
    }
  }

  /** Drop everything (new round / restart). */
  clear(): void {
    this.immuneUntil.clear();
  }
}

const SEPARATOR = ">";

function key(attackerId: string, targetId: string): string {
  return `${attackerId}${SEPARATOR}${targetId}`;
}
