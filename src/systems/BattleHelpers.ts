/**
 * BattleHelpers — shared utilities used by all battle scene types.
 *
 * Extracted from duplicated implementations across ArcadeBattleScene,
 * TurnBasedBattleScene, ContinuousTacticalScene, SurvivalScene, and
 * EpicBattleScene to ensure consistent behavior across all game modes.
 */

import { getShipLoadouts } from "../data/ShipLoadouts";
import { UPGRADE_DEFINITIONS } from "./UpgradeSystem";

// ============================================
// Target Finding
// ============================================

/** Minimal shape required for closest-enemy search. */
export interface BattleEntity {
  readonly x: number;
  readonly y: number;
  readonly faction: string;
  readonly hull: number;
}

/**
 * Finds the closest living enemy ship to `ship` in the given map.
 * Uses Euclidean distance; ignores ships of the same faction and dead ships.
 *
 * @param ship - The ship doing the search.
 * @param ships - All ships currently in the battle.
 * @returns The closest enemy, or null if none exist.
 */
export function findClosestEnemy<T extends BattleEntity>(
  ship: T,
  ships: Map<string, T>,
): T | null {
  let closest: T | null = null;
  let closestDist = Infinity;

  for (const other of ships.values()) {
    if (other.faction === ship.faction || other.hull <= 0) continue;
    const dist = Math.hypot(other.x - ship.x, other.y - ship.y);
    if (dist < closestDist) {
      closest = other;
      closestDist = dist;
    }
  }

  return closest;
}

// ============================================
// Loadout / Upgrade Application
// ============================================

/**
 * Minimal shape required to apply loadout stat bonuses.
 * `combatStats` is optional — present in turn-based and continuous scenes
 * (attackDice / agilityDice dice pools); absent in arcade scenes.
 */
export interface LoadoutTarget {
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  readonly definitionId: string;
  combatStats?: { attackDice: number; agilityDice: number };
}

/**
 * Applies the stat bonuses from a ship's loadout upgrades to the live ship object.
 *
 * Must be called right after `createShip()` / ship object construction, before
 * the first combat interaction. Modifies hull, shields, and (if present)
 * attackDice / agilityDice in-place.
 *
 * @param ship - The freshly spawned ship object.
 * @param loadoutId - The ID of the equipped loadout, or null/undefined for base config.
 */
export function applyLoadoutEffects(
  ship: LoadoutTarget,
  loadoutId: string | null | undefined,
): void {
  if (!loadoutId) return;

  const loadout = getShipLoadouts(ship.definitionId).find(
    (l) => l.id === loadoutId,
  );
  if (!loadout) return;

  for (const upgradeId of loadout.upgrades) {
    const upg = UPGRADE_DEFINITIONS[upgradeId];
    if (!upg?.effects) continue;

    const {
      hullBonus = 0,
      shieldBonus = 0,
      attackBonus = 0,
      agilityBonus = 0,
    } = upg.effects;

    if (hullBonus) {
      ship.hull += hullBonus;
      ship.maxHull += hullBonus;
    }
    if (shieldBonus) {
      ship.shields += shieldBonus;
      ship.maxShields += shieldBonus;
    }
    if (attackBonus && ship.combatStats) {
      ship.combatStats.attackDice = Math.max(
        1,
        ship.combatStats.attackDice + attackBonus,
      );
    }
    if (agilityBonus && ship.combatStats) {
      ship.combatStats.agilityDice = Math.max(
        0,
        ship.combatStats.agilityDice + agilityBonus,
      );
    }
  }
}
