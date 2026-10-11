import { describe, expect, it } from "vitest";
import {
  SCENARIO_DEFINITIONS,
  createScenarioState,
  type PlannerShip,
} from "../../../../src/arcade/scenarios";
import { ScenarioDirector } from "../../../../src/scenes/scenario/ScenarioDirector";

const WORLD = 6000;
const C = WORLD / 2;
const STATE = createScenarioState(
  SCENARIO_DEFINITIONS.chance_engagement,
  WORLD,
);

const ships = (allyY: number): PlannerShip[] => [
  { id: "player_0", side: "player", x: C, y: C + 1400, isHuman: true },
  { id: "ally_0", side: "player", x: C, y: allyY, isHuman: false },
  { id: "enemy_0", side: "enemy", x: C, y: C - 1400, isHuman: false },
];

describe("ScenarioDirector", () => {
  it("plans both sides: each sends a ship to the central objective", () => {
    const director = new ScenarioDirector(WORLD, 250);
    director.update({
      nowMs: 0,
      state: STATE,
      ships: ships(C + 1400),
      markActive: false,
    });
    expect(director.directiveFor("ally_0")?.role).toBe("hold");
    expect(director.directiveFor("enemy_0")?.role).toBe("hold");
    expect(director.directiveFor("player_0")).toBeNull();
  });

  it("steers a far holder to its objective and frees it once inside the leash", () => {
    const director = new ScenarioDirector(WORLD, 250);
    director.update({
      nowMs: 0,
      state: STATE,
      ships: ships(C + 1400),
      markActive: false,
    });
    expect(director.goalFor("ally_0")).toEqual({ x: C, y: C });
    director.update({
      nowMs: 16,
      state: STATE,
      ships: ships(C + 50),
      markActive: false,
    });
    expect(director.goalFor("ally_0")).toBeNull();
  });

  it("re-plans on its cadence, not every tick", () => {
    const director = new ScenarioDirector(WORLD, 250);
    director.update({
      nowMs: 0,
      state: STATE,
      ships: ships(C + 1400),
      markActive: false,
    });
    director.update({
      nowMs: 100,
      state: STATE,
      ships: ships(C + 1400),
      markActive: true,
    });
    expect(director.directiveFor("ally_0")?.role).toBe("hold");
    director.update({
      nowMs: 250,
      state: STATE,
      ships: ships(C + 1400),
      markActive: true,
    });
    expect(director.directiveFor("ally_0")?.role).toBe("screen");
  });
});
