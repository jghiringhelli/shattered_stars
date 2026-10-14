/**
 * Spec: the ship catalog is grouped into role sections (light fighters,
 * heavy fighters, interceptors, bombers, gunships, support, capitals), each
 * with a header, ship / build counts, role filtering, sort by points and an
 * epic-only notice for capitals; the grid layout places headers and cards.
 */

import { describe, it, expect } from "vitest";
import {
  buildSections,
  layoutSections,
  nextSort,
  sectionCounts,
  sortLabel,
} from "../../../../src/ui/picker/catalogSections";
import { getShipsByFaction } from "../../../../src/data/ShipDefinitions";
import { getEquippableLoadouts } from "../../../../src/data/ShipLoadouts";

const SHIPS = getShipsByFaction("terran_hegemony").filter(
  (s) => s.role !== "capital",
);
const buildsOf = (id: string): number => getEquippableLoadouts(id).length;
const ALL = { role: null, sort: "default" } as const;

describe("buildSections", () => {
  it("puts each ship in exactly one section, in the requested role order", () => {
    const sections = buildSections(SHIPS, ALL, buildsOf);
    const expected = [
      "light_fighter",
      "heavy_fighter",
      "interceptor",
      "bomber",
      "gunship",
      "support",
    ].filter((role) => SHIPS.some((s) => s.role === role));
    expect(sections.map((s) => s.role)).toEqual(expected);
    expect(sections.flatMap((s) => s.ships)).toHaveLength(SHIPS.length);
    for (const section of sections)
      for (const ship of section.ships) expect(ship.role).toBe(section.role);
  });

  it("counts the ships and quick builds of each section", () => {
    for (const section of buildSections(SHIPS, ALL, buildsOf)) {
      expect(section.shipCount).toBe(section.ships.length);
      expect(section.buildCount).toBe(
        section.ships.reduce((sum, ship) => sum + buildsOf(ship.id), 0),
      );
    }
  });

  it("shows only the filtered role", () => {
    const sections = buildSections(
      SHIPS,
      { role: "bomber", sort: "default" },
      buildsOf,
    );
    expect(sections.map((s) => s.role)).toEqual(["bomber"]);
  });

  it("sorts each section by points, cheapest or dearest first", () => {
    const cheap = buildSections(SHIPS, { role: null, sort: "points_asc" }, buildsOf);
    for (const section of cheap) {
      const costs = section.ships.map((s) => s.baseStats.pointCost);
      expect(costs).toEqual([...costs].sort((a, b) => a - b));
    }
    const dear = buildSections(SHIPS, { role: null, sort: "points_desc" }, buildsOf);
    for (const section of dear) {
      const costs = section.ships.map((s) => s.baseStats.pointCost);
      expect(costs).toEqual([...costs].sort((a, b) => b - a));
    }
  });

  it("appends an epic-only capitals notice when capitals are hidden", () => {
    const sections = buildSections(SHIPS, ALL, buildsOf, { hiddenCapitals: 4 });
    const last = sections[sections.length - 1]!;
    expect(last.role).toBe("capital");
    expect(last.epicOnly).toBe(true);
    expect(last.ships).toHaveLength(0);
    expect(last.shipCount).toBe(4);
  });

  it("omits the epic notice when another role is filtered", () => {
    const sections = buildSections(
      SHIPS,
      { role: "bomber", sort: "default" },
      buildsOf,
      { hiddenCapitals: 4 },
    );
    expect(sections.some((s) => s.epicOnly)).toBe(false);
  });
});

describe("sort cycling and counts", () => {
  it("cycles default → cheapest → dearest → default", () => {
    expect(nextSort("default")).toBe("points_asc");
    expect(nextSort("points_asc")).toBe("points_desc");
    expect(nextSort("points_desc")).toBe("default");
    expect(sortLabel("default")).toBe("PTS");
    expect(sortLabel("points_asc")).toContain("↑");
    expect(sortLabel("points_desc")).toContain("↓");
  });

  it("reads '3 SHIPS · 9 BUILDS' with singulars", () => {
    expect(sectionCounts(3, 9)).toBe("3 SHIPS · 9 BUILDS");
    expect(sectionCounts(1, 1)).toBe("1 SHIP · 1 BUILD");
  });
});

describe("layoutSections", () => {
  const metrics = { columns: 2, rowPitch: 56, headerH: 40, sectionGap: 10 };

  it("places a header above each section's cards, top to bottom", () => {
    const sections = buildSections(SHIPS, ALL, buildsOf);
    const { items, height } = layoutSections(sections, metrics);
    expect(items.filter((i) => i.kind === "header")).toHaveLength(
      sections.length,
    );
    expect(items.filter((i) => i.kind === "card")).toHaveLength(SHIPS.length);
    const ys = items.map((i) => i.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(height).toBeGreaterThan(Math.max(...ys));
  });

  it("alternates card columns inside a section", () => {
    const sections = buildSections(SHIPS, ALL, buildsOf);
    const columns = layoutSections(sections, metrics)
      .items.flatMap((i) => (i.kind === "card" ? [i.column] : []))
      .slice(0, 2);
    expect(columns).toEqual(sections[0]!.ships.length > 1 ? [0, 1] : [0]);
  });

  it("is empty for no sections", () => {
    expect(layoutSections([], metrics)).toEqual({ items: [], height: 0 });
  });
});
