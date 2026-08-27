/**
 * FleeDetector — Detects and penalises "run away and hide" gameplay.
 *
 * When the player stays out of engagement range AND no damage is exchanged
 * for a sustained period, the battle ends as a defeat. This prevents endless
 * cat-and-mouse where a faster player ship can never be caught even with
 * torus-aware AI pursuit.
 *
 * State machine:
 *   idle → warning (10s idle at long range) → fled (5s more)
 *
 * Timers reset instantly on any hull damage OR player closing to combat range.
 */

/** Milliseconds of no combat + long range before the WARNING starts. */
export const FLEE_IDLE_THRESHOLD_MS = 10_000;

/** Milliseconds the warning displays before the battle is force-ended. */
export const FLEE_FORCE_END_MS = 5_000;

/** Player must be farther than this from every enemy to count as "hiding". */
export const FLEE_DISTANCE_THRESHOLD = 1500;

export interface FleeState {
  /** Time (ms) since the last damage event or last time player was in range. */
  readonly idleMs: number;
  /** Time (ms) spent in the WARNING state. */
  readonly warningMs: number;
  /** True when idleMs ≥ FLEE_IDLE_THRESHOLD_MS. */
  readonly isWarning: boolean;
  /** True when warningMs ≥ FLEE_FORCE_END_MS. Battle should end. */
  readonly hasFled: boolean;
}

export function createFleeState(): FleeState {
  return { idleMs: 0, warningMs: 0, isWarning: false, hasFled: false };
}

export interface FleeTickInput {
  readonly deltaMs: number;
  /** True if any ship took hull damage this frame. */
  readonly damageThisFrame: boolean;
  /** Torus-aware distance from player to nearest live enemy. */
  readonly playerNearestEnemyDist: number;
}

/**
 * Advances the flee state one tick.
 *
 * @param state - Previous frame's state.
 * @param input - Combat metrics for this frame.
 * @returns New state; caller reads `isWarning` for HUD and `hasFled` to end battle.
 */
export function updateFleeState(
  state: FleeState,
  input: FleeTickInput,
): FleeState {
  const inRange = input.playerNearestEnemyDist <= FLEE_DISTANCE_THRESHOLD;
  if (input.damageThisFrame || inRange) {
    return createFleeState();
  }
  const idleMs = state.idleMs + input.deltaMs;
  const isWarning = idleMs >= FLEE_IDLE_THRESHOLD_MS;
  const warningMs = isWarning ? state.warningMs + input.deltaMs : 0;
  const hasFled = warningMs >= FLEE_FORCE_END_MS;
  return { idleMs, warningMs, isWarning, hasFled };
}

/**
 * Seconds remaining before force-end while in warning state.
 * Returns 0 outside the warning state.
 */
export function fleeSecondsRemaining(state: FleeState): number {
  if (!state.isWarning) return 0;
  return Math.max(0, (FLEE_FORCE_END_MS - state.warningMs) / 1000);
}
