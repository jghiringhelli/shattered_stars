/**
 * Spec: the quick-build guide (pre-build explanation) is generated from the
 * catalogues for every build — when to pick it, how to fly it, strengths,
 * weaknesses, counter, a concrete example and a cost breakdown — and names
 * the build's real pilot and cards.
 */

import { describe, it, expect } from "vitest";
import {
  explainBaseShip,
  explainQuickBuild,
} from "../../../src/data/roleHints";
import { SHIP_LOADOUTS } from "../../../src/data/ShipLoadouts";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";

const ALL_BUILDS = Object.values(SHIP_LOADOUTS).flat();

describe("explainQuickBuild", () => {
  it("covers every quick build in the catalogue without throwing", () => {
    expect(ALL_BUILDS.length).toBeGreaterThanOrEqual(263);
    for (const build of ALL_BUILDS) {
      expect(() => explainQuickBuild(build), build.id).not.toThrow();
    }
  });

  it("cites every card of the build in its how-to-fly lines", () => {
    for (const build of ALL_BUILDS) {
      const guide = explainQuickBuild(build);
      const text = guide.howToFly.join("\n");
      for (const id of build.upgrades) {
        const name = UPGRADE_DEFINITIONS[id]?.name;
        expect(text, `${build.id}: ${id}`).toContain(name);
      }
    }
  });

  it("starts the example with the build's own name and pilot", () => {
    for (const build of ALL_BUILDS) {
      const pilot = PILOT_CARDS[build.pilotId];
      const guide = explainQuickBuild(build);
      expect(guide.example.startsWith(`${build.name}:`), build.id).toBe(true);
      if (pilot) expect(guide.example, build.id).toContain(pilot.name);
    }
  });

  it("breaks the price into hull + pilot + cards that add up to the build's cost", () => {
    for (const build of ALL_BUILDS) {
      const guide = explainQuickBuild(build);
      const sum = guide.costLines.reduce(
        (total, line) => total + line.points,
        0,
      );
      expect(sum, build.id).toBe(build.pointCost);
      expect(guide.totalPoints).toBe(build.pointCost);
      expect(guide.costLines[0]?.kind).toBe("hull");
    }
  });

  it("gives every build a non-empty paragraph, strengths, weaknesses and counter", () => {
    for (const build of ALL_BUILDS) {
      const guide = explainQuickBuild(build);
      expect(guide.whenToPick.length, build.id).toBeGreaterThan(40);
      expect(guide.strengths.length, build.id).toBeGreaterThan(0);
      expect(guide.weaknesses.length, build.id).toBeGreaterThan(0);
      expect(guide.counter, build.id).toMatch(/^Struggles against: /);
      expect(guide.bestWith, build.id).toMatch(/^Best with /);
    }
  });

  it("reads the hull's real stats into its strengths and weaknesses", () => {
    const interceptor = ALL_BUILDS.find(
      (b) => SHIP_DEFINITIONS[b.shipId]?.baseStats.agility === 4,
    )!;
    const guide = explainQuickBuild(interceptor);
    expect(guide.strengths.join(" ")).toContain("evasive (Agility 4)");
  });

  it("is deterministic", () => {
    const build = ALL_BUILDS[0]!;
    expect(explainQuickBuild(build)).toEqual(explainQuickBuild(build));
  });
});

describe("explainBaseShip", () => {
  it("explains every stock ship as a rookie hull with only its hull price", () => {
    for (const ship of Object.values(SHIP_DEFINITIONS)) {
      const guide = explainBaseShip(ship.id);
      expect(guide.totalPoints, ship.id).toBe(ship.baseStats.pointCost);
      expect(guide.costLines).toHaveLength(1);
      expect(guide.whenToPick).toContain("rookie");
    }
  });

  it("throws for an unknown ship", () => {
    expect(() => explainBaseShip("no_such_ship")).toThrow();
  });
});
