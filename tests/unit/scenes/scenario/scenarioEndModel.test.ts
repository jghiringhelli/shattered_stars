import { describe, expect, it } from "vitest";
import {
  SCENARIO_DEFINITIONS,
  type ScenarioResult,
} from "../../../../src/arcade/scenarios";
import { endSummary } from "../../../../src/scenes/scenario/scenarioEndModel";

const DEF = SCENARIO_DEFINITIONS.satellite_array;

function result(overrides: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    winner: "player",
    reason: "threshold",
    points: {
      player: { objective: 12, destruction: 8 },
      enemy: { objective: 7, destruction: 5 },
    },
    rounds: 14,
    elapsedMs: 44_000,
    ...overrides,
  };
}

describe("endSummary", () => {
  it("a win at the threshold names the scenario and the threshold", () => {
    const summary = endSummary(result(), DEF);
    expect(summary).toMatchObject({
      outcome: "victory",
      headline: "VICTORY",
      scenarioName: "Assault at the Satellite Array",
      reason: "First to 20 points",
    });
  });

  it("breaks the score down by objectives, destruction and total", () => {
    expect(endSummary(result(), DEF).rows).toEqual([
      { label: "OBJECTIVES", player: "12", enemy: "7" },
      { label: "DESTRUCTION", player: "8", enemy: "5" },
      { label: "TOTAL", player: "20", enemy: "12" },
    ]);
  });

  it("reports the rounds played and the match time", () => {
    expect(endSummary(result(), DEF).footer).toBe("14 ROUNDS  ·  0:44");
  });

  it("a loss on annihilation says the fleet was destroyed", () => {
    const summary = endSummary(
      result({ winner: "enemy", reason: "annihilation" }),
      DEF,
    );
    expect(summary).toMatchObject({ outcome: "defeat", headline: "DEFEATED" });
    expect(summary.reason).toContain("fleet was destroyed");
  });

  it("a dead heat at the time limit is a draw", () => {
    const summary = endSummary(result({ winner: "draw", reason: "time" }), DEF);
    expect(summary).toMatchObject({ outcome: "draw", headline: "DRAW" });
    expect(summary.reason).toContain("Time limit");
  });
});
