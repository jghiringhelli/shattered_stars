/**
 * CycleFlight — specification tests for the cycle engine as battle scenes
 * use it: spawn control from the definition, fly frames, accrue stress, and
 * steer AI ships from a heading error.
 */

import { describe, it, expect } from "vitest";
import {
  createCycleFlight,
  createShipControl,
  tickCycleFlight,
  type CycleFlightState,
  type FlightTickInput,
} from "../../../../src/arcade/systems/CycleFlight";
import {
  SHIP_DEFINITIONS,
  getShipDial,
} from "../../../../src/data/ShipDefinitions";
import {
  BATTLEFIELD_SIZE,
  CYCLE_DURATION_MS,
  SHIP_SIZES,
} from "../../../../src/config";
import {
  headingDelta,
  predictFlight,
  type FlightStep,
  type Pose,
} from "../../../../src/simulation/flight/XWingFlightOracle";
import type { CompletedCycle } from "../../../../src/arcade/systems/ShipMotion";
import type { ManeuverDirection } from "../../../../src/core/types";

const SHIP_ID = "terran_viper";
const START: Pose = { x: 3000, y: 3000, angle: 37 };
const TICK_MS = 1000 / 60;

function tickInput(overrides: Partial<FlightTickInput> = {}): FlightTickInput {
  return {
    deltaMs: TICK_MS,
    worldSize: BATTLEFIELD_SIZE,
    dial: getShipDial(SHIP_ID),
    cycleMs: CYCLE_DURATION_MS,
    ...overrides,
  };
}

/** Fly until `cycles` cycles complete, queueing `plan[i+1]` as each starts. */
function fly(
  state: CycleFlightState,
  queue: (cycle: number) => ManeuverDirection | null,
  cycles: number,
): { state: CycleFlightState; ends: CompletedCycle[] } {
  const ends: CompletedCycle[] = [];
  let s = state;
  const queueNext = (): void => {
    const next = queue(ends.length + 1);
    s = {
      ...s,
      motion: {
        ...s.motion,
        control: { ...s.motion.control, nextManeuver: next },
      },
    };
  };
  queueNext();
  while (ends.length < cycles) {
    const tick = tickCycleFlight(s, tickInput());
    s = tick.state;
    if (tick.completed) {
      ends.push(tick.completed);
      queueNext();
    }
  }
  return { state: s, ends };
}

describe("createShipControl", () => {
  it("takes speed bounds from the ship definition", () => {
    const def = Object.values(SHIP_DEFINITIONS).find((d) => d.id === SHIP_ID)!;
    const control = createShipControl(SHIP_ID, START);
    expect(control.minSpeed).toBe(def.baseStats.speed.min);
    expect(control.maxSpeed).toBe(def.baseStats.speed.max);
  });

  it("flies capitals on the capital movement profile", () => {
    const capital = Object.values(SHIP_DEFINITIONS).find(
      (d) => d.role === "capital",
    )!;
    expect(createShipControl(capital.id, START).movementProfile).toBe(
      "capital",
    );
  });

  it("uses the definition's size class as the base size", () => {
    const def = Object.values(SHIP_DEFINITIONS).find((d) => d.id === SHIP_ID)!;
    expect(createShipControl(SHIP_ID, START).baseSize).toBe(
      SHIP_SIZES[def.baseStats.size],
    );
  });
});

describe("createCycleFlight", () => {
  it("spawns unstressed at the pose, already flying a straight cycle", () => {
    const flight = createCycleFlight(SHIP_ID, START);
    expect(flight.stress.level).toBe(0);
    expect(flight.motion).toMatchObject(START);
    expect(flight.motion.control.currentManeuver).toBe("straight");
  });
});

describe("tickCycleFlight — the ship ends each cycle where X-Wing rules put it", () => {
  const cases: ReadonlyArray<[string, ManeuverDirection]> = [
    ["straight", "straight"],
    ["bank right", "bank_right"],
    ["turn left", "turn_left"],
  ];
  for (const [label, direction] of cases) {
    it(`${label}: 4 cycles match the oracle within 0.5px / 0.1°`, () => {
      const start = createCycleFlight(SHIP_ID, START);
      const speed = start.motion.control.speed;
      const { ends } = fly(start, () => direction, 4);
      const plan: FlightStep[] = [
        { direction: "straight", speed },
        ...Array.from({ length: 3 }, () => ({ direction, speed })),
      ];
      const expected = predictFlight(
        START,
        plan,
        start.motion.control.baseSize,
      );
      ends.forEach((end, i) => {
        const want = expected[i]!;
        expect(
          Math.hypot(end.endPose.x - want.x, end.endPose.y - want.y),
        ).toBeLessThan(0.5);
        expect(
          Math.abs(headingDelta(end.endPose.angle, want.angle)),
        ).toBeLessThan(0.1);
      });
    });
  }

  it("drains action cooldowns every frame", () => {
    const start = createCycleFlight(SHIP_ID, START);
    const cooling = {
      ...start,
      motion: {
        ...start.motion,
        control: { ...start.motion.control, boostCooldown: 1000 },
      },
    };
    const tick = tickCycleFlight(cooling, tickInput({ deltaMs: 100 }));
    expect(tick.state.motion.control.boostCooldown).toBe(900);
  });

  it("a completed red turn adds stress; mid-cycle frames do not", () => {
    const start = createCycleFlight(SHIP_ID, START);
    const fast = {
      ...start,
      motion: {
        ...start.motion,
        control: { ...start.motion.control, speed: 3 },
      },
    };
    const mid = tickCycleFlight(fast, tickInput());
    expect(mid.completed).toBeNull();
    expect(mid.state.stress).toEqual(fast.stress);
    const { state } = fly(fast, () => "turn_left", 2);
    expect(state.stress.level).toBeGreaterThan(0);
  });
});
