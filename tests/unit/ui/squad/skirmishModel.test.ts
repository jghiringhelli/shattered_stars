/**
 * Spec: the Skirmish setup is an ordered flow of three titled steps, each
 * with one plain-language sentence; the squad list shows the flagship first
 * with the flown cost of every ship; the NEXT / LAUNCH button follows the step.
 */

import { describe, expect, it } from "vitest";
import { flownSquadCost } from "../../../../src/core/squadTypes";
import { SHIP_DEFINITIONS } from "../../../../src/data/ShipDefinitions";
import { WINGMEN_TYPES } from "../../../../src/systems/setup/wingmenTypes";
import {
  SKIRMISH_STEPS,
  navButton,
  nextStep,
  squadRows,
  stepText,
  wingmenText,
} from "../../../../src/ui/squad/skirmish/skirmishModel";

describe("skirmish steps", () => {
  it("run ship, wingmen, battle", () => {
    expect(SKIRMISH_STEPS).toEqual(["ship", "wingmen", "battle"]);
  });

  it("each have a title and exactly one sentence", () => {
    for (const step of SKIRMISH_STEPS) {
      const { title, sentence } = stepText(step);
      expect(title).toBe(title.toUpperCase());
      expect(sentence.endsWith(".")).toBe(true);
      expect(sentence.slice(0, -1)).not.toContain(". ");
    }
  });

  it("name the three parts the way the owner asked", () => {
    expect(stepText("ship").title).toBe("YOUR SHIP");
    expect(stepText("wingmen").title).toBe("YOUR WINGMEN");
    expect(stepText("battle").title).toContain("ENEMY");
  });

  it("step forward until the last one", () => {
    expect(nextStep("ship")).toBe("wingmen");
    expect(nextStep("wingmen")).toBe("battle");
    expect(nextStep("battle")).toBeNull();
  });
});

describe("wingmenText", () => {
  it("explains every type in one sentence", () => {
    for (const type of WINGMEN_TYPES) {
      const { title, body } = wingmenText(type);
      expect(title.length, type).toBeGreaterThan(2);
      expect(body.endsWith("."), type).toBe(true);
    }
  });

  it("recommends AUTO", () => {
    expect(wingmenText("auto").body).toMatch(/Recommended/);
  });
});

describe("squadRows", () => {
  const ships = ["terran_gladius", "terran_viper"].filter((id) => SHIP_DEFINITIONS[id]);

  it("lists the flagship first and prices every ship as flown", () => {
    const rows = squadRows(ships, {});
    expect(rows.map((r) => r.shipId)).toEqual(ships);
    expect(rows[0]!.isFlagship).toBe(true);
    expect(rows.slice(1).every((r) => !r.isFlagship)).toBe(true);
    expect(rows.reduce((sum, r) => sum + r.cost, 0)).toBe(flownSquadCost(ships, {}));
  });

  it("names the role of each ship", () => {
    for (const row of squadRows(ships, {})) expect(row.roleLabel.length).toBeGreaterThan(2);
  });

  it("is empty without ships", () => {
    expect(squadRows([], {})).toEqual([]);
  });
});

describe("navButton", () => {
  it("offers NEXT on the first two steps and LAUNCH on the last", () => {
    expect(navButton("ship", true)).toEqual({ label: "NEXT", enabled: true, launches: false });
    expect(navButton("wingmen", true).label).toBe("NEXT");
    expect(navButton("battle", true)).toEqual({ label: "LAUNCH", enabled: true, launches: true });
  });

  it("asks for a ship before launching", () => {
    expect(navButton("battle", false)).toEqual({ label: "PICK A SHIP", enabled: false, launches: true });
    expect(navButton("ship", false).enabled).toBe(true);
  });
});
