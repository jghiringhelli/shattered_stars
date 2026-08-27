/**
 * Unit tests for BattleScore — point-cost scoring and timeout tiebreak.
 * Uses real ship ids so shipPointCost resolves against ShipDefinitions.
 */

import { describe, it, expect } from "vitest";
import {
  shipPointCost,
  createSideScore,
  creditKill,
  resolveByPoints,
} from "../../../../src/systems/arena/BattleScore";
import { getShipDefinition } from "../../../../src/data/ShipDefinitions";

describe("shipPointCost", () => {
  it("returns the definition's squad-point cost", () => {
    const def = getShipDefinition("terran_viper")!;
    expect(shipPointCost("terran_viper")).toBe(def.baseStats.pointCost);
  });

  it("returns 0 for an unknown ship id", () => {
    expect(shipPointCost("not_a_real_ship")).toBe(0);
  });
});

describe("creditKill", () => {
  it("adds the destroyed ship's point cost and a kill", () => {
    const score = creditKill(createSideScore(), "terran_viper");
    expect(score.kills).toBe(1);
    expect(score.destroyedPoints).toBe(shipPointCost("terran_viper"));
  });

  it("accumulates across kills", () => {
    let score = createSideScore();
    score = creditKill(score, "terran_viper");
    score = creditKill(score, "terran_stiletto");
    expect(score.kills).toBe(2);
    expect(score.destroyedPoints).toBe(
      shipPointCost("terran_viper") + shipPointCost("terran_stiletto"),
    );
  });
});

describe("resolveByPoints", () => {
  it("awards the side that destroyed more points", () => {
    const side1 = { destroyedPoints: 100, kills: 1 };
    const side2 = { destroyedPoints: 84, kills: 3 };
    expect(resolveByPoints(side1, side2)).toBe("side1");
  });

  it("ignores raw kill count when points differ (miniatures-style)", () => {
    const manyCheapKills = { destroyedPoints: 56, kills: 2 };
    const oneExpensiveKill = { destroyedPoints: 100, kills: 1 };
    expect(resolveByPoints(manyCheapKills, oneExpensiveKill)).toBe("side2");
  });

  it("falls back to kills when points are tied", () => {
    const side1 = { destroyedPoints: 90, kills: 2 };
    const side2 = { destroyedPoints: 90, kills: 1 };
    expect(resolveByPoints(side1, side2)).toBe("side1");
  });

  it("falls back to kills for side2 when points are tied", () => {
    const side1 = { destroyedPoints: 90, kills: 1 };
    const side2 = { destroyedPoints: 90, kills: 3 };
    expect(resolveByPoints(side1, side2)).toBe("side2");
  });

  it("is a draw when points and kills are equal", () => {
    const side1 = { destroyedPoints: 90, kills: 2 };
    const side2 = { destroyedPoints: 90, kills: 2 };
    expect(resolveByPoints(side1, side2)).toBe("draw");
  });
});
