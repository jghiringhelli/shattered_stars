/**
 * Survival roguelite — the relic registry: lookup, pools (meta unlocks),
 * seeded draws, prices and archetype set bonuses. Pure.
 */

import type { RandomGenerator } from "../../utils/random";
import { SHOP_PRICES } from "./economy";
import { ACE_RELICS, HUNTER_RELICS } from "./relicCatalogCombat";
import {
  BULWARK_RELICS,
  SALVAGER_RELICS,
  SQUADRON_RELICS,
} from "./relicCatalogSupport";
import {
  ARCHETYPE_SET_SIZE,
  ARCHETYPE_SETS,
  type ArchetypeSet,
  type Relic,
  type RelicArchetype,
  type RelicPool,
  type RelicRarity,
} from "./relics";

/** Every relic in the game. */
export const ALL_RELICS: readonly Relic[] = [
  ...ACE_RELICS,
  ...HUNTER_RELICS,
  ...SQUADRON_RELICS,
  ...BULWARK_RELICS,
  ...SALVAGER_RELICS,
];

const RELICS_BY_ID: ReadonlyMap<string, Relic> = new Map(
  ALL_RELICS.map((relic) => [relic.id, relic]),
);

/**
 * @param id - A relic id.
 * @returns The relic, or undefined for an unknown id.
 */
export function getRelic(id: string): Relic | undefined {
  return RELICS_BY_ID.get(id);
}

/**
 * @param ids - Relic ids (unknown ids are skipped).
 * @returns The known relics, in order.
 */
export function relicsOf(ids: readonly string[]): Relic[] {
  return ids.flatMap((id) => {
    const relic = RELICS_BY_ID.get(id);
    return relic ? [relic] : [];
  });
}

/** Base salvage price of a relic by rarity. */
export const RELIC_PRICE: Readonly<Record<RelicRarity, number>> = {
  common: SHOP_PRICES.relicCommon,
  uncommon: SHOP_PRICES.relicUncommon,
  rare: SHOP_PRICES.relicRare,
};

/** Options for a seeded relic draw. */
export interface RelicDrawOptions {
  readonly owned: readonly string[];
  readonly pools: readonly RelicPool[];
  readonly count: number;
  /** Only draw at or above this rarity (boss / elite rewards). */
  readonly minRarity?: RelicRarity;
}

const RARITY_RANK: Readonly<Record<RelicRarity, number>> = {
  common: 0,
  uncommon: 1,
  rare: 2,
};

/**
 * Draws distinct relics the run does not own yet from the unlocked pools.
 * When the rarity filter leaves too few, lower rarities fill the gap.
 *
 * @param rng - The run's seeded RNG for this draw.
 * @param options - Owned relics, unlocked pools, count and rarity floor.
 * @returns Up to `count` relics.
 */
export function drawRelics(
  rng: RandomGenerator,
  options: RelicDrawOptions,
): Relic[] {
  const available = ALL_RELICS.filter(
    (relic) =>
      options.pools.includes(relic.pool) && !options.owned.includes(relic.id),
  );
  const floor = RARITY_RANK[options.minRarity ?? "common"];
  const preferred = rng.shuffle(
    available.filter((relic) => RARITY_RANK[relic.rarity] >= floor),
  );
  const rest = rng.shuffle(
    available.filter((relic) => RARITY_RANK[relic.rarity] < floor),
  );
  return [...preferred, ...rest].slice(0, Math.max(0, options.count));
}

/**
 * @param relicIds - Owned relic ids.
 * @returns How many relics of each archetype the run owns.
 */
export function archetypeCounts(
  relicIds: readonly string[],
): Record<RelicArchetype, number> {
  const counts: Record<RelicArchetype, number> = {
    ace: 0,
    hunter: 0,
    squadron: 0,
    bulwark: 0,
    salvager: 0,
  };
  for (const relic of relicsOf(relicIds)) counts[relic.archetype] += 1;
  return counts;
}

/**
 * @param relicIds - Owned relic ids.
 * @returns The archetype set bonuses the run has completed.
 */
export function activeArchetypeSets(
  relicIds: readonly string[],
): ArchetypeSet[] {
  const counts = archetypeCounts(relicIds);
  return (Object.keys(counts) as RelicArchetype[])
    .filter((archetype) => counts[archetype] >= ARCHETYPE_SET_SIZE)
    .map((archetype) => ARCHETYPE_SETS[archetype]);
}

/**
 * @param relic - A relic.
 * @param ownedIds - Relics the run already owns.
 * @returns How many owned relics share at least one synergy tag with it.
 */
export function synergyMatches(
  relic: Relic,
  ownedIds: readonly string[],
): number {
  return relicsOf(ownedIds).filter(
    (owned) =>
      owned.id !== relic.id && owned.tags.some((t) => relic.tags.includes(t)),
  ).length;
}
