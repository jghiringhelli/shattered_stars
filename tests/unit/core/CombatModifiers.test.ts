import { describe, it, expect } from "vitest";
import {
  combineEffects,
  laserDamageWithModifiers,
  NEUTRAL_MODIFIERS,
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  MIN_COOLDOWN_MULTIPLIER,
  MIN_STRESS_RATE_MULTIPLIER,
  MAX_STRESS_RELIEF_TIERS,
} from "../../../src/core/CombatModifiers";

describe("combineEffects", () => {
  it("returns the neutral sheet when no upgrade is equipped", () => {
    expect(combineEffects([])).toEqual(NEUTRAL_MODIFIERS);
  });

  it("sums additive bonuses across upgrades", () => {
    const sheet = combineEffects([
      { laserDamageBonus: 1 },
      { laserDamageBonus: 1, ordnanceBonusCharges: 1 },
    ]);
    expect(sheet.laserDamageBonus).toBe(2);
    expect(sheet.ordnanceBonusCharges).toBe(1);
  });

  it("multiplies multiplicative modifiers across upgrades", () => {
    const sheet = combineEffects([
      { boostCooldownMultiplier: 0.8 },
      { boostCooldownMultiplier: 0.75 },
    ]);
    expect(sheet.boostCooldownMultiplier).toBeCloseTo(0.6);
  });

  it("projects an aura when any upgrade projects one", () => {
    const sheet = combineEffects([
      { laserDamageBonus: 1 },
      { projectsAura: true },
    ]);
    expect(sheet.projectsAura).toBe(true);
  });

  it("never lets stacked damage reduction go below the floor", () => {
    const sheet = combineEffects([
      { damageTakenMultiplier: 0.5 },
      { damageTakenMultiplier: 0.5 },
    ]);
    expect(sheet.damageTakenMultiplier).toBe(MIN_DAMAGE_TAKEN_MULTIPLIER);
  });

  it("never lets stacked cooldown reduction go below the floor", () => {
    const sheet = combineEffects([
      { kturnCooldownMultiplier: 0.5 },
      { kturnCooldownMultiplier: 0.5 },
    ]);
    expect(sheet.kturnCooldownMultiplier).toBe(MIN_COOLDOWN_MULTIPLIER);
  });

  it("never lets stacked stress reduction go below the floor", () => {
    const sheet = combineEffects([
      { stressRateMultiplier: 0.6 },
      { stressRateMultiplier: 0.6 },
    ]);
    expect(sheet.stressRateMultiplier).toBe(MIN_STRESS_RATE_MULTIPLIER);
  });

  it("caps stress relief at two tiers", () => {
    const sheet = combineEffects([
      { stressReliefTiers: 1 },
      { stressReliefTiers: 1 },
      { stressReliefTiers: 1 },
    ]);
    expect(sheet.stressReliefTiers).toBe(MAX_STRESS_RELIEF_TIERS);
  });

  it("keeps drawbacks above 1 instead of clamping them away", () => {
    const sheet = combineEffects([{ damageTakenMultiplier: 1.15 }]);
    expect(sheet.damageTakenMultiplier).toBeCloseTo(1.15);
  });
});

describe("laserDamageWithModifiers", () => {
  it("adds the flat laser bonus", () => {
    const sheet = combineEffects([{ laserDamageBonus: 1 }]);
    expect(laserDamageWithModifiers(2, sheet, false)).toBe(3);
  });

  it("adds the calm bonus only while the pilot is unstressed", () => {
    const sheet = combineEffects([{ calmLaserDamageBonus: 1 }]);
    expect(laserDamageWithModifiers(2, sheet, false)).toBe(3);
    expect(laserDamageWithModifiers(2, sheet, true)).toBe(2);
  });
});
