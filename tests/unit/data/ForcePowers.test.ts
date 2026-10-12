/**
 * Force powers — specification tests: the `force_power` slot that
 * Ascendant pilot cards add has real cards to fill it, each with a
 * real-time effect, and every such pilot can equip at least one of them.
 */

import { describe, it, expect } from "vitest";
import {
  UPGRADE_DEFINITIONS,
  canEquipUpgrade,
} from "../../../src/systems/UpgradeSystem";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";
import { slotBarFor } from "../../../src/data/ShipSlots";
import { describeRealtimeEffect } from "../../../src/data/realtimeEffectSummary";

const FORCE_CARDS = Object.values(UPGRADE_DEFINITIONS).filter(
  (card) => card.slotType === "force_power",
);

const FORCE_PILOTS = Object.values(PILOT_CARDS).filter((pilot) =>
  (pilot.extraSlots ?? []).includes("force_power"),
);

describe("force power cards", () => {
  it("offers a small set (3-5) of Force powers", () => {
    expect(FORCE_CARDS.length).toBeGreaterThanOrEqual(3);
    expect(FORCE_CARDS.length).toBeLessThanOrEqual(5);
  });

  it("restricts every Force power to the Ascendant Empire", () => {
    const open = FORCE_CARDS.filter(
      (card) => card.requiredFaction !== "ascendant_empire",
    ).map((card) => card.id);
    expect(open).toEqual([]);
  });

  it("gives every Force power a real-time effect that reads as a phrase", () => {
    const inert = FORCE_CARDS.filter(
      (card) => describeRealtimeEffect(card.realtime ?? {}).length === 0,
    ).map((card) => card.id);
    expect(inert).toEqual([]);
  });

  it("lets every pilot with a force_power slot equip at least one power", () => {
    const stranded = FORCE_PILOTS.filter((pilot) => {
      const ship = SHIP_DEFINITIONS[pilot.shipId]!;
      const slots = slotBarFor(
        pilot.shipId,
        pilot.extraSlots,
        pilot.removedSlots,
      );
      return !FORCE_CARDS.some(
        (card) =>
          canEquipUpgrade(card, {
            size: ship.baseStats.size,
            role: ship.role,
            faction: ship.faction,
            availableSlots: slots,
            equippedUpgrades: [],
          }).valid,
      );
    }).map((pilot) => pilot.id);
    expect(FORCE_PILOTS.length).toBeGreaterThan(0);
    expect(stranded).toEqual([]);
  });
});
