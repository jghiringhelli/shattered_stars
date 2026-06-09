/**
 * Unit tests for ArcadeInputGestures — gesture state machine.
 *
 * Each test drives updateGestures() with synthetic key states and
 * asserts the correct actions and deflectionCap are emitted.
 */

import { describe, it, expect } from "vitest";
import {
  updateGestures,
  INITIAL_GESTURE_STATE,
  BANK_HOLD_THRESHOLD_MS,
  DOUBLE_TAP_WINDOW_MS,
  CHORD_WINDOW_MS,
  STRESSED_MAX_DEFLECTION as BANK_DEFLECTION,
  type GestureState,
} from "../../../src/arcade/ArcadeInputGestures";

// Re-import the constant via the module it lives in
import { STRESSED_MAX_DEFLECTION } from "../../../src/arcade/ArcadeStress";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal param object with all keys up and all booleans false. */
function base(
  overrides: Partial<{
    state: GestureState;
    leftDown: boolean;
    rightDown: boolean;
    upDown: boolean;
    downDown: boolean;
    nowMs: number;
    deltaMs: number;
    allowChordBarrelRoll: boolean;
  }> = {},
) {
  return {
    state: INITIAL_GESTURE_STATE,
    leftDown: false,
    rightDown: false,
    upDown: false,
    downDown: false,
    nowMs: 1000,
    deltaMs: 16,
    allowChordBarrelRoll: true,
    ...overrides,
  };
}

/** Advance a single frame with given keys. */
function frame(
  state: GestureState,
  keys: Partial<{
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  }>,
  nowMs: number,
  deltaMs = 16,
): ReturnType<typeof updateGestures> {
  return updateGestures({
    state,
    leftDown: keys.left ?? false,
    rightDown: keys.right ?? false,
    upDown: keys.up ?? false,
    downDown: keys.down ?? false,
    nowMs,
    deltaMs,
    allowChordBarrelRoll: true,
  });
}

// ─── Deflection cap ──────────────────────────────────────────────────────────

describe("deflectionCap", () => {
  it("is bank-level on a short tap (below hold threshold)", () => {
    let s = INITIAL_GESTURE_STATE;
    let r = frame(s, { left: true }, 1000, 16); // 16ms — way below 250ms
    expect(r.deflectionCap).toBe(STRESSED_MAX_DEFLECTION);
  });

  it("rises to 1.0 after holding past BANK_HOLD_THRESHOLD_MS", () => {
    let s = INITIAL_GESTURE_STATE;
    let r = frame(s, { left: true }, 1000, BANK_HOLD_THRESHOLD_MS + 1);
    expect(r.deflectionCap).toBe(1.0);
  });

  it("returns to bank-level immediately after key release", () => {
    let s = INITIAL_GESTURE_STATE;
    // Hold long enough to open full deflection
    let r = frame(s, { left: true }, 1000, BANK_HOLD_THRESHOLD_MS + 1);
    s = r.state;
    // Release
    r = frame(s, {}, 1016, 16);
    expect(r.deflectionCap).toBe(STRESSED_MAX_DEFLECTION);
  });
});

// ─── Hold-to-commit hard turn ────────────────────────────────────────────────

describe("hold-to-commit hard turn", () => {
  it("emits hard_turn_left exactly once when hold crosses threshold", () => {
    let s = INITIAL_GESTURE_STATE;
    // Accumulate just below the threshold
    let r = frame(s, { left: true }, 1000, BANK_HOLD_THRESHOLD_MS - 1);
    expect(r.actions).not.toContain("hard_turn_left");
    s = r.state;
    // One more frame pushes past it
    r = frame(s, { left: true }, 1000 + BANK_HOLD_THRESHOLD_MS - 1, 2);
    expect(r.actions).toContain("hard_turn_left");
  });

  it("does NOT re-fire on subsequent frames while still held", () => {
    let s = INITIAL_GESTURE_STATE;
    let r = frame(s, { left: true }, 1000, BANK_HOLD_THRESHOLD_MS + 1);
    s = r.state;
    // Another frame still holding
    r = frame(s, { left: true }, 1000 + BANK_HOLD_THRESHOLD_MS + 1, 16);
    expect(r.actions).not.toContain("hard_turn_left");
  });

  it("resets after release so a second hold fires again", () => {
    let s = INITIAL_GESTURE_STATE;
    // First hold: commit
    let r = frame(s, { left: true }, 1000, BANK_HOLD_THRESHOLD_MS + 1);
    s = r.state;
    // Release
    r = frame(s, {}, 1300, 16);
    s = r.state;
    // Second hold: should commit again
    r = frame(s, { left: true }, 1316, BANK_HOLD_THRESHOLD_MS + 1);
    expect(r.actions).toContain("hard_turn_left");
  });

  it("emits hard_turn_right when right is held", () => {
    let s = INITIAL_GESTURE_STATE;
    let r = frame(s, { right: true }, 1000, BANK_HOLD_THRESHOLD_MS + 1);
    expect(r.actions).toContain("hard_turn_right");
  });
});

// ─── Double-tap UP: boost vs. Tallon Roll ────────────────────────────────────

describe("double-tap UP", () => {
  it("emits boost when UP is double-tapped with no direction held", () => {
    let s = INITIAL_GESTURE_STATE;
    // First tap
    let r = frame(s, { up: true }, 1000, 16);
    s = r.state;
    r = frame(s, {}, 1016, 16);
    s = r.state;
    // Second tap within window
    r = frame(s, { up: true }, 1100, 16);
    expect(r.actions).toContain("boost");
    expect(r.actions).not.toContain("tallon_roll_left");
    expect(r.actions).not.toContain("tallon_roll_right");
  });

  it("emits tallon_roll_left when UP double-tapped while LEFT held", () => {
    let s = INITIAL_GESTURE_STATE;
    // First tap
    let r = frame(s, { up: true }, 1000, 16);
    s = r.state;
    r = frame(s, {}, 1016, 16);
    s = r.state;
    // Second tap + left held
    r = frame(s, { up: true, left: true }, 1100, 16);
    expect(r.actions).toContain("tallon_roll_left");
    expect(r.actions).not.toContain("boost");
  });

  it("emits tallon_roll_right when UP double-tapped while RIGHT held", () => {
    let s = INITIAL_GESTURE_STATE;
    let r = frame(s, { up: true }, 1000, 16);
    s = r.state;
    r = frame(s, {}, 1016, 16);
    s = r.state;
    r = frame(s, { up: true, right: true }, 1100, 16);
    expect(r.actions).toContain("tallon_roll_right");
  });

  it("does NOT boost on single tap", () => {
    let r = frame(INITIAL_GESTURE_STATE, { up: true }, 1000, 16);
    expect(r.actions).not.toContain("boost");
  });

  it("does NOT boost when double-tap exceeds the window", () => {
    let s = INITIAL_GESTURE_STATE;
    let r = frame(s, { up: true }, 1000, 16);
    s = r.state;
    r = frame(s, {}, 1016, 16);
    s = r.state;
    // Way outside the window
    r = frame(s, { up: true }, 1000 + DOUBLE_TAP_WINDOW_MS + 50, 16);
    expect(r.actions).not.toContain("boost");
  });
});

// ─── Double-tap DOWN: K-turn vs. Segnor Loop ────────────────────────────────

describe("double-tap DOWN", () => {
  it("emits kturn_gesture when DOWN double-tapped with no direction held", () => {
    let s = INITIAL_GESTURE_STATE;
    let r = frame(s, { down: true }, 1000, 16);
    s = r.state;
    r = frame(s, {}, 1016, 16);
    s = r.state;
    r = frame(s, { down: true }, 1100, 16);
    expect(r.actions).toContain("kturn_gesture");
    expect(r.actions).not.toContain("segnor_loop_left");
  });

  it("emits segnor_loop_left when DOWN double-tapped while LEFT held", () => {
    let s = INITIAL_GESTURE_STATE;
    let r = frame(s, { down: true }, 1000, 16);
    s = r.state;
    r = frame(s, {}, 1016, 16);
    s = r.state;
    r = frame(s, { down: true, left: true }, 1100, 16);
    expect(r.actions).toContain("segnor_loop_left");
    expect(r.actions).not.toContain("kturn_gesture");
  });

  it("emits segnor_loop_right when DOWN double-tapped while RIGHT held", () => {
    let s = INITIAL_GESTURE_STATE;
    let r = frame(s, { down: true }, 1000, 16);
    s = r.state;
    r = frame(s, {}, 1016, 16);
    s = r.state;
    r = frame(s, { down: true, right: true }, 1100, 16);
    expect(r.actions).toContain("segnor_loop_right");
  });
});

// ─── Chord barrel roll ───────────────────────────────────────────────────────

describe("chord barrel roll", () => {
  it("emits barrel_roll_left when right is pressed while left is held within window", () => {
    let s = INITIAL_GESTURE_STATE;
    // Press left first
    let r = frame(s, { left: true }, 1000, 16);
    s = r.state;
    // Press right within chord window — held key (left) determines roll direction
    r = frame(s, { left: true, right: true }, 1000 + CHORD_WINDOW_MS - 10, 16);
    expect(r.actions).toContain("barrel_roll_left");
  });

  it("does NOT fire when chord window is exceeded", () => {
    let s = INITIAL_GESTURE_STATE;
    let r = frame(s, { left: true }, 1000, 16);
    s = r.state;
    r = frame(s, { left: true, right: true }, 1000 + CHORD_WINDOW_MS + 50, 16);
    expect(r.actions).not.toContain("barrel_roll_right");
  });

  it("does not fire when allowChordBarrelRoll is false", () => {
    let s = INITIAL_GESTURE_STATE;
    let r = updateGestures({
      ...base({ leftDown: true, nowMs: 1000 }),
      state: s,
    });
    s = r.state;
    r = updateGestures({
      ...base({
        leftDown: true,
        rightDown: true,
        nowMs: 1000 + CHORD_WINDOW_MS - 10,
      }),
      state: s,
      allowChordBarrelRoll: false,
    });
    expect(r.actions).not.toContain("barrel_roll_right");
  });
});
