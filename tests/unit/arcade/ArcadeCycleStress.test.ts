/**
 * Cycle stress accrual — specification tests for the stress a ship gains or
 * sheds when a maneuver cycle completes (shared by every cycle-engine scene).
 */

import { describe, it, expect } from "vitest";
import {
  accrueCycleStress,
  applyInstantStress,
  applyKturnStress,
  easeDifficulty,
  INITIAL_STRESS,
  KTURN_STRESS_INSTANT,
  type CycleStressInput,
} from "../../../src/arcade/ArcadeStress";
import {
  flightCapabilitiesOf,
  specialRefusal,
} from "../../../src/arcade/systems/FlightCapabilities";
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

/** Cycles of one maneuver flown from a full, latched bar until released. */
function cyclesToClear(direction: string, speed: number): number {
  let stress = applyInstantStress(INITIAL_STRESS, 1);
  let cycles = 0;
  while (stress.isStressed && cycles < 200) {
    stress = accrueCycleStress(cycle({ stress, direction, speed }));
    cycles += 1;
  }
  return cycles;
}

const secondsOf = (cycles: number): number =>
  (cycles * CYCLE_DURATION_MS) / 1000;

describe("passive stress recovery (no recovery action required)", () => {
  it("clears a full bar in 4-6 s of white flying", () => {
    const seconds = secondsOf(cyclesToClear("bank_left", 2));
    expect(seconds).toBeGreaterThanOrEqual(4);
    expect(seconds).toBeLessThanOrEqual(6);
  });

  it("clears a full bar in 4-6 s of white turns", () => {
    const seconds = secondsOf(cyclesToClear("turn_left", 2));
    expect(seconds).toBeGreaterThanOrEqual(4);
    expect(seconds).toBeLessThanOrEqual(6);
  });

  it("clears faster flying green than white", () => {
    expect(cyclesToClear("straight", 2)).toBeLessThan(
      cyclesToClear("bank_left", 2),
    );
  });

  it("clears a full bar in under 4 s of green flying", () => {
    expect(secondsOf(cyclesToClear("straight", 2))).toBeLessThan(4);
  });

  it("drains the same passive amount for any white maneuver", () => {
    const start = { level: 0.6, isStressed: false };
    const bank = accrueCycleStress(
      cycle({ stress: start, direction: "bank_left" }),
    );
    const turn = accrueCycleStress(
      cycle({ stress: start, direction: "turn_left" }),
    );
    expect(bank.level).toBeCloseTo(turn.level, 9);
    expect(bank.level).toBeLessThan(0.6 - 0.05);
  });

  it("still builds stress on a red cycle", () => {
    const start = { level: 0.2, isStressed: false };
    const after = accrueCycleStress(
      cycle({ stress: start, direction: "turn_left", speed: 3 }),
    );
    expect(after.level).toBeGreaterThan(0.2);
  });

  it("keeps a latched pilot refusing red specials until released", () => {
    const viper = flightCapabilitiesOf("terran_viper");
    let stress = applyKturnStress({ level: 0.4, isStressed: false });
    expect(stress.isStressed).toBe(true);
    let sawRefusal = false;
    for (let i = 0; i < 100 && stress.isStressed; i += 1) {
      sawRefusal ||= specialRefusal(viper, "kturn", stress.isStressed) !== null;
      stress = accrueCycleStress(cycle({ stress, direction: "bank_left" }));
    }
    expect(sawRefusal).toBe(true);
    expect(stress.isStressed).toBe(false);
    expect(specialRefusal(viper, "kturn", stress.isStressed)).toBeNull();
  });

  it("a Snap spike from a calm pilot latches stressed at once", () => {
    expect(applyKturnStress(INITIAL_STRESS).level).toBe(KTURN_STRESS_INSTANT);
    expect(
      applyKturnStress({ level: 0.25, isStressed: false }).isStressed,
    ).toBe(true);
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
