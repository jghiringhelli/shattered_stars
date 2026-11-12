/**
 * Dash distances — boost slides 300 px; a barrel roll slides one speed-2
 * template plus the ship's base. Both stay instantaneous in the simulation
 * and leave the heading alone.
 */

import { describe, it, expect } from "vitest";
import { BOOST_DISTANCE_PX } from "../../../../src/arcade/ArcadeInputGestures";
import {
  barrelRollDistance,
  type MotionState,
} from "../../../../src/arcade/systems/ShipMotion";
import { performAction } from "../../../../src/arcade/systems/ShipActions";
import { createControlState } from "../../../../src/core/ArcadeControls";
import {
  BARREL_ROLL_SLIDE_SPEED,
  predictBarrelRoll,
  templateLength,
} from "../../../../src/simulation/flight/XWingFlightOracle";
import { BATTLEFIELD_SIZE, SHIP_SIZES } from "../../../../src/config";

const POSE = { x: 3000, y: 3000, angle: 90 };

const resting = (baseSize: number): MotionState => ({
  ...POSE,
  control: createControlState(POSE, baseSize),
});

describe("dash distances", () => {
  it("boost is 300 px", () => {
    expect(BOOST_DISTANCE_PX).toBe(300);
    const done = performAction(
      resting(SHIP_SIZES.small),
      POSE,
      "boost",
      BATTLEFIELD_SIZE,
    );
    expect(done.performed).toBe(true);
    expect(done.state.x - POSE.x).toBeCloseTo(300, 6);
    expect(done.state.angle).toBe(POSE.angle);
  });

  it("a barrel roll slides a speed-2 template plus the base: 112 px on a small ship", () => {
    expect(BARREL_ROLL_SLIDE_SPEED).toBe(2);
    expect(barrelRollDistance(SHIP_SIZES.small)).toBe(112);
    for (const size of Object.values(SHIP_SIZES))
      expect(barrelRollDistance(size)).toBe(templateLength(2, size));
  });

  it("a barrel roll lands where the oracle puts it, heading unchanged", () => {
    const base = SHIP_SIZES.small;
    for (const side of ["left", "right"] as const) {
      const done = performAction(
        resting(base),
        POSE,
        `barrel_roll_${side}`,
        BATTLEFIELD_SIZE,
      );
      const want = predictBarrelRoll(POSE, side, base);
      expect(done.performed).toBe(true);
      expect(done.state.x).toBeCloseTo(want.x, 6);
      expect(done.state.y).toBeCloseTo(want.y, 6);
      expect(done.state.angle).toBe(POSE.angle);
    }
  });
});
