import { describe, it, expect } from "vitest";
import {
  derivePilotSurcharge,
  UnknownAbilityError,
  POINTS_PER_INITIATIVE,
} from "../../../src/data/pilotPricing";
import { PILOT_ABILITIES } from "../../../src/systems/PilotAbilities";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";

describe("derivePilotSurcharge", () => {
  it("charges nothing for an initiative-1 rookie without an ability", () => {
    expect(derivePilotSurcharge(1, undefined)).toBe(0);
  });

  it("charges one point per initiative level above 1", () => {
    expect(derivePilotSurcharge(4, undefined)).toBe(3 * POINTS_PER_INITIATIVE);
  });

  it("adds the signature ability's own point value", () => {
    const ability = PILOT_ABILITIES["iron_discipline"]!;
    expect(derivePilotSurcharge(5, "iron_discipline")).toBe(
      4 + ability.pointCost,
    );
  });

  it("refuses to price an ability that does not exist", () => {
    expect(() => derivePilotSurcharge(3, "no_such_ability")).toThrow(
      UnknownAbilityError,
    );
  });
});

describe("pilot card prices", () => {
  const cards = Object.values(PILOT_CARDS);

  it("derives every card's price from its initiative and ability", () => {
    const drifted = cards
      .filter(
        (card) =>
          card.pointCost !==
          derivePilotSurcharge(card.initiative, card.abilityId),
      )
      .map((card) => card.id);
    expect(drifted).toEqual([]);
  });

  it("never charges a pilot as much as a whole extra ship", () => {
    const tooExpensive = cards
      .filter((card) => card.pointCost > 15)
      .map((card) => card.id);
    expect(tooExpensive).toEqual([]);
  });

  it("gives every pilot at most one signature ability", () => {
    // The card shape allows a single abilityId; campaign pilots, who level up
    // and collect abilities, live in a separate model (CampaignPilot).
    const withList = cards.filter((card) =>
      Array.isArray((card as { abilityId?: unknown }).abilityId),
    );
    expect(withList).toEqual([]);
  });
});
