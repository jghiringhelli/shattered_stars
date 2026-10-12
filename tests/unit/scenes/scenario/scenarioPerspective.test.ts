import { describe, expect, it } from "vitest";
import {
  SCENARIO_DEFINITIONS,
  SCENARIO_IDS,
  createScenarioState,
  type ScenarioState,
} from "../../../../src/arcade/scenarios";
import { scenarioFromSide } from "../../../../src/scenes/scenario/scenarioPerspective";

const base = createScenarioState(SCENARIO_DEFINITIONS[SCENARIO_IDS[0]!], 4000);
const scored: ScenarioState = {
  ...base,
  points: {
    player: { objective: 3, destruction: 1 },
    enemy: { objective: 0, destruction: 5 },
  },
  zones: base.zones.map((z, i) => ({
    ...z,
    controller: i === 0 ? "player" : z.controller,
  })),
};

describe("scenarioFromSide", () => {
  it("leaves the player side's view as it is", () => {
    expect(scenarioFromSide(scored, "player")).toBe(scored);
  });

  it("swaps the points and objective owners for the other side", () => {
    const view = scenarioFromSide(scored, "enemy");
    expect(view.points.player).toEqual({ objective: 0, destruction: 5 });
    expect(view.points.enemy).toEqual({ objective: 3, destruction: 1 });
    if (view.zones[0]) expect(view.zones[0].controller).toBe("enemy");
  });

  it("swaps the result's winner", () => {
    const won: ScenarioState = {
      ...scored,
      result: {
        winner: "player",
        reason: "threshold",
        points: scored.points,
        rounds: 3,
        elapsedMs: 1000,
      } as ScenarioState["result"],
    };
    expect(scenarioFromSide(won, "enemy").result?.winner).toBe("enemy");
  });
});
