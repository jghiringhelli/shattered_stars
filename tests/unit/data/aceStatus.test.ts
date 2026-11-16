/**
 * aceStatus — specification tests of who is an ace: a named pilot with a
 * signature ability and initiative at or above the configured floor.
 */

import { describe, expect, it } from "vitest";
import { ACE_MIN_INITIATIVE } from "../../../src/data/aceConfig";
import { isAceLoadout, isAcePilotCard } from "../../../src/data/aceStatus";
import { getShipLoadouts } from "../../../src/data/ShipLoadouts";
import { PILOT_CARDS, type PilotCard } from "../../../src/systems/SquadBuilder";

const card = (over: Partial<PilotCard>): PilotCard => ({
  id: "p",
  name: "P",
  shipId: "terran_gladius",
  faction: "terran_hegemony",
  initiative: ACE_MIN_INITIATIVE,
  pointCost: 0,
  isUnique: true,
  abilityId: "marksmanship",
  ...over,
});

describe("isAcePilotCard", () => {
  it("accepts a unique pilot with an ability at the initiative floor", () => {
    expect(isAcePilotCard(card({}))).toBe(true);
  });

  it("rejects a pilot below the initiative floor", () => {
    expect(isAcePilotCard(card({ initiative: ACE_MIN_INITIATIVE - 1 }))).toBe(
      false,
    );
  });

  it("rejects a generic pilot however high its initiative", () => {
    expect(isAcePilotCard(card({ isUnique: false, initiative: 6 }))).toBe(false);
  });

  it("rejects a named pilot without an ability", () => {
    const { abilityId: _omitted, ...bare } = card({});
    expect(isAcePilotCard(bare)).toBe(false);
  });

  it("rejects no pilot", () => {
    expect(isAcePilotCard(undefined)).toBe(false);
  });
});

describe("isAceLoadout", () => {
  it("rejects the bare ship and unknown builds", () => {
    expect(isAceLoadout(null)).toBe(false);
    expect(isAceLoadout(undefined)).toBe(false);
    expect(isAceLoadout("no_such_build")).toBe(false);
  });

  it("follows the pilot card of every quick build in the catalog", () => {
    const hulls = new Set(
      Object.values(PILOT_CARDS).map((pilot) => pilot.shipId),
    );
    let aces = 0;
    let others = 0;
    for (const hull of hulls) {
      for (const build of getShipLoadouts(hull)) {
        const expected = isAcePilotCard(PILOT_CARDS[build.pilotId]);
        expect(isAceLoadout(build.id)).toBe(expected);
        if (expected) aces += 1;
        else others += 1;
      }
    }
    expect(aces).toBeGreaterThan(0);
    expect(others).toBeGreaterThan(0);
  });
});
