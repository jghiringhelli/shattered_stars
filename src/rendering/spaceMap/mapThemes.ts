/**
 * Map themes — the look of a battle arena: painted backdrop, star palette,
 * dust, nebula wisps and the drifting decorations (rocks, debris, shards, a
 * planet limb). Names and colours come from the astrography in
 * docs/lore/universe.md. Pure data plus seed-based selection; the same seed
 * always yields the same theme (online battles pick from the shared match
 * seed so both clients show the same map).
 */

import { createSeededRng } from "../../utils/random";
import type { MapTheme } from "./mapThemeTypes";
import { MAP_THEMES } from "./themeCatalog";

export { MAP_THEMES };
export type { DecorKind, MapTheme, PlanetKind, PlanetSpec } from "./mapThemeTypes";

/** Selector value meaning "pick by seed". */
export const RANDOM_MAP_THEME = "random";

/** Ids in selection order. */
export const MAP_THEME_IDS: readonly string[] = MAP_THEMES.map((t) => t.id);

/** Mixes the seed so neighbouring seeds pick unrelated themes. */
const THEME_SEED_SALT = 0x5ca1ab1e;

/**
 * @param id - Theme id.
 * @returns The theme, or undefined for an unknown id.
 */
export function findMapTheme(id: string | undefined): MapTheme | undefined {
  return MAP_THEMES.find((theme) => theme.id === id);
}

/**
 * Pick a theme from a seed (deterministic).
 *
 * @param seed - Any integer (match seed, run seed, ...).
 * @returns One of {@link MAP_THEMES}.
 */
export function themeForSeed(seed: number): MapTheme {
  const rng = createSeededRng((seed ^ THEME_SEED_SALT) >>> 0);
  return MAP_THEMES[rng.nextInt(0, MAP_THEMES.length - 1)]!;
}

/**
 * Resolve a player's "Map" choice.
 *
 * @param choice - A theme id, "random", or nothing.
 * @param seed - Seed used for random / unknown choices.
 * @returns The chosen theme, else the seed's.
 */
export function resolveMapTheme(
  choice: string | undefined,
  seed: number,
): MapTheme {
  return findMapTheme(choice) ?? themeForSeed(seed);
}

/** Survival sectors, in the order a run crosses the Reach. */
const SECTOR_THEME_IDS: readonly string[] = [
  "kessa_lane",
  "tessaly_junction",
  "hales_run",
  "cinder_reach",
  "prometheus_shadow",
  "reach_shards",
  "deepmaw_trench",
  "void_blackfield",
];

/**
 * @param sector - Survival sector number (1-based; wraps past the last).
 * @returns The id of the theme that sector is fought in.
 */
export function themeIdForSector(sector: number): string {
  const count = SECTOR_THEME_IDS.length;
  const index = (((Math.trunc(sector) - 1) % count) + count) % count;
  return SECTOR_THEME_IDS[index]!;
}
