/**
 * Gate: every faction fields almost the same number of hulls of every role.
 *
 * Factions were merged and ships moved between them, which left the roster
 * lopsided (Corsairs: six interceptors, one support). Identity lives in
 * levers, auras and aces (docs/specs/factions.md), not in role counts:
 * no role may differ by more than one hull between any two factions, and
 * every faction keeps at least one hull of every role.
 */

import { describe, it, expect } from "vitest";
import type { FactionId } from "../../../src/config";
import type { ShipRole } from "../../../src/core/types";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";

const FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

const ROLES: readonly ShipRole[] = [
  "light_fighter",
  "heavy_fighter",
  "interceptor",
  "bomber",
  "gunship",
  "support",
  "capital",
];

/** Largest allowed gap, per role, between the richest and poorest faction. */
const MAX_ROLE_SPREAD = 1;

/** Hulls per faction, unchanged by the role equalisation (no ship added or removed). */
const FACTION_TOTALS: Readonly<Record<FactionId, number>> = {
  terran_hegemony: 20,
  free_confederation: 20,
  synthetic_collective: 21,
  void_corsairs: 20,
  ascendant_empire: 20,
};

/** The shipped matrix, in {@link ROLES} order (docs/specs/ship-variants.md §5). */
const ROLE_MATRIX: Readonly<Record<FactionId, readonly number[]>> = {
  terran_hegemony: [3, 3, 2, 2, 3, 3, 4],
  free_confederation: [3, 4, 3, 2, 3, 2, 3],
  synthetic_collective: [3, 3, 2, 3, 3, 3, 4],
  void_corsairs: [3, 4, 3, 2, 3, 2, 3],
  ascendant_empire: [2, 3, 3, 2, 3, 3, 4],
};

/** Count the hulls of one faction in one role. */
function countOf(faction: FactionId, role: ShipRole): number {
  return Object.values(SHIP_DEFINITIONS).filter(
    (ship) => ship.faction === faction && ship.role === role,
  ).length;
}

describe("ship role distribution", () => {
  it("keeps every faction's total hull count", () => {
    const totals = Object.fromEntries(
      FACTIONS.map((faction) => [
        faction,
        ROLES.reduce((sum, role) => sum + countOf(faction, role), 0),
      ]),
    );
    expect(totals).toEqual(FACTION_TOTALS);
  });

  it("fields at least one hull of every role in every faction", () => {
    const missing = FACTIONS.flatMap((faction) =>
      ROLES.filter((role) => countOf(faction, role) === 0).map(
        (role) => `${faction}: ${role}`,
      ),
    );
    expect(missing).toEqual([]);
  });

  it("never lets two factions differ by more than one hull in a role", () => {
    const lopsided = ROLES.filter((role) => {
      const counts = FACTIONS.map((faction) => countOf(faction, role));
      return Math.max(...counts) - Math.min(...counts) > MAX_ROLE_SPREAD;
    });
    expect(lopsided).toEqual([]);
  });

  it("ships the documented role matrix", () => {
    const actual = Object.fromEntries(
      FACTIONS.map((faction) => [
        faction,
        ROLES.map((role) => countOf(faction, role)),
      ]),
    );
    expect(actual).toEqual(ROLE_MATRIX);
  });
});
