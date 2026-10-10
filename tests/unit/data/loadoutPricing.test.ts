/**
 * Gate: loadout prices are derived, consistent, and incremental.
 *
 * Loadout pointCost used to be a hand-authored literal on each of the 215
 * loadouts. 196 of them disagreed with their own contents and 20 cost LESS
 * than the bare ship they upgrade — the player was offered "Viper Basic,
 * 35pt, +1 hull" for a ship whose bare cost is 45pt. These tests pin the
 * rule the catalogue has to obey: a loadout costs its ship plus its
 * upgrades, so buying an upgrade always costs more, never less.
 */

import { describe, it, expect } from "vitest";
import {
  deriveLoadoutCost,
  upgradeCost,
  UnknownUpgradeError,
} from "../../../src/data/loadoutPricing";
import {
  SHIP_LOADOUTS,
  getEquippableLoadouts,
} from "../../../src/data/ShipLoadouts";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";

/** Bare hull cost of a ship, the floor every loadout price must clear. */
function baseCost(shipId: string): number {
  return SHIP_DEFINITIONS[shipId]!.baseStats.pointCost;
}

/** Every loadout in the catalogue, flattened, with its ship id. */
function allLoadouts() {
  return Object.values(SHIP_LOADOUTS).flat();
}

describe("upgradeCost", () => {
  it("returns the catalogue price of a known upgrade", () => {
    expect(upgradeCost("hull_upgrade")).toBe(
      UPGRADE_DEFINITIONS["hull_upgrade"]!.pointCost,
    );
  });

  it("throws UnknownUpgradeError for an upgrade that does not exist", () => {
    expect(() => upgradeCost("no_such_upgrade")).toThrow(UnknownUpgradeError);
  });

  it("names the missing upgrade in the error", () => {
    expect(() => upgradeCost("no_such_upgrade")).toThrow("no_such_upgrade");
  });
});

describe("deriveLoadoutCost", () => {
  it("is the bare ship cost when there are no upgrades", () => {
    expect(deriveLoadoutCost("terran_viper", [])).toBe(
      baseCost("terran_viper"),
    );
  });

  it("adds every upgrade's cost to the ship cost", () => {
    const cost = deriveLoadoutCost("terran_viper", ["hull_upgrade", "elusive"]);
    expect(cost).toBe(
      baseCost("terran_viper") +
        upgradeCost("hull_upgrade") +
        upgradeCost("elusive"),
    );
  });

  it("does not depend on the order upgrades are listed in", () => {
    const forward = deriveLoadoutCost("terran_viper", [
      "hull_upgrade",
      "elusive",
    ]);
    const reversed = deriveLoadoutCost("terran_viper", [
      "elusive",
      "hull_upgrade",
    ]);
    expect(forward).toBe(reversed);
  });

  it("charges twice for the same upgrade equipped twice", () => {
    const once = deriveLoadoutCost("terran_viper", ["hull_upgrade"]);
    const twice = deriveLoadoutCost("terran_viper", [
      "hull_upgrade",
      "hull_upgrade",
    ]);
    expect(twice - once).toBe(upgradeCost("hull_upgrade"));
  });

  it("throws for an unknown ship rather than pricing it at zero", () => {
    expect(() => deriveLoadoutCost("no_such_ship", [])).toThrow();
  });
});

describe("the shipped loadout catalogue", () => {
  it("references only upgrades that exist", () => {
    const unknown = new Set<string>();
    for (const loadout of allLoadouts()) {
      for (const id of loadout.upgrades) {
        if (!UPGRADE_DEFINITIONS[id]) unknown.add(id);
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it("prices every loadout as ship cost plus pilot surcharge plus upgrade costs", () => {
    const wrong = allLoadouts().filter(
      (l) =>
        l.pointCost !==
        baseCost(l.shipId) +
          PILOT_CARDS[l.pilotId]!.pointCost +
          l.upgrades.reduce((sum, id) => sum + upgradeCost(id), 0),
    );
    expect(wrong.map((l) => l.id)).toEqual([]);
  });

  it("never prices a loadout below the bare ship", () => {
    const tooCheap = allLoadouts().filter(
      (l) => l.pointCost < baseCost(l.shipId),
    );
    expect(tooCheap.map((l) => l.id)).toEqual([]);
  });

  it("charges strictly more than the bare ship whenever it adds an upgrade", () => {
    const notIncremental = allLoadouts().filter(
      (l) => l.upgrades.length > 0 && l.pointCost <= baseCost(l.shipId),
    );
    expect(notIncremental.map((l) => l.id)).toEqual([]);
  });

  it("charges more for a loadout that is a superset of another on the same ship", () => {
    const violations: string[] = [];
    for (const loadouts of Object.values(SHIP_LOADOUTS)) {
      for (const a of loadouts) {
        for (const b of loadouts) {
          if (a.id === b.id) continue;
          const aSet = [...a.upgrades];
          const isSuperset =
            b.upgrades.length < aSet.length &&
            b.upgrades.every((u) => aSet.includes(u));
          if (isSuperset && a.pointCost <= b.pointCost) {
            violations.push(`${a.id} <= ${b.id}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("gives every ship in the catalogue at least one loadout", () => {
    for (const [shipId, loadouts] of Object.entries(SHIP_LOADOUTS)) {
      expect(loadouts.length, shipId).toBeGreaterThan(0);
    }
  });
});

describe("getEquippableLoadouts", () => {
  it("hides loadouts that equip nothing, because BASE already offers them", () => {
    // A zero-upgrade loadout costs exactly the bare hull, so showing it next to
    // the BASE button gave the player the same ship at the same price twice.
    for (const [shipId, loadouts] of Object.entries(SHIP_LOADOUTS)) {
      const equippable = getEquippableLoadouts(shipId);
      const empty = loadouts.filter((l) => l.upgrades.length === 0);
      expect(equippable.length, shipId).toBe(loadouts.length - empty.length);
      expect(
        equippable.some((l) => l.upgrades.length === 0),
        shipId,
      ).toBe(false);
    }
  });

  it("keeps every loadout that actually equips an upgrade", () => {
    const kept = getEquippableLoadouts("terran_viper").map((l) => l.id);
    expect(kept).toContain("viper_ace");
    expect(kept).toContain("viper_pursuit");
    expect(kept).toContain("viper_basic");
    expect(kept).not.toContain("viper_swarm");
  });

  it("is empty for a ship that has no loadouts at all", () => {
    expect(getEquippableLoadouts("no_such_ship")).toEqual([]);
  });
});
