/**
 * RollDoubleTap — the barrel-roll gesture: two quick taps of the SAME arrow.
 */

import { describe, it, expect } from "vitest";
import {
  INITIAL_ROLL_TAP,
  ROLL_DOUBLE_TAP_WINDOW_MS,
  ROLL_TAP_GAP_MIN_MS,
  ROLL_TAP_MAX_MS,
  ROLL_TAP_MIN_MS,
  updateRollTap,
  type RollSide,
  type RollTapState,
} from "../../../src/arcade/RollDoubleTap";

type Step = readonly [atMs: number, left: boolean, right: boolean];

/** Plays arrow states at given times; returns the sides rolled and when. */
function play(steps: readonly Step[], enabled = true): RollSide[] {
  let state: RollTapState = INITIAL_ROLL_TAP;
  const rolls: RollSide[] = [];
  for (const [atMs, left, right] of steps) {
    const result = updateRollTap(state, { left, right, nowMs: atMs, enabled });
    state = result.state;
    if (result.roll) rolls.push(result.roll);
  }
  return rolls;
}

/** A tap: down at `at`, up `holdMs` later. */
const tap = (side: RollSide, at: number, holdMs = 60): Step[] => [
  [at, side === "left", side === "right"],
  [at + holdMs, false, false],
];

describe("RollDoubleTap", () => {
  it("double-tap ← rolls left", () => {
    expect(play([...tap("left", 0), ...tap("left", 120)])).toEqual(["left"]);
  });

  it("double-tap → rolls right", () => {
    expect(play([...tap("right", 0), ...tap("right", 120)])).toEqual(["right"]);
  });

  it("rolls on the second keydown, not on its release", () => {
    const steps = [...tap("left", 0), [120, true, false] as Step];
    expect(play(steps)).toEqual(["left"]);
  });

  it("a single tap never rolls", () => {
    expect(play(tap("left", 0))).toEqual([]);
  });

  it("alternating ← → ← → quickly stays steering", () => {
    const steps = [
      ...tap("left", 0),
      ...tap("right", 90),
      ...tap("left", 180),
      ...tap("right", 270),
    ];
    expect(play(steps)).toEqual([]);
  });

  it("← → ← inside one window is not a double-tap of ←", () => {
    const steps = [...tap("left", 0), ...tap("right", 70), ...tap("left", 140)];
    expect(play(steps)).toEqual([]);
  });

  it("a second tap after the window is a fresh first tap", () => {
    const late = ROLL_DOUBLE_TAP_WINDOW_MS + 30;
    expect(play([...tap("left", 0), ...tap("left", late)])).toEqual([]);
  });

  it("a held first press is a bank, not a tap", () => {
    const hold = ROLL_TAP_MAX_MS + 40;
    expect(play([...tap("left", 0, hold), ...tap("left", hold + 60)])).toEqual(
      [],
    );
  });

  it("input flicker (a bounce faster than a deliberate tap) never rolls", () => {
    const flick = ROLL_TAP_MIN_MS - 10;
    expect(play([...tap("left", 0, flick), ...tap("left", flick + 10)])).toEqual(
      [],
    );
    const gap = ROLL_TAP_GAP_MIN_MS - 10;
    expect(play([...tap("left", 0, 60), ...tap("left", 60 + gap)])).toEqual([]);
  });

  it("a third quick tap does not roll again", () => {
    const steps = [
      ...tap("left", 0),
      ...tap("left", 110),
      ...tap("left", 220),
    ];
    expect(play(steps)).toEqual(["left"]);
  });

  it("both arrows down together (a chord) is not a double-tap", () => {
    const steps: Step[] = [
      [0, true, true],
      [60, false, false],
      [120, true, true],
    ];
    expect(play(steps)).toEqual([]);
  });

  it("is off while another gesture owns the arrows", () => {
    const steps = [...tap("left", 0), ...tap("left", 120)];
    expect(play(steps, false)).toEqual([]);
  });
});