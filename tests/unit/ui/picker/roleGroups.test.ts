/**
 * Spec: every pick screen groups ships by role through one shared module —
 * all six non-capital roles in a fixed order, capitals never listed, every
 * hull in exactly one group, and each role header explains the role with an
 * example hull of the faction.
 */

import { describe, expect, it } from "vitest";
import type { FactionId } from "../../../../src/config";
import { getShipsByFaction } from "../../../../src/data/ShipDefinitions";
import {
  PICKABLE_ROLES,
  describeRole,
  groupShipsByRole,
  orderShipsByRole,
  roleHeading,
} from "../../../../src/ui/picker/roleGroups";

const FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

const isCapital = (s: { role: string; baseStats: { size: string } }): boolean =>
  s.role === "capital" || s.baseStats.size === "huge";

describe("roleGroups", () => {
  it("lists the six non-capital roles in picker order", () => {
    expect(PICKABLE_ROLES).toEqual([
      "light_fighter",
      "heavy_fighter",
      "interceptor",
      "bomber",
      "gunship",
      "support",
    ]);
  });

  for (const faction of FACTIONS) {
    describe(faction, () => {
      const ships = getShipsByFaction(faction);
      const groups = groupShipsByRole(ships);

      it("has a group for each of the six roles", () => {
        expect(groups.map((g) => g.role)).toEqual([...PICKABLE_ROLES]);
        for (const group of groups) expect(group.ships.length).toBeGreaterThan(0);
      });

      it("puts every non-capital ship in exactly one group", () => {
        const grouped = groups.flatMap((g) => g.ships.map((s) => s.id)).sort();
        const expected = ships.filter((s) => !isCapital(s)).map((s) => s.id).sort();
        expect(grouped).toEqual(expected);
      });

      it("never lists a capital or huge ship", () => {
        for (const group of groups) {
          for (const ship of group.ships) expect(isCapital(ship), ship.id).toBe(false);
        }
      });

      it("explains each role in one line with a hull of the group as example", () => {
        for (const group of groups) {
          expect(group.exampleLine).toContain(group.ships[0]!.name);
          expect(group.blurb.length).toBeGreaterThan(15);
          expect(group.blurb).not.toMatch(/[{}\n]/);
          expect(group.exampleLine).not.toMatch(/[{}\n]/);
        }
      });
    });
  }

  it("orders ships by role and keeps the list order inside a role", () => {
    const ships = getShipsByFaction("terran_hegemony");
    const ordered = orderShipsByRole(ships);
    expect(ordered).toHaveLength(ships.length);
    const rank = (role: string): number => [...PICKABLE_ROLES, "capital"].indexOf(role as never);
    for (let i = 1; i < ordered.length; i += 1) {
      expect(rank(ordered[i]!.role)).toBeGreaterThanOrEqual(rank(ordered[i - 1]!.role));
    }
  });

  it("describes the role of a faction's ship with that faction's example hull", () => {
    const ships = getShipsByFaction("void_corsairs");
    const heading = describeRole("gunship", ships);
    expect(heading.title).toBe("GUNSHIPS");
    expect(heading.exampleLine).toContain(ships.find((s) => s.role === "gunship")!.name);
    expect(describeRole("gunship", []).exampleLine).toBe("");
  });

  it("writes a one-line heading for a role without an example hull", () => {
    const heading = roleHeading("bomber");
    expect(heading.title).toBe("BOMBERS");
    expect(heading.blurb).not.toMatch(/[{}\n]/);
    expect(heading.exampleLine).toBe("");
  });
});
