/**
 * roleSections — how the ship pickers group hulls: the section order, one
 * line per ship role and the short chip label. Pure data.
 */

import type { ShipRole } from "../../core/types";

/** Roles in the order the picker sections them (capitals last). */
export const ROLE_SECTION_ORDER: readonly ShipRole[] = [
  "light_fighter",
  "heavy_fighter",
  "interceptor",
  "bomber",
  "gunship",
  "support",
  "capital",
];

/** One line per role — shown under every section header. */
export const ROLE_BLURBS: Readonly<Record<ShipRole, string>> = {
  light_fighter: "Cheap, quick wingmen — best flown in numbers",
  heavy_fighter: "Balanced all-rounders — the backbone of a squad",
  interceptor: "Very agile hunters — fragile, but hard to pin down",
  bomber: "Slow ordnance carriers — big first strikes, need escorts",
  gunship: "Tanky gun platforms — high firepower, sluggish turns",
  support: "Shield, steady and coordinate the rest of the wing",
  capital: "Huge flagships — Epic format only",
};

/** Three-letter filter-chip label per role. */
export const ROLE_CHIP_LABELS: Readonly<Record<ShipRole, string>> = {
  light_fighter: "LGT",
  heavy_fighter: "HVY",
  interceptor: "INT",
  bomber: "BMB",
  gunship: "GUN",
  support: "SUP",
  capital: "CAP",
};

/**
 * @param roles - Roles in any order.
 * @returns The roles sorted into section order.
 */
export function sortRolesForSections(
  roles: readonly ShipRole[],
): readonly ShipRole[] {
  return ROLE_SECTION_ORDER.filter((role) => roles.includes(role));
}
