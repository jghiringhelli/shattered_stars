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

  it("charges 5 points per extra real-time hull point", () => {
    expect(deltaFor("interceptor", { hull: 3 })).toBe(5);
  });

  it("charges 8 points per extra real-time shield point", () => {
    expect(deltaFor("interceptor", { shields: 2 })).toBe(8);
  });

  it("charges 10 points per extra point of damage per hit", () => {
    expect(deltaFor("heavy_fighter", { attack: 3 })).toBe(10);
  });

  it("charges 2 points per extra real-time agility die", () => {
    expect(deltaFor("light_fighter", { agility: 4 })).toBe(2);
  });

  it("refunds removed stats at the same rate", () => {
    expect(deltaFor("interceptor", { shields: 0, hull: 1 })).toBe(-13);
  });

  it("charges 4 points per extra top speed", () => {
    expect(deltaFor("bomber", { maxSpeed: 4 })).toBe(4);
  });

  it("charges 2 points per step of lower minimum speed", () => {
    expect(deltaFor("gunship", { minSpeed: 0 })).toBe(2);
  });

  it("charges 4 points per size class up to medium", () => {
    expect(deltaFor("heavy_fighter", { size: "medium" })).toBe(4);
  });

  it("prices a large hull 4 points below a medium one (big hitbox, one attack a cycle)", () => {
    expect(deltaFor("support", { size: "large" })).toBe(-4);
  });

  it("values eleven dial steps like one 4-point stress-relief tier", () => {
    expect(deltaFor("interceptor", { dialSteps: 14 + 11 })).toBeCloseTo(4);
  });

  it("values capital hull and shields at a third of a fighter's", () => {
    expect(deltaFor("capital", { hull: 25 })).toBeCloseTo(5);
    expect(deltaFor("capital", { shields: 15 })).toBeCloseTo(8);
  });

  it("does not scale capital attack", () => {
    expect(deltaFor("capital", { attack: 4 })).toBe(10);
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

  it("charges nothing for a card point that rounds away in real time", () => {
    // Interceptor hull 3 and 4 both fly as 2 real-time hull points (24 HP).
    expect(expectedPointCost("interceptor", stats({ hull: 4 }), dial)).toBe(
      expectedPointCost("interceptor", stats({ hull: 3 }), dial),
    );
  });

  it("charges a card point that adds a real-time point", () => {
    // Interceptor hull 5 flies as 3 real-time hull points (36 HP).
    expect(
      expectedPointCost("interceptor", stats({ hull: 5 }), dial),
    ).toBeGreaterThan(
      expectedPointCost("interceptor", stats({ hull: 4 }), dial),
    );
  });

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
