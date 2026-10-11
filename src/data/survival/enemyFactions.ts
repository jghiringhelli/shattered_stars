/**
 * Survival roguelite — enemy faction selection (pure). Every faction except
 * the player's own can field enemies — including the Free Confederation,
 * which the old wave rotation never used.
 */

import type { FactionId } from "../../config";
import type { RandomGenerator } from "../../utils/random";

/** All factions, in a stable order. */
export const ALL_FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

/**
 * @param player - The player's faction.
 * @returns Factions that may appear as enemies.
 */
export function hostileFactions(player: FactionId): FactionId[] {
  return ALL_FACTIONS.filter((faction) => faction !== player);
}

/**
 * @param rng - Seeded RNG of the node.
 * @param player - The player's faction.
 * @returns The faction a node's enemies fly for.
 */
export function pickEnemyFaction(
  rng: RandomGenerator,
  player: FactionId,
): FactionId {
  const pool = hostileFactions(player);
  return rng.pick(pool) ?? pool[0]!;
}
