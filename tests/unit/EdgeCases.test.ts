/**
 * Edge Case Tests
 *
 * Tests for boundary conditions, null handling, and mathematical edge cases
 */

import { describe, it, expect } from "vitest";
import {
  getShipDefinition,
  getShipsByFaction,
} from "../../src/data/ShipDefinitions";
import {
  getModeCombatStats,
  calculateHitChance,
} from "../../src/data/ModeBalancing";
import { createSeededRng } from "../../src/utils/random";
import type { FactionId } from "../../src/config";

// Helper to calculate distance (mirrors common pattern)
function calculateDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

describe("Edge Cases", () => {
  describe("ShipDefinitions", () => {
    it("should return undefined for non-existent ship", () => {
      const def = getShipDefinition("nonexistent_ship_xyz");
      expect(def).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      const def = getShipDefinition("");
      expect(def).toBeUndefined();
    });

    it("should handle all valid ship IDs", () => {
      const factions: FactionId[] = [
        "terran_hegemony",
        "free_confederation",
        "synthetic_collective",
        "void_corsairs",
        "ascendant_empire",
      ];

      for (const faction of factions) {
        const ships = getShipsByFaction(faction);
        expect(ships.length).toBeGreaterThan(0);

        for (const ship of ships) {
          const def = getShipDefinition(ship.id);
          expect(def).toBeDefined();
          expect(def!.id).toBe(ship.id);
        }
      }
    });

    it("should have positive stats for all ships", () => {
      const factions: FactionId[] = [
        "terran_hegemony",
        "free_confederation",
        "synthetic_collective",
        "void_corsairs",
        "ascendant_empire",
      ];

      for (const faction of factions) {
        const ships = getShipsByFaction(faction);
        for (const ship of ships) {
          expect(ship.baseStats.hull).toBeGreaterThan(0);
          expect(ship.baseStats.shields).toBeGreaterThanOrEqual(0);
          expect(ship.baseStats.attack).toBeGreaterThan(0);
          // Capital ships can have 0 agility (like in X-Wing TMG)
          expect(ship.baseStats.agility).toBeGreaterThanOrEqual(0);
          expect(ship.baseStats.speed.max).toBeGreaterThan(0);
          expect(ship.baseStats.speed.max).toBeGreaterThanOrEqual(
            ship.baseStats.speed.min,
          );
          expect(ship.baseStats.pointCost).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Distance Calculations", () => {
    it("should calculate distance correctly for same point", () => {
      const dist = calculateDistance(100, 100, 100, 100);
      expect(dist).toBe(0);
    });

    it("should calculate distance correctly for horizontal line", () => {
      const dist = calculateDistance(0, 0, 100, 0);
      expect(dist).toBe(100);
    });

    it("should calculate distance correctly for vertical line", () => {
      const dist = calculateDistance(0, 0, 0, 100);
      expect(dist).toBe(100);
    });

    it("should calculate distance correctly for diagonal", () => {
      const dist = calculateDistance(0, 0, 3, 4);
      expect(dist).toBe(5); // 3-4-5 triangle
    });

    it("should handle negative coordinates", () => {
      const dist = calculateDistance(-50, -50, 50, 50);
      expect(dist).toBeCloseTo(Math.sqrt(100 * 100 + 100 * 100));
    });

    it("should handle very large coordinates", () => {
      const dist = calculateDistance(0, 0, 1000000, 0);
      expect(dist).toBe(1000000);
    });

    it("should be symmetric", () => {
      const dist1 = calculateDistance(10, 20, 30, 40);
      const dist2 = calculateDistance(30, 40, 10, 20);
      expect(dist1).toBeCloseTo(dist2);
    });

    it("should handle NaN coordinates gracefully", () => {
      const dist = calculateDistance(NaN, 0, 0, 0);
      expect(Number.isNaN(dist)).toBe(true);
    });

    it("should handle Infinity coordinates", () => {
      const dist = calculateDistance(Infinity, 0, 0, 0);
      expect(dist).toBe(Infinity);
    });
  });

  describe("ModeBalancing", () => {
    it("should return valid stats for known ship", () => {
      const stats = getModeCombatStats("terran_viper", "continuous");
      expect(stats).toBeDefined();
      expect(stats.hull).toBeGreaterThan(0);
      expect(stats.attackDice).toBeGreaterThan(0);
    });

    it("should not produce NaN for hit chance", () => {
      const hitChance = calculateHitChance(3, 2);
      expect(Number.isNaN(hitChance)).toBe(false);
      expect(hitChance).toBeGreaterThanOrEqual(0);
      expect(hitChance).toBeLessThanOrEqual(1);
    });

    it("should handle zero attack stat", () => {
      const hitChance = calculateHitChance(0, 2);
      expect(Number.isNaN(hitChance)).toBe(false);
      expect(hitChance).toBeGreaterThanOrEqual(0);
    });

    it("should handle zero defense stat", () => {
      const hitChance = calculateHitChance(3, 0);
      expect(Number.isNaN(hitChance)).toBe(false);
      expect(hitChance).toBeGreaterThanOrEqual(0);
    });

    it("should floor hit chance for an overwhelming defense", () => {
      expect(calculateHitChance(0, 100)).toBe(0.2);
    });

    it("should cap hit chance for an overwhelming attack", () => {
      expect(calculateHitChance(100, 0)).toBe(0.95);
    });
  });

  describe("Random Number Generator", () => {
    it("should produce deterministic results with same seed", () => {
      const rng1 = createSeededRng(12345);
      const rng2 = createSeededRng(12345);

      for (let i = 0; i < 100; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it("should produce different results with different seeds", () => {
      const rng1 = createSeededRng(12345);
      const rng2 = createSeededRng(54321);

      let same = 0;
      for (let i = 0; i < 100; i++) {
        if (rng1.next() === rng2.next()) same++;
      }

      // Should not be all same (statistically near impossible)
      expect(same).toBeLessThan(50);
    });

    it("should produce values between 0 and 1", () => {
      const rng = createSeededRng(99999);

      for (let i = 0; i < 1000; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it("should handle seed of 0", () => {
      const rng = createSeededRng(0);
      const value = rng.next();
      expect(Number.isNaN(value)).toBe(false);
    });

    it("should handle negative seed", () => {
      const rng = createSeededRng(-12345);
      const value = rng.next();
      expect(Number.isNaN(value)).toBe(false);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });

    it("should handle very large seed", () => {
      const rng = createSeededRng(Number.MAX_SAFE_INTEGER);
      const value = rng.next();
      expect(Number.isNaN(value)).toBe(false);
    });

    it("should produce integers in range", () => {
      const rng = createSeededRng(42);

      for (let i = 0; i < 100; i++) {
        const value = rng.nextInt(1, 6);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
        expect(Number.isInteger(value)).toBe(true);
      }
    });
  });

  describe("Array Bounds", () => {
    it("should handle empty ship array for faction", () => {
      const factions: FactionId[] = [
        "terran_hegemony",
        "free_confederation",
        "synthetic_collective",
        "void_corsairs",
        "ascendant_empire",
      ];

      for (const faction of factions) {
        const ships = getShipsByFaction(faction);
        expect(Array.isArray(ships)).toBe(true);
        expect(ships.length).toBeGreaterThan(0);
      }
    });

    it("should return undefined when picking from empty array", () => {
      const rng = createSeededRng(123);
      const result = rng.pick([]);
      expect(result).toBeUndefined();
    });
  });

  describe("Division Safety", () => {
    it("should not throw on percentage calculations with zero max", () => {
      const calculatePercentage = (current: number, max: number): number => {
        if (max === 0) return 0;
        return current / max;
      };

      expect(calculatePercentage(50, 100)).toBe(0.5);
      expect(calculatePercentage(0, 0)).toBe(0);
      expect(calculatePercentage(50, 0)).toBe(0);
    });
  });
});
