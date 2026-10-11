/**
 * Steering intent — specification tests.
 *
 * Regression origin: holding a steering key re-queued the same 90°/cycle
 * `turn_left` every cycle. Four cycles = 360°, so the ship traced a closed
 * circle and never left its spawn area ("flota en el lugar"). The same held
 * input also classified as a red dial maneuver every cycle, so pilot stress
 * rose forever and never drained.
 *
 * The specification below is what sustained steering must do instead.
 */

import { describe, it, expect } from "vitest";
import {
  resolveSteeringManeuver,
  SUSTAINED_TURN_DEGREES_PER_CYCLE,
  BANK_HOLD_MS,
  IDLE_STEERING,
  updateHeldSteering,
  onSteeringCycleCommitted,
  steeringQueue,
} from "../../../src/arcade/SteeringIntent";
import {
  createControlState,
  updateManeuver,
  advanceCycle,
  getManeuverDifficulty,
} from "../../../src/core/ArcadeControls";
import { MANEUVER_TEMPLATES } from "../../../src/systems/MovementSystem";
import { CYCLE_DURATION_MS } from "../../../src/config";
import type { ShipState } from "../../../src/core/types";

function makeShip(x = 3000, y = 3000, angle = 0): ShipState {
  return {
    id: "probe",
    definitionId: "terran_viper",
    faction: "terran_hegemony",
    owner: "player",
    x,
    y,
    angle,
    hull: 5,
    maxHull: 5,
    shields: 2,
    maxShields: 2,
    isStressed: false,
    hasFocus: false,
    hasEvade: false,
    hasTargetLock: null,
    isCloaked: false,
  } as ShipState;
}

/**
 * Flies `cycles` cycles with the same steering maneuver queued every frame,
 * exactly as a held key does in the battle scene.
 *
 * @returns net displacement from origin and the total arc length travelled.
 */
function flyHeld(
  maneuver: Parameters<typeof advanceCycle>[1]["nextManeuver"],
  cycles: number,
): { netDistance: number; pathLength: number } {
  const ship = makeShip();
  let control = createControlState(ship, 18, "fighter", { min: 1, max: 5 });
  const startX = ship.x;
  const startY = ship.y;
  let pathLength = 0;

  for (let c = 0; c < cycles; c++) {
    let prevX = ship.x;
    let prevY = ship.y;
    for (let step = 0; step < 10; step++) {
      // A held key re-queues the same maneuver on every frame.
      control = { ...control, nextManeuver: maneuver };
      const result = updateManeuver(control, CYCLE_DURATION_MS / 10);
      control = result.control;
      ship.x = result.position.x;
      ship.y = result.position.y;
      ship.angle = result.position.angle;
      pathLength += Math.hypot(ship.x - prevX, ship.y - prevY);
      prevX = ship.x;
      prevY = ship.y;
      if (result.cycleComplete) control = advanceCycle(ship, control);
    }
  }

  return {
    netDistance: Math.hypot(ship.x - startX, ship.y - startY),
    pathLength,
  };
}

describe("resolveSteeringManeuver", () => {
  it("queues no maneuver change when no direction is held", () => {
    expect(resolveSteeringManeuver("none", false)).toBeNull();
  });

  it("maps a plain held direction to a sustained shallow turn, not a dial turn", () => {
    expect(resolveSteeringManeuver("left", false)).toBe("drift_left");
    expect(resolveSteeringManeuver("right", false)).toBe("drift_right");
  });

  it("maps the hard-turn gesture to the full 90-degree dial turn", () => {
    expect(resolveSteeringManeuver("left", true)).toBe("turn_left");
    expect(resolveSteeringManeuver("right", true)).toBe("turn_right");
  });
});

describe("sustained steering geometry", () => {
  it("turns shallow enough that a full circle takes more than 8 cycles", () => {
    expect(SUSTAINED_TURN_DEGREES_PER_CYCLE).toBeGreaterThan(0);
    expect(360 / SUSTAINED_TURN_DEGREES_PER_CYCLE).toBeGreaterThan(8);
  });

  it("advances the ship across the map instead of orbiting in place", () => {
    // Four cycles of held steering must carry the ship well clear of its
    // spawn — the bug produced a net 105.6px after travelling 552px.
    const { netDistance, pathLength } = flyHeld("drift_left", 4);
    expect(pathLength).toBeGreaterThan(400);
    expect(netDistance).toBeGreaterThan(pathLength * 0.85);
  });

  it("still makes forward progress over a long sustained hold", () => {
    // 8 cycles is 240° of arc, so the chord is shorter than the path — but the
    // ship must stay far outside the ~105px orbit the dial turn produced.
    const { netDistance } = flyHeld("drift_left", 8);
    expect(netDistance).toBeGreaterThan(450);
  });

  it("advances far further than the dial turn it replaced", () => {
    const drift = flyHeld("drift_left", 4);
    const dialTurn = flyHeld("turn_left", 4);
    // turn_left closes a full 360° circle in 4 cycles, so it returns to spawn
    // having thrown away three quarters of the distance it travelled.
    expect(dialTurn.netDistance).toBeLessThan(dialTurn.pathLength * 0.3);
    expect(drift.netDistance).toBeGreaterThan(dialTurn.netDistance * 3);
  });

  it("does not let a held bank close a circle either", () => {
    // bank_left is 45°/cycle, so holding it closes a circle in 8 cycles —
    // which is why a held key must not queue a dial maneuver at all.
    const bank = flyHeld("bank_left", 8);
    const drift = flyHeld("drift_left", 8);
    expect(drift.netDistance).toBeGreaterThan(bank.netDistance * 3);
  });
});

describe("sustained steering stress", () => {
  it("does not classify a sustained shallow turn as a red maneuver", () => {
    for (let speed = 1; speed <= 5; speed++) {
      expect(getManeuverDifficulty("drift_left", speed)).not.toBe("red");
      expect(getManeuverDifficulty("drift_right", speed)).not.toBe("red");
    }
  });

  it("lets stress drain while holding a shallow turn at cruise speed", () => {
    expect(getManeuverDifficulty("drift_left", 2)).toBe("green");
  });
});

describe("drift maneuver templates", () => {
  it("are registered with the configured per-cycle angle", () => {
    expect(MANEUVER_TEMPLATES.drift_left.deltaAngle).toBe(
      -SUSTAINED_TURN_DEGREES_PER_CYCLE,
    );
    expect(MANEUVER_TEMPLATES.drift_right.deltaAngle).toBe(
      SUSTAINED_TURN_DEGREES_PER_CYCLE,
    );
  });

  it("use unit-length displacement vectors like every other template", () => {
    for (const key of ["drift_left", "drift_right"] as const) {
      const t = MANEUVER_TEMPLATES[key];
      expect(Math.hypot(t.deltaX, t.deltaY)).toBeCloseTo(1, 3);
    }
  });

  it("point mostly forward so held steering still advances", () => {
    expect(MANEUVER_TEMPLATES.drift_left.deltaY).toBeLessThan(-0.9);
    expect(MANEUVER_TEMPLATES.drift_right.deltaY).toBeLessThan(-0.9);
  });
});

describe("player steering — tap drifts, hold banks once, then drifts", () => {
  const hold = (side: "left" | "right", ms: number, from = IDLE_STEERING) =>
    updateHeldSteering(updateHeldSteering(from, side, 0), side, ms);

  it("queues nothing with no input and no pending tap", () => {
    expect(steeringQueue(IDLE_STEERING, false)).toBeNull();
  });

  it("queues a drift while a press is still shorter than the bank threshold", () => {
    expect(steeringQueue(hold("left", BANK_HOLD_MS - 1), false)).toBe(
      "drift_left",
    );
  });

  it("queues a 45-degree bank once the key has been held long enough", () => {
    expect(steeringQueue(hold("right", BANK_HOLD_MS), false)).toBe(
      "bank_right",
    );
  });

  it("drifts after the hold has already flown its bank, so it never orbits", () => {
    const banked = onSteeringCycleCommitted(hold("left", 600), "bank_left");
    expect(steeringQueue(updateHeldSteering(banked, "left", 500), false)).toBe(
      "drift_left",
    );
  });

  it("still owes one drift for a tap released before the cycle committed", () => {
    const tapped = updateHeldSteering(hold("left", 60), "none", 16);
    expect(steeringQueue(tapped, false)).toBe("drift_left");
  });

  it("forgets the tap once a cycle has committed it", () => {
    const tapped = updateHeldSteering(hold("left", 60), "none", 16);
    expect(
      steeringQueue(onSteeringCycleCommitted(tapped, "drift_left"), false),
    ).toBeNull();
  });

  it("does not treat the release of a long hold as a tap", () => {
    const held = onSteeringCycleCommitted(hold("left", 600), "bank_left");
    expect(
      steeringQueue(updateHeldSteering(held, "none", 16), false),
    ).toBeNull();
  });

  it("lets the hard-turn gesture override into a 90-degree turn", () => {
    expect(steeringQueue(hold("left", 600), true)).toBe("turn_left");
  });

  it("starts a fresh bank when the player switches sides", () => {
    const banked = onSteeringCycleCommitted(hold("left", 600), "bank_left");
    expect(steeringQueue(hold("right", BANK_HOLD_MS, banked), false)).toBe(
      "bank_right",
    );
  });
});
