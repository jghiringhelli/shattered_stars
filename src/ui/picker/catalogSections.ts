/**
 * catalogSections — the ship picker's role sections as pure data: which
 * ships fall in each role section (light fighters … capitals), their
 * counts, role filter, sort by points, the epic-only capitals notice and the
 * y-layout of headers and card rows. No Phaser.
 */

import type { ShipDefinition, ShipRole } from "../../core/types";
import {
  ROLE_BLURBS,
  ROLE_SECTION_ORDER,
} from "../../data/roleHints/roleSections";
import { ROLE_PLURALS } from "../../data/roleHints/playstyleCatalog";

/** How ships are ordered inside a section. */
export type SortMode = "default" | "points_asc" | "points_desc";

/** What the filter chips select. */
export interface CatalogFilters {
  /** Only this role, or every role. */
  readonly role: ShipRole | null;
  readonly sort: SortMode;
}

/** One role section. */
export interface CatalogSection {
  readonly role: ShipRole;
  /** "INTERCEPTORS". */
  readonly title: string;
  readonly blurb: string;
  readonly ships: readonly ShipDefinition[];
  /** Ships in the role (for a notice section: the hidden ones). */
  readonly shipCount: number;
  /** Quick builds across the section's ships. */
  readonly buildCount: number;
  /** A header-only notice: this role needs the Epic format. */
  readonly epicOnly: boolean;
}

/** Extras for {@link buildSections}. */
export interface SectionOptions {
  /** Capital ships hidden because the format excludes them. */
  readonly hiddenCapitals?: number;
}

const SORTS: readonly SortMode[] = ["default", "points_asc", "points_desc"];

/**
 * @param mode - Current sort.
 * @returns The next sort in the cycle.
 */
export function nextSort(mode: SortMode): SortMode {
  return SORTS[(SORTS.indexOf(mode) + 1) % SORTS.length]!;
}

/**
 * @param mode - A sort.
 * @returns The chip label.
 */
export function sortLabel(mode: SortMode): string {
  if (mode === "points_asc") return "PTS ↑";
  return mode === "points_desc" ? "PTS ↓" : "PTS";
}

/**
 * @param ships - Ship count.
 * @param builds - Build count.
 * @returns "3 SHIPS · 9 BUILDS".
 */
export function sectionCounts(ships: number, builds: number): string {
  return `${ships} ${ships === 1 ? "SHIP" : "SHIPS"} · ${builds} ${builds === 1 ? "BUILD" : "BUILDS"}`;
}

function sorted(
  ships: readonly ShipDefinition[],
  sort: SortMode,
): ShipDefinition[] {
  const copy = [...ships];
  if (sort === "default") return copy;
  const direction = sort === "points_asc" ? 1 : -1;
  return copy.sort(
    (a, b) =>
      direction * (a.baseStats.pointCost - b.baseStats.pointCost) ||
      a.name.localeCompare(b.name),
  );
}

/**
 * Groups ships into role sections.
 *
 * @param ships - Ships to list (already gated and unlock-filtered).
 * @param filters - Role filter and sort.
 * @param buildsOf - Quick builds a ship offers.
 * @param options - Hidden capitals for the epic-only notice.
 * @returns Non-empty sections in picker order (a notice section last).
 */
export function buildSections(
  ships: readonly ShipDefinition[],
  filters: CatalogFilters,
  buildsOf: (shipId: string) => number,
  options: SectionOptions = {},
): CatalogSection[] {
  const sections: CatalogSection[] = [];
  for (const role of ROLE_SECTION_ORDER) {
    if (filters.role && filters.role !== role) continue;
    const inRole = sorted(
      ships.filter((ship) => ship.role === role),
      filters.sort,
    );
    if (inRole.length === 0) continue;
    sections.push({
      role,
      title: ROLE_PLURALS[role].toUpperCase(),
      blurb: ROLE_BLURBS[role],
      ships: inRole,
      shipCount: inRole.length,
      buildCount: inRole.reduce((sum, ship) => sum + buildsOf(ship.id), 0),
      epicOnly: false,
    });
  }
  const hidden = options.hiddenCapitals ?? 0;
  const showNotice = hidden > 0 && (!filters.role || filters.role === "capital");
  if (showNotice && !sections.some((s) => s.role === "capital")) {
    sections.push({
      role: "capital",
      title: ROLE_PLURALS.capital.toUpperCase(),
      blurb: ROLE_BLURBS.capital,
      ships: [],
      shipCount: hidden,
      buildCount: 0,
      epicOnly: true,
    });
  }
  return sections;
}

/** Spacing of the sectioned grid. */
export interface SectionMetrics {
  readonly columns: number;
  readonly rowPitch: number;
  readonly headerH: number;
  readonly sectionGap: number;
}

/** One placed element of the grid (y relative to the grid top). */
export type GridItem =
  | { readonly kind: "header"; readonly section: CatalogSection; readonly y: number }
  | {
      readonly kind: "card";
      readonly ship: ShipDefinition;
      readonly column: number;
      readonly y: number;
    };

/**
 * Places each section's header and its cards top to bottom.
 *
 * @param sections - Sections to place.
 * @param metrics - Column count and spacing.
 * @returns The items and the total grid height.
 */
export function layoutSections(
  sections: readonly CatalogSection[],
  metrics: SectionMetrics,
): { items: GridItem[]; height: number } {
  const items: GridItem[] = [];
  let y = 0;
  for (const section of sections) {
    items.push({ kind: "header", section, y });
    y += metrics.headerH;
    section.ships.forEach((ship, index) => {
      const row = Math.floor(index / metrics.columns);
      items.push({
        kind: "card",
        ship,
        column: index % metrics.columns,
        y: y + row * metrics.rowPitch,
      });
    });
    y += Math.ceil(section.ships.length / metrics.columns) * metrics.rowPitch;
    y += metrics.sectionGap;
  }
  return { items, height: items.length === 0 ? 0 : y - metrics.sectionGap };
}
