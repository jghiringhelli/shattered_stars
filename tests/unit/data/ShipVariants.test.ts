/**
 * Gate: every ship variant plays differently and is priced consistently.
 *
 * Same-chassis variants across factions used to be reskins — identical
 * stats at different prices, or a cheaper copy that was strictly better.
 * These invariants are judged only on levers that weigh in real-time play
 * (docs/specs/ship-variants.md); action lists are flavour and never count.
 */

import { describe, it, expect } from "vitest";
import type { ShipDefinition } from "../../../src/core/types";
import {
  SHIP_DEFINITIONS,
  SHIP_DIALS,
} from "../../../src/data/ShipDefinitions";
import {
  ROLE_ANCHORS,
  expectedPointCost,
  pricingProfile,
  priceTolerance,
  type PricingProfile,
} from "../../../src/data/shipPricing";
import { atLeastAsGood, leversOf, sameLevers } from "./shipVariantLevers";

const SHIPS: readonly ShipDefinition[] = Object.values(SHIP_DEFINITIONS);

/** Every ordered pair of distinct ships sharing a role. */
function sameRolePairs(): Array<[ShipDefinition, ShipDefinition]> {
  return SHIPS.flatMap((a) =>
    SHIPS.filter((b) => b.id !== a.id && b.role === a.role).map(
      (b): [ShipDefinition, ShipDefinition] => [a, b],
    ),
  );
}

/** The heuristic price of a ship. */
function expectedFor(ship: ShipDefinition): number {
  return expectedPointCost(ship.role, ship.baseStats, SHIP_DIALS[ship.id]!);
}

describe("ship variants", () => {
  it("never ships two variants of a role that play identically", () => {
    const twins = sameRolePairs()
      .filter(([a, b]) => a.id < b.id && sameLevers(leversOf(a), leversOf(b)))
      .map(([a, b]) => `${a.id} == ${b.id}`);
    expect(twins).toEqual([]);
  });

  it("never sells a variant that matches or beats another for no more points", () => {
    const dominated = sameRolePairs()
      .filter(([a, b]) => {
        const levers = leversOf(a);
        const other = leversOf(b);
        return (
          !sameLevers(levers, other) &&
          atLeastAsGood(levers, other) &&
          a.baseStats.pointCost <= b.baseStats.pointCost
        );
      })
      .map(
        ([a, b]) =>
          `${a.id} (${a.baseStats.pointCost}) >= ${b.id} (${b.baseStats.pointCost})`,
      );
    expect(dominated).toEqual([]);
  });

  it("prices every ship within tolerance of the heuristic", () => {
    const drifted = SHIPS.filter((ship) => {
      const expected = expectedFor(ship);
      return (
        Math.abs(ship.baseStats.pointCost - expected) > priceTolerance(expected)
      );
    }).map(
      (ship) =>
        `${ship.id} ${ship.baseStats.pointCost} vs ${expectedFor(ship)}`,
    );
    expect(drifted).toEqual([]);
  });

  it("keeps each role anchor true to its reference ship", () => {
    const stale = Object.entries(ROLE_ANCHORS)
      .filter(([role, anchor]) => {
        const ship = SHIP_DEFINITIONS[anchor.referenceShipId];
        if (!ship || ship.role !== role) return true;
        const live = pricingProfile(
          ship.role,
          ship.baseStats,
          SHIP_DIALS[ship.id]!,
        );
        const levers = Object.keys(anchor.profile) as (keyof PricingProfile)[];
        return (
          levers.some((lever) => live[lever] !== anchor.profile[lever]) ||
          ship.baseStats.pointCost !== anchor.pointCost
        );
      })
      .map(([role]) => role);
    expect(stale).toEqual([]);
  });
});
