/**
 * Survival roguelite — meta-progression unlocks (Hades Mirror-style), pure
 * data. Bought with Star Charts, earned at the end of every run win or
 * lose. Unlocks persist in the meta profile (MetaProgression.ts).
 */

import type { FactionId } from "../../config";
import type { RelicPool } from "./relics";
import {
  GUNSHIP_STARTERS,
  HEAVY_STARTERS,
  SURVIVAL_STARTER_CHOICES,
} from "./starters";

/** One meta unlock. */
export interface MetaUnlock {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly cost: number;
  readonly description: string;
  /** Unlock that must be owned first, if any. */
  readonly requires?: string;
  readonly relicPool?: RelicPool;
  readonly startingEscorts?: number;
  readonly startingSalvage?: number;
}

/** Every meta unlock, in shop order. */
export const META_UNLOCKS: readonly MetaUnlock[] = [
  {
    id: "heavy_flagships",
    name: "Heavy Flagships",
    icon: "🛩",
    cost: 30,
    description: "Unlock a heavy-fighter flagship for every faction",
  },
  {
    id: "gunship_flagships",
    name: "Gunship Flagships",
    icon: "🚢",
    cost: 70,
    requires: "heavy_flagships",
    description: "Unlock a gunship flagship for every faction",
  },
  {
    id: "wingmate_package",
    name: "Wingmate Package",
    icon: "👥",
    cost: 25,
    startingEscorts: 1,
    description: "Start every run with 1 escort",
  },
  {
    id: "twin_wing_package",
    name: "Twin Wing Package",
    icon: "👥",
    cost: 60,
    requires: "wingmate_package",
    startingEscorts: 2,
    description: "Start every run with 2 escorts",
  },
  {
    id: "ace_pack",
    name: "Ace Relic Pack",
    icon: "↩",
    cost: 40,
    relicPool: "ace_pack",
    description: "Adds 3 maneuver relics to the pool",
  },
  {
    id: "fleet_pack",
    name: "Fleet Relic Pack",
    icon: "📻",
    cost: 40,
    relicPool: "fleet_pack",
    description: "Adds 3 escort relics to the pool",
  },
  {
    id: "salvage_pack",
    name: "Salvager Relic Pack",
    icon: "📦",
    cost: 40,
    relicPool: "salvage_pack",
    description: "Adds 4 economy relics to the pool",
  },
  {
    id: "war_chest",
    name: "War Chest",
    icon: "💰",
    cost: 35,
    startingSalvage: 30,
    description: "Start every run with +30 salvage",
  },
];

/**
 * @param id - An unlock id.
 * @returns The unlock, or undefined.
 */
export function getMetaUnlock(id: string): MetaUnlock | undefined {
  return META_UNLOCKS.find((u) => u.id === id);
}

/**
 * @param unlocked - Owned unlock ids.
 * @returns The relic pools a run may draw from.
 */
export function unlockedRelicPools(unlocked: readonly string[]): RelicPool[] {
  const pools: RelicPool[] = ["base"];
  for (const id of unlocked) {
    const pool = getMetaUnlock(id)?.relicPool;
    if (pool) pools.push(pool);
  }
  return pools;
}

/**
 * @param unlocked - Owned unlock ids.
 * @returns Escorts a new run starts with (the best package owned).
 */
export function startingEscorts(unlocked: readonly string[]): number {
  return Math.max(
    0,
    ...unlocked.map((id) => getMetaUnlock(id)?.startingEscorts ?? 0),
  );
}

/**
 * @param unlocked - Owned unlock ids.
 * @returns Extra salvage a new run starts with.
 */
export function bonusStartingSalvage(unlocked: readonly string[]): number {
  return unlocked.reduce(
    (sum, id) => sum + (getMetaUnlock(id)?.startingSalvage ?? 0),
    0,
  );
}

/**
 * @param faction - The player's faction.
 * @param unlocked - Owned unlock ids.
 * @returns Flagships the setup screen offers.
 */
export function starterChoices(
  faction: FactionId,
  unlocked: readonly string[],
): string[] {
  const choices = [...SURVIVAL_STARTER_CHOICES[faction]];
  if (unlocked.includes("heavy_flagships"))
    choices.push(HEAVY_STARTERS[faction]);
  if (unlocked.includes("gunship_flagships"))
    choices.push(GUNSHIP_STARTERS[faction]);
  return choices;
}
