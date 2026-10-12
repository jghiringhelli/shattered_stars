/**
 * HullRepair — the real-time hull repair mechanic and the shared repair step.
 *
 * Every rate (shield regen and hull repair) is authored in REAL-TIME hit
 * points per second and applied as is: nothing in the repair pipeline
 * rescales it by DURABILITY_SCALE (values once written in miniature points
 * were converted at their source). Hull repair
 * pauses for {@link HULL_REPAIR_DAMAGE_PAUSE_MS} after the ship takes any
 * damage, so crews and drones patch the hull between engagements rather
 * than out-healing incoming fire. Shield regeneration keeps its existing
 * behaviour (no pause). Repairs never exceed max values and never revive a
 * destroyed ship. Pure, no Phaser.
 */

import type { DurabilitySnapshot } from "./RepairEvents";

/** Hull repair waits this long after the last hit (6 maneuver cycles). */
export const HULL_REPAIR_DAMAGE_PAUSE_MS = 3000;

/** Milliseconds per second (rate conversion). */
const MS_PER_SECOND = 1000;

/** Inputs of one repair step. */
export interface RepairStepInput {
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  /** Real-time shield HP per second. */
  readonly shieldRegenPerSecond: number;
  /** Real-time hull HP per second. */
  readonly hullRepairPerSecond: number;
  readonly deltaMs: number;
  /** Time since the ship last lost hull or shields. */
  readonly msSinceDamage: number;
}

/**
 * A value after restoring at a real-time rate for a frame, capped.
 * @param value - Current real-time value.
 * @param max - Cap.
 * @param ratePerSecond - Real-time HP per second.
 * @param deltaMs - Frame length (ms).
 * @returns The restored value.
 */
function restore(
  value: number,
  max: number,
  ratePerSecond: number,
  deltaMs: number,
): number {
  if (ratePerSecond <= 0 || value >= max) return value;
  const gain = (ratePerSecond * deltaMs) / MS_PER_SECOND;
  return Math.min(max, value + gain);
}

/**
 * Hull and shields after one frame of regeneration and repair.
 *
 * @param input - Current values, rates, frame length and quiet time.
 * @returns The new values (unchanged for a destroyed ship).
 */
export function repairStep(input: RepairStepInput): DurabilitySnapshot {
  if (input.hull <= 0) return { hull: input.hull, shields: input.shields };
  const shields = restore(
    input.shields,
    input.maxShields,
    input.shieldRegenPerSecond,
    input.deltaMs,
  );
  const hullQuiet = input.msSinceDamage >= HULL_REPAIR_DAMAGE_PAUSE_MS;
  const hull = hullQuiet
    ? restore(
        input.hull,
        input.maxHull,
        input.hullRepairPerSecond,
        input.deltaMs,
      )
    : input.hull;
  return { hull, shields };
}

/** Last seen values and quiet time of one ship. */
interface QuietRecord {
  hull: number;
  shields: number;
  quietMs: number;
}

/**
 * Tracks how long each ship has gone without losing hull or shields, by
 * comparing the values it is shown frame to frame (no hook into the damage
 * code needed). Records are reused, so steady-state observing allocates
 * nothing.
 */
export class DamagePauseTracker {
  private readonly records = new Map<string, QuietRecord>();

  /**
   * Record a ship's current values and advance its quiet timer.
   * @param shipId - The ship.
   * @param hull - Current hull.
   * @param shields - Current shields.
   * @param deltaMs - Time since the previous observation.
   * @returns Milliseconds since the ship last lost hull or shields.
   */
  observe(
    shipId: string,
    hull: number,
    shields: number,
    deltaMs: number,
  ): number {
    const record = this.records.get(shipId);
    if (!record) {
      this.records.set(shipId, {
        hull,
        shields,
        quietMs: HULL_REPAIR_DAMAGE_PAUSE_MS,
      });
      return HULL_REPAIR_DAMAGE_PAUSE_MS;
    }
    const tookDamage = hull < record.hull || shields < record.shields;
    record.quietMs = tookDamage ? 0 : record.quietMs + deltaMs;
    record.hull = hull;
    record.shields = shields;
    return record.quietMs;
  }

  /**
   * A ship's quiet time without advancing it (for a second repair source
   * applied in the same frame, e.g. an aura after the ship's own repair).
   * @param shipId - The ship.
   * @returns Milliseconds since it last lost hull or shields (unseen ships
   *   count as out of fire).
   */
  quietMs(shipId: string): number {
    return this.records.get(shipId)?.quietMs ?? HULL_REPAIR_DAMAGE_PAUSE_MS;
  }

  /**
   * Forget a ship (destroyed / removed).
   * @param shipId - The ship.
   */
  forget(shipId: string): void {
    this.records.delete(shipId);
  }
}
