import { describe, it, expect } from "vitest";
import { DURABILITY_SCALE } from "../../../../../src/config";
import {
  HULL_REPAIR_DAMAGE_PAUSE_MS,
  DamagePauseTracker,
  repairStep,
  type RepairStepInput,
} from "../../../../../src/arcade/systems/repair/HullRepair";

const SECOND = 1000;

/**
 * repairStep input with defaults: a damaged ship long out of fire.
 * @param over - Field overrides.
 * @returns The input.
 */
function input(over: Partial<RepairStepInput> = {}): RepairStepInput {
  return {
    hull: 24,
    maxHull: 48,
    shields: 12,
    maxShields: 24,
    shieldRegenPerSecond: 0,
    hullRepairPerSecond: 0,
    deltaMs: SECOND,
    msSinceDamage: HULL_REPAIR_DAMAGE_PAUSE_MS,
    ...over,
  };
}

describe("repairStep", () => {
  it("repairs miniature hull points scaled to real-time HP", () => {
    const after = repairStep(input({ hullRepairPerSecond: 0.1 }));
    expect(after.hull).toBeCloseTo(24 + 0.1 * DURABILITY_SCALE, 10);
  });

  it("never repairs hull above max hull", () => {
    const after = repairStep(input({ hull: 47.9, hullRepairPerSecond: 1 }));
    expect(after.hull).toBe(48);
  });

  it("pauses hull repair right after the ship took damage", () => {
    const after = repairStep(
      input({
        hullRepairPerSecond: 0.1,
        msSinceDamage: HULL_REPAIR_DAMAGE_PAUSE_MS - 1,
      }),
    );
    expect(after.hull).toBe(24);
  });

  it("never revives a destroyed ship", () => {
    const after = repairStep(input({ hull: 0, hullRepairPerSecond: 1 }));
    expect(after.hull).toBe(0);
  });

  it("regenerates shields without the damage pause (existing behaviour)", () => {
    const after = repairStep(
      input({ shieldRegenPerSecond: 0.1, msSinceDamage: 0 }),
    );
    expect(after.shields).toBeCloseTo(12 + 0.1 * DURABILITY_SCALE, 10);
  });

  it("never regenerates shields above max shields", () => {
    const after = repairStep(input({ shields: 23.9, shieldRegenPerSecond: 5 }));
    expect(after.shields).toBe(24);
  });
});

describe("DamagePauseTracker", () => {
  it("treats a newly seen ship as out of fire", () => {
    const tracker = new DamagePauseTracker();
    expect(tracker.observe("a", 10, 5, 16)).toBeGreaterThanOrEqual(
      HULL_REPAIR_DAMAGE_PAUSE_MS,
    );
  });

  it("restarts the quiet timer when hull drops", () => {
    const tracker = new DamagePauseTracker();
    tracker.observe("a", 10, 5, 16);
    expect(tracker.observe("a", 8, 5, 16)).toBe(0);
    expect(tracker.observe("a", 8, 5, 16)).toBe(16);
  });

  it("restarts the quiet timer when shields drop", () => {
    const tracker = new DamagePauseTracker();
    tracker.observe("a", 10, 5, 16);
    expect(tracker.observe("a", 10, 4, 16)).toBe(0);
  });

  it("keeps counting while values hold or grow", () => {
    const tracker = new DamagePauseTracker();
    tracker.observe("a", 10, 5, 16);
    tracker.observe("a", 9, 5, 16);
    tracker.observe("a", 9, 6, 100);
    expect(tracker.observe("a", 9.5, 6, 100)).toBe(200);
  });

  it("peeks a ship's quiet time without advancing it", () => {
    const tracker = new DamagePauseTracker();
    expect(tracker.quietMs("unseen")).toBe(HULL_REPAIR_DAMAGE_PAUSE_MS);
    tracker.observe("a", 10, 5, 16);
    tracker.observe("a", 9, 5, 16);
    tracker.observe("a", 9, 5, 40);
    expect(tracker.quietMs("a")).toBe(40);
    expect(tracker.quietMs("a")).toBe(40);
  });

  it("forgets a ship", () => {
    const tracker = new DamagePauseTracker();
    tracker.observe("a", 10, 5, 16);
    tracker.observe("a", 1, 5, 16);
    tracker.forget("a");
    expect(tracker.observe("a", 1, 5, 16)).toBeGreaterThanOrEqual(
      HULL_REPAIR_DAMAGE_PAUSE_MS,
    );
  });
});
