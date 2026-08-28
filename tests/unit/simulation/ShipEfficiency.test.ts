/**
 * Unit tests for ShipEfficiency — deterministic point-value analysis.
 */

import { describe, it, expect } from "vitest";
import type { ShipDefinition } from "../../../src/core/types";
import {
  computeShipValue,
  rankShipsByEfficiency,
  flagCostOutliers,
  type ShipValue,
} from "../../../src/simulation/ShipEfficiency";

function makeDef(
  id: string,
  overrides: Partial<ShipDefinition["baseStats"]> = {},
  role: ShipDefinition["role"] = "heavy_fighter",
): ShipDefinition {
  return {
    id,
    name: id,
    faction: "terran_hegemony",
    role,
    spriteKey: id,
    description: "",
    baseStats: {
      hull: 4,
      shields: 2,
      attack: 3,
      agility: 2,
      speed: { min: 1, max: 4 },
      size: "small",
      actions: [],
      pointCost: 40,
      ...overrides,
    },
  };
}

describe("computeShipValue", () => {
  it("gives higher offense to ships with more attack dice", () => {
    const weak = computeShipValue(makeDef("weak", { attack: 2 }));
    const strong = computeShipValue(makeDef("strong", { attack: 4 }));
    expect(strong.offense).toBeGreaterThan(weak.offense);
  });

  it("rewards agility with higher effective durability", () => {
    const nimble = computeShipValue(makeDef("nimble", { agility: 3 }));
    const clumsy = computeShipValue(makeDef("clumsy", { agility: 0 }));
    expect(nimble.durability).toBeGreaterThan(clumsy.durability);
  });

  it("lowers rating-per-point as point cost rises for identical stats", () => {
    const cheap = computeShipValue(makeDef("cheap", { pointCost: 20 }));
    const pricey = computeShipValue(makeDef("pricey", { pointCost: 80 }));
    expect(cheap.ratingPerPoint).toBeGreaterThan(pricey.ratingPerPoint);
  });

  it("handles a zero point cost without dividing by zero", () => {
    const v = computeShipValue(makeDef("free", { pointCost: 0 }));
    expect(v.ratingPerPoint).toBe(0);
  });
});

describe("rankShipsByEfficiency", () => {
  it("sorts by rating-per-point descending", () => {
    const defs = [
      makeDef("a", { pointCost: 80 }),
      makeDef("b", { pointCost: 20 }),
      makeDef("c", { pointCost: 50 }),
    ];
    const ranked = rankShipsByEfficiency(defs);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.ratingPerPoint).toBeGreaterThanOrEqual(
        ranked[i]!.ratingPerPoint,
      );
    }
  });
});

describe("flagCostOutliers", () => {
  it("flags an oversized-value ship as under-costed within its role", () => {
    const defs: ShipDefinition[] = [];
    for (let i = 0; i < 6; i++) {
      defs.push(makeDef(`baseline_${i}`, { pointCost: 40 }));
    }
    // Same combat stats, a fraction of the cost => hugely under-costed.
    defs.push(makeDef("bargain", { pointCost: 5 }));
    const values = defs.map(computeShipValue);
    const report = flagCostOutliers(values, 1.5);
    expect(report.underCosted.some((v: ShipValue) => v.id === "bargain")).toBe(
      true,
    );
  });

  it("flags an overpriced ship as over-costed within its role", () => {
    const defs: ShipDefinition[] = [];
    for (let i = 0; i < 6; i++) {
      defs.push(makeDef(`baseline_${i}`, { pointCost: 40 }));
    }
    defs.push(makeDef("ripoff", { pointCost: 400 }));
    const values = defs.map(computeShipValue);
    const report = flagCostOutliers(values, 1.5);
    expect(report.overCosted.some((v: ShipValue) => v.id === "ripoff")).toBe(
      true,
    );
  });

  it("does not flag anything when a role has too few ships", () => {
    const values = [makeDef("solo", {}, "capital")].map(computeShipValue);
    const report = flagCostOutliers(values);
    expect(report.overCosted.length).toBe(0);
    expect(report.underCosted.length).toBe(0);
  });
});
