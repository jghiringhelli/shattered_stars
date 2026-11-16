/**
 * Stress of the analog turn key: a cycle counts by the angle it achieved
 * against what the dial allowed (ArcadeStress thresholds 0.25 / 0.65).
 */

import { describe, it, expect } from "vitest";
import { freshAnalogSteer, type AnalogSteer } from "../../../src/core/analogSteering";
import { classifyAnalogCycle } from "../../../src/arcade/systems/AnalogCompletion";
import { accrueCycleStress, INITIAL_STRESS } from "../../../src/arcade/ArcadeStress";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../../src/config";
import { holdSteer } from "../../../src/core/analogCycle";
import { getShipDial } from "../../../src/data/ShipDefinitions";
import {
  createCycleFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../../../src/arcade/systems/CycleFlight";
import { startManeuver } from "../../../src/core/ArcadeControls";
import type { DialSpeedTable } from "../../../src/core/speedCap";

const TABLE: DialSpeedTable = { turn: [1, 2, 3], bank: [1, 2, 3, 4], straight: [1, 2, 3, 4, 5] };

/** Steering state after a cycle that turned `turnedDeg` of a dial maximum. */
function after(turnedDeg: number, kind: "turn" | "bank", speed = 3): AnalogSteer {
  return {
    ...freshAnalogSteer(speed, true),
    turnedDeg,
    turnSpeed: speed,
    dialMaxDeg: kind === "turn" ? 90 : 45,
    turnKind: kind,
  };
}

describe("classifyAnalogCycle", () => {
  it("counts a barely touched key as straight at the base speed", () => {
    expect(classifyAnalogCycle(after(10, "turn"), TABLE)).toEqual({
      direction: "straight",
      speed: 3,
    });
  });

  it("counts a quarter to two thirds of the dial maximum as a bank", () => {
    expect(classifyAnalogCycle(after(45, "turn"), TABLE).direction).toBe("bank_left");
    expect(classifyAnalogCycle(after(22.6, "turn"), TABLE).direction).toBe("bank_left");
  });

  it("keeps the dial's hard-turn entry for a fully held hard turn", () => {
    expect(classifyAnalogCycle(after(90, "turn"), TABLE)).toEqual({
      direction: "turn_left",
      speed: 3,
    });
  });

  it("counts a fully held bank-only turn as a bank, never as an absent turn", () => {
    expect(classifyAnalogCycle(after(45, "bank", 4), TABLE)).toEqual({
      direction: "bank_left",
      speed: 4,
    });
  });

  it("uses the hard-turn entry for a partial turn where the dial prints no bank", () => {
    const turnOnly: DialSpeedTable = { turn: [3], bank: [1], straight: [1, 3] };
    expect(classifyAnalogCycle(after(45, "turn"), turnOnly).direction).toBe("turn_left");
  });
});

describe("stress of a flown analog cycle", () => {
  const id = "terran_viper";
  const START = { x: 3000, y: 3000, angle: 0 };

  function cycle(heldTicks: number, speed: number): CycleFlightState {
    const made = createCycleFlight(id, START, "identity", "analog");
    let flight: CycleFlightState = {
      ...made,
      motion: {
        ...made.motion,
        control: startManeuver(START, { ...made.motion.control, speed }, "straight"),
      },
    };
    for (let tick = 0; tick < 30; tick++) {
      const { motion, stress } = flight;
      const control = holdSteer(motion, motion.control, tick < heldTicks ? "left" : "none", false);
      flight = tickCycleFlight(
        { motion: { ...motion, control }, stress },
        { deltaMs: 1000 / 60, worldSize: BATTLEFIELD_SIZE, dial: getShipDial(id), cycleMs: CYCLE_DURATION_MS },
      ).state;
    }
    return flight;
  }

  it("charges a fully held turn the dial colour of that turn entry", () => {
    const dial = getShipDial(id);
    const redTurn = dial.find((m) => m.direction === "turn_left" && m.difficulty === "red");
    expect(redTurn, "the test ship has a red hard turn").toBeDefined();
    const flown = cycle(30, redTurn!.speed);
    const expected = accrueCycleStress({
      stress: INITIAL_STRESS,
      direction: "turn_left",
      speed: redTurn!.speed,
      dial,
      reliefTiers: 0,
      rateMultiplier: 1,
      cycleMs: CYCLE_DURATION_MS,
    });
    expect(flown.stress.level).toBeCloseTo(expected.level, 6);
    expect(flown.stress.level).toBeGreaterThan(0);
  });

  it("charges nothing for a cycle that barely turned", () => {
    const dial = getShipDial(id);
    const redTurn = dial.find((m) => m.direction === "turn_left" && m.difficulty === "red")!;
    expect(cycle(2, redTurn.speed).stress.level).toBe(0);
  });
});
