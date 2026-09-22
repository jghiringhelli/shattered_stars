/**
 * Gate: X-Wing 2.0 geometric fidelity of per-cycle movement.
 *
 * Verifies the MUST obligations in docs/specs/telemetry-xwing-reference.md against
 * the game's own resolveManeuver. SHOULD deviations (MOV-5, MOV-6) are locked to
 * their current values and tracked by ADR-0001 so an accidental change trips this gate.
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
  it("MOV-5: bank chord currently uses a 30-degree chord, not the true 22.5-degree arc", () => {
    const bank = measureManeuver("bank_right", 1, "small");
    // Current template: (0.5, -0.866) → 30° chord. Locked so a silent change trips the gate.
    const chordAngleDeg = normalizeDelta(
      (Math.atan2(bank.chordUnit.x, -bank.chordUnit.y) * 180) / Math.PI,
    );
    expect(chordAngleDeg).toBeCloseTo(30, 1);
    // ...and it deviates from the true 45°-arc chord (22.5°).
    const trueAngle =
      (Math.atan2(TRUE_ARC_CHORD.bank.x, -TRUE_ARC_CHORD.bank.y) * 180) /
      Math.PI;
    expect(trueAngle).toBeCloseTo(22.5, 1);
    expect(Math.abs(chordAngleDeg - trueAngle)).toBeGreaterThan(5);
  });

  it("MOV-6: ship bases use S=0.8 px/mm while templates use S=1.0 px/mm", () => {
    expect(SHIP_SIZES.small / XWING_BASE_MM.small).toBeCloseTo(0.8, 6);
    expect(SHIP_SIZES.medium / XWING_BASE_MM.medium).toBeCloseTo(0.8, 6);
    expect(SHIP_SIZES.large / XWING_BASE_MM.large).toBeCloseTo(0.8, 6);
    // Straight templates use S=1.0 (speed*40 mm → speed*40 px).
    expect(SPEED_SCALE_FACTOR).toBe(40);
  });
});
