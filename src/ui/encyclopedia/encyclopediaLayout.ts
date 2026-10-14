/**
 * encyclopediaLayout — layout grid, labels and colour tables for the ship
 * encyclopedia (filter chips, ship list, detail panel). Pure data and pure
 * helpers so the scene and its components share one source of geometry.
 */

import type { FactionId } from "../../config";
import type { ShipRole } from "../../core/types";
import type { HoloRect } from "../menu/holoChrome";
import { MENU_LAYOUT } from "../menu/MenuScaffold";
import { HOLO_PALETTE, HOLO_SPACING, SIDE_COLORS } from "../theme/HoloTheme";

/** Left column (filter chips + ship list) geometry. */
export const ENCYCLOPEDIA_LAYOUT = {
  /** Width of the left column. */
  listWidth: 400,
  /** Width of the search field sharing the filter row with the faction chips. */
  searchWidth: 128,
  /** Gap between the left column and the detail panel. */
  columnGap: HOLO_SPACING.lg,
  /** Filter chip height. */
  chipHeight: 28,
  /** Gap between filter chips. */
  chipGap: HOLO_SPACING.xs,
  /** Gap between the chip row and the ship list panel. */
  chipToListGap: HOLO_SPACING.md,
  /** Ship list row pitch (height of one row). */
  rowHeight: 30,
  /** Vertical gap between rows. */
  rowGap: 2,
  /** Wheel delta → scroll pixels. */
  wheelScale: 0.35,
} as const;

/** Header strip height of HoloPanel (kept in sync with HoloPanel). */
export const PANEL_HEADER_HEIGHT = 28;

/** A faction filter chip. */
export interface FactionChipSpec {
  /** Faction filtered by the chip; null = every faction. */
  readonly faction: FactionId | null;
  readonly label: string;
}

/** Filter chips in display order. */
export const FACTION_CHIPS: ReadonlyArray<FactionChipSpec> = [
  { faction: null, label: "ALL" },
  { faction: "terran_hegemony", label: "HGMY" },
  { faction: "free_confederation", label: "CONF" },
  { faction: "synthetic_collective", label: "SYNT" },
  { faction: "void_corsairs", label: "CORS" },
  { faction: "ascendant_empire", label: "ASCN" },
];

/** Role chip colours, harmonised with the holo palette. */
export const ROLE_COLORS: Readonly<Record<ShipRole, number>> = {
  light_fighter: HOLO_PALETTE.textSecondary,
  heavy_fighter: SIDE_COLORS.ally,
  interceptor: HOLO_PALETTE.accent,
  bomber: HOLO_PALETTE.warning,
  support: HOLO_PALETTE.success,
  gunship: HOLO_PALETTE.danger,
  capital: HOLO_PALETTE.target,
};

/**
 * Human-readable uppercase label for an id such as "heavy_fighter".
 *
 * @param id - Snake-case identifier.
 * @returns e.g. "HEAVY FIGHTER".
 */
export function snakeToLabel(id: string): string {
  return id.replace(/_/g, " ").toUpperCase();
}

/** Screen regions of the encyclopedia. */
export interface EncyclopediaRegions {
  /** Section tabs (ships / pilots / upgrades / factions / bestiary). */
  readonly tabs: HoloRect;
  readonly chips: HoloRect;
  /** Type-to-search field. */
  readonly search: HoloRect;
  readonly list: HoloRect;
  readonly detail: HoloRect;
}

/**
 * Compute the encyclopedia regions for a screen size.
 *
 * @param width - Screen width.
 * @param height - Screen height.
 * @returns Tab row, chip row, search field, list panel and detail panel.
 */
export function encyclopediaRegions(
  width: number,
  height: number,
): EncyclopediaRegions {
  const L = ENCYCLOPEDIA_LAYOUT;
  const left = MENU_LAYOUT.margin;
  const top = MENU_LAYOUT.contentTop;
  const bottom = height - MENU_LAYOUT.margin;
  const row = (y: number, h: number): HoloRect => ({
    x: left,
    y,
    width: L.listWidth,
    height: h,
  });
  const filterTop = top + L.chipHeight + L.chipGap;
  const listTop = filterTop + L.chipHeight + L.chipToListGap;
  const detailX = left + L.listWidth + L.columnGap;
  return {
    tabs: row(top, L.chipHeight),
    search: { ...row(filterTop, L.chipHeight), width: L.searchWidth },
    chips: {
      ...row(filterTop, L.chipHeight),
      x: left + L.searchWidth + L.chipGap * 2,
      width: L.listWidth - L.searchWidth - L.chipGap * 2,
    },
    list: row(listTop, bottom - listTop),
    detail: {
      x: detailX,
      y: top,
      width: width - MENU_LAYOUT.margin - detailX,
      height: bottom - top,
    },
  };
}
