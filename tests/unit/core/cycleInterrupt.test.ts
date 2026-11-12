/**
 * Instant turns — specification tests for the human pilot's cycle interrupt
 * (src/core/cycleInterrupt): eligibility, the cut pose, the full new cycle,
 * and the stress of a cut cycle.
 */

import { describe, it, expect } from "vitest";
import {
  createControlState,
  type ShipControlState,
} from "../../../src/core/ArcadeControls";
import {
  CYCLE_INTERRUPT_MIN_ELAPSED_MS,
  canInterruptCycle,
  interruptCycle,
  isAtomicManeuver,
  queueInterrupt,
} from "../../../src/core/cycleInterrupt";
import {
  stepMotion,
  type CompletedCycle,
  type MotionState,
} from "../../../src/arcade/systems/ShipMotion";
import {
  createCycleFlight,
  tickCycleFlight,
} from "../../../src/arcade/systems/CycleFlight";
import {
  accrueCycleStress,
  INITIAL_STRESS,
} from "../../../src/arcade/ArcadeStress";
import { getShipDial } from "../../../src/data/ShipDefinitions";
import {
  headingDelta,
  predictArcPose,
  predictManeuver,
} from "../../../src/simulation/flight/XWingFlightOracle";
import { CYCLE_DURATION_MS, SHIP_SIZES } from "../../../src/config";

const WORLD = 6000;
const TICK_MS = 1000 / 60;
const BASE = SHIP_SIZES.small;
const START = { x: 3000, y: 3000, angle: 0 };

/** A ship flying its first straight cycle in the middle of the field. */
function cruising(overrides: Partial<ShipControlState> = {}): MotionState {
  return {
    ...START,
    control: { ...createControlState(START, BASE), ...overrides },
  };
}

/** Steps `ticks` ticks, collecting every reported cycle. */
function fly(
  from: MotionState,
  ticks: number,
): { state: MotionState; ended: CompletedCycle[] } {
  let state = from;
  const ended: CompletedCycle[] = [];
  for (let i = 0; i < ticks; i++) {
    const step = stepMotion(state, state, TICK_MS, WORLD);
    state = step.state;
    if (step.completed) ended.push(step.completed);
  }
  return { state, ended };
}

describe("canInterruptCycle — eligibility", () => {
  const aged = (state: MotionState): MotionState =>
    fly(state, Math.ceil(CYCLE_INTERRUPT_MIN_ELAPSED_MS / TICK_MS)).state;

  it("never cuts without the pilot's interrupt flag", () => {
    const state = aged(cruising({ nextManeuver: "drift_left" }));
    expect(canInterruptCycle(state.control)).toBe(false);
  });

  it("waits until the cycle has flown the minimum elapsed time", () => {
    const fresh = cruising();
    const queued = {
      ...fresh,
      control: queueInterrupt(fresh.control, "drift_left"),
    };
    expect(canInterruptCycle(queued.control)).toBe(false);
    const early = fly(queued, 3).state;
    expect(canInterruptCycle(early.control)).toBe(false);
    expect(canInterruptCycle(aged(queued).control)).toBe(true);
  });

  it("does not cut for the maneuver already flying", () => {
    const state = aged(cruising());
    const same = queueInterrupt(state.control, "straight");
    expect(canInterruptCycle(same)).toBe(false);
  });

  it("never cuts an atomic special in flight", () => {
    const state = aged(cruising());
    const flying = { ...state.control, currentManeuver: "kturn" as const };
    expect(canInterruptCycle(queueInterrupt(flying, "drift_left"))).toBe(false);
  });

  it("never cuts for an atomic special: it queues to the boundary", () => {
    const state = aged(cruising());
    for (const special of ["kturn", "segnor_left", "tallon_right"] as const)
      expect(canInterruptCycle(queueInterrupt(state.control, special))).toBe(
        false,
      );
    expect(isAtomicManeuver("kturn")).toBe(true);
    expect(isAtomicManeuver("bank_left")).toBe(false);
  });

  it("never cuts a capital ship (its boat easing would stall at every restart)", () => {
    const state = aged(cruising({ movementProfile: "capital" }));
    expect(canInterruptCycle(queueInterrupt(state.control, "drift_left"))).toBe(
      false,
    );
  });
});

describe("interruptCycle — the cut", () => {
  function cutAfter(ticks: number, requested: "drift_left" | "turn_right") {
    const flown = fly(cruising(), ticks).state;
    const before = {
      ...flown,
      control: queueInterrupt(flown.control, requested),
    };
    const step = stepMotion(before, before, TICK_MS, WORLD);
    return { before, step };
  }

  it("ends the cut cycle on the prefix of its template arc", () => {
    const { before, step } = cutAfter(10, "drift_left");
    const progress = before.control.maneuverProgress;
    const expected = predictArcPose(
      START,
      { direction: "straight", speed: before.control.cycleSpeed },
      BASE,
      progress,
    );
    expect(step.completed).not.toBeNull();
    const end = step.completed!.endPose;
    expect(Math.hypot(end.x - expected.x, end.y - expected.y)).toBeLessThan(
      0.5,
    );
    expect(step.completed!.fraction).toBeCloseTo(progress, 9);
    expect(step.completed!.direction).toBe("straight");
  });

  it("keeps the heading and the position continuous at the cut", () => {
    const { before, step } = cutAfter(10, "turn_right");
    const jump = Math.hypot(step.state.x - before.x, step.state.y - before.y);
    // One tick of the new cycle at most: a turn at speed ≤ 2 is < 112 px per cycle.
    expect(jump).toBeLessThan(10);
    expect(Math.abs(headingDelta(step.state.angle, before.angle))).toBeLessThan(
      4,
    );
  });

  it("starts the requested maneuver from the cut pose as a full template", () => {
    const { before, step } = cutAfter(10, "turn_right");
    const control = step.state.control;
    expect(control.currentManeuver).toBe("turn_right");
    const cutPose = step.completed!.endPose;
    expect(control.maneuverPath[0]).toMatchObject(cutPose);
    const target = predictManeuver(
      cutPose,
      { direction: "turn_right", speed: control.cycleSpeed },
      BASE,
    );
    expect(control.maneuverTarget!.x).toBeCloseTo(target.x, 6);
    expect(control.maneuverTarget!.y).toBeCloseTo(target.y, 6);
    expect(control.maneuverProgress).toBeLessThan(
      TICK_MS / CYCLE_DURATION_MS + 1e-9,
    );
    expect(before.control.interruptQueued).toBe(true);
    expect(control.interruptQueued).toBe(false);
    expect(control.nextManeuver).toBeNull();
  });

  it("runs the new cycle for a full 500 ms and ends exactly on its template", () => {
    const { step } = cutAfter(10, "turn_right");
    const cutPose = step.completed!.endPose;
    const rest = fly(step.state, Math.round(CYCLE_DURATION_MS / TICK_MS));
    const full = rest.ended[0]!;
    expect(full.direction).toBe("turn_right");
    expect(full.fraction).toBe(1);
    const target = predictManeuver(
      cutPose,
      { direction: "turn_right", speed: full.speed },
      BASE,
    );
    expect(
      Math.hypot(full.endPose.x - target.x, full.endPose.y - target.y),
    ).toBeLessThan(0.05);
    expect(
      Math.abs(headingDelta(full.endPose.angle, target.angle)),
    ).toBeLessThan(0.05);
  });

  it("flies the new cycle at the speed cap of that moment", () => {
    const queued = createCycleFlight("terran_gladius", START, "identity");
    const control = {
      ...queued.motion.control,
      speed: 4,
    };
    const flown = fly({ ...queued.motion, control }, 8).state;
    const before = {
      ...flown,
      control: queueInterrupt(flown.control, "turn_left"),
    };
    const cut = stepMotion(before, before, TICK_MS, WORLD);
    expect(cut.state.control.speed).toBe(4);
    expect(cut.state.control.cycleSpeed).toBeLessThan(4);
    expect(cut.completed!.speed).toBe(before.control.cycleSpeed);
  });

  it("keeps the once-per-cycle weapon latch: a cut grants no extra attack", () => {
    const state = fly(cruising(), 6).state;
    const fired: ShipControlState = {
      ...queueInterrupt(state.control, "drift_left"),
      firedLaserThisCycle: true,
    };
    const cut = interruptCycle(state, fired);
    expect(cut.control.firedLaserThisCycle).toBe(true);
  });
});

describe("cut cycle stress", () => {
  it("scales a cut cycle's stress change by the share that was flown", () => {
    const flight = createCycleFlight("terran_gladius", START, "identity");
    const dial = getShipDial("terran_gladius");
    const ready = {
      motion: {
        ...flight.motion,
        control: queueInterrupt(
          { ...flight.motion.control, speed: 3 },
          "bank_left",
        ),
      },
      stress: INITIAL_STRESS,
    };
    let state = ready;
    let cut: CompletedCycle | null = null;
    let lastStress = state.stress;
    for (let i = 0; i < 40 && !cut; i++) {
      lastStress = state.stress;
      const tick = tickCycleFlight(state, {
        deltaMs: TICK_MS,
        worldSize: WORLD,
        dial,
        cycleMs: CYCLE_DURATION_MS,
      });
      state = tick.state;
      cut = tick.completed;
    }
    expect(cut).not.toBeNull();
    expect(cut!.fraction).toBeGreaterThan(0.15);
    expect(cut!.fraction).toBeLessThan(0.5);
    const expected = accrueCycleStress({
      stress: lastStress,
      direction: cut!.direction,
      speed: cut!.speed,
      dial,
      reliefTiers: 0,
      rateMultiplier: 1,
      cycleMs: CYCLE_DURATION_MS * cut!.fraction,
    });
    expect(state.stress.level).toBeCloseTo(expected.level, 9);
  });
});

describe("determinism", () => {
  it("the same input stream and clock give identical states", () => {
    const run = (): string => {
      let state = cruising();
      for (let i = 0; i < 90; i++) {
        if (i === 12)
          state = {
            ...state,
            control: queueInterrupt(state.control, "drift_left"),
          };
        if (i === 40)
          state = {
            ...state,
            control: queueInterrupt(state.control, "bank_right"),
          };
        state = stepMotion(state, state, TICK_MS, WORLD).state;
      }
      return JSON.stringify(state);
    };
    expect(run()).toBe(run());
  });
});
