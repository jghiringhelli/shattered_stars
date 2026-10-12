/**
 * Card pricing — specification tests: upgrade cards and pilot abilities are
 * priced on ONE scale (src/data/abilityPricing.ts), calibrated with the
 * real engine (skill arena, card vs no card, docs/specs/upgrades-and-slots.md
 * "Price rule"). A non-weapon card costs its stat tokens plus the value of
 * its real-time effect; weapon cards carry their measured price.
 */

import { describe, it, expect } from "vitest";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";
import {
  STAT_TOKEN_POINTS,
  abilityPointValue,
  cardPointValue,
} from "../../../src/data/abilityPricing";
import type { UpgradeDefinition } from "../../../src/core/upgradeTypes";

const CARDS = Object.values(UPGRADE_DEFINITIONS);

function card(over: Partial<UpgradeDefinition>): UpgradeDefinition {
  return {
    id: "probe",
    name: "Probe",
    slotType: "modification",
    description: "",
    pointCost: 1,
    creditCost: 50,
    ...over,
  };
}

describe("one price scale for cards and pilot abilities", () => {
  it("prices every non-weapon card at its stats plus its effect's value", () => {
    const off = CARDS.filter((c) => !c.weapon)
      .filter((c) => c.pointCost !== cardPointValue(c))
      .map((c) => `${c.id}: ${c.pointCost} != ${cardPointValue(c)}`);
    expect(off).toEqual([]);
  });

  it("charges a card the same as a pilot ability with the same effect", () => {
    const effect = { calmLaserDamageBonus: 1 };
    expect(cardPointValue(card({ realtime: effect }))).toBe(
      abilityPointValue(effect),
    );
  });

  it("values +1 hull and +1 shield the same (shields spill into hull)", () => {
    expect(cardPointValue(card({ effects: { hullBonus: 1 } }))).toBe(
      STAT_TOKEN_POINTS,
    );
    expect(cardPointValue(card({ effects: { shieldBonus: 1 } }))).toBe(
      STAT_TOKEN_POINTS,
    );
  });

  it("prices an illicit card one point below the same effect on a clean card", () => {
    const effect = { laserDamageBonus: 1, stressRateMultiplier: 1.25 };
    expect(
      cardPointValue(card({ slotType: "illicit", realtime: effect })),
    ).toBe(cardPointValue(card({ realtime: effect })) - 1);
  });

  it("never prices a card below 1 point", () => {
    const tiny = card({ realtime: { stressRateMultiplier: 0.99 } });
    expect(cardPointValue(tiny)).toBeGreaterThanOrEqual(1);
  });
});
