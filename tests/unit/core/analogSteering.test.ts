/**
 * Analog steering engine: one turn key bends the heading at the dial's rate,
 * a full-cycle hold flies exactly the tabletop template, a partial hold is an
 * arc followed by a straight, and the turn is immediate.
 */

import { describe, it, expect } from "vitest";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../../src/config";
import { startManeuver } from "../../../src/core/ArcadeControls";
import { holdSteer } from "../../../src/core/analogCycle";
import {
  steeringCapacity,
  usesAnalogSteering,
  type AnalogSide,
} from "../../../src/core/analogSteering";
import { flownSpeed } from "../../../src/core/speedCap";
import {
  SHIP_DEFINITIONS,
  getShipDial,
  getShipsByRole,
} from "../../../src/data/ShipDefinitions";
import {
  createCycleFlight,
  tickCycleFlight,
  type CycleFlightState,
  type FlightTick,
} from "../../../src/arcade/systems/CycleFlight";
import {
  headingDelta,
  predictArcPose,
  predictManeuver,
  templateLength,
  translate,
} from "../../../src/simulation/flight/XWingFlightOracle";
import type { CompletedCycle } from "../../../src/arcade/systems/ShipMotion";
import { captureGraph, restoreGraph } from "../../../src/net/lockstep/StateGraph";

const TICK_MS = 1000 / 60;
const TICKS_PER_CYCLE = Math.round(CYCLE_DURATION_MS / TICK_MS);
const START = { x: 3000, y: 3000, angle: 0 };
const POSITION_TOLERANCE_PX = 2;
const HEADING_TOLERANCE_DEG = 1;

/** Ships whose cycle engine steers with the analog key (fighters, not capitals/huge). */
const FIGHTER_IDS = Object.keys(SHIP_DEFINITIONS).filter((id) => {
  const flight = createCycleFlight(id, START, "identity", "analog");
  return usesAnalogSteering(flight.motion.control);
});

/** A flight of `id` at the set speed, ready to steer (a fresh straight cycle). */
function analogFlight(id: string, setSpeed: number): CycleFlightState {
  const flight = createCycleFlight(id, START, "identity", "analog");
  const control = startManeuver(
    START,
    { ...flight.motion.control, speed: setSpeed },
    "straight",
  );
  return { ...flight, motion: { ...flight.motion, control } };
}

interface Flown {
  readonly flight: CycleFlightState;
  readonly completed: CompletedCycle[];
  readonly ticks: FlightTick[];
}

/**
 * Fly `ticks` simulation ticks pressing the key as `side(tick)` says, the way
 * the pilot controls do: the key is applied, then the motion steps.
 */
function fly(
  start: CycleFlightState,
  ticks: number,
  side: (tick: number) => AnalogSide,
  id: string,
): Flown {
  let flight = start;
  const completed: CompletedCycle[] = [];
  const all: FlightTick[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    const { motion, stress } = flight;
    const control = holdSteer(
      motion,
      motion.control,
      side(tick),
      stress.isStressed,
    );
    const stepped = tickCycleFlight(
      { motion: { ...motion, control }, stress },
      {
        deltaMs: TICK_MS,
        worldSize: BATTLEFIELD_SIZE,
        dial: getShipDial(id),
        cycleMs: CYCLE_DURATION_MS,
      },
    );
    flight = stepped.state;
    all.push(stepped);
    if (stepped.completed) completed.push(stepped.completed);
  }
  return { flight, completed, ticks: all };
}

const baseSizeOf = (flight: CycleFlightState): number =>
  flight.motion.control.baseSize;

function expectPose(
  actual: { x: number; y: number; angle: number },
  expected: { x: number; y: number; angle: number },
  label: string,
): void {
  expect(
    Math.hypot(actual.x - expected.x, actual.y - expected.y),
    `${label} position`,
  ).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  expect(
    Math.abs(headingDelta(actual.angle, expected.angle)),
    `${label} heading`,
  ).toBeLessThanOrEqual(HEADING_TOLERANCE_DEG);
}

describe("steeringCapacity", () => {
  const table = { turn: [1, 2, 3], bank: [1, 2, 3, 4], straight: [1, 2, 3, 4, 5] };

  it("turns 90 degrees where the dial prints a hard turn", () => {
    expect(steeringCapacity(table, 2, false)).toMatchObject({
      speed: 2,
      rateDeg: 90,
      kind: "turn",
    });
  });

  it("turns 45 degrees where the dial prints only a bank", () => {
    expect(steeringCapacity(table, 4, false)).toMatchObject({
      speed: 4,
      rateDeg: 45,
      kind: "bank",
    });
  });

  it("slows to the fastest speed with a turn where the dial prints none", () => {
    expect(steeringCapacity(table, 5, false)).toMatchObject({
      speed: 4,
      kind: "bank",
    });
    expect(steeringCapacity({ turn: [1, 2], bank: [1, 2] }, 5, false)).toMatchObject(
      { speed: 2, rateDeg: 90, kind: "turn" },
    );
  });

  it("falls back to the nearest turn speed above when none is below", () => {
    expect(steeringCapacity({ turn: [3], bank: [3] }, 1, false).speed).toBe(3);
  });

  it("limits a stressed pilot to bank rate but keeps the dial maximum", () => {
    const stressed = steeringCapacity(table, 2, true);
    expect(stressed.rateDeg).toBe(45);
    expect(stressed.dialMaxDeg).toBe(90);
  });

  it("turns fully at the set speed when the ship has no dial table", () => {
    expect(steeringCapacity(undefined, 4, false)).toMatchObject({
      speed: 4,
      rateDeg: 90,
    });
  });
});

describe("a full-cycle hold", () => {
  it("flies the tabletop template for every fighter at every speed", () => {
    expect(FIGHTER_IDS.length).toBeGreaterThan(50);
    for (const id of FIGHTER_IDS) {
      const probe = createCycleFlight(id, START, "identity", "analog");
      const { minSpeed, maxSpeed, capabilities } = probe.motion.control;
      for (let speed = minSpeed; speed <= maxSpeed; speed++) {
        const start = analogFlight(id, speed);
        const capacity = steeringCapacity(capabilities?.dialSpeeds, speed, false);
        for (const side of ["left", "right"] as const) {
          const flown = fly(start, TICKS_PER_CYCLE, () => side, id);
          const direction = `${capacity.kind}_${side}` as const;
          const expected = predictManeuver(
            START,
            { direction, speed: capacity.speed },
            baseSizeOf(start),
          );
          expect(flown.completed).toHaveLength(1);
          expectPose(flown.completed[0]!.endPose, expected, `${id}@${speed} ${direction}`);
        }
      }
    }
  });
});

describe("no key", () => {
  it("flies straight at the set speed", () => {
    for (const id of FIGHTER_IDS.slice(0, 40)) {
      const start = analogFlight(id, 3);
      const table = start.motion.control.capabilities?.dialSpeeds;
      const flown = fly(start, TICKS_PER_CYCLE, () => "none", id);
      const expected = predictManeuver(
        START,
        { direction: "straight", speed: flownSpeed(table, "straight", 3) },
        baseSizeOf(start),
      );
      expectPose(flown.completed[0]!.endPose, expected, id);
    }
  });
});

describe("a partial hold", () => {
  const id = getShipsByRole("heavy_fighter")[0]!.id;

  it("turns the held share of the angle, then flies straight", () => {
    const start = analogFlight(id, 2);
    const capacity = steeringCapacity(
      start.motion.control.capabilities?.dialSpeeds,
      2,
      false,
    );
    const heldTicks = TICKS_PER_CYCLE / 2;
    const flown = fly(start, TICKS_PER_CYCLE, (t) => (t < heldTicks ? "right" : "none"), id);
    const arc = predictArcPose(
      START,
      { direction: `${capacity.kind}_right`, speed: capacity.speed },
      baseSizeOf(start),
      0.5,
    );
    const straightSpeed = start.motion.control.cycleSpeed;
    const expected = translate(
      arc,
      0,
      templateLength(straightSpeed, baseSizeOf(start)) * 0.5,
    );
    const end = flown.completed[0]!.endPose;
    expectPose(end, expected, "half hold");
    expect(Math.abs(headingDelta(end.angle, START.angle))).toBeCloseTo(
      capacity.rateDeg / 2,
      0,
    );
  });

  it("turns in proportion to the time held", () => {
    for (const share of [0.2, 0.4, 0.8]) {
      const ticks = Math.round(TICKS_PER_CYCLE * share);
      const flown = fly(analogFlight(id, 2), TICKS_PER_CYCLE, (t) => (t < ticks ? "left" : "none"), id);
      const turned = Math.abs(headingDelta(flown.completed[0]!.endPose.angle, 0));
      expect(turned).toBeCloseTo(90 * (ticks / TICKS_PER_CYCLE), 0);
    }
  });
});

describe("the turn is immediate", () => {
  it("bends the heading on the first tick of the press, mid-cycle, without cutting the cycle", () => {
    const id = getShipsByRole("heavy_fighter")[0]!.id;
    const before = fly(analogFlight(id, 2), 10, () => "none", id);
    const after = fly(before.flight, 1, () => "right", id);
    const turned = headingDelta(after.flight.motion.angle, before.flight.motion.angle);
    expect(turned).toBeGreaterThan(2.5);
    expect(after.completed).toHaveLength(0);
    expect(after.flight.motion.control.interruptQueued).toBe(false);
    expect(after.flight.motion.control.maneuverProgress).toBeGreaterThan(
      before.flight.motion.control.maneuverProgress,
    );
  });

  it("stops turning on the tick the key is released", () => {
    const id = getShipsByRole("heavy_fighter")[0]!.id;
    const held = fly(analogFlight(id, 2), 8, () => "right", id);
    const released = fly(held.flight, 5, () => "none", id);
    expect(released.flight.motion.angle).toBeCloseTo(held.flight.motion.angle, 6);
  });
});

describe("speed cap and return", () => {
  const find = (): { id: string; set: number; turnSpeed: number } => {
    for (const id of FIGHTER_IDS) {
      const control = createCycleFlight(id, START, "identity", "analog").motion.control;
      for (let set = control.minSpeed; set <= control.maxSpeed; set++) {
        const capacity = steeringCapacity(control.capabilities?.dialSpeeds, set, false);
        if (capacity.speed < set) return { id, set, turnSpeed: capacity.speed };
      }
    }
    throw new Error("no ship has a cruise speed without a turn");
  };

  it("drops to the turn speed while the key is held and returns on release", () => {
    const { id, set, turnSpeed } = find();
    const start = analogFlight(id, set);
    const held = fly(start, 3, () => "left", id);
    expect(held.flight.motion.control.speed).toBe(set);
    expect(held.flight.motion.control.cycleSpeed).toBe(turnSpeed);
    const released = fly(held.flight, 1, () => "none", id);
    expect(released.flight.motion.control.cycleSpeed).toBe(
      flownSpeed(start.motion.control.capabilities?.dialSpeeds, "straight", set),
    );
  });

  it("keeps the set speed through the next straight cycle", () => {
    const { id, set } = find();
    const flown = fly(analogFlight(id, set), TICKS_PER_CYCLE + 2, (t) => (t < 4 ? "left" : "none"), id);
    expect(flown.flight.motion.control.cycleSpeed).toBe(
      flownSpeed(flown.flight.motion.control.capabilities?.dialSpeeds, "straight", set),
    );
  });
});

describe("determinism", () => {
  it("flies the same key script to the same state twice", () => {
    const id = getShipsByRole("interceptor")[0]!.id;
    const script = (t: number): AnalogSide =>
      t % 50 < 20 ? "left" : t % 50 < 35 ? "right" : "none";
    const run = () => fly(analogFlight(id, 3), 400, script, id).flight;
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("survives a lockstep state-graph snapshot mid-turn, analog state included", () => {
    const id = getShipsByRole("interceptor")[0]!.id;
    const mid = fly(analogFlight(id, 2), 17, () => "right", id).flight;
    expect(mid.motion.control.analog?.held).toBe("right");
    const restored = restoreGraph(analogFlight(id, 3), captureGraph(mid))
      .root as CycleFlightState;
    expect(JSON.stringify(restored)).toBe(JSON.stringify(mid));
    const script = (): AnalogSide => "right";
    const onward = (from: CycleFlightState) => fly(from, 40, script, id).flight;
    expect(JSON.stringify(onward(restored))).toBe(JSON.stringify(onward(mid)));
  });
});
