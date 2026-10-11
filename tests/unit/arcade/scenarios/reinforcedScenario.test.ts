import { describe, expect, it } from "vitest";
import {
  REINFORCED_SCENARIO_POINTS_PER_SQUAD_POINT,
  REINFORCED_SCENARIO_THRESHOLDS,
  SCENARIO_DEFINITIONS,
  SCENARIO_IDS,
  createScenarioState,
  reinforcedScenarioDefinition,
  scenarioShipValue,
  stepScenario,
} from "../../../../src/arcade/scenarios";
import {
  REINFORCED_TIME_LIMIT_MS,
  DEFAULT_POOL_POINTS,
} from "../../../../src/arcade/reinforcements";
import { aFrame, aShip } from "./scenarioBuilders";

describe("reinforced scenario variant", () => {
  const base = SCENARIO_DEFINITIONS.satellite_array;
  const reinforced = reinforcedScenarioDefinition(base);

  it("plays every scenario to a higher threshold within the 3-minute limit", () => {
    for (const id of SCENARIO_IDS) {
      const variant = reinforcedScenarioDefinition(SCENARIO_DEFINITIONS[id]);
      expect(variant.threshold).toBe(REINFORCED_SCENARIO_THRESHOLDS[id]);
      expect(variant.threshold).toBeGreaterThan(
        SCENARIO_DEFINITIONS[id].threshold,
      );
      expect(variant.timeLimitMs).toBe(REINFORCED_TIME_LIMIT_MS);
    }
    expect(reinforced.id).toBe(base.id);
    expect(reinforced.slots).toEqual(base.slots);
  });

  it("scrambled nodes and carried crates keep scoring, so those play to more", () => {
    expect(REINFORCED_SCENARIO_THRESHOLDS.salvage_mission).toBeGreaterThan(
      REINFORCED_SCENARIO_THRESHOLDS.satellite_array,
    );
    expect(
      REINFORCED_SCENARIO_THRESHOLDS.scramble_transmissions,
    ).toBeGreaterThan(REINFORCED_SCENARIO_THRESHOLDS.satellite_array);
  });

  it("values ships against the pool: a 50-point ship is worth 2", () => {
    expect(reinforced.pointsPerSquadPoint).toBe(
      REINFORCED_SCENARIO_POINTS_PER_SQUAD_POINT,
    );
    expect(
      scenarioShipValue(50, REINFORCED_SCENARIO_POINTS_PER_SQUAD_POINT),
    ).toBe(2);
    expect(
      REINFORCED_SCENARIO_POINTS_PER_SQUAD_POINT * DEFAULT_POOL_POINTS,
    ).toBe(40);
  });

  it("scenario ship values follow the given rate (default: the classic one)", () => {
    expect(scenarioShipValue(50)).toBe(5);
    expect(
      scenarioShipValue(50, REINFORCED_SCENARIO_POINTS_PER_SQUAD_POINT),
    ).toBe(
      Math.max(1, Math.round(50 * REINFORCED_SCENARIO_POINTS_PER_SQUAD_POINT)),
    );
  });

  it("a side with no ship alive but reinforcements left is not annihilated", () => {
    const state = createScenarioState(reinforced, 0);
    const next = stepScenario(state, {
      ...aFrame([aShip({ side: "player" })]),
      reserves: { player: true, enemy: true },
    });
    expect(next.result).toBeNull();
  });

  it("a side with no ship alive and no reinforcements left loses", () => {
    const state = createScenarioState(reinforced, 0);
    const next = stepScenario(state, {
      ...aFrame([aShip({ side: "player" })]),
      reserves: { player: true, enemy: false },
    });
    expect(next.result).toMatchObject({
      winner: "player",
      reason: "annihilation",
    });
  });
});
