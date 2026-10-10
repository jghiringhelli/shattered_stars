/**
 * Cycle stress accrual — specification tests for the stress a ship gains or
 * sheds when a maneuver cycle completes (shared by every cycle-engine scene).
 */

import { describe, it, expect } from "vitest";
import {
  accrueCycleStress,
  easeDifficulty,
  INITIAL_STRESS,
  type CycleStressInput,
} from "../../../src/arcade/ArcadeStress";
import { CYCLE_DURATION_MS } from "../../../src/config";
import type { ManeuverDefinition } from "../../../src/core/types";

const DIAL: readonly ManeuverDefinition[] = [
  { direction: "straight", speed: 2, difficulty: "green" },
  { direction: "bank_left", speed: 2, difficulty: "white" },
  { direction: "turn_left", speed: 2, difficulty: "white" },
  { direction: "turn_left", speed: 3, difficulty: "red" },
];

function cycle(overrides: Partial<CycleStressInput> = {}): CycleStressInput {
  return {
    stress: INITIAL_STRESS,
    direction: "straight",
    speed: 2,
    dial: DIAL,
    reliefTiers: 0,
    rateMultiplier: 1,
    cycleMs: CYCLE_DURATION_MS,
    ...overrides,
  };
}

describe("easeDifficulty", () => {
  it("leaves the difficulty unchanged with zero tiers", () => {
    expect(easeDifficulty("red", 0)).toBe("red");
  });

  it("eases red one tier to white", () => {
    expect(easeDifficulty("red", 1)).toBe("white");
  });

  it("never eases past green", () => {
    expect(easeDifficulty("red", 5)).toBe("green");
  });

  it("ignores fractional tiers below one", () => {
    expect(easeDifficulty("white", 0.9)).toBe("white");
  });
});

describe("accrueCycleStress", () => {
  it("a red turn adds stress", () => {
    const after = accrueCycleStress(
      cycle({ direction: "turn_right", speed: 3 }),
    );
    expect(after.level).toBeGreaterThan(0);
  });

  it("a green straight drains stress", () => {
    const stressed = { level: 0.5, isStressed: false };
    const after = accrueCycleStress(cycle({ stress: stressed }));
    expect(after.level).toBeLessThan(0.5);
  });

  it("classifies right-side maneuvers with the left-side dial entry", () => {
    const left = accrueCycleStress(cycle({ direction: "turn_left", speed: 3 }));
    const right = accrueCycleStress(
      cycle({ direction: "turn_right", speed: 3 }),
    );
    expect(right).toEqual(left);
  });

  it("relief tiers make a red turn cost less than unrelieved", () => {
    const red = accrueCycleStress(cycle({ direction: "turn_left", speed: 3 }));
    const eased = accrueCycleStress(
      cycle({ direction: "turn_left", speed: 3, reliefTiers: 1 }),
    );
    expect(eased.level).toBeLessThan(red.level);
  });

  it("a rate multiplier below one shrinks the stress gained", () => {
    const full = accrueCycleStress(cycle({ direction: "turn_left", speed: 3 }));
    const halved = accrueCycleStress(
      cycle({ direction: "turn_left", speed: 3, rateMultiplier: 0.5 }),
    );
    expect(halved.level).toBeCloseTo(full.level / 2, 6);
  });
});
