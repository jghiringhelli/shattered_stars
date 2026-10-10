/**
 * Upgrade System
 *
 * Slot rules, equip validation and the campaign shop. The catalog itself
 * lives in src/data/upgrades/ (one file per category); this module exposes it
 * as UPGRADE_DEFINITIONS so existing callers keep a single import path.
 */

import type { FactionId, ShipSize } from "../config";
import type { ShipRole } from "../core/types";
import type { UpgradeDefinition, UpgradeSlotType } from "../core/upgradeTypes";
import { UPGRADE_CATALOG } from "../data/upgrades";

export type {
  UpgradeDefinition,
  UpgradeEffects,
  UpgradeSlotType,
  WeaponProfile,
} from "../core/upgradeTypes";

/** Every upgrade card, keyed by id. */
export const UPGRADE_DEFINITIONS: Readonly<Record<string, UpgradeDefinition>> =
  UPGRADE_CATALOG;
// ============================================
// Shop System
// ============================================

export interface ShopState {
  readonly availableUpgrades: string[]; // IDs of upgrades in stock
  readonly purchasedUpgrades: string[]; // IDs of upgrades owned
  readonly playerCredits: number;
}

/**
 * Get upgrades available in shop for a faction
 */
export function getShopInventory(faction: FactionId): UpgradeDefinition[] {
  return Object.values(UPGRADE_DEFINITIONS).filter((upgrade) => {
    // No faction requirement or matches faction
    if (upgrade.requiredFaction && upgrade.requiredFaction !== faction) {
      return false;
    }
    return true;
  });
}

/**
 * Check if player can afford an upgrade
 */
export function canAffordUpgrade(
  upgrade: UpgradeDefinition,
  credits: number,
): boolean {
  return credits >= upgrade.creditCost;
}

/**
 * Purchase an upgrade
 */
export function purchaseUpgrade(
  state: ShopState,
  upgradeId: string,
): ShopState | null {
  const upgrade = UPGRADE_DEFINITIONS[upgradeId];
  if (!upgrade) return null;

  if (state.playerCredits < upgrade.creditCost) {
    return null; // Can't afford
  }

  if (state.purchasedUpgrades.includes(upgradeId)) {
    return null; // Already owned
  }

  return {
    ...state,
    purchasedUpgrades: [...state.purchasedUpgrades, upgradeId],
    playerCredits: state.playerCredits - upgrade.creditCost,
  };
}

/**
 * Check if an upgrade can be equipped on a ship
 */
export function canEquipUpgrade(
  upgrade: UpgradeDefinition,
  ship: {
    size: ShipSize;
    role: ShipRole;
    faction: FactionId;
    availableSlots: UpgradeSlotType[];
    equippedUpgrades: string[];
  },
): { valid: boolean; reason?: string } {
  // Check slot availability
  if (!ship.availableSlots.includes(upgrade.slotType)) {
    return { valid: false, reason: `No ${upgrade.slotType} slot available` };
  }

  // Check faction requirement
  if (upgrade.requiredFaction && upgrade.requiredFaction !== ship.faction) {
    return { valid: false, reason: `Requires ${upgrade.requiredFaction}` };
  }

  // Check size requirement
  if (upgrade.requiredShipSize) {
    const sizes = Array.isArray(upgrade.requiredShipSize)
      ? upgrade.requiredShipSize
      : [upgrade.requiredShipSize];
    if (!sizes.includes(ship.size)) {
      return { valid: false, reason: `Requires ${sizes.join(" or ")} ship` };
    }
  }

  // Check role requirement
  if (upgrade.requiredShipRole) {
    const roles = Array.isArray(upgrade.requiredShipRole)
      ? upgrade.requiredShipRole
      : [upgrade.requiredShipRole];
    if (!roles.includes(ship.role)) {
      return { valid: false, reason: `Requires ${roles.join(" or ")} role` };
    }
  }

  // Check uniqueness
  if (upgrade.isUnique && ship.equippedUpgrades.includes(upgrade.id)) {
    return { valid: false, reason: "Already equipped (unique)" };
  }

  return { valid: true };
}

/**
 * Calculate total point cost of equipped upgrades
 */
export function calculateUpgradesCost(upgradeIds: string[]): number {
  return upgradeIds.reduce((total, id) => {
    const upgrade = UPGRADE_DEFINITIONS[id];
    return total + (upgrade?.pointCost ?? 0);
  }, 0);
}
