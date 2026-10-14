/**
 * ManeuverKey — the ONE key (default Z; gamepad LT; touch MANEUVER button)
 * that flies the specials the arrows cannot reach:
 *
 *   tap                       → Snap Turn (180°)
 *   hold + ← / →              → Hook Loop left / right
 *   double-tap, then hold + ← / → → Knife Roll left / right
 *
 * A tap cannot be told from the first half of a Knife double-tap until the
 * double-tap window closes, so the Snap Turn is requested when that window
 * ends with no second press (queueing it at once could let the 500 ms cycle
 * fly it before the second press arrives). A second press inside the window
 * arms the Knife; released with no side, it is the Snap Turn after all.
 * Pressing a side that was already held when the key went down never fires a
 * Hook (steering left, then tapping the key for a Snap Turn, must not hook
 * left) unless that side came down within a chord grace of the key.
 *
 * Pure: no Phaser.
 */

import type { SpecialManeuver } from "./systems/FlightCapabilities";

/** A tap is released within this long of its press (ms). */
export const MANEUVER_TAP_MAX_MS = 300;

/**
 * A second press within this long of a tap's press arms the Knife Roll, and
 * a lone tap's Snap Turn waits this long (ms) — the same feel as the arrows'
 * barrel-roll double-tap.
 */
export const MANEUVER_DOUBLE_TAP_WINDOW_MS = 220;

/** A side pressed up to this long before the key still counts as part of the chord (ms). */
export const MANEUVER_SIDE_GRACE_MS = 60;

/** Tap timestamp meaning "no tap pending" (finite: pilot memory is snapshotted as JSON online). */
const NO_TAP = -1_000_000_000;

/** The maneuver key's memory between frames. */
export interface ManeuverKeyState {
  readonly held: boolean;
  readonly downAtMs: number;
  /** A Hook or Knife fired during this hold. */
  readonly used: boolean;
  /** This hold is the second press of a double tap: its side is a Knife. */
  readonly knifeArmed: boolean;
  /** Press time of a clean tap whose Snap Turn is still waiting out the window, or NO_TAP. */
  readonly pendingTapDownAtMs: number;
  readonly prevLeft: boolean;
  readonly prevRight: boolean;
  readonly leftDownAtMs: number;
  readonly rightDownAtMs: number;
}

export const INITIAL_MANEUVER_KEY: ManeuverKeyState = {
  held: false,
  downAtMs: 0,
  used: false,
  knifeArmed: false,
  pendingTapDownAtMs: NO_TAP,
  prevLeft: false,
  prevRight: false,
  leftDownAtMs: NO_TAP,
  rightDownAtMs: NO_TAP,
};

/** One frame of the key and the arrows. */
export interface ManeuverKeyFrame {
  readonly held: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly nowMs: number;
}

/** What the key asked for this frame. */
export interface ManeuverKeyResult {
  readonly state: ManeuverKeyState;
  /** The special requested (at most one per frame). */
  readonly special: SpecialManeuver | null;
}

/**
 * @param frame - The key and arrows this frame.
 * @param state - Memory before the frame.
 * @param armed - Whether this hold is the second press of a double tap.
 * @param justDown - Whether the key went down this frame.
 * @returns The side pressed with the key, or null.
 */
function chordSide(
  frame: ManeuverKeyFrame,
  state: ManeuverKeyState,
  armed: boolean,
  justDown: boolean,
): "left" | "right" | null {
  const { left, right, nowMs } = frame;
  if (left === right) return null;
  const side = left ? "left" : "right";
  const wasDown = left ? state.prevLeft : state.prevRight;
  if (!wasDown) return side;
  if (!justDown) return null;
  if (armed) return side;
  const sideDownAt = left ? state.leftDownAtMs : state.rightDownAtMs;
  return nowMs - sideDownAt <= MANEUVER_SIDE_GRACE_MS ? side : null;
}

/**
 * Advance the maneuver key by one frame.
 *
 * @param state - Memory before the frame.
 * @param frame - The key and arrows this frame.
 * @returns New memory and the special requested, if any.
 */
export function updateManeuverKey(
  state: ManeuverKeyState,
  frame: ManeuverKeyFrame,
): ManeuverKeyResult {
  const { nowMs, left, right } = frame;
  const justDown = frame.held && !state.held;
  const justUp = !frame.held && state.held;
  const armed = justDown
    ? nowMs - state.pendingTapDownAtMs <= MANEUVER_DOUBLE_TAP_WINDOW_MS
    : frame.held && state.knifeArmed;
  const base: ManeuverKeyState = {
    ...state,
    held: frame.held,
    downAtMs: justDown ? nowMs : state.downAtMs,
    used: frame.held && !justDown && state.used,
    knifeArmed: armed,
    pendingTapDownAtMs: justDown ? NO_TAP : state.pendingTapDownAtMs,
    prevLeft: left,
    prevRight: right,
    leftDownAtMs: left && !state.prevLeft ? nowMs : state.leftDownAtMs,
    rightDownAtMs: right && !state.prevRight ? nowMs : state.rightDownAtMs,
  };
  if (justUp) return released(base, state, nowMs);
  if (!frame.held) return waitedOut(base, nowMs);
  if (justDown && !armed && state.pendingTapDownAtMs !== NO_TAP) {
    return { state: base, special: "kturn" };
  }
  if (base.used) return idle(base);
  const side = chordSide(frame, state, armed, justDown);
  if (!side) return idle(base);
  return {
    state: { ...base, used: true },
    special: `${armed ? "tallon" : "segnor"}_${side}`,
  };
}

/**
 * @param state - Memory to keep.
 * @returns A result requesting nothing.
 */
function idle(state: ManeuverKeyState): ManeuverKeyResult {
  return { state, special: null };
}

/**
 * The key is up: a lone tap's Snap Turn fires once its double-tap window
 * closes with no second press.
 *
 * @param state - Memory with this frame's edges applied.
 * @param nowMs - Frame time (ms).
 * @returns The Snap Turn request when the window just closed, else nothing.
 */
function waitedOut(state: ManeuverKeyState, nowMs: number): ManeuverKeyResult {
  if (state.pendingTapDownAtMs === NO_TAP) return idle(state);
  if (nowMs - state.pendingTapDownAtMs <= MANEUVER_DOUBLE_TAP_WINDOW_MS)
    return idle(state);
  return {
    state: { ...state, pendingTapDownAtMs: NO_TAP },
    special: "kturn",
  };
}

/**
 * The key came up. A short, unused first press becomes a pending tap (its
 * Snap Turn waits out the window); a short second press with no side is the
 * Snap Turn right away; a used hold, or a long press, requests nothing.
 *
 * @param next - Memory with this frame's edges applied.
 * @param previous - Memory before the frame.
 * @param nowMs - Frame time (ms).
 * @returns The Snap Turn request, or nothing.
 */
function released(
  next: ManeuverKeyState,
  previous: ManeuverKeyState,
  nowMs: number,
): ManeuverKeyResult {
  const cleaned: ManeuverKeyState = {
    ...next,
    used: false,
    knifeArmed: false,
    pendingTapDownAtMs: NO_TAP,
  };
  const quick = nowMs - previous.downAtMs <= MANEUVER_TAP_MAX_MS;
  if (previous.used || !quick) return idle(cleaned);
  if (previous.knifeArmed) return { state: cleaned, special: "kturn" };
  return idle({ ...cleaned, pendingTapDownAtMs: previous.downAtMs });
}