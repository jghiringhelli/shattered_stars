import { describe, it, expect } from "vitest";
import {
  AI_OPTIMAL_CHANCE,
  canHullKTurn,
  chooseAiHeadingError,
  closestPoint,
  ESCORT_OPTIMAL_CHANCE,
  planDuelSteer,
  seekSteerOrder,
  SUBOPTIMAL_HEADING_ERRORS_DEG,
  type DuelSteerInput,
} from "../../../../src/arcade/systems/AiPursuit";
import {
  createCycleFlight,
  pursuitSpeed,
} from "../../../../src/arcade/systems/CycleFlight";

const FIGHTER_ID = "terran_viper";
const CAPITAL_ID = "terran_imperator";
const NORTH_FACING = { x: 3000, y: 3000, angle: 0 };
const TARGET_DISTANCE_PX = 500;

describe("canHullKTurn", () => {
  it("allows fighters to K-turn", () => {
    expect(canHullKTurn(FIGHTER_ID)).toBe(true);
  });

  it("forbids capital ships from K-turning", () => {
    expect(canHullKTurn(CAPITAL_ID)).toBe(false);
  });
});

describe("seekSteerOrder", () => {
  const flight = createCycleFlight(FIGHTER_ID, NORTH_FACING);

  it("reports a target to the right as a positive heading error", () => {
    const order = seekSteerOrder({
      flight,
      target: { x: NORTH_FACING.x + TARGET_DISTANCE_PX, y: NORTH_FACING.y },
      cycleCommitted: false,
      allowKTurn: true,
    });
    expect(order.headingErrorDeg).toBeCloseTo(90);
  });

  it("reports a target to the left as a negative heading error", () => {
    const order = seekSteerOrder({
      flight,
      target: { x: NORTH_FACING.x - TARGET_DISTANCE_PX, y: NORTH_FACING.y },
      cycleCommitted: false,
      allowKTurn: true,
    });
    expect(order.headingErrorDeg).toBeCloseTo(-90);
  });

  it("asks for the pursuit speed matching the heading error", () => {
    const target = {
      x: NORTH_FACING.x,
      y: NORTH_FACING.y + TARGET_DISTANCE_PX,
    };
    const order = seekSteerOrder({
      flight,
      target,
      cycleCommitted: false,
      allowKTurn: true,
    });
    expect(order.desiredSpeed).toBe(
      pursuitSpeed(flight.motion.control, order.headingErrorDeg),
    );
  });

  it("passes cycle timing and K-turn permission through", () => {
    const order = seekSteerOrder({
      flight,
      target: { x: NORTH_FACING.x, y: NORTH_FACING.y - TARGET_DISTANCE_PX },
      cycleCommitted: true,
      allowKTurn: false,
    });
    expect(order.cycleCommitted).toBe(true);
    expect(order.allowKTurn).toBe(false);
  });
});

const facingUp = { x: 0, y: 0, angle: 0 };
const targetToTheRight = { x: 100, y: 0 };

/** Random source that replays the given rolls in order. */
const scripted = (...rolls: number[]): (() => number) => {
  let index = 0;
  return () => rolls[index++] ?? 0;
};

const steerInput = (overrides: Partial<DuelSteerInput>): DuelSteerInput => ({
  ship: facingUp,
  target: targetToTheRight,
  owner: "ai",
  difficulty: "normal",
  random: scripted(0),
  ...overrides,
});

describe("closestPoint", () => {
  it("returns_null_when_there_are_no_candidates", () => {
    expect(closestPoint({ x: 0, y: 0 }, [])).toBeNull();
  });

  it("returns_the_nearest_candidate", () => {
    const near = { x: 10, y: 10 };
    const far = { x: 300, y: -40 };
    expect(closestPoint({ x: 0, y: 0 }, [far, near])).toBe(near);
  });
});

describe("planDuelSteer", () => {
  it("steers_by_the_true_error_when_the_optimal_roll_succeeds", () => {
    const plan = planDuelSteer(steerInput({ random: scripted(0) }));
    expect(plan.trueErrorDeg).toBeCloseTo(90);
    expect(plan.headingErrorDeg).toBeCloseTo(90);
  });

  it("steers_by_a_sloppy_error_when_the_optimal_roll_fails", () => {
    const failRoll = AI_OPTIMAL_CHANCE.normal;
    const plan = planDuelSteer(steerInput({ random: scripted(failRoll, 0) }));
    expect(plan.headingErrorDeg).toBe(SUBOPTIMAL_HEADING_ERRORS_DEG[0]);
    expect(plan.trueErrorDeg).toBeCloseTo(90);
  });

  it("uses_the_escort_rate_for_player_side_ships_regardless_of_difficulty", () => {
    const justUnderEscortRate = ESCORT_OPTIMAL_CHANCE - 0.01;
    const plan = planDuelSteer(
      steerInput({
        owner: "player",
        difficulty: "easy",
        random: scripted(justUnderEscortRate),
      }),
    );
    expect(plan.headingErrorDeg).toBeCloseTo(90);
  });

  it("always_flies_optimally_on_brutal", () => {
    const plan = planDuelSteer(
      steerInput({ difficulty: "brutal", random: scripted(0.999, 0) }),
    );
    expect(plan.headingErrorDeg).toBeCloseTo(90);
  });

  it("forbids_k_turns_only_for_easy_enemies", () => {
    expect(planDuelSteer(steerInput({ difficulty: "easy" })).allowKTurn).toBe(
      false,
    );
    expect(planDuelSteer(steerInput({ difficulty: "hard" })).allowKTurn).toBe(
      true,
    );
    expect(
      planDuelSteer(steerInput({ owner: "player", difficulty: "easy" }))
        .allowKTurn,
    ).toBe(true);
  });
});

describe("chooseAiHeadingError", () => {
  it("returns_the_true_error_when_flying_optimally", () => {
    expect(chooseAiHeadingError(73, true, 0.5)).toBe(73);
  });

  it("picks_from_a_custom_spread_when_misjudging", () => {
    expect(chooseAiHeadingError(73, false, 0.99, [-90, 90])).toBe(90);
  });
});
