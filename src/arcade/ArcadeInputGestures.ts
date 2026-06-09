/**
 * ArcadeInputGestures — Gesture state machine for arcade flight controls.
 *
 * Converts raw key-held booleans into higher-level flight intentions:
 *   - Short tap left/right  → bank (caps deflection to STRESSED_MAX_DEFLECTION)
 *   - Held  left/right      → turn (full deflection, subject to stress)
 *   - Double-tap UP         → boost dash
 *   - Double-tap DOWN       → K-turn (in addition to Z key)
 *   - Chord left+right      → barrel roll (direction of second key, feature-flagged)
 *
 * Pure functions only — no Phaser dependency. All state is immutable.
 */

import { STRESSED_MAX_DEFLECTION } from "./ArcadeStress";

// ============================================
// Timing constants
// ============================================

/**
 * Hold left/right longer than this threshold to open full-turn deflection.
 * Shorter taps stay capped at bank level (0.64 × max).
 */
export const BANK_HOLD_THRESHOLD_MS = 250;

/** Two keydowns within this window counts as a double-tap. */
export const DOUBLE_TAP_WINDOW_MS = 300;

/**
 * Both lateral keys must be pressed within this window to register as a chord
 * barrel roll. Tighter than DOUBLE_TAP to require deliberate simultaneous press.
 */
export const CHORD_WINDOW_MS = 150;

/** Pixels the ship snaps forward on a boost dash. */
export const BOOST_DISTANCE_PX = 220;

// ============================================
// State & actions
// ============================================

/** Actions that gesture detection can fire in a single frame. */
export type GestureAction =
  | "boost"
  | "kturn_gesture"
  | "barrel_roll_left"
  | "barrel_roll_right"
  /** Hold left/right past BANK_HOLD_THRESHOLD_MS — fires once, then consumed until key released. */
  | "hard_turn_left"
  | "hard_turn_right"
  /** Double-tap UP + direction held — Tallon Roll (180° with lateral offset). Arc math TODO. */
  | "tallon_roll_left"
  | "tallon_roll_right"
  /** Double-tap DOWN + direction held — Segnor Loop (reverse loop with lateral offset). Arc math TODO. */
  | "segnor_loop_left"
  | "segnor_loop_right";

/** Immutable gesture tracking state; updated every frame via updateGestures(). */
export interface GestureState {
  /** Continuous ms the left key has been held (reset to 0 on release). */
  readonly leftHeldMs: number;
  /** Continuous ms the right key has been held (reset to 0 on release). */
  readonly rightHeldMs: number;
  /** Wall-clock timestamp (ms) when left was last pressed (0 while not held). */
  readonly leftPressedAtMs: number;
  /** Wall-clock timestamp (ms) when right was last pressed (0 while not held). */
  readonly rightPressedAtMs: number;
  /** Wall-clock timestamp of the most recent UP keydown. */
  readonly lastUpTapMs: number;
  /** Wall-clock timestamp of the most recent DOWN keydown. */
  readonly lastDownTapMs: number;
  /** Prevents a barrel roll from firing repeatedly while the chord is held. */
  readonly barrelRollConsumed: boolean;
  /**
   * Prevents hard_turn_left/right from repeating while the key stays held.
   * Reset to false when both left and right are released.
   */
  readonly hardTurnConsumed: boolean;
  readonly prevLeftDown: boolean;
  readonly prevRightDown: boolean;
  readonly prevUpDown: boolean;
  readonly prevDownDown: boolean;
}

export const INITIAL_GESTURE_STATE: GestureState = {
  leftHeldMs: 0,
  rightHeldMs: 0,
  leftPressedAtMs: 0,
  rightPressedAtMs: 0,
  lastUpTapMs: 0,
  lastDownTapMs: 0,
  barrelRollConsumed: false,
  hardTurnConsumed: false,
  prevLeftDown: false,
  prevRightDown: false,
  prevUpDown: false,
  prevDownDown: false,
};

// ============================================
// Parameters object (avoids >5 param limit)
// ============================================

export interface GestureUpdateParams {
  readonly state: GestureState;
  readonly leftDown: boolean;
  readonly rightDown: boolean;
  readonly upDown: boolean;
  readonly downDown: boolean;
  /** Current wall-clock time in ms (use Phaser's time.now). */
  readonly nowMs: number;
  readonly deltaMs: number;
  /** Set false to disable the chord barrel roll (accessibility / mobile). */
  readonly allowChordBarrelRoll: boolean;
}

export interface GestureUpdateResult {
  /** New gesture state to store for next frame. */
  readonly state: GestureState;
  /**
   * Fraction of maxAngularVelocity to allow this frame.
   * 0.64 for bank (short tap), 1.0 for turn (held > BANK_HOLD_THRESHOLD_MS).
   */
  readonly deflectionCap: number;
  /** Zero or more actions triggered this frame. */
  readonly actions: readonly GestureAction[];
}

// ============================================
// Core update function
// ============================================

/**
 * Advances gesture state by one frame and returns intent data.
 *
 * @param params - Current key states, timing, and feature flags.
 * @returns New state, deflection cap (fraction of maxAngVel), and triggered actions.
 */
export function updateGestures(
  params: GestureUpdateParams,
): GestureUpdateResult {
  const {
    state,
    leftDown,
    rightDown,
    upDown,
    downDown,
    nowMs,
    deltaMs,
    allowChordBarrelRoll,
  } = params;

  const actions: GestureAction[] = [];

  // --- Hold timers: accumulate while held, reset on release ---
  const leftHeldMs = leftDown ? state.leftHeldMs + deltaMs : 0;
  const rightHeldMs = rightDown ? state.rightHeldMs + deltaMs : 0;

  // --- Leading-edge detection (key just pressed this frame) ---
  const leftJustDown = leftDown && !state.prevLeftDown;
  const rightJustDown = rightDown && !state.prevRightDown;
  const upJustDown = upDown && !state.prevUpDown;
  const downJustDown = downDown && !state.prevDownDown;

  // --- Press timestamps (for chord timing) ---
  const leftPressedAtMs = leftJustDown
    ? nowMs
    : leftDown
      ? state.leftPressedAtMs
      : 0;
  const rightPressedAtMs = rightJustDown
    ? nowMs
    : rightDown
      ? state.rightPressedAtMs
      : 0;

  // --- Double-tap timestamps ---
  const lastUpTapMs = upJustDown ? nowMs : state.lastUpTapMs;
  const lastDownTapMs = downJustDown ? nowMs : state.lastDownTapMs;

  // --- Chord barrel roll (left+right within CHORD_WINDOW_MS) ---
  let barrelRollConsumed =
    !leftDown || !rightDown ? false : state.barrelRollConsumed;
  if (allowChordBarrelRoll && !barrelRollConsumed) {
    if (
      leftDown &&
      rightJustDown &&
      nowMs - state.leftPressedAtMs <= CHORD_WINDOW_MS
    ) {
      actions.push("barrel_roll_left");
      barrelRollConsumed = true;
    } else if (
      rightDown &&
      leftJustDown &&
      nowMs - state.rightPressedAtMs <= CHORD_WINDOW_MS
    ) {
      actions.push("barrel_roll_right");
      barrelRollConsumed = true;
    }
  }

  // --- Double-tap UP: boost (plain) or Tallon Roll (with direction held) ---
  if (upJustDown && nowMs - state.lastUpTapMs <= DOUBLE_TAP_WINDOW_MS) {
    if (leftDown) actions.push("tallon_roll_left");
    else if (rightDown) actions.push("tallon_roll_right");
    else actions.push("boost");
  }

  // --- Double-tap DOWN: K-turn (plain) or Segnor Loop (with direction held) ---
  if (downJustDown && nowMs - state.lastDownTapMs <= DOUBLE_TAP_WINDOW_MS) {
    if (leftDown) actions.push("segnor_loop_left");
    else if (rightDown) actions.push("segnor_loop_right");
    else actions.push("kturn_gesture");
  }

  // --- Hold-to-commit hard turn: fires once when hold crosses the bank threshold ---
  // Resets when both lateral keys are released so a new hold can commit again.
  let hardTurnConsumed =
    !leftDown && !rightDown ? false : state.hardTurnConsumed;
  if (!hardTurnConsumed) {
    const justCrossedLeft =
      leftDown &&
      leftHeldMs >= BANK_HOLD_THRESHOLD_MS &&
      state.leftHeldMs < BANK_HOLD_THRESHOLD_MS;
    const justCrossedRight =
      rightDown &&
      rightHeldMs >= BANK_HOLD_THRESHOLD_MS &&
      state.rightHeldMs < BANK_HOLD_THRESHOLD_MS;
    if (justCrossedLeft) {
      actions.push("hard_turn_left");
      hardTurnConsumed = true;
    }
    if (justCrossedRight) {
      actions.push("hard_turn_right");
      hardTurnConsumed = true;
    }
  }

  // --- Deflection cap: bank-level until held long enough for a full turn ---
  const holdMs = Math.max(leftHeldMs, rightHeldMs);
  const deflectionCap =
    holdMs >= BANK_HOLD_THRESHOLD_MS ? 1.0 : STRESSED_MAX_DEFLECTION;

  return {
    state: {
      leftHeldMs,
      rightHeldMs,
      leftPressedAtMs,
      rightPressedAtMs,
      lastUpTapMs,
      lastDownTapMs,
      barrelRollConsumed,
      hardTurnConsumed,
      prevLeftDown: leftDown,
      prevRightDown: rightDown,
      prevUpDown: upDown,
      prevDownDown: downDown,
    },
    deflectionCap,
    actions,
  };
}
