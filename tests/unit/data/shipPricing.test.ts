import { describe, it, expect } from "vitest";
import type {
  ManeuverDefinition,
  ShipRole,
  ShipStats,
} from "../../../src/core/types";
import {
  ROLE_ANCHORS,
  expectedPointCost,
  priceBreakdown,
  priceTolerance,
  type PricingProfile,
} from "../../../src/data/shipPricing";

/** A role's anchor profile with a few levers overridden. */
function profileFor(
  role: ShipRole,
  overrides: Partial<PricingProfile> = {},
): PricingProfile {
  return { ...ROLE_ANCHORS[role].profile, ...overrides };
}

/** Price delta of a profile against its role anchor. */
function deltaFor(role: ShipRole, overrides: Partial<PricingProfile>): number {
  return (
    priceBreakdown(role, profileFor(role, overrides)).total -
    ROLE_ANCHORS[role].pointCost
  );
}

/** Bare stats with sensible defaults; tests set only what matters. */
function stats(overrides: Partial<ShipStats> = {}): ShipStats {
  return {
    hull: 3,
    shields: 2,
    attack: 3,
    agility: 3,
    speed: { min: 1, max: 5 },
    size: "small",
    actions: ["focus"],
    pointCost: 0,
    ...overrides,
  };
}

const STRAIGHT_1_GREEN: ManeuverDefinition = {
  direction: "straight",
  speed: 1,
  difficulty: "green",
};

describe("priceBreakdown", () => {
  it.each(Object.keys(ROLE_ANCHORS) as ShipRole[])(
    "prices the %s anchor at the anchor price",
    (role) => {
      expect(priceBreakdown(role, profileFor(role)).total).toBe(
        ROLE_ANCHORS[role].pointCost,
      );
    },
  );

  it("charges 3 points per extra hull", () => {
    expect(deltaFor("interceptor", { hull: 4 })).toBe(3);
  });

  it("charges 4 points per extra shield", () => {
    expect(deltaFor("interceptor", { shields: 3 })).toBe(4);
  });

  it("charges 5 points per extra attack die", () => {
    expect(deltaFor("heavy_fighter", { attack: 4 })).toBe(5);
  });

  it("charges 4 points per extra agility die", () => {
    expect(deltaFor("light_fighter", { agility: 4 })).toBe(4);
  });

  it("refunds removed stats at the same rate", () => {
    expect(deltaFor("interceptor", { shields: 1, hull: 2 })).toBe(-7);
  });

  it("charges 4 points per extra top speed", () => {
    expect(deltaFor("bomber", { maxSpeed: 4 })).toBe(4);
  });

  it("charges 2 points per step of lower minimum speed", () => {
    expect(deltaFor("gunship", { minSpeed: 0 })).toBe(2);
  });

  it("charges 4 points per size class", () => {
    expect(deltaFor("support", { size: "large" })).toBe(4);
  });

  it("values eleven dial steps like one 4-point stress-relief tier", () => {
    expect(deltaFor("interceptor", { dialSteps: 13 + 11 })).toBeCloseTo(4);
  });

  it("values capital hull and shields at a third of a fighter's", () => {
    expect(deltaFor("capital", { hull: 39 })).toBeCloseTo(3);
    expect(deltaFor("capital", { shields: 27 })).toBeCloseTo(4);
  });

  it("does not scale capital attack", () => {
    expect(deltaFor("capital", { attack: 6 })).toBe(5);
  });

  it("prices each role against its own anchor", () => {
    const profile = ROLE_ANCHORS.interceptor.profile;
    expect(priceBreakdown("interceptor", profile).total).not.toBe(
      priceBreakdown("bomber", profile).total,
    );
  });
});

describe("expectedPointCost", () => {
  const dial: ManeuverDefinition[] = [STRAIGHT_1_GREEN];

  it("rounds the breakdown to whole points", () => {
    const value = expectedPointCost("interceptor", stats(), dial);
    expect(Number.isInteger(value)).toBe(true);
  });

  it("ignores the action list (actions have no real-time effect)", () => {
    const plain = stats({ actions: ["focus"] });
    const loaded = stats({
      actions: ["focus", "boost", "barrel_roll", "cloak"],
    });
    expect(expectedPointCost("interceptor", loaded, dial)).toBe(
      expectedPointCost("interceptor", plain, dial),
    );
  });

  it("charges a greener dial more than a harsher one", () => {
    const green: ManeuverDefinition[] = [
      STRAIGHT_1_GREEN,
      { direction: "bank_left", speed: 1, difficulty: "green" },
      { direction: "turn_left", speed: 1, difficulty: "green" },
      { direction: "straight", speed: 2, difficulty: "green" },
      { direction: "bank_left", speed: 2, difficulty: "green" },
      { direction: "turn_left", speed: 2, difficulty: "green" },
    ];
    expect(expectedPointCost("interceptor", stats(), green)).toBeGreaterThan(
      expectedPointCost("interceptor", stats(), dial),
    );
  });
});

describe("priceTolerance", () => {
  it("allows 3 points on small hulls", () => {
    expect(priceTolerance(25)).toBe(3);
  });

  it("allows 5% on big hulls", () => {
    expect(priceTolerance(120)).toBe(6);
  });
});
