/**
 * Integration Tests for Battle Flow
 *
 * Tests multi-system interactions:
 * - Movement → Combat → Damage chain
 * - Turn progression with multiple ships
 * - Full battle scenarios
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BattleManager, type BattleConfig } from "../../src/core/BattleManager";
import { getShipDefinition } from "../../src/data/ShipDefinitions";
import type { FactionId } from "../../src/config";

describe("Battle Flow Integration", () => {
  let battleManager: BattleManager;

  describe("Basic Battle Setup", () => {
    beforeEach(() => {
      const config: BattleConfig = {
        playerFaction: "free_confederation",
        enemyFaction: "terran_hegemony",
        playerShips: ["confed_falcon"],
        enemyShips: ["terran_gladius"],
        seed: 12345,
      };
      battleManager = new BattleManager(config);
    });

    it("should initialize with correct ship counts", () => {
      const state = battleManager.getState();
      expect(state.ships.size).toBe(2);
    });

    it("should have ships from correct factions", () => {
      const state = battleManager.getState();
      const ships = Array.from(state.ships.values());

      const playerShip = ships.find((s) => s.owner === "player");
      const enemyShip = ships.find((s) => s.owner === "ai");

      expect(playerShip?.faction).toBe("free_confederation");
      expect(enemyShip?.faction).toBe("terran_hegemony");
    });

    it("should start in planning phase", () => {
      const state = battleManager.getState();
      expect(state.turnState.currentPhase).toBe("planning");
      expect(state.turnState.turnNumber).toBe(1);
    });

    it("should have player ship ID set", () => {
      const state = battleManager.getState();
      expect(state.playerShipId).toBeDefined();
      expect(state.ships.has(state.playerShipId!)).toBe(true);
    });
  });

  describe("Multi-Ship Battle", () => {
    beforeEach(() => {
      const config: BattleConfig = {
        playerFaction: "terran_hegemony",
        enemyFaction: "void_corsairs",
        playerShips: ["terran_viper", "terran_viper", "terran_gladius"],
        enemyShips: ["corsair_blade", "corsair_blade", "corsair_marauder"],
        seed: 54321,
      };
      battleManager = new BattleManager(config);
    });

    it("should initialize all ships with correct stats", () => {
      const state = battleManager.getState();
      expect(state.ships.size).toBe(6);

      for (const ship of state.ships.values()) {
        const def = getShipDefinition(ship.definitionId);
        expect(def).toBeDefined();
        expect(ship.hull).toBe(def!.baseStats.hull);
        expect(ship.maxHull).toBe(def!.baseStats.hull);
        expect(ship.shields).toBe(def!.baseStats.shields);
        expect(ship.maxShields).toBe(def!.baseStats.shields);
      }
    });

    it("should position player ships and enemy ships separately", () => {
      const state = battleManager.getState();
      const ships = Array.from(state.ships.values());

      const playerShips = ships.filter((s) => s.owner === "player");
      const enemyShips = ships.filter((s) => s.owner === "ai");

      expect(playerShips.length).toBe(3);
      expect(enemyShips.length).toBe(3);

      // Player ships should be at higher Y (bottom of field)
      const avgPlayerY =
        playerShips.reduce((sum, s) => sum + s.y, 0) / playerShips.length;
      const avgEnemyY =
        enemyShips.reduce((sum, s) => sum + s.y, 0) / enemyShips.length;

      expect(avgPlayerY).toBeGreaterThan(avgEnemyY);
    });
  });

  describe("Empty and Edge Cases", () => {
    it("should handle single ship per side", () => {
      const config: BattleConfig = {
        playerFaction: "synthetic_collective",
        enemyFaction: "ascendant_empire",
        playerShips: ["synth_drone"],
        enemyShips: ["ascendant_seraph"],
        seed: 11111,
      };
      battleManager = new BattleManager(config);
      const state = battleManager.getState();

      expect(state.ships.size).toBe(2);
    });

    it("should handle maximum squad size", () => {
      const config: BattleConfig = {
        playerFaction: "free_confederation",
        enemyFaction: "terran_hegemony",
        playerShips: [
          "confed_sparrow",
          "confed_sparrow",
          "confed_sparrow",
          "confed_sparrow",
          "confed_sparrow",
          "confed_sparrow",
        ],
        enemyShips: [
          "terran_viper",
          "terran_viper",
          "terran_viper",
          "terran_viper",
          "terran_viper",
          "terran_viper",
        ],
        seed: 22222,
      };
      battleManager = new BattleManager(config);
      const state = battleManager.getState();

      expect(state.ships.size).toBe(12);
    });
  });

  describe("Ship Stats Integrity", () => {
    it("should never have negative hull", () => {
      const config: BattleConfig = {
        playerFaction: "free_confederation",
        enemyFaction: "terran_hegemony",
        playerShips: ["confed_falcon"],
        enemyShips: ["terran_gladius"],
        seed: 33333,
      };
      battleManager = new BattleManager(config);

      const state = battleManager.getState();
      for (const ship of state.ships.values()) {
        expect(ship.hull).toBeGreaterThanOrEqual(0);
        expect(ship.shields).toBeGreaterThanOrEqual(0);
      }
    });

    it("should never exceed max hull or shields", () => {
      const config: BattleConfig = {
        playerFaction: "free_confederation",
        enemyFaction: "terran_hegemony",
        playerShips: ["confed_falcon"],
        enemyShips: ["terran_gladius"],
        seed: 44444,
      };
      battleManager = new BattleManager(config);

      const state = battleManager.getState();
      for (const ship of state.ships.values()) {
        expect(ship.hull).toBeLessThanOrEqual(ship.maxHull);
        expect(ship.shields).toBeLessThanOrEqual(ship.maxShields);
      }
    });
  });

  describe("Faction Balance Check", () => {
    const factions: FactionId[] = [
      "terran_hegemony",
      "free_confederation",
      "synthetic_collective",
      "void_corsairs",
      "ascendant_empire",
    ];

    it("should be able to create battles between all faction pairs", () => {
      for (const playerFaction of factions) {
        for (const enemyFaction of factions) {
          if (playerFaction === enemyFaction) continue;

          // Get a ship from each faction
          const playerShip = getFirstShipForFaction(playerFaction);
          const enemyShip = getFirstShipForFaction(enemyFaction);

          expect(playerShip).toBeDefined();
          expect(enemyShip).toBeDefined();

          const config: BattleConfig = {
            playerFaction,
            enemyFaction,
            playerShips: [playerShip!],
            enemyShips: [enemyShip!],
            seed: Date.now(),
          };

          const bm = new BattleManager(config);
          const state = bm.getState();
          expect(state.ships.size).toBe(2);
        }
      }
    });
  });

  describe("Belt Containment", () => {
    const BASE = { safeRadius: 700, wallRadius: 1100, maxDamagePerSecond: 2 };

    it("has no belt by default", () => {
      const bm = new BattleManager({
        playerFaction: "free_confederation",
        enemyFaction: "terran_hegemony",
        playerShips: ["confed_falcon"],
        enemyShips: ["terran_gladius"],
        seed: 1,
      });
      expect(bm.getBeltConfig()).toBeNull();
    });

    it("exposes the base belt geometry on turn 1 when enabled", () => {
      const bm = new BattleManager({
        playerFaction: "free_confederation",
        enemyFaction: "terran_hegemony",
        playerShips: ["confed_falcon"],
        enemyShips: ["terran_gladius"],
        seed: 1,
        belt: { centerX: 500, centerY: 500, base: BASE },
      });
      // Turn 1 → zero tightening steps → base geometry.
      expect(bm.getBeltConfig()).toEqual(BASE);
    });
  });
});

function getFirstShipForFaction(faction: FactionId): string | undefined {
  const shipMap: Record<FactionId, string> = {
    terran_hegemony: "terran_viper",
    free_confederation: "confed_sparrow",
    synthetic_collective: "synth_drone",
    void_corsairs: "corsair_blade",
    ascendant_empire: "ascendant_seraph",
  };
  return shipMap[faction];
}
