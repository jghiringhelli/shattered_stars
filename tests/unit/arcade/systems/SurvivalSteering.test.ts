import { describe, it, expect } from "vitest";
import {
  ENEMY_KTURN_UNLOCK_WAVE,
  MAX_ESCORT_SPEED_BONUS,
  survivalSteerOrder,
  type SurvivalSteerInput,
} from "../../../../src/arcade/systems/SurvivalSteering";
import { pursuitSpeed } from "../../../../src/arcade/systems/CycleFlight";

const CONTROL = { minSpeed: 1, maxSpeed: 5 } as const;
const CRUISE_SPEED = pursuitSpeed(CONTROL, 0);

/** A ship at the origin facing up (0°) chasing a target straight ahead. */
function input(
  overrides: Partial<SurvivalSteerInput> = {},
): SurvivalSteerInput {
  return {
    role: "enemy",
    pose: { x: 0, y: 0, angle: 0 },
    target: { x: 0, y: -500 },
    control: CONTROL,
    cycleCommitted: false,
    wave: 1,
    speedBonus: 0,
    ...overrides,
  };
}

describe("survivalSteerOrder", () => {
  it("reports zero heading error for a target dead ahead", () => {
    expect(survivalSteerOrder(input()).headingErrorDeg).toBeCloseTo(0);
  });

  it("reports a positive heading error for a target to the right", () => {
    const order = survivalSteerOrder(input({ target: { x: 500, y: 0 } }));
    expect(order.headingErrorDeg).toBeCloseTo(90);
  });

  it("reports a negative heading error for a target to the left", () => {
    const order = survivalSteerOrder(input({ target: { x: -500, y: 0 } }));
    expect(order.headingErrorDeg).toBeCloseTo(-90);
  });

  it("passes the cycle-commit flag through", () => {
    const order = survivalSteerOrder(input({ cycleCommitted: true }));
    expect(order.cycleCommitted).toBe(true);
  });

  it("cruises an enemy lined up on its target", () => {
    expect(survivalSteerOrder(input()).desiredSpeed).toBe(CRUISE_SPEED);
  });

  it("slows an enemy down to turn onto a target well off the nose", () => {
    const order = survivalSteerOrder(input({ target: { x: 500, y: 0 } }));
    expect(order.desiredSpeed).toBe(CONTROL.minSpeed);
  });

  it("ignores the speed bonus for enemies", () => {
    expect(survivalSteerOrder(input({ speedBonus: 2 })).desiredSpeed).toBe(
      CRUISE_SPEED,
    );
  });

  it("adds the whole-point speed bonus to a lined-up escort", () => {
    const order = survivalSteerOrder(
      input({ role: "escort", speedBonus: 1.7 }),
    );
    expect(order.desiredSpeed).toBe(CRUISE_SPEED + 1);
  });

  it("caps an escort's speed at its maximum", () => {
    const order = survivalSteerOrder(
      input({ role: "escort", speedBonus: MAX_ESCORT_SPEED_BONUS + 10 }),
    );
    expect(order.desiredSpeed).toBe(CONTROL.maxSpeed);
  });

  it("still slows a turning escort to minimum despite its bonus", () => {
    const order = survivalSteerOrder(
      input({ role: "escort", speedBonus: 3, target: { x: 500, y: 0 } }),
    );
    expect(order.desiredSpeed).toBe(CONTROL.minSpeed);
  });

  it("forbids enemy K-turns before the unlock wave", () => {
    const order = survivalSteerOrder(
      input({ wave: ENEMY_KTURN_UNLOCK_WAVE - 1 }),
    );
    expect(order.allowKTurn).toBe(false);
  });

  it("allows enemy K-turns from the unlock wave on", () => {
    const order = survivalSteerOrder(input({ wave: ENEMY_KTURN_UNLOCK_WAVE }));
    expect(order.allowKTurn).toBe(true);
  });

  it("never lets escorts K-turn", () => {
    const order = survivalSteerOrder(
      input({ role: "escort", wave: ENEMY_KTURN_UNLOCK_WAVE + 10 }),
    );
    expect(order.allowKTurn).toBe(false);
  });
});
