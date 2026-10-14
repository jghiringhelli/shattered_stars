/**
 * Mitigation on small hits — specification tests: a dice-mode hit deals a
 * few points (≈ attack dice), so rounding `damage × mitigation` to the
 * nearest whole number used to swallow every reduction under ~17% (3 × 0.85
 * rounds back to 3: Stealth Device, Psi-Sensitive, Elusive, wingman cover
 * did nothing). The hit is rounded with a dither taken from the shot's own
 * roll, so the AVERAGE damage is exactly damage × mitigation, every hit stays
 * a whole number, and no extra random number is drawn (deterministic sims
 * and lockstep stay in step).
 */

import { describe, it, expect } from "vitest";
import {
  resolveDiceAttack,
  type DiceAttackInput,
} from "../../../../src/arcade/systems/DiceAttack";
import {
  combineEffects,
  type RealtimeEffect,
} from "../../../../src/core/CombatModifiers";
import { INITIAL_STRESS } from "../../../../src/arcade/ArcadeStress";
import type { AbilityCombatant } from "../../../../src/arcade/PilotAbilityCombat";

function combatant(
  id: string,
  effect: RealtimeEffect,
  y: number,
  angle: number,
): AbilityCombatant {
  return {
    id,
    x: 1000,
    y,
    angle,
    hull: 48,
    maxHull: 48,
    shields: 24,
    maxShields: 24,
    stress: INITIAL_STRESS,
    modifiers: combineEffects([effect]),
    frenzyUntilMs: 0,
  };
}

const HIT_CHANCE = 0.6;
/** Rolls sampled evenly across the hitting range [0, HIT_CHANCE). */
const SAMPLES = 1000;

function shot(targetEffect: RealtimeEffect, roll: number): DiceAttackInput {
  return {
    attacker: combatant("a", {}, 1000, 0),
    target: combatant("t", targetEffect, 700, 90),
    hitChance: HIT_CHANCE,
    baseDamage: 3,
    attackerHasWingman: false,
    targetHasWingman: false,
    nowMs: 0,
    roll,
  };
}

function hitDamages(targetEffect: RealtimeEffect): number[] {
  return Array.from(
    { length: SAMPLES },
    (_, k) =>
      resolveDiceAttack(shot(targetEffect, (k / SAMPLES) * HIT_CHANCE)).damage,
  );
}

const mean = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0) / values.length;

describe("damage reduction on small dice-mode hits", () => {
  it.each([0.85, 0.9, 0.95])(
    "a %s damage-taken card lowers the average 3-damage hit proportionally",
    (multiplier) => {
      expect(
        mean(hitDamages({ damageTakenMultiplier: multiplier })),
      ).toBeCloseTo(3 * multiplier, 2);
    },
  );

  it("keeps every hit a whole number of hit points", () => {
    const fractional = hitDamages({ damageTakenMultiplier: 0.85 }).filter(
      (damage) => !Number.isInteger(damage),
    );
    expect(fractional).toEqual([]);
  });

  it("leaves unmitigated hits exactly as rolled", () => {
    expect(new Set(hitDamages({}))).toEqual(new Set([3]));
  });

  it("never reduces a landed hit below 1", () => {
    expect(
      Math.min(...hitDamages({ damageTakenMultiplier: 0.5 }).map((d) => d)),
    ).toBeGreaterThanOrEqual(1);
  });
});
