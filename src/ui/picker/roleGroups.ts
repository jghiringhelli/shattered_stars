/**
 * roleGroups — THE role grouping of every pick screen: the six non-capital
 * roles in picker order, each with its header text (title, a one-line
 * "what this role does in a squad" from the message catalog, and an example
 * hull of the faction). Capital and huge ships never appear (Epic / Boss
 * modes only). Pure: no Phaser.
 */

import type { ShipDefinition, ShipRole } from "../../core/types";
import { ROLE_SECTION_ORDER } from "../../data/roleHints/roleSections";
import { ROLE_PLURALS } from "../../data/roleHints/playstyleCatalog";
import { t } from "../../i18n";

/** The roles a non-Epic pick screen offers, in picker order. */
export const PICKABLE_ROLES: readonly ShipRole[] = ROLE_SECTION_ORDER.filter(
  (role) => role !== "capital",
);

/** Header text of one role section. */
export interface RoleHeading {
  /** "HEAVY FIGHTERS". */
  readonly title: string;
  /** One line: what the role does in a squad. */
  readonly blurb: string;
  /** "E.g. Gladius-class Fighter", or "" without an example. */
  readonly exampleLine: string;
}

/** A role and the ships of a faction in it. */
export interface RoleGroup extends RoleHeading {
  readonly role: ShipRole;
  readonly ships: readonly ShipDefinition[];
}

/**
 * @param ship - A ship.
 * @returns Whether it is a capital / huge hull (Epic and Boss modes only).
 */
export function isCapitalShip(ship: ShipDefinition): boolean {
  return ship.role === "capital" || ship.baseStats.size === "huge";
}

function blurbOf(role: ShipRole): string {
  switch (role) {
    case "light_fighter":
      return t("pick.role.lightFighter.blurb");
    case "heavy_fighter":
      return t("pick.role.heavyFighter.blurb");
    case "interceptor":
      return t("pick.role.interceptor.blurb");
    case "bomber":
      return t("pick.role.bomber.blurb");
    case "gunship":
      return t("pick.role.gunship.blurb");
    case "support":
      return t("pick.role.support.blurb");
    case "capital":
      return t("pick.role.capital.blurb");
  }
}

/**
 * @param role - A ship role.
 * @param example - Name of a hull of the role to show as an example.
 * @returns The role's header text.
 */
export function roleHeading(role: ShipRole, example?: string): RoleHeading {
  return {
    title: ROLE_PLURALS[role].toUpperCase(),
    blurb: blurbOf(role),
    exampleLine: example ? t("pick.role.example", { example }) : "",
  };
}

/**
 * @param role - A ship role.
 * @param ships - The faction's ships (the first one of the role is the example).
 * @returns The role's header text with an example hull of that faction.
 */
export function describeRole(role: ShipRole, ships: readonly ShipDefinition[]): RoleHeading {
  return roleHeading(role, ships.find((ship) => ship.role === role)?.name);
}

/**
 * Groups a faction's ships into the six pickable roles.
 *
 * @param ships - Ships in list order (capital / huge ones are left out).
 * @returns The non-empty groups in picker order; the first ship of a group is its example.
 */
export function groupShipsByRole(ships: readonly ShipDefinition[]): RoleGroup[] {
  const groups: RoleGroup[] = [];
  for (const role of PICKABLE_ROLES) {
    const inRole = ships.filter((ship) => ship.role === role && !isCapitalShip(ship));
    if (inRole.length === 0) continue;
    groups.push({ role, ships: inRole, ...roleHeading(role, inRole[0]!.name) });
  }
  return groups;
}

/**
 * @param ships - Ships in any order.
 * @returns The ships sorted into picker role order (capitals last), list order kept inside a role.
 */
export function orderShipsByRole(ships: readonly ShipDefinition[]): ShipDefinition[] {
  const rank = (role: ShipRole): number => ROLE_SECTION_ORDER.indexOf(role);
  return ships
    .map((ship, index) => ({ ship, index }))
    .sort((a, b) => rank(a.ship.role) - rank(b.ship.role) || a.index - b.index)
    .map(({ ship }) => ship);
}
