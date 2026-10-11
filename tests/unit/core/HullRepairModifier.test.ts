import { describe, it, expect } from "vitest";
import {
  NEUTRAL_MODIFIERS,
  combineEffects,
} from "../../../src/core/CombatModifiers";
import { summarizeRealtimeEffect } from "../../../src/data/realtimeEffectSummary";
import { abilityPointValue } from "../../../src/data/abilityPricing";
import { UPGRADE_CATALOG } from "../../../src/data/upgrades";

describe("hullRepairPerSecond modifier knob", () => {
  it("is neutral (0) on a ship with no upgrades", () => {
    expect(NEUTRAL_MODIFIERS.hullRepairPerSecond).toBe(0);
  });

  it("stacks additively across upgrades", () => {
    const sheet = combineEffects([
      { hullRepairPerSecond: 0.05 },
      { hullRepairPerSecond: 0.03 },
    ]);
    expect(sheet.hullRepairPerSecond).toBeCloseTo(0.08, 10);
  });

  it("reads as a hull repair phrase", () => {
    expect(summarizeRealtimeEffect({ hullRepairPerSecond: 0.05 })).toBe(
      "repairs 0.05 hull/s out of fire",
    );
  });

  it("is worth points in the ability price rule", () => {
    expect(abilityPointValue({ hullRepairPerSecond: 0.1 })).toBeGreaterThan(1);
  });
});

describe("hull repair cards", () => {
  it("offers a Mechanic crew card that repairs hull", () => {
    const mechanic = UPGRADE_CATALOG.mechanic;
    expect(mechanic?.slotType).toBe("crew");
    expect(mechanic?.realtime?.hullRepairPerSecond ?? 0).toBeGreaterThan(0);
  });

  it("offers an astromech that patches hull (the R5-style repair droid)", () => {
    const patch = UPGRADE_CATALOG.patch_astromech;
    expect(patch?.slotType).toBe("astromech");
    expect(patch?.realtime?.hullRepairPerSecond ?? 0).toBeGreaterThan(0);
  });

  it("keeps every hull repair card slower than one miniature hull per 10 s", () => {
    const rates = Object.values(UPGRADE_CATALOG)
      .map((card) => card.realtime?.hullRepairPerSecond ?? 0)
      .filter((rate) => rate > 0);
    expect(rates.length).toBeGreaterThanOrEqual(2);
    expect(rates.every((rate) => rate <= 0.1)).toBe(true);
  });
});
