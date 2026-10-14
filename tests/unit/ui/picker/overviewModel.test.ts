/**
 * Spec: the overview tab condenses a ship to a 2-3 line description, four key
 * numbers (hull / shields / attack / agility with the build's bonuses), the
 * speed range and the faction's aura tag.
 */

import { describe, it, expect } from "vitest";
import {
  factionAuraTag,
  overviewModel,
  shortDescription,
} from "../../../../src/ui/picker/overviewModel";
import { computeLoadoutBonuses } from "../../../../src/ui/picker/catalogHelpers";
import { SHIP_DEFINITIONS } from "../../../../src/data/ShipDefinitions";
import { FACTION_COLORS, type FactionId } from "../../../../src/config";

const none = computeLoadoutBonuses([]);
const ship = (id: string) => SHIP_DEFINITIONS[id]!;

describe("shortDescription", () => {
  it("keeps short text as it is", () => {
    expect(shortDescription("A sturdy fighter.")).toBe("A sturdy fighter.");
  });

  it("cuts long text at a sentence end within the limit", () => {
    const text = `${"First sentence is here. ".repeat(3)}${"x".repeat(200)}`;
    const cut = shortDescription(text, 80);
    expect(cut.length).toBeLessThanOrEqual(80);
    expect(cut.endsWith(".")).toBe(true);
  });

  it("falls back to an ellipsis when there is no sentence end in range", () => {
    const cut = shortDescription("x".repeat(300), 50);
    expect(cut.length).toBe(50);
    expect(cut.endsWith("\u2026")).toBe(true);
  });
});

describe("factionAuraTag", () => {
  it("names an aura for every faction", () => {
    for (const faction of Object.keys(FACTION_COLORS) as FactionId[]) {
      const tag = factionAuraTag(faction);
      expect(tag.name.length, faction).toBeGreaterThan(2);
      expect(tag.text.length, faction).toBeGreaterThan(10);
    }
  });

  it("reads the Hegemony aura as Coordinated Fire", () => {
    expect(factionAuraTag("terran_hegemony").name).toBe("Coordinated Fire");
  });
});

describe("overviewModel", () => {
  const id = Object.keys(SHIP_DEFINITIONS)[0]!;

  it("lists the four key numbers in a fixed order", () => {
    const model = overviewModel(ship(id), none);
    expect(model.keyNumbers.map((n) => n.key)).toEqual(["attack", "agility", "hull", "shields"]);
  });

  it("adds the build's bonuses to the numbers", () => {
    const base = ship(id).baseStats;
    const model = overviewModel(ship(id), { ...none, hull: 2 });
    const hull = model.keyNumbers.find((n) => n.key === "hull")!;
    expect(hull.value).toBe(base.hull + 2);
    expect(hull.bonus).toBe(2);
  });

  it("reads the speed range as min to max", () => {
    const { speed } = ship(id).baseStats;
    expect(overviewModel(ship(id), none).speedText).toBe(
      `${speed.min}\u2013${speed.max}`,
    );
  });
});
