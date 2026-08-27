/**
 * Pure countdown clock for competitive match time limits.
 *
 * Modes with a bounded runtime (arcade skirmish, ace duel, continuous tactical,
 * dogfight, epic) share this state machine so the timeout → score resolution
 * behaves identically everywhere. Rendering and outcome handling stay in the
 * scene; this module only advances the clock.
 */

/** Immutable snapshot of the remaining match time. */
export interface MatchTimerState {
  /** Milliseconds left before the match ends. Never negative. */
  readonly remainingMs: number;
  /** True once the clock has reached zero. */
  readonly expired: boolean;
}

/**
 * Create a match timer for the given duration.
 *
 * @param durationMs - Total match length in milliseconds. Negative values are
 *   clamped to zero (an already-expired timer).
 * @returns The initial timer state.
 */
export function createMatchTimer(durationMs: number): MatchTimerState {
  const clamped = Math.max(0, durationMs);
  return { remainingMs: clamped, expired: clamped === 0 };
}

/**
 * Advance the timer by a frame delta.
 *
 * @param state - The current timer state.
 * @param deltaMs - Elapsed time since the last tick, in milliseconds. Negative
 *   values are treated as zero.
 * @returns The next timer state. Once expired, the same state is returned.
 */
export function tickMatchTimer(
  state: MatchTimerState,
  deltaMs: number,
): MatchTimerState {
  if (state.expired) return state;
  const remaining = Math.max(0, state.remainingMs - Math.max(0, deltaMs));
  return { remainingMs: remaining, expired: remaining === 0 };
}

/**
 * Format a remaining-time value as a `m:ss` clock string.
 *
 * @param remainingMs - Milliseconds remaining. Negative values render as `0:00`.
 * @returns The formatted clock string (for example `3:00`, `1:05`, `0:07`).
 */
export function formatMatchClock(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
