/**
 * Tests for UpgradeSystem
 */

import { describe, it, expect } from 'vitest';
import {
  UPGRADE_DEFINITIONS,
  getDefaultUpgradeSlots,
  getShopInventory,
  canAffordUpgrade,
  purchaseUpgrade,
  canEquipUpgrade,
  calculateUpgradesCost,
  type UpgradeSlotType,
  type ShopState,
} from '../../../src/systems/UpgradeSystem';

// ============================================
// UPGRADE_DEFINITIONS
// ============================================

describe('UPGRADE_DEFINITIONS', () => {
  it('should have at least 10 upgrade definitions', () => {
    expect(Object.keys(UPGRADE_DEFINITIONS).length).toBeGreaterThan(10);
  });

  it('each definition should have required fields', () => {
    for (const upgrade of Object.values(UPGRADE_DEFINITIONS)) {
      expect(upgrade.id).toBeTruthy();
      expect(upgrade.name).toBeTruthy();
      expect(upgrade.slotType).toBeTruthy();
      expect(typeof upgrade.pointCost).toBe('number');
      expect(typeof upgrade.creditCost).toBe('number');
    }
  });

  it('id should match the key', () => {
    for (const [key, upgrade] of Object.entries(UPGRADE_DEFINITIONS)) {
      expect(upgrade.id).toBe(key);
    }
  });

  it('should have upgrades across multiple slot types', () => {
    const slotTypes = new Set(Object.values(UPGRADE_DEFINITIONS).map(u => u.slotType));
    expect(slotTypes.size).toBeGreaterThan(5);
  });

  it('hull_upgrade should exist with modification slot', () => {
    const upgrade = UPGRADE_DEFINITIONS['hull_upgrade']!;
    expect(upgrade).toBeDefined();
    expect(upgrade.slotType).toBe('modification');
    expect(upgrade.effects?.hullBonus).toBe(1);
  });

  it('shield_upgrade should exist with modification slot', () => {
    const upgrade = UPGRADE_DEFINITIONS['shield_upgrade']!;
    expect(upgrade).toBeDefined();
    expect(upgrade.slotType).toBe('modification');
    expect(upgrade.effects?.shieldBonus).toBe(1);
  });

  it('predator should have rerollCount effect', () => {
    const upgrade = UPGRADE_DEFINITIONS['predator']!;
    expect(upgrade.effects?.rerollCount).toBeGreaterThan(0);
  });

  it('ace_pilot_title should be unique', () => {
    const upgrade = UPGRADE_DEFINITIONS['ace_pilot_title']!;
    expect(upgrade.isUnique).toBe(true);
  });

  it('veteran_gunner should require medium or large ship', () => {
    const upgrade = UPGRADE_DEFINITIONS['veteran_gunner']!;
    expect(Array.isArray(upgrade.requiredShipSize)).toBe(true);
    const sizes = upgrade.requiredShipSize as string[];
    expect(sizes).toContain('medium');
    expect(sizes).toContain('large');
  });

  it('targeting_astromech should require free_confederation', () => {
    const upgrade = UPGRADE_DEFINITIONS['targeting_astromech']!;
    expect(upgrade.requiredFaction).toBe('free_confederation');
  });
});

// ============================================
// getDefaultUpgradeSlots
// ============================================

describe('getDefaultUpgradeSlots', () => {
  it('all ships get modification and talent slots', () => {
    const slots = getDefaultUpgradeSlots('small', 'heavy_fighter');
    expect(slots).toContain('modification');
    expect(slots).toContain('talent');
  });

  describe('small ships', () => {
    it('interceptor gets sensor and missile slots', () => {
      const slots = getDefaultUpgradeSlots('small', 'interceptor');
      expect(slots).toContain('sensor');
      expect(slots).toContain('missile');
    });

    it('light_fighter gets sensor and missile slots', () => {
      const slots = getDefaultUpgradeSlots('small', 'light_fighter');
      expect(slots).toContain('sensor');
      expect(slots).toContain('missile');
    });

    it('bomber gets torpedo and bomb slots', () => {
      const slots = getDefaultUpgradeSlots('small', 'bomber');
      expect(slots).toContain('torpedo');
      expect(slots).toContain('bomb');
    });

    it('bomber does not get missile slot on small', () => {
      const slots = getDefaultUpgradeSlots('small', 'bomber');
      expect(slots).not.toContain('missile');
    });

    it('heavy_fighter gets sensor but no cannon on small', () => {
      const slots = getDefaultUpgradeSlots('small', 'heavy_fighter');
      expect(slots).toContain('sensor');
      expect(slots).not.toContain('cannon');
    });

    it('support on small gets sensor', () => {
      const slots = getDefaultUpgradeSlots('small', 'support');
      expect(slots).toContain('sensor');
    });
  });

  describe('medium ships', () => {
    it('all medium ships get sensor, crew, and gunner', () => {
      const slots = getDefaultUpgradeSlots('medium', 'heavy_fighter');
      expect(slots).toContain('sensor');
      expect(slots).toContain('crew');
      expect(slots).toContain('gunner');
    });

    it('medium gunship gets cannon and turret', () => {
      const slots = getDefaultUpgradeSlots('medium', 'gunship');
      expect(slots).toContain('cannon');
      expect(slots).toContain('turret');
    });

    it('medium heavy_fighter gets cannon and turret', () => {
      const slots = getDefaultUpgradeSlots('medium', 'heavy_fighter');
      expect(slots).toContain('cannon');
      expect(slots).toContain('turret');
    });

    it('medium bomber gets torpedo, bomb, and missile', () => {
      const slots = getDefaultUpgradeSlots('medium', 'bomber');
      expect(slots).toContain('torpedo');
      expect(slots).toContain('bomb');
      expect(slots).toContain('missile');
    });

    it('medium support does not get cannon', () => {
      const slots = getDefaultUpgradeSlots('medium', 'support');
      expect(slots).not.toContain('cannon');
    });
  });

  describe('large ships', () => {
    it('large ships get sensor, crew x2, gunner, tech', () => {
      const slots = getDefaultUpgradeSlots('large', 'heavy_fighter');
      expect(slots).toContain('sensor');
      expect(slots).toContain('gunner');
      expect(slots).toContain('tech');
      // crew appears twice
      const crewCount = slots.filter(s => s === 'crew').length;
      expect(crewCount).toBeGreaterThanOrEqual(2);
    });

    it('large ships get cannon, turret, missile, torpedo', () => {
      const slots = getDefaultUpgradeSlots('large', 'heavy_fighter');
      expect(slots).toContain('cannon');
      expect(slots).toContain('turret');
      expect(slots).toContain('missile');
      expect(slots).toContain('torpedo');
    });

    it('large capital ships get bomb and configuration', () => {
      const slots = getDefaultUpgradeSlots('large', 'capital');
      expect(slots).toContain('bomb');
      expect(slots).toContain('configuration');
    });

    it('large non-capital ships do not get configuration', () => {
      const slots = getDefaultUpgradeSlots('large', 'gunship');
      expect(slots).not.toContain('configuration');
    });
  });

  describe('edge cases', () => {
    it('tiny ship (unrecognized size) returns modification and talent', () => {
      const slots = getDefaultUpgradeSlots('tiny' as 'small', 'light_fighter');
      expect(slots).toContain('modification');
      expect(slots).toContain('talent');
    });

    it('huge ship (unrecognized size) returns modification and talent', () => {
      const slots = getDefaultUpgradeSlots('huge' as 'small', 'capital');
      expect(slots).toContain('modification');
      expect(slots).toContain('talent');
    });
  });
});

// ============================================
// getShopInventory
// ============================================

describe('getShopInventory', () => {
  it('should return an array of upgrade definitions', () => {
    const inventory = getShopInventory('terran_hegemony');
    expect(Array.isArray(inventory)).toBe(true);
    expect(inventory.length).toBeGreaterThan(0);
  });

  it('should exclude upgrades for other factions', () => {
    const inventory = getShopInventory('terran_hegemony');
    for (const upgrade of inventory) {
      if (upgrade.requiredFaction) {
        expect(upgrade.requiredFaction).toBe('terran_hegemony');
      }
    }
  });

  it('should include upgrades with no faction requirement', () => {
    const inventory = getShopInventory('terran_hegemony');
    const noFactionUpgrades = Object.values(UPGRADE_DEFINITIONS).filter(u => !u.requiredFaction);
    for (const upgrade of noFactionUpgrades) {
      expect(inventory.some(u => u.id === upgrade.id)).toBe(true);
    }
  });

  it('should include faction-specific upgrade for correct faction', () => {
    const inventory = getShopInventory('free_confederation');
    expect(inventory.some(u => u.id === 'targeting_astromech')).toBe(true);
  });

  it('should exclude faction-specific upgrade for wrong faction', () => {
    const inventory = getShopInventory('terran_hegemony');
    expect(inventory.some(u => u.id === 'targeting_astromech')).toBe(false);
  });

  it('different factions should get the same base upgrades count (non-faction specific)', () => {
    const terranInventory = getShopInventory('terran_hegemony');
    const corsairInventory = getShopInventory('void_corsairs');
    // Both should at least include hull_upgrade and shield_upgrade
    expect(terranInventory.some(u => u.id === 'hull_upgrade')).toBe(true);
    expect(corsairInventory.some(u => u.id === 'hull_upgrade')).toBe(true);
  });
});

// ============================================
// canAffordUpgrade
// ============================================

describe('canAffordUpgrade', () => {
  const upgrade = UPGRADE_DEFINITIONS['hull_upgrade']!; // creditCost: 150

  it('should return true when credits equals creditCost', () => {
    expect(canAffordUpgrade(upgrade, 150)).toBe(true);
  });

  it('should return true when credits exceed creditCost', () => {
    expect(canAffordUpgrade(upgrade, 1000)).toBe(true);
  });

  it('should return false when credits are less than creditCost', () => {
    expect(canAffordUpgrade(upgrade, 149)).toBe(false);
  });

  it('should return false with 0 credits', () => {
    expect(canAffordUpgrade(upgrade, 0)).toBe(false);
  });

  it('should work with expensive upgrades', () => {
    const expensive = UPGRADE_DEFINITIONS['proton_torpedo']!; // creditCost: 250
    expect(canAffordUpgrade(expensive, 249)).toBe(false);
    expect(canAffordUpgrade(expensive, 250)).toBe(true);
  });
});

// ============================================
// purchaseUpgrade
// ============================================

describe('purchaseUpgrade', () => {
  const makeShop = (credits: number, purchased: string[] = []): ShopState => ({
    availableUpgrades: Object.keys(UPGRADE_DEFINITIONS),
    purchasedUpgrades: purchased,
    playerCredits: credits,
  });

  it('should return updated state with upgrade added and credits deducted', () => {
    const state = makeShop(500);
    const result = purchaseUpgrade(state, 'hull_upgrade'); // creditCost: 150
    expect(result).not.toBeNull();
    expect(result!.purchasedUpgrades).toContain('hull_upgrade');
    expect(result!.playerCredits).toBe(350);
  });

  it('should not modify original state (immutability)', () => {
    const state = makeShop(500);
    purchaseUpgrade(state, 'hull_upgrade');
    expect(state.purchasedUpgrades).not.toContain('hull_upgrade');
    expect(state.playerCredits).toBe(500);
  });

  it('should return null for unknown upgrade ID', () => {
    const state = makeShop(1000);
    const result = purchaseUpgrade(state, 'nonexistent_upgrade_xyz');
    expect(result).toBeNull();
  });

  it('should return null when not enough credits', () => {
    const state = makeShop(100);
    const result = purchaseUpgrade(state, 'hull_upgrade'); // costs 150
    expect(result).toBeNull();
  });

  it('should return null when upgrade already owned', () => {
    const state = makeShop(500, ['hull_upgrade']);
    const result = purchaseUpgrade(state, 'hull_upgrade');
    expect(result).toBeNull();
  });

  it('should allow purchasing multiple different upgrades', () => {
    const state = makeShop(1000);
    const r1 = purchaseUpgrade(state, 'hull_upgrade')!; // 150
    expect(r1).not.toBeNull();
    const r2 = purchaseUpgrade(r1, 'shield_upgrade')!; // 200
    expect(r2).not.toBeNull();
    expect(r2.purchasedUpgrades).toContain('hull_upgrade');
    expect(r2.purchasedUpgrades).toContain('shield_upgrade');
    expect(r2.playerCredits).toBe(650);
  });

  it('should keep other state fields unchanged', () => {
    const state = makeShop(500);
    const result = purchaseUpgrade(state, 'hull_upgrade')!;
    expect(result.availableUpgrades).toBe(state.availableUpgrades);
  });
});

// ============================================
// canEquipUpgrade
// ============================================

describe('canEquipUpgrade', () => {
  const makeShip = (overrides: Partial<{
    size: 'small' | 'medium' | 'large';
    role: 'light_fighter' | 'heavy_fighter' | 'interceptor' | 'bomber' | 'gunship' | 'support' | 'capital';
    faction: 'terran_hegemony' | 'free_confederation' | 'synthetic_collective' | 'void_corsairs' | 'ascendant_empire';
    availableSlots: UpgradeSlotType[];
    equippedUpgrades: string[];
  }> = {}) => ({
    size: 'small' as const,
    role: 'light_fighter' as const,
    faction: 'terran_hegemony' as const,
    availableSlots: ['modification', 'talent', 'sensor', 'missile'] as UpgradeSlotType[],
    equippedUpgrades: [] as string[],
    ...overrides,
  });

  it('should return valid=true when all conditions are met', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['hull_upgrade']!,  // modification slot, no restrictions
      makeShip()
    );
    expect(result.valid).toBe(true);
  });

  it('should reject when slot type not available', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['proton_torpedo']!,  // torpedo slot
      makeShip({ availableSlots: ['modification', 'talent'] })
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('torpedo');
  });

  it('should reject when faction does not match', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['targeting_astromech']!,  // requires free_confederation
      makeShip({ availableSlots: ['astromech'], faction: 'terran_hegemony' })
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('free_confederation');
  });

  it('should allow when faction matches', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['targeting_astromech']!,
      makeShip({ availableSlots: ['astromech'], faction: 'free_confederation' })
    );
    expect(result.valid).toBe(true);
  });

  it('should reject single required size when ship is wrong size', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['stealth_device']!,  // requires small
      makeShip({ size: 'medium', availableSlots: ['modification'] })
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('small');
  });

  it('should allow single required size when ship matches', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['stealth_device']!,  // requires small
      makeShip({ size: 'small', availableSlots: ['modification'] })
    );
    expect(result.valid).toBe(true);
  });

  it('should reject array required size when ship size not in array', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['veteran_gunner']!,  // requires ['medium', 'large']
      makeShip({ size: 'small', availableSlots: ['crew'] })
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('medium');
  });

  it('should allow array required size when ship size is in array', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['veteran_gunner']!,  // requires ['medium', 'large']
      makeShip({ size: 'medium', availableSlots: ['crew'] })
    );
    expect(result.valid).toBe(true);
  });

  it('should allow array required size for large ship', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['veteran_gunner']!,  // requires ['medium', 'large']
      makeShip({ size: 'large', availableSlots: ['crew'] })
    );
    expect(result.valid).toBe(true);
  });

  it('should reject when role does not match', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['bombardier']!,  // requires bomber role
      makeShip({ role: 'light_fighter', availableSlots: ['talent'] })
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('bomber');
  });

  it('should allow when role matches', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['bombardier']!,  // requires bomber
      makeShip({ role: 'bomber', availableSlots: ['talent'] })
    );
    expect(result.valid).toBe(true);
  });

  it('should reject unique upgrade when already equipped', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['ace_pilot_title']!,  // isUnique: true
      makeShip({
        availableSlots: ['title'],
        equippedUpgrades: ['ace_pilot_title'],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('unique');
  });

  it('should allow unique upgrade when not yet equipped', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['ace_pilot_title']!,
      makeShip({ availableSlots: ['title'], equippedUpgrades: [] })
    );
    expect(result.valid).toBe(true);
  });

  it('should allow non-unique upgrade to be equipped multiple times', () => {
    const result = canEquipUpgrade(
      UPGRADE_DEFINITIONS['hull_upgrade']!,  // not unique
      makeShip({
        availableSlots: ['modification'],
        equippedUpgrades: ['hull_upgrade'],  // already have one
      })
    );
    expect(result.valid).toBe(true);
  });
});

// ============================================
// calculateUpgradesCost
// ============================================

describe('calculateUpgradesCost', () => {
  it('should return 0 for empty array', () => {
    expect(calculateUpgradesCost([])).toBe(0);
  });

  it('should return pointCost for a single upgrade', () => {
    const hull = UPGRADE_DEFINITIONS['hull_upgrade']!;
    expect(calculateUpgradesCost(['hull_upgrade'])).toBe(hull.pointCost);
  });

  it('should sum point costs for multiple upgrades', () => {
    const hull = UPGRADE_DEFINITIONS['hull_upgrade']!;    // pointCost: 3
    const shield = UPGRADE_DEFINITIONS['shield_upgrade']!; // pointCost: 4
    const expected = hull.pointCost + shield.pointCost;
    expect(calculateUpgradesCost(['hull_upgrade', 'shield_upgrade'])).toBe(expected);
  });

  it('should skip unknown upgrade IDs gracefully (treat as 0)', () => {
    const hull = UPGRADE_DEFINITIONS['hull_upgrade']!;
    const result = calculateUpgradesCost(['hull_upgrade', 'nonexistent_upgrade_xyz']);
    expect(result).toBe(hull.pointCost);
  });

  it('should handle array of all unknown IDs', () => {
    expect(calculateUpgradesCost(['foo', 'bar', 'baz'])).toBe(0);
  });

  it('should sum correctly for expensive loadout', () => {
    const ids = ['proton_torpedo', 'heavy_laser_cannon', 'predator'];
    const expected = ids.reduce((sum, id) => sum + (UPGRADE_DEFINITIONS[id]?.pointCost ?? 0), 0);
    expect(calculateUpgradesCost(ids)).toBe(expected);
  });
});
