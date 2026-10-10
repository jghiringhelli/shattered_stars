/**
 * Gate: X-Wing 2.0 geometric fidelity of per-cycle movement.
 *
 * Verifies the MUST obligations in docs/specs/telemetry-xwing-reference.md against
 * the game's own resolveManeuver. The remaining SHOULD deviation (MOV-6) is locked
 * to its current value and tracked by ADR-0001 so an accidental change trips this gate.
 */

import { describe, it, expect } from "vitest";
import {
  SPEED_SCALE_FACTOR,
  SHIP_SIZES,
  CYCLE_DURATION_MS,
} from "../../../src/config";
import { MANEUVER_TEMPLATES } from "../../../src/systems/MovementSystem";
import {
  measureManeuver,
  expectedStraightPx,
  normalizeDelta,
  XWING_FACING_CHANGE,
  XWING_BASE_MM,
  TRUE_ARC_CHORD,
  DIAL_DIRECTIONS,
  NON_DIAL_DIRECTIONS,
} from "../../../src/simulation/XWingReference";
import type { ManeuverDirection } from "../../../src/core/types";

const SIZES = ["tiny", "small", "medium", "large", "huge"] as const;
const SPEEDS = [1, 2, 3, 4, 5] as const;
/**
 * The X-Wing gates apply to dial maneuvers. Arcade-only templates (drift_*)
 * have no X-Wing counterpart; the test below pins that they are the *only*
 * exclusions, so a future template cannot silently escape these gates.
 */
const DIRECTIONS = DIAL_DIRECTIONS;

describe("X-Wing telemetry reference — MUST gates", () => {
  it("MOV-0: every movement template is either gated as a dial maneuver or explicitly excluded", () => {
    const templates = Object.keys(MANEUVER_TEMPLATES).sort();
    const accounted = [...DIAL_DIRECTIONS, ...NON_DIAL_DIRECTIONS].sort();
    expect(accounted).toEqual(templates);
    // The exclusion list is arcade-feel templates only — nothing from the dial.
    expect(NON_DIAL_DIRECTIONS).toEqual(["drift_left", "drift_right"]);
  });

  it("MOV-1: straight displacement equals speed*40 + baseSize for all speeds/sizes", () => {
    for (const size of SIZES) {
      for (const speed of SPEEDS) {
        const m = measureManeuver("straight", speed, size);
        expect(m.displacementPx).toBeCloseTo(
          expectedStraightPx(speed, size),
          6,
        );
        expect(m.displacementPx).toBeCloseTo(
          speed * SPEED_SCALE_FACTOR + SHIP_SIZES[size],
          6,
        );
      }
    }
  });

  it("MOV-2: facing change matches X-Wing 2.0 for every direction", () => {
    for (const direction of DIRECTIONS) {
      const m = measureManeuver(direction, 2, "small");
      expect(m.facingChangeDeg).toBe(
        normalizeDelta(XWING_FACING_CHANGE[direction]),
      );
    }
  });

  it("MOV-3: 90-degree turn chord is a true circular quarter-arc (0.7071)", () => {
    const left = measureManeuver("turn_left", 3, "small");
    const right = measureManeuver("turn_right", 3, "small");
    expect(Math.abs(left.chordUnit.x)).toBeCloseTo(TRUE_ARC_CHORD.turn.x, 3);
    expect(left.chordUnit.y).toBeCloseTo(TRUE_ARC_CHORD.turn.y, 3);
    expect(Math.abs(right.chordUnit.x)).toBeCloseTo(TRUE_ARC_CHORD.turn.x, 3);
    expect(right.chordUnit.y).toBeCloseTo(TRUE_ARC_CHORD.turn.y, 3);
    expect(left.chordUnit.x).toBeLessThan(0);
    expect(right.chordUnit.x).toBeGreaterThan(0);
  });

  it("MOV-5: 45-degree bank chord is a true circular eighth-arc (22.5 degrees)", () => {
    for (const direction of ["bank_left", "bank_right"] as const) {
      const bank = measureManeuver(direction, 1, "small");
      expect(Math.abs(bank.chordUnit.x)).toBeCloseTo(TRUE_ARC_CHORD.bank.x, 3);
      expect(bank.chordUnit.y).toBeCloseTo(TRUE_ARC_CHORD.bank.y, 3);
    }
  });

  it("MOV-4: displacement is deterministic per (speed,dir,size) and cycle is 500ms", () => {
    expect(CYCLE_DURATION_MS).toBe(500);
    for (const direction of DIRECTIONS) {
      const a = measureManeuver(direction, 3, "medium");
      const b = measureManeuver(direction, 3, "medium");
      expect(a.displacementPx).toBe(b.displacementPx);
      expect(Number.isFinite(a.displacementPx)).toBe(true);
    }
  });
});

describe("X-Wing telemetry reference — SHOULD deviations (tracked by ADR-0001)", () => {
  it("MOV-6: ship bases use S=0.8 px/mm while templates use S=1.0 px/mm", () => {
    expect(SHIP_SIZES.small / XWING_BASE_MM.small).toBeCloseTo(0.8, 6);
    expect(SHIP_SIZES.medium / XWING_BASE_MM.medium).toBeCloseTo(0.8, 6);
    expect(SHIP_SIZES.large / XWING_BASE_MM.large).toBeCloseTo(0.8, 6);
    // Straight templates use S=1.0 (speed*40 mm → speed*40 px).
    expect(SPEED_SCALE_FACTOR).toBe(40);
  });
});
