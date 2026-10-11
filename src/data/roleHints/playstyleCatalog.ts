/**
 * playstyleCatalog — the play-style vocabulary role hints are written in:
 * each style's label and tagline, the hulls that fly it best, the squadmate
 * it wants and its partner style; plus ship-role nouns and titles.
 *
 * Pure data + one formatter.
 */

import type { ShipRole } from "../../core/types";
/** Play styles a card, ability, build, relic or mod can serve. */
export type Playstyle =
  | "striker"
  | "flanker"
  | "marksman"
  | "brawler"
  | "hunter"
  | "interceptor"
  | "tank"
  | "wingman"
  | "support"
  | "bomber"
  | "gunner"
  | "suppressor"
  | "ghost"
  | "salvager"
  | "commander";

/** How a play style reads, who flies it best and who it wants alongside. */
export interface PlaystyleInfo {
  readonly label: string;
  readonly tagline: string;
  /** Ship roles that make the most of it (best first). */
  readonly bestRoles: readonly ShipRole[];
  /** The squadmate it wants ("a tank drawing fire up front"). */
  readonly squadPartner: string;
  /** The style whose cards complement it best. */
  readonly partner: Playstyle;
}

function style(
  label: string,
  tagline: string,
  bestRoles: readonly ShipRole[],
  squadPartner: string,
  partner: Playstyle,
): PlaystyleInfo {
  return { label, tagline, bestRoles, squadPartner, partner };
}

/** Every play style, in tie-break order. */
export const PLAYSTYLES: Readonly<Record<Playstyle, PlaystyleInfo>> = {
  striker: style(
    "Striker",
    "hits harder in a straight fight",
    ["heavy_fighter", "gunship"],
    "a support ship keeping it in the fight",
    "hunter",
  ),
  flanker: style(
    "Flanker",
    "strikes from behind",
    ["interceptor", "light_fighter"],
    "a tank drawing fire up front",
    "interceptor",
  ),
  marksman: style(
    "Marksman",
    "lines up clean shots",
    ["heavy_fighter", "light_fighter"],
    "a wingman screening its flank",
    "interceptor",
  ),
  brawler: style(
    "Brawler",
    "wins knife fights at range 1",
    ["heavy_fighter", "gunship"],
    "a support ship repairing it",
    "tank",
  ),
  hunter: style(
    "Hunter",
    "finishes wounded prey",
    ["interceptor", "heavy_fighter"],
    "a striker stripping shields first",
    "striker",
  ),
  interceptor: style(
    "Interceptor",
    "chases and flanks",
    ["interceptor", "light_fighter"],
    "a heavy fighter holding the line",
    "flanker",
  ),
  tank: style(
    "Tank",
    "soaks fire and outlasts",
    ["gunship", "heavy_fighter"],
    "flankers hitting whatever shoots it",
    "brawler",
  ),
  wingman: style(
    "Wingman",
    "fights best in pairs",
    ["light_fighter", "heavy_fighter"],
    "a second ship flying close",
    "support",
  ),
  support: style(
    "Support",
    "shields and steadies the wing",
    ["support", "capital"],
    "fighters staying inside its aura",
    "wingman",
  ),
  bomber: style(
    "Bomber",
    "delivers heavy ordnance",
    ["bomber", "gunship"],
    "interceptors clearing its escorts",
    "marksman",
  ),
  gunner: style(
    "Gunner",
    "turret covers every angle",
    ["gunship", "support"],
    "fast ships dragging enemies past it",
    "tank",
  ),
  suppressor: style(
    "Suppressor",
    "stresses targets into mistakes",
    ["heavy_fighter", "interceptor"],
    "hunters pouncing on stressed targets",
    "hunter",
  ),
  ghost: style(
    "Ghost",
    "strikes from the cloak",
    ["interceptor", "light_fighter"],
    "a loud tank pulling attention",
    "flanker",
  ),
  salvager: style(
    "Salvager",
    "profits from every kill",
    ["light_fighter", "interceptor"],
    "escorts racking up kills",
    "hunter",
  ),
  commander: style(
    "Commander",
    "powers up the hero",
    ["heavy_fighter", "support"],
    "a hero pilot leading the wing",
    "support",
  ),
};

/** Ship roles as plural nouns ("interceptors"). */
export const ROLE_PLURALS: Readonly<Record<ShipRole, string>> = {
  light_fighter: "light fighters",
  heavy_fighter: "heavy fighters",
  interceptor: "interceptors",
  bomber: "bombers",
  support: "support ships",
  gunship: "gunships",
  capital: "capital ships",
};

/** Ship roles as a title ("Heavy fighter"). */
export const ROLE_TITLES: Readonly<Record<ShipRole, string>> = {
  light_fighter: "Light fighter",
  heavy_fighter: "Heavy fighter",
  interceptor: "Interceptor",
  bomber: "Bomber",
  support: "Support",
  gunship: "Gunship",
  capital: "Capital",
};

/**
 * @param s - A play style.
 * @returns e.g. "Flanker — strikes from behind".
 */
export function roleLine(s: Playstyle): string {
  const info = PLAYSTYLES[s];
  return `${info.label} — ${info.tagline}`;
}
