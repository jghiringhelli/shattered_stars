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
  toggleCollapsed,
} from "../../../../src/ui/picker/catalogSections";
import type { ShipRole } from "../../../../src/core/types";
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

describe("collapsible sections", () => {
  const METRICS = { columns: 2, rowPitch: 56, headerH: 38, sectionGap: 8 } as const;

  it("keeps a collapsed section's header and counts but hides its cards", () => {
    const sections = buildSections(SHIPS, ALL, buildsOf, {
      collapsed: new Set(["heavy_fighter"]),
    });
    const heavy = sections.find((s) => s.role === "heavy_fighter")!;
    expect(heavy.collapsed).toBe(true);
    expect(heavy.shipCount).toBeGreaterThan(0);
    const layout = layoutSections(sections, METRICS);
    const heavyCards = layout.items.filter(
      (item) => item.kind === "card" && item.ship.role === "heavy_fighter",
    );
    expect(heavyCards).toHaveLength(0);
    expect(
      layout.items.some((i) => i.kind === "header" && i.section.role === "heavy_fighter"),
    ).toBe(true);
  });

  it("makes the grid shorter when a section collapses", () => {
    const open = layoutSections(buildSections(SHIPS, ALL, buildsOf), METRICS);
    const closed = layoutSections(
      buildSections(SHIPS, ALL, buildsOf, { collapsed: new Set(["heavy_fighter"]) }),
      METRICS,
    );
    expect(closed.height).toBeLessThan(open.height);
  });

  it("never collapses the only section of a role filter", () => {
    const sections = buildSections(
      SHIPS,
      { role: "heavy_fighter", sort: "default" },
      buildsOf,
      { collapsed: new Set(["heavy_fighter"]) },
    );
    expect(sections[0]!.collapsed).toBe(false);
  });

  it("toggles a role in and out of the collapsed set without mutating it", () => {
    const start: ReadonlySet<ShipRole> = new Set<ShipRole>();
    const once = toggleCollapsed(start, "bomber");
    expect(once.has("bomber")).toBe(true);
    expect(start.size).toBe(0);
    expect(toggleCollapsed(once, "bomber").has("bomber")).toBe(false);
  });
});

describe("buildSections role headers", () => {
  const FACTIONS = [
    "terran_hegemony",
    "free_confederation",
    "synthetic_collective",
    "void_corsairs",
    "ascendant_empire",
  ] as const;

  it("gives every section of every faction a role line and an example hull", () => {
    for (const faction of FACTIONS) {
      const ships = getShipsByFaction(faction).filter((s) => s.role !== "capital");
      const sections = buildSections(ships, ALL, buildsOf);
      expect(sections.map((s) => s.role), faction).toHaveLength(6);
      for (const section of sections) {
        expect(section.blurb.length, `${faction} ${section.role}`).toBeGreaterThan(15);
        expect(section.exampleLine).toContain(section.ships[0]!.name);
      }
    }
  });

  it("examples follow the section's sort order", () => {
    const sections = buildSections(SHIPS, { role: null, sort: "points_desc" }, buildsOf);
    for (const section of sections) expect(section.exampleLine).toContain(section.ships[0]!.name);
  });

  it("explains the capital notice as Epic only without an example", () => {
    const notice = buildSections(SHIPS, ALL, buildsOf, { hiddenCapitals: 3 }).find((s) => s.epicOnly)!;
    expect(notice.blurb).toMatch(/Epic/);
    expect(notice.exampleLine).toBe("");
  });
});
