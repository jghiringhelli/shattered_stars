/**
 * ShotConditions — specification tests for conditional pilot-ability
 * bonuses: close range, behind the target, bullseye, wingman nearby,
 * stressed, damaged and the kill frenzy.
 */

import { describe, it, expect } from "vitest";
import {
  BULLSEYE_HALF_ARC_DEG,
  CLOSE_RANGE_PX,
  conditionalLaserBonus,
  describeShot,
  incomingDamageMultiplier,
  NO_SHOT_CONDITIONS,
  type ShotConditions,
} from "../../../src/arcade/ShotConditions";
import {
  combineEffects,
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  NEUTRAL_MODIFIERS,
} from "../../../src/core/CombatModifiers";

const at = (overrides: Partial<ShotConditions>): ShotConditions => ({
  ...NO_SHOT_CONDITIONS,
  ...overrides,
});

describe("conditionalLaserBonus", () => {
  it("a ship without conditional knobs gets nothing in the best context", () => {
    const best = at({
      closeRange: true,
      behindTarget: true,
      inBullseye: true,
      allyNear: true,
      isStressed: true,
      isDamaged: true,
      frenzyActive: true,
    });
    expect(conditionalLaserBonus(NEUTRAL_MODIFIERS, best)).toBe(0);
  });

  const cases = [
    ["closeRangeLaserBonus", "closeRange"],
    ["rearArcLaserBonus", "behindTarget"],
    ["bullseyeLaserBonus", "inBullseye"],
    ["wingmanLaserBonus", "allyNear"],
    ["stressedLaserBonus", "isStressed"],
    ["damagedLaserBonus", "isDamaged"],
    ["killFrenzyLaserBonus", "frenzyActive"],
  ] as const;
  for (const [knob, condition] of cases) {
    it(`${knob} applies only when ${condition}`, () => {
      const modifiers = combineEffects([{ [knob]: 1 }]);
      expect(conditionalLaserBonus(modifiers, at({ [condition]: true }))).toBe(
        1,
      );
      expect(conditionalLaserBonus(modifiers, NO_SHOT_CONDITIONS)).toBe(0);
    });
  }

  it("bonuses whose conditions all hold stack", () => {
    const modifiers = combineEffects([
      { closeRangeLaserBonus: 1, rearArcLaserBonus: 1 },
    ]);
    expect(
      conditionalLaserBonus(
        modifiers,
        at({ closeRange: true, behindTarget: true }),
      ),
    ).toBe(2);
  });
});

describe("incomingDamageMultiplier", () => {
  const guarded = combineEffects([
    { damageTakenMultiplier: 0.9, wingmanDamageTakenMultiplier: 0.8 },
  ]);

  it("alone, only the unconditional multiplier applies", () => {
    expect(incomingDamageMultiplier(guarded, false)).toBeCloseTo(0.9);
  });

  it("with a wingman near, both multiply", () => {
    expect(incomingDamageMultiplier(guarded, true)).toBeCloseTo(0.72);
  });

  it("never drops below the damage floor", () => {
    const stacked = combineEffects([
      { damageTakenMultiplier: 0.5, wingmanDamageTakenMultiplier: 0.5 },
    ]);
    expect(incomingDamageMultiplier(stacked, true)).toBe(
      MIN_DAMAGE_TAKEN_MULTIPLIER,
    );
  });
});

describe("describeShot — geometry", () => {
  const target = { x: 1000, y: 1000, angle: 0 };

  it("a shooter straight behind the target, nose on it, is behind and in bullseye", () => {
    const shooter = { x: 1000, y: 1000 + CLOSE_RANGE_PX - 10, angle: 0 };
    const shot = describeShot(shooter, target);
    expect(shot.behindTarget).toBe(true);
    expect(shot.inBullseye).toBe(true);
    expect(shot.closeRange).toBe(true);
  });

  it("a head-on shooter is not behind the target", () => {
    const shooter = { x: 1000, y: 800, angle: 180 };
    expect(describeShot(shooter, target).behindTarget).toBe(false);
  });

  it("a target just outside the bullseye half-arc is not in bullseye", () => {
    const rad = ((BULLSEYE_HALF_ARC_DEG + 2) * Math.PI) / 180;
    const shooter = {
      x: 1000 - Math.sin(rad) * 200,
      y: 1000 + Math.cos(rad) * 200,
      angle: 0,
    };
    expect(describeShot(shooter, target).inBullseye).toBe(false);
  });

  it("beyond close range is not close range", () => {
    const shooter = { x: 1000, y: 1000 + CLOSE_RANGE_PX + 10, angle: 0 };
    expect(describeShot(shooter, target).closeRange).toBe(false);
  });
});
