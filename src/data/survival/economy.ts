/**
 * Survival roguelite — run economy constants (pure data): salvage earned
 * per kill and per node, shop prices, repair amounts and the meta-currency
 * (Star Charts) formula. See docs/adr/ADR-0004-survival-roguelite-run-structure.md.
 */

import type { WaveTier } from "../../arcade/systems/SurvivalLoadouts";
import type { NodeType } from "./nodes";

/** Salvage a run starts with. */
export const STARTING_SALVAGE = 40;

/** Rerolls a run starts with. */
export const STARTING_REROLLS = 1;

/** Salvage per enemy destroyed by the player's fleet, by rank. */
export const SALVAGE_PER_KILL: Readonly<Record<WaveTier, number>> = {
  regular: 3,
  elite: 10,
  boss: 40,
};

/** Salvage awarded for clearing a battle node, by type. */
export const NODE_CLEAR_SALVAGE: Readonly<Partial<Record<NodeType, number>>> = {
  combat: 15,
  elite: 30,
  boss: 60,
};

/** Shop base prices (salvage) before discounts and ascension. */
export const SHOP_PRICES = {
  repair: 35,
  relicCommon: 60,
  relicUncommon: 90,
  relicRare: 130,
  escort: 75,
  reroll: 20,
  upgrade: 65,
} as const;

/** Fraction of the fleet's max hull a shop repair restores. */
export const SHOP_REPAIR_FRACTION = 0.3;

/** Fraction of the fleet's max hull a repair dock restores. */
export const DOCK_REPAIR_FRACTION = 0.45;

/** Max upgrade level of one ship (each level: +1 laser damage, +hull). */
export const MAX_SHIP_UPGRADES = 3;

/** Extra miniature hull points per upgrade level (scaled by DURABILITY_SCALE). */
export const UPGRADE_HULL_POINTS = 1;

/** Laser damage per upgrade level. */
export const UPGRADE_LASER_DAMAGE = 1;

/**
 * Fraction of missing shields restored between nodes (shield damage
 * persists, but capacitors recover half of it in transit).
 */
export const SHIELD_RECOVERY_BETWEEN_NODES = 0.5;

/** Salvage paid instead of a power when skipping a draft. */
export const SKIP_DRAFT_SALVAGE = 12;

/** Max salvage multiplier floor (ascension can never zero the economy). */
export const MIN_SALVAGE_MULTIPLIER = 0.5;

/** Star Charts (meta currency) formula — earned win or lose. */
export const META_PER_NODE = 2;
export const META_PER_SECTOR = 10;
export const META_PER_TEN_KILLS = 1;
export const META_VICTORY_BONUS = 40;
export const META_PER_ASCENSION = 4;
