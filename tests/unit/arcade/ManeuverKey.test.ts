/**
 * ManeuverKey — the one key for Snap Turn (tap), Hook Loop (hold + side) and
 * Knife Roll (double-tap, hold + side).
 */

import { describe, it, expect } from "vitest";
import {
  INITIAL_MANEUVER_KEY,
  MANEUVER_DOUBLE_TAP_WINDOW_MS,
  MANEUVER_SIDE_GRACE_MS,
  MANEUVER_TAP_MAX_MS,
  updateManeuverKey,
  type ManeuverKeyState,
} from "../../../src/arcade/ManeuverKey";
import type { SpecialManeuver } from "../../../src/arcade/systems/FlightCapabilities";

interface Step {
  readonly atMs: number;
  readonly held?: boolean;
  readonly left?: boolean;
  readonly right?: boolean;
}

/** Plays states at times (omitted fields stay as they were); lists every special requested. */
function play(steps: readonly Step[]): Array<[number, SpecialManeuver]> {
  let state: ManeuverKeyState = INITIAL_MANEUVER_KEY;
  let held = false;
  let left = false;
  let right = false;
  const requested: Array<[number, SpecialManeuver]> = [];
  for (const step of steps) {
    held = step.held ?? held;
    left = step.left ?? left;
    right = step.right ?? right;
    const result = updateManeuverKey(state, {
      held,
      left,
      right,
      nowMs: step.atMs,
    });
    state = result.state;
    if (result.special) requested.push([step.atMs, result.special]);
  }
  return requested;
}

const specials = (steps: readonly Step[]): SpecialManeuver[] =>
  play(steps).map(([, special]) => special);

/** Time after a press at 0 when its double-tap window has closed. */
const WINDOW_CLOSED = MANEUVER_DOUBLE_TAP_WINDOW_MS + 16;

describe("ManeuverKey — tap = Snap Turn", () => {
  it("a short press requests the Snap Turn when its double-tap window closes", () => {
    expect(
      play([
        { atMs: 0, held: true },
        { atMs: 80, held: false },
        { atMs: WINDOW_CLOSED - 20 },
        { atMs: WINDOW_CLOSED },
      ]),
    ).toEqual([[WINDOW_CLOSED, "kturn"]]);
  });

  it("not before the window closes (a second press could still make it a Knife)", () => {
    expect(
      specials([
        { atMs: 0, held: true },
        { atMs: 16, held: false },
        { atMs: 100 },
        { atMs: MANEUVER_DOUBLE_TAP_WINDOW_MS },
      ]),
    ).toEqual([]);
  });

  it("a one-frame tap (down and up between polls) still Snap Turns", () => {
    expect(
      specials([
        { atMs: 0, held: true },
        { atMs: 16, held: false },
        { atMs: WINDOW_CLOSED },
      ]),
    ).toEqual(["kturn"]);
  });

  it("a long hold with no side requests nothing (changed mind)", () => {
    expect(
      specials([
        { atMs: 0, held: true },
        { atMs: MANEUVER_TAP_MAX_MS + 100, held: false },
        { atMs: MANEUVER_TAP_MAX_MS + 600 },
      ]),
    ).toEqual([]);
  });

  it("tapping the key while steering (side held earlier) is a Snap Turn, not a Hook", () => {
    expect(
      specials([
        { atMs: 0, left: true },
        { atMs: 500, held: true },
        { atMs: 560, held: false },
        { atMs: 500 + WINDOW_CLOSED },
      ]),
    ).toEqual(["kturn"]);
  });

  it("requests the Snap Turn once, not again on later frames", () => {
    expect(
      specials([
        { atMs: 0, held: true },
        { atMs: 40, held: false },
        { atMs: WINDOW_CLOSED },
        { atMs: WINDOW_CLOSED + 100 },
        { atMs: WINDOW_CLOSED + 600 },
      ]),
    ).toEqual(["kturn"]);
  });

  it("a press landing on the very frame the window closes still gets the first tap's Snap Turn", () => {
    expect(
      specials([
        { atMs: 0, held: true },
        { atMs: 40, held: false },
        { atMs: WINDOW_CLOSED + 20, held: true },
      ]),
    ).toEqual(["kturn"]);
  });
});

describe("ManeuverKey — hold + side = Hook Loop", () => {
  for (const side of ["left", "right"] as const) {
    it(`hold the key then press ${side} requests a Hook ${side}`, () => {
      expect(
        specials([
          { atMs: 0, held: true },
          { atMs: 100, [side]: true },
        ]),
      ).toEqual([`segnor_${side}`]);
    });
  }

  it("fires once per hold, and releasing it afterwards does not also Snap Turn", () => {
    expect(
      specials([
        { atMs: 0, held: true },
        { atMs: 100, left: true },
        { atMs: 150, left: false },
        { atMs: 200, right: true },
        { atMs: 250, held: false },
        { atMs: 250 + WINDOW_CLOSED },
      ]),
    ).toEqual(["segnor_left"]);
  });

  it("a side pressed a hair before the key still counts as the chord", () => {
    expect(
      specials([
        { atMs: 0, right: true },
        { atMs: MANEUVER_SIDE_GRACE_MS - 10, held: true },
      ]),
    ).toEqual(["segnor_right"]);
  });

  it("both sides together request nothing", () => {
    expect(
      specials([
        { atMs: 0, held: true },
        { atMs: 100, left: true, right: true },
      ]),
    ).toEqual([]);
  });
});

describe("ManeuverKey — double-tap then hold + side = Knife Roll", () => {
  for (const side of ["left", "right"] as const) {
    it(`tap, press again and add ${side} requests a Knife ${side} and no Snap Turn`, () => {
      expect(
        play([
          { atMs: 0, held: true },
          { atMs: 60, held: false },
          { atMs: 120, held: true },
          { atMs: 180, [side]: true },
          { atMs: 400, held: false, left: false, right: false },
          { atMs: 400 + WINDOW_CLOSED },
        ]),
      ).toEqual([[180, `tallon_${side}`]]);
    });
  }

  it("a side already held at the second press is a Knife immediately", () => {
    expect(
      specials([
        { atMs: 0, held: true },
        { atMs: 60, held: false },
        { atMs: 100, left: true },
        { atMs: 140, held: true },
      ]),
    ).toEqual(["tallon_left"]);
  });

  it("a second press after the window is a plain Hook (the first tap Snap Turned)", () => {
    expect(
      specials([
        { atMs: 0, held: true },
        { atMs: 60, held: false },
        { atMs: WINDOW_CLOSED },
        { atMs: WINDOW_CLOSED + 100, held: true },
        { atMs: WINDOW_CLOSED + 160, left: true },
      ]),
    ).toEqual(["kturn", "segnor_left"]);
  });

  it("a double-tap with no side Snap Turns once, on the second release", () => {
    expect(
      play([
        { atMs: 0, held: true },
        { atMs: 60, held: false },
        { atMs: 120, held: true },
        { atMs: 180, held: false },
        { atMs: 180 + WINDOW_CLOSED },
        { atMs: 180 + 2 * WINDOW_CLOSED },
      ]),
    ).toEqual([[180, "kturn"]]);
  });

  it("a long second press with no side requests nothing", () => {
    expect(
      specials([
        { atMs: 0, held: true },
        { atMs: 60, held: false },
        { atMs: 120, held: true },
        { atMs: 120 + MANEUVER_TAP_MAX_MS + 100, held: false },
        { atMs: 2000 },
      ]),
    ).toEqual([]);
  });

  it("after a Knife the key starts clean: the next hold is a Hook", () => {
    expect(
      specials([
        { atMs: 0, held: true },
        { atMs: 60, held: false },
        { atMs: 120, held: true },
        { atMs: 180, left: true },
        { atMs: 300, held: false, left: false },
        { atMs: 400, held: true },
        { atMs: 450, right: true },
      ]),
    ).toEqual(["tallon_left", "segnor_right"]);
  });
});