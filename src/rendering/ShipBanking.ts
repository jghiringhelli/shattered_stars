/**
 * ShipBanking — turn-rate-driven "lean into the turn" squash for ship sprites.
 * Every battle scene already rotates a ship's container to face its heading;
 * this adds a secondary scale wobble on top so a hard turn reads as banking
 * rather than a flat sprite spinning in place. Pure math/state only — scenes
 * own applying the resulting scale to the actual image.
 */

export interface BankState {
  readonly lastAngle: number;
  readonly smoothedRate: number;
}

export const INITIAL_BANK_STATE: BankState = { lastAngle: 0, smoothedRate: 0 };

/** How much the sprite squashes horizontally / stretches vertically at full saturation. */
const MAX_BANK_SQUASH = 0.3;
/** Exponential-ease factor per update toward the instantaneous turn rate (0..1, higher = snappier). */
const RATE_SMOOTHING = 0.25;
/** Turn rate (deg/sec) at which the squash effect is fully saturated. */
const SATURATION_DEG_PER_SEC = 240;

/** Signed shortest angular distance from `from` to `to`, in the range (-180, 180]. */
function shortestAngleDeltaDeg(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

/**
 * Advances bank state by one frame given the ship's current facing angle.
 * @param state - Previous bank state.
 * @param currentAngleDeg - The ship's current heading, in degrees.
 * @param deltaSeconds - Elapsed time since the last update, in seconds.
 * @returns The updated bank state; unchanged when `deltaSeconds` is non-positive.
 */
export function updateBankState(
  state: BankState,
  currentAngleDeg: number,
  deltaSeconds: number,
): BankState {
  if (deltaSeconds <= 0) return state;

  const deltaDeg = shortestAngleDeltaDeg(state.lastAngle, currentAngleDeg);
  const instantRate = deltaDeg / deltaSeconds;
  const smoothedRate =
    state.smoothedRate + (instantRate - state.smoothedRate) * RATE_SMOOTHING;

  return { lastAngle: currentAngleDeg, smoothedRate };
}

/**
 * Maps a bank state's turn rate to a sprite scale that reads as banking into the turn.
 * @param state - Current bank state.
 * @returns Scale factors to apply to the ship's image (1, 1 when flying straight).
 */
export function bankSquashFor(state: BankState): {
  scaleX: number;
  scaleY: number;
} {
  const normalized = Math.max(
    -1,
    Math.min(1, state.smoothedRate / SATURATION_DEG_PER_SEC),
  );
  const intensity = Math.abs(normalized);
  return {
    scaleX: 1 - intensity * MAX_BANK_SQUASH,
    scaleY: 1 + intensity * MAX_BANK_SQUASH * 0.3,
  };
}
