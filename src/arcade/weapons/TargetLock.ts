/**
 * TargetLock — the tabletop target lock in real time. A pilot that keeps the
 * target it wants within range 3 (any bearing) for one full maneuver cycle
 * acquires a lock; the lock holds until a launch spends it, the target
 * leaves {@link LOCK_BREAK_RANGE_PX}, dies or cloaks (the caller passes a
 * null range), or the pilot switches target. Missiles and torpedoes can
 * only be launched at a locked target.
 *
 * Pure: no Phaser.
 */

import { CYCLE_DURATION_MS, RANGE_3 } from "../../config";

/** Time the wanted target must stay in lock range to acquire a lock. */
export const LOCK_ACQUIRE_MS = CYCLE_DURATION_MS;
/** A lock is acquired at tabletop range 0–3. */
export const LOCK_RANGE_PX = RANGE_3;
/** An acquired lock breaks once the target is this far away. */
export const LOCK_BREAK_RANGE_PX = 2 * RANGE_3;

/** A ship's lock on one target. */
export interface LockState {
  /** The target being locked (or locked), null for none. */
  readonly targetId: string | null;
  /** Time spent acquiring (≥ LOCK_ACQUIRE_MS = locked). */
  readonly heldMs: number;
}

/** No target, no lock. */
export const NO_LOCK: LockState = { targetId: null, heldMs: 0 };

/** One frame of lock input. */
export interface LockInput {
  /** The target the pilot wants (HUD target / bot target), or null. */
  readonly wantedId: string | null;
  /** Range to it the short way round; null when dead, cloaked or gone. */
  readonly rangePx: number | null;
  readonly deltaMs: number;
}

/**
 * @param lock - A lock state.
 * @param targetId - The target asked about.
 * @returns True when the lock on that target is acquired.
 */
export function isLockedOn(lock: LockState, targetId: string): boolean {
  return lock.targetId === targetId && lock.heldMs >= LOCK_ACQUIRE_MS;
}

/**
 * @param lock - A lock state.
 * @returns Acquisition progress in [0, 1] (1 = locked).
 */
export function lockProgress(lock: LockState): number {
  if (lock.targetId === null) return 0;
  return Math.min(1, lock.heldMs / LOCK_ACQUIRE_MS);
}

/**
 * Advance a ship's lock one frame.
 *
 * @param lock - The lock before the frame.
 * @param input - The wanted target, its range and the frame length.
 * @returns The lock after the frame.
 */
export function stepLock(lock: LockState, input: LockInput): LockState {
  if (input.wantedId === null || input.rangePx === null) return NO_LOCK;
  const current: LockState =
    lock.targetId === input.wantedId
      ? lock
      : { targetId: input.wantedId, heldMs: 0 };
  if (current.heldMs >= LOCK_ACQUIRE_MS) {
    return input.rangePx > LOCK_BREAK_RANGE_PX
      ? { targetId: input.wantedId, heldMs: 0 }
      : current;
  }
  if (input.rangePx > LOCK_RANGE_PX) return { ...current, heldMs: 0 };
  return { ...current, heldMs: current.heldMs + input.deltaMs };
}

/**
 * A launch spends the lock: the target stays wanted, but the lock must be
 * acquired again before the next launch.
 *
 * @param lock - The lock spent.
 * @returns The lock after the launch.
 */
export function spendLock(lock: LockState): LockState {
  return { targetId: lock.targetId, heldMs: 0 };
}
