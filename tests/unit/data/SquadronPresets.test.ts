/**
 * Gate: quick-build squads fit the budget they advertise.
 *
 * Each preset carried a hand-written `totalCost`. Once loadout prices became
 * derived, 19 of 20 presets disagreed with what their ships actually cost and
 * 9 blew past their own pointLimit — a "200pt" squad that really cost 263.
 * These tests pin both halves: the total is derived, and it fits.
 */

import { describe, it, expect } from "vitest";
import {
  QUICK_BUILD_SQUADS,
  squadCost,
} from "../../../src/data/SquadronPresets";
import { getLoadoutById } from "../../../src/data/ShipLoadouts";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";

describe("quick-build presets", () => {
  it("ships at least one preset per faction", () => {
    const factions = new Set(QUICK_BUILD_SQUADS.map((s) => s.factionId));
    expect(factions.size).toBe(5);
  });

  it("references only loadouts that exist", () => {
    const missing: string[] = [];
    for (const squad of QUICK_BUILD_SQUADS) {
      for (const ship of squad.ships) {
        if (!getLoadoutById(ship.loadoutId)) missing.push(ship.loadoutId);
      }
    }
    expect(missing).toEqual([]);
  });

  it("fields each unique pilot at most once per squad", () => {
    const repeated: string[] = [];
    for (const squad of QUICK_BUILD_SQUADS) {
      const pilots = squad.ships.map(
        (ship) => getLoadoutById(ship.loadoutId)!.pilotId,
      );
      pilots.forEach((pilotId, index) => {
        if (
          PILOT_CARDS[pilotId]?.isUnique &&
          pilots.indexOf(pilotId) !== index
        ) {
          repeated.push(`${squad.id}: ${pilotId}`);
        }
      });
    }
    expect(repeated).toEqual([]);
  });

  it("reports a totalCost that matches what its ships cost", () => {
    const drifted = QUICK_BUILD_SQUADS.filter(
      (s) => s.totalCost !== squadCost(s.ships),
    );
    expect(drifted.map((s) => s.id)).toEqual([]);
  });

  it("never costs more than the point limit it advertises", () => {
    const over = QUICK_BUILD_SQUADS.filter((s) => s.totalCost > s.pointLimit);
    expect(over.map((s) => `${s.id} ${s.totalCost}>${s.pointLimit}`)).toEqual(
      [],
    );
  });

  it("spends most of the budget rather than fielding a token squad", () => {
    // A preset that spends a third of its budget is a bug, not a build.
    const underspent = QUICK_BUILD_SQUADS.filter(
      (s) => s.totalCost < s.pointLimit * 0.75,
    );
    expect(
      underspent.map((s) => `${s.id} ${s.totalCost}/${s.pointLimit}`),
    ).toEqual([]);
  });
});

describe("squadCost", () => {
  it("is zero for an empty squad", () => {
    expect(squadCost([])).toBe(0);
  });

  it("charges each ship its loadout price, pilot included, once", () => {
    const ship = QUICK_BUILD_SQUADS[0]!.ships[0]!;
    expect(squadCost([ship, ship])).toBe(
      2 * getLoadoutById(ship.loadoutId)!.pointCost,
    );
  });
});
