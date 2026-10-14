/**
 * RollDoubleTap — recognises the barrel-roll gesture: two quick taps of the
 * SAME steering arrow (← ← = roll left, → → = roll right).
 *
 * Alternating ← → is ordinary steering in this game, so only two
 * consecutive presses of one side count: any press of the other side, or a
 * chord of both, forgets the first tap. Both taps must be short (a hold is
 * a bank) and flicker-proof (a stick wobbling across its deadzone, or a
 * bouncing switch, is too fast to be a deliberate tap).
 *
 * Pure: no Phaser.
 */

/** Second press must land within this long of the first press (ms). */
export const ROLL_DOUBLE_TAP_WINDOW_MS = 220;

/** The first tap must be released within this long — shorter than a bank hold (ms). */
export const ROLL_TAP_MAX_MS = 140;

/** The first tap must last at least this long, or it is input flicker (ms). */
export const ROLL_TAP_MIN_MS = 25;

/** The gap between the taps must be at least this long, or it is flicker (ms). */
export const ROLL_TAP_GAP_MIN_MS = 25;

export type RollSide = "left" | "right";

/** Memory of the last lateral press and the arrows' previous frame. */
export interface RollTapState {
  /** Side of the last press that could begin a double tap, if any. */
  readonly side: RollSide | null;
  readonly pressedAtMs: number;
  /** When that press was released; null while it is still held. */
  readonly releasedAtMs: number | null;
  readonly prevLeft: boolean;
  readonly prevRight: boolean;
}

export const INITIAL_ROLL_TAP: RollTapState = {
  side: null,
  pressedAtMs: 0,
  releasedAtMs: null,
  prevLeft: false,
  prevRight: false,
};

/** One frame of the arrows. */
export interface RollTapFrame {
  readonly left: boolean;
  readonly right: boolean;
  readonly nowMs: number;
  /** False while another gesture owns the arrows (e.g. the maneuver key is down). */
  readonly enabled: boolean;
}

/** Tracking after a frame and the roll it completed, if any. */
export interface RollTapResult {
  readonly state: RollTapState;
  readonly roll: RollSide | null;
}

/**
 * @param state - Memory after the candidate's press was seen.
 * @param side - Side just pressed.
 * @param nowMs - Press time (ms).
 * @returns Whether this press completes a double tap of `side`.
 */
function completesDoubleTap(
  state: RollTapState,
  side: RollSide,
  nowMs: number,
): boolean {
  if (state.side !== side || state.releasedAtMs === null) return false;
  const tapMs = state.releasedAtMs - state.pressedAtMs;
  return (
    nowMs - state.pressedAtMs <= ROLL_DOUBLE_TAP_WINDOW_MS &&
    tapMs >= ROLL_TAP_MIN_MS &&
    tapMs <= ROLL_TAP_MAX_MS &&
    nowMs - state.releasedAtMs >= ROLL_TAP_GAP_MIN_MS
  );
}

/**
 * Advance the double-tap tracking by one frame.
 *
 * @param state - Tracking before the frame.
 * @param frame - The arrows this frame.
 * @returns New tracking and the roll side when a double tap just completed.
 */
export function updateRollTap(
  state: RollTapState,
  frame: RollTapFrame,
): RollTapResult {
  const { left, right, nowMs } = frame;
  const carried: RollTapState = { ...state, prevLeft: left, prevRight: right };
  if (!frame.enabled || (left && right)) {
    return { state: { ...carried, side: null, releasedAtMs: null }, roll: null };
  }
  const pressed: RollSide | null =
    left && !state.prevLeft ? "left" : right && !state.prevRight ? "right" : null;
  if (pressed) {
    if (completesDoubleTap(state, pressed, nowMs)) {
      return { state: { ...carried, side: null, releasedAtMs: null }, roll: pressed };
    }
    return {
      state: { ...carried, side: pressed, pressedAtMs: nowMs, releasedAtMs: null },
      roll: null,
    };
  }
  const stillHeld = state.side === "left" ? left : state.side === "right" ? right : false;
  if (state.side && !stillHeld && state.releasedAtMs === null) {
    return { state: { ...carried, releasedAtMs: nowMs }, roll: null };
  }
  return { state: carried, roll: null };
}
