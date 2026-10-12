/**
 * SurvivalBelt — Survival's asteroid belt per squeeze: still denser every
 * wave, but its real-time damage is capped (ADR-0004 fairness pass: the old
 * belt dealt up to 36 HP/s on an unsqueezed belt and more on tight ones).
 */

import { describe, it, expect } from "vitest";
import { realTimeBeltDamage } from "../../../../src/arcade/systems/SurvivalDurability";
import { beltDamagePerSecond } from "../../../../src/systems/arena/ArenaBoundary";
import { MAX_BELT_STEPS } from "../../../../src/systems/survival/CombatNodePlan";
import {
  SURVIVAL_BELT_MAX_REAL_DPS,
  survivalBelt,
} from "../../../../src/systems/survival/SurvivalBelt";

/** Peak real-time damage of the belt before the fairness pass (HP/s). */
const OLD_UNSQUEEZED_PEAK_HP_PER_S = 36;
/** Squeezes a battle can reach: the node's start plus a boss node's waves. */
const DEEPEST_SQUEEZE = MAX_BELT_STEPS + 3;

function peakRealDps(steps: number): number {
  const belt = survivalBelt(steps);
  return realTimeBeltDamage(beltDamagePerSecond(belt.wallRadius, belt));
}

describe("survivalBelt", () => {
  it("caps the real-time damage at a third of the old peak", () => {
    expect(SURVIVAL_BELT_MAX_REAL_DPS).toBeCloseTo(
      OLD_UNSQUEEZED_PEAK_HP_PER_S / 3,
    );
  });

  it("never deals more than the cap at any squeeze", () => {
    for (let steps = 0; steps <= DEEPEST_SQUEEZE; steps++) {
      expect(peakRealDps(steps)).toBeLessThanOrEqual(
        SURVIVAL_BELT_MAX_REAL_DPS + 1e-9,
      );
    }
  });

  it("reaches the cap on the tightest belts", () => {
    expect(peakRealDps(DEEPEST_SQUEEZE)).toBeCloseTo(
      SURVIVAL_BELT_MAX_REAL_DPS,
    );
  });

  it("gets denser every squeeze: damage never drops, the safe zone shrinks", () => {
    for (let steps = 1; steps <= DEEPEST_SQUEEZE; steps++) {
      expect(peakRealDps(steps)).toBeGreaterThanOrEqual(peakRealDps(steps - 1));
      expect(survivalBelt(steps).safeRadius).toBeLessThanOrEqual(
        survivalBelt(steps - 1).safeRadius,
      );
    }
    expect(peakRealDps(1)).toBeGreaterThan(peakRealDps(0));
    expect(survivalBelt(1).safeRadius).toBeLessThan(survivalBelt(0).safeRadius);
  });
});
