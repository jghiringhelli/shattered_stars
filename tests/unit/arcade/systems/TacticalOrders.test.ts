/**
 * TacticalOrders — specification tests for the continuous-tactical dial:
 * a player's standing maneuver order latches into the cycle engine's queue,
 * a stressed pilot's red order is calmed, the preview flies the engine's own
 * geometry.
 */

import { describe, it, expect } from "vitest";
import {
  calmOrderIfStressed,
  initialOrder,
  latchManeuverOrder,
  nearestDialManeuver,
  planOrderPreview,
} from "../../../../src/arcade/systems/TacticalOrders";
import { createShipControl } from "../../../../src/arcade/systems/CycleFlight";
import { CYCLE_DURATION_MS } from "../../../../src/config";
import {
  advanceCycle,
  updateManeuver,
  type ShipControlState,
} from "../../../../src/core/ArcadeControls";
import type { ManeuverDefinition } from "../../../../src/core/types";
import { resolveManeuver } from "../../../../src/systems/MovementSystem";

const SHIP_ID = "terran_viper";
const POSE = { x: 1000, y: 1000, angle: 30 };

const DIAL: readonly ManeuverDefinition[] = [
  { direction: "straight", speed: 1, difficulty: "green" },
  { direction: "straight", speed: 3, difficulty: "white" },
  { direction: "bank_right", speed: 2, difficulty: "white" },
  { direction: "bank_right", speed: 3, difficulty: "red" },
  { direction: "turn_left", speed: 3, difficulty: "red" },
];

const order = (
  direction: ManeuverDefinition["direction"],
  speed: number,
): ManeuverDefinition =>
  DIAL.find((m) => m.direction === direction && m.speed === speed)!;

describe("nearestDialManeuver", () => {
  it("returns the exact dial entry when the speed exists", () => {
    expect(nearestDialManeuver(DIAL, "bank_right", 3)).toEqual(
      order("bank_right", 3),
    );
  });

  it("falls back to the closest speed in that direction", () => {
    expect(nearestDialManeuver(DIAL, "straight", 2)?.speed).toBe(1);
    expect(nearestDialManeuver(DIAL, "bank_right", 5)?.speed).toBe(3);
  });

  it("skips entries the filter rejects", () => {
    const calm = nearestDialManeuver(
      DIAL,
      "bank_right",
      3,
      (m) => m.difficulty !== "red",
    );
    expect(calm).toEqual(order("bank_right", 2));
  });

  it("returns undefined when the dial lacks the direction", () => {
    expect(nearestDialManeuver(DIAL, "kturn", 3)).toBeUndefined();
  });
});

describe("initialOrder", () => {
  it("is the dial's straight nearest the cruise speed", () => {
    expect(initialOrder(DIAL, 3)).toEqual(order("straight", 3));
  });

  it("synthesises a straight at cruise speed when the dial has none", () => {
    expect(initialOrder([], 2)).toEqual({
      direction: "straight",
      speed: 2,
      difficulty: "white",
    });
  });
});

describe("latchManeuverOrder", () => {
  const control = createShipControl(SHIP_ID, POSE);

  it("queues the ordered maneuver and speed for the next cycle", () => {
    const latched = latchManeuverOrder(control, order("bank_right", 2));
    expect(latched.nextManeuver).toBe("bank_right");
    expect(latched.speed).toBe(2);
  });

  it("does not touch the maneuver in flight", () => {
    const latched = latchManeuverOrder(control, order("bank_right", 2));
    expect(latched.currentManeuver).toBe(control.currentManeuver);
    expect(latched.maneuverPath).toBe(control.maneuverPath);
  });

  it("queues straight as the engine default (null)", () => {
    const banking = latchManeuverOrder(control, order("bank_right", 2));
    expect(latchManeuverOrder(banking, order("straight", 3)).nextManeuver).toBe(
      null,
    );
  });

  it("returns the same control when the order is already latched", () => {
    const latched = latchManeuverOrder(control, order("bank_right", 2));
    expect(latchManeuverOrder(latched, order("bank_right", 2))).toBe(latched);
  });

  it("clamps the ordered speed to the ship's speed bounds", () => {
    const fast = { direction: "straight", speed: 99, difficulty: "white" };
    const latched = latchManeuverOrder(control, fast as ManeuverDefinition);
    expect(latched.speed).toBe(control.maxSpeed);
  });

  it("flies the order at the next cycle boundary", () => {
    const latched = latchManeuverOrder(control, order("bank_right", 2));
    const end = updateManeuver(latched, CYCLE_DURATION_MS);
    const target = end.position!;
    const next = advanceCycle(target, end.control);
    expect(next.currentManeuver).toBe("bank_right");
    expect(next.nextManeuver).toBeNull();
  });
});

describe("calmOrderIfStressed", () => {
  it("keeps any order while the pilot is calm", () => {
    expect(calmOrderIfStressed(order("bank_right", 3), DIAL, false)).toEqual(
      order("bank_right", 3),
    );
  });

  it("keeps a non-red order while stressed", () => {
    expect(calmOrderIfStressed(order("bank_right", 2), DIAL, true)).toEqual(
      order("bank_right", 2),
    );
  });

  it("slows a red order to the same direction's nearest non-red speed", () => {
    expect(calmOrderIfStressed(order("bank_right", 3), DIAL, true)).toEqual(
      order("bank_right", 2),
    );
  });

  it("falls back to the nearest non-red straight", () => {
    expect(calmOrderIfStressed(order("turn_left", 3), DIAL, true)).toEqual(
      order("straight", 3),
    );
  });
});

describe("planOrderPreview", () => {
  const control = createShipControl(SHIP_ID, POSE);
  const ordered = order("bank_right", 2);

  it("starts at the ship's pose", () => {
    const preview = planOrderPreview(POSE, control, ordered);
    expect(preview.remaining[0]).toEqual(POSE);
  });

  it("finishes the cycle in flight at its maneuver target", () => {
    const preview = planOrderPreview(POSE, control, ordered);
    const last = preview.remaining.at(-1)!;
    expect(last.x).toBeCloseTo(control.maneuverTarget!.x, 6);
    expect(last.y).toBeCloseTo(control.maneuverTarget!.y, 6);
  });

  it("flies the order from the end of the current cycle with the engine's geometry", () => {
    const preview = planOrderPreview(POSE, control, ordered);
    const start = control.maneuverTarget!;
    const expected = resolveManeuver(
      start.x,
      start.y,
      start.angle,
      ordered,
      control.baseSize,
    );
    const end = preview.queued.at(-1)!;
    expect(preview.queued[0]!.x).toBeCloseTo(start.x, 6);
    expect(end.x).toBeCloseTo(expected.targetX, 6);
    expect(end.y).toBeCloseTo(expected.targetY, 6);
    expect(end.angle).toBeCloseTo(expected.targetAngle, 6);
  });

  it("follows a ship that wrapped across the world edge mid-cycle", () => {
    const midCycle: ShipControlState = updateManeuver(
      control,
      CYCLE_DURATION_MS / 2,
    ).control;
    const wrappedPose = { x: POSE.x + 4000, y: POSE.y, angle: POSE.angle };
    const unwrapped = planOrderPreview(POSE, midCycle, ordered);
    const wrapped = planOrderPreview(wrappedPose, midCycle, ordered);
    expect(wrapped.queued.at(-1)!.x - unwrapped.queued.at(-1)!.x).toBeCloseTo(
      4000,
      6,
    );
  });
});
