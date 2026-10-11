/**
 * Survival roguelite — sector layout constants (pure data). A run is
 * SECTOR_COUNT sectors; each sector is a branching map of REGULAR_ROWS rows
 * of 2–4 nodes plus a final boss row. Clearing the last sector's boss wins
 * the run. See docs/adr/ADR-0004-survival-roguelite-run-structure.md.
 */

import type { NodeType } from "./nodes";

/** Sectors per run; the last sector's boss is the victory condition. */
export const SECTOR_COUNT = 3;

/** Regular rows per sector before the boss row (map is REGULAR_ROWS + 1 rows deep). */
export const REGULAR_ROWS = 7;

/** Fewest / most nodes a regular row may hold. */
export const MIN_ROW_WIDTH = 2;
export const MAX_ROW_WIDTH = 4;

/** Earliest row (0-based) that may hold an elite or a shop. */
export const FIRST_ELITE_ROW = 2;
export const FIRST_SHOP_ROW = 2;

/** The row right before the boss is always a repair dock (rest before the boss). */
export const PRE_BOSS_ROW = REGULAR_ROWS - 1;

/** Relative odds of each node type on rows without a fixed type. */
export const NODE_WEIGHTS: Readonly<Record<Exclude<NodeType, "boss">, number>> =
  {
    combat: 44,
    event: 20,
    elite: 10,
    shop: 8,
    repair: 6,
    mystery: 12,
  };

/** Sector names shown on the map header. */
export const SECTOR_NAMES: readonly string[] = [
  "Outer Drift",
  "Shattered Reach",
  "Nexus Approach",
];

/**
 * @param sector - 1-based sector number.
 * @returns Its display name.
 */
export function sectorName(sector: number): string {
  return SECTOR_NAMES[sector - 1] ?? `Sector ${sector}`;
}
