/**
 * Instant turns, pilot level — a human's steering starts at once and cuts the
 * running cycle; bots, specials and releases keep the boundary cadence.
 * The rig below is a minimal scene: input frame, motion tick, commit notice.
 */

import { describe, it, expect } from "vitest";
import {
  applyPilotFlightInput,
  onPilotCycleCommitted,
  INITIAL_PILOT_CONTROL,
  type FlightEdge,
  type FlightInput,
  type PilotControlState,
} from "../../../../src/arcade/systems/PilotFlightControls";
import {
  stepMotion,
  barrelRollDistance,
  type CompletedCycle,
  type MotionState,
} from "../../../../src/arcade/systems/ShipMotion";
import { createControlState } from "../../../../src/core/ArcadeControls";
import { CYCLE_INTERRUPT_MIN_ELAPSED_MS } from "../../../../src/core/cycleInterrupt";
import { INITIAL_STRESS } from "../../../../src/arcade/ArcadeStress";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { headingDelta } from "../../../../src/simulation/flight/XWingFlightOracle";
import { CYCLE_DURATION_MS, SHIP_SIZES } from "../../../../src/config";
import type { ShipState } from "../../../../src/core/types";

const WORLD = 6000;
const TICK_MS = 1000 / 60;
const START = { x: 3000, y: 3000, angle: 0 };
const SHIP = { ...START, definitionId: "terran_viper" } as unknown as ShipState;

interface Held {
  readonly left?: boolean;
  readonly right?: boolean;
  readonly edges?: readonly FlightEdge[];
}

interface Rig {
  pilot: PilotControlState;
  motion: MotionState;
  clockMs: number;
  /** Every cycle reported, with the maneuver that started after it. */
  ended: Array<
    CompletedCycle & { readonly started: string; readonly atMs: number }
  >;
  readonly interrupts: boolean;
}

function rig(interrupts = true): Rig {
  return {
    pilot: INITIAL_PILOT_CONTROL,
    motion: {
      ...START,
      control: createControlState(START, SHIP_SIZES.small),
    },
    clockMs: 0,
    ended: [],
    interrupts,
  };
}

/** One scene tick: pilot input, motion step, commit notice. */
function tick(r: Rig, held: Held = {}): void {
  const input: FlightInput = {
    left: held.left === true,
    right: held.right === true,
    up: false,
    down: false,
    edges: new Set<FlightEdge>(held.edges ?? []),
    nowMs: r.clockMs,
    deltaMs: TICK_MS,
    allowChordBarrelRoll: false,
  };
  const result = applyPilotFlightInput(
    r.pilot,
    {
      ship: SHIP,
      motion: r.motion,
      stress: INITIAL_STRESS,
      dial: getShipDial("terran_viper"),
    },
    input,
    WORLD,
    { interruptCycles: r.interrupts },
  );
  const step = stepMotion(result.motion, SHIP, TICK_MS, WORLD);
  r.motion = step.state;
  r.pilot = result.pilot;
  r.clockMs += TICK_MS;
  if (!step.completed) return;
  const started = step.state.control.currentManeuver ?? "straight";
  r.ended.push({ ...step.completed, started, atMs: r.clockMs });
  r.pilot = onPilotCycleCommitted(r.pilot, started);
}

function run(r: Rig, ms: number, held: Held = {}): void {
  for (let t = 0; t < ms - 1e-6; t += TICK_MS) tick(r, held);
}

const maneuver = (r: Rig): string | null => r.motion.control.currentManeuver;
const startedList = (r: Rig): string[] => r.ended.map((e) => e.started);

describe("instant turns — a human's steering", () => {
  it("a steer press cuts the running cycle at once", () => {
    const r = rig();
    run(r, 200);
    expect(maneuver(r)).toBe("straight");
    tick(r, { left: true });
    expect(maneuver(r)).toBe("drift_left");
    expect(r.ended).toHaveLength(1);
    expect(r.ended[0]!.direction).toBe("straight");
    expect(r.ended[0]!.fraction).toBeGreaterThan(0.3);
    expect(r.ended[0]!.fraction).toBeLessThan(0.5);
    expect(r.motion.control.maneuverProgress).toBeLessThan(0.05);
  });

  it("a press before the cycle is old enough waits, then cuts", () => {
    const r = rig();
    run(r, 20);
    tick(r, { left: true });
    expect(maneuver(r)).toBe("straight");
    run(r, CYCLE_INTERRUPT_MIN_ELAPSED_MS, { left: true });
    expect(maneuver(r)).toBe("drift_left");
    expect(r.ended[0]!.fraction * CYCLE_DURATION_MS).toBeGreaterThanOrEqual(
      CYCLE_INTERRUPT_MIN_ELAPSED_MS,
    );
  });

  it("a tap still flies exactly one full drift", () => {
    const r = rig();
    run(r, 200);
    run(r, 40, { left: true });
    run(r, 1500);
    expect(startedList(r).slice(0, 2)).toEqual(["drift_left", "straight"]);
    const drift = r.ended[1]!;
    expect(drift.direction).toBe("drift_left");
    expect(drift.fraction).toBe(1);
    expect(startedList(r).filter((m) => m === "drift_left")).toHaveLength(1);
  });

  it("releasing the key does not cut the drift that is flying", () => {
    const r = rig();
    run(r, 200);
    run(r, 100, { left: true });
    const driftStart = r.ended[0]!.atMs;
    run(r, 1000);
    const drift = r.ended[1]!;
    expect(drift.direction).toBe("drift_left");
    expect(drift.atMs - driftStart).toBeCloseTo(CYCLE_DURATION_MS - TICK_MS, 0);
    expect(drift.fraction).toBe(1);
  });

  it("holding upgrades the drift to one bank at once, then drifts at the normal cadence", () => {
    const r = rig();
    run(r, 200);
    run(r, 1800, { left: true });
    const started = startedList(r);
    expect(started.slice(0, 3)).toEqual([
      "drift_left",
      "bank_left",
      "drift_left",
    ]);
    const bank = r.ended[1]!;
    expect(bank.direction).toBe("drift_left");
    expect(bank.fraction).toBeLessThan(0.5);
    const full = r.ended.slice(2);
    expect(full.length).toBeGreaterThanOrEqual(2);
    for (const cycle of full) expect(cycle.fraction).toBe(1);
    expect(full[1]!.atMs - full[0]!.atMs).toBeCloseTo(CYCLE_DURATION_MS, 0);
  });

  it("Q / E cut for a 90° turn", () => {
    const r = rig();
    run(r, 200);
    tick(r, { edges: ["SHARP_TURN_LEFT"] });
    expect(maneuver(r)).toBe("turn_left");
    expect(r.ended).toHaveLength(1);
  });

  it("a turn queued in the first moments of a cycle cuts when the cycle is old enough", () => {
    const r = rig();
    run(r, 20);
    tick(r, { edges: ["SHARP_TURN_RIGHT"] });
    expect(maneuver(r)).toBe("straight");
    run(r, CYCLE_INTERRUPT_MIN_ELAPSED_MS);
    expect(maneuver(r)).toBe("turn_right");
  });

  it("the same maneuver continuing does not restart its cycle", () => {
    const r = rig();
    run(r, 200);
    run(r, 100, { left: true });
    run(r, 240);
    const before = r.ended.length;
    const progress = r.motion.control.maneuverProgress;
    run(r, 40, { left: true });
    expect(maneuver(r)).toBe("drift_left");
    expect(r.ended.length).toBe(before);
    expect(r.motion.control.maneuverProgress).toBeGreaterThan(progress);
  });

  it("a Snap Turn stays queued to the cycle boundary (atomic specials queue)", () => {
    const r = rig();
    run(r, 200);
    tick(r, { edges: ["KTURN"] });
    run(r, 100);
    expect(maneuver(r)).toBe("straight");
    expect(r.motion.control.nextManeuver).toBe("kturn");
    run(r, 250);
    expect(maneuver(r)).toBe("kturn");
    expect(r.ended[0]!.fraction).toBe(1);
  });

  it("steering during an atomic special does not cut it", () => {
    const r = rig();
    run(r, 50);
    tick(r, { edges: ["KTURN"] });
    run(r, 500);
    expect(maneuver(r)).toBe("kturn");
    run(r, 200, { left: true });
    expect(maneuver(r)).toBe("kturn");
    run(r, 400, { left: true });
    expect(maneuver(r)).toBe("bank_left");
  });

  it("the double-tap barrel roll cancels the drift its first tap started", () => {
    const r = rig();
    run(r, 200);
    const before = { x: r.motion.x, y: r.motion.y };
    run(r, 50, { left: true });
    run(r, 40);
    run(r, 50, { left: true });
    run(r, 100);
    expect(r.motion.control.barrelRollCooldown).toBeGreaterThan(0);
    expect(maneuver(r)).toBe("straight");
    run(r, 1000);
    expect(Math.abs(headingDelta(r.motion.angle, 0))).toBeLessThan(15);
    const slid = before.x - r.motion.x;
    expect(slid).toBeGreaterThan(barrelRollDistance(SHIP_SIZES.small) - 20);
  });

  it("the heading never jumps while steering mid-cycle", () => {
    const r = rig();
    run(r, 200);
    let heading = r.motion.angle;
    let worst = 0;
    for (let i = 0; i < 90; i++) {
      tick(r, { left: i < 40 });
      worst = Math.max(worst, Math.abs(headingDelta(r.motion.angle, heading)));
      heading = r.motion.angle;
    }
    expect(worst).toBeLessThan(3);
  });
});

describe("instant turns — who does not interrupt", () => {
  it("a bot (no interruptCycles option) commits steering at the cycle boundary", () => {
    const r = rig(false);
    run(r, 200);
    run(r, 100, { left: true });
    expect(maneuver(r)).toBe("straight");
    expect(r.motion.control.interruptQueued).toBe(false);
    run(r, 250);
    expect(maneuver(r)).not.toBe("straight");
    expect(r.ended[0]!.fraction).toBe(1);
  });

  it("a seat handed to a bot drops the human's stale interrupt request", () => {
    const r = rig(true);
    run(r, 10);
    tick(r, { left: true });
    expect(r.motion.control.interruptQueued).toBe(true);
    const bot = { ...r, interrupts: false };
    tick(bot, { left: true });
    expect(bot.motion.control.interruptQueued).toBe(false);
  });

  it("is deterministic: the same input stream gives identical states", () => {
    const script = (): string => {
      const r = rig();
      run(r, 150);
      run(r, 120, { left: true });
      run(r, 60);
      tick(r, { edges: ["SHARP_TURN_RIGHT"] });
      run(r, 700, { right: true });
      return JSON.stringify({ motion: r.motion, pilot: r.pilot, log: r.ended });
    };
    expect(script()).toBe(script());
  });
});
