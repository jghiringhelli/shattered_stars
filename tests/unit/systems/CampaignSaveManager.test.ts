/**
 * Tests for CampaignSaveManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CampaignSaveManager,
  type CampaignSaveData,
} from "../../../src/systems/CampaignSaveManager";
import type { FactionId } from "../../../src/config";
import { resetBrowserStore } from "../../../src/systems/keyValueStore";

/** A pre-v1 save as stored on disk: only the original fields exist. */
type LegacyCampaignSave = Parameters<typeof CampaignSaveManager.migrate>[0];

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

// Replace global localStorage
vi.stubGlobal("localStorage", localStorageMock);

describe("CampaignSaveManager", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    resetBrowserStore();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe("createNew", () => {
    it("should create new save data with defaults", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");

      expect(save.version).toBe(3);
      expect(save.factionId).toBe("terran_hegemony");
      expect(save.currentMission).toBe(1);
      expect(save.completedMissions).toEqual([]);
      expect(save.totalXp).toBe(0);
      expect(save.credits).toBe(0);
      expect(save.totalKills).toBe(0);
      expect(save.shipsLost).toBe(0);
      expect(save.unlockedShips).toEqual([]);
      expect(save.lastPlayed).toBeGreaterThan(0);
    });

    it("should create different saves for different factions", () => {
      const save1 = CampaignSaveManager.createNew("terran_hegemony");
      const save2 = CampaignSaveManager.createNew("void_corsairs");

      expect(save1.factionId).toBe("terran_hegemony");
      expect(save2.factionId).toBe("void_corsairs");
    });
  });

  describe("save", () => {
    it("should save data to localStorage", () => {
      const save = CampaignSaveManager.createNew("free_confederation");
      CampaignSaveManager.save(save);

      expect(localStorageMock.setItem).toHaveBeenCalled();
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "shattered_stars_campaign_free_confederation",
        expect.any(String),
      );
    });

    it("should update lastPlayed timestamp on save", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");
      const originalTime = save.lastPlayed;

      CampaignSaveManager.save(save);

      // The save function updates lastPlayed, so we check the stored value
      const storedCall = localStorageMock.setItem.mock.calls[0]!;
      const storedData = JSON.parse(storedCall[1]) as CampaignSaveData;
      // lastPlayed should be equal or greater (same millisecond possible)
      expect(storedData.lastPlayed).toBeGreaterThanOrEqual(originalTime);
    });

    it("should handle save errors gracefully", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");

      // Mock setItem to throw
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error("Storage full");
      });

      // Should not throw
      expect(() => CampaignSaveManager.save(save)).not.toThrow();
    });

    it("should not mutate the input data object when saving", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");
      // Force lastPlayed to a known past value
      save.lastPlayed = 12345;

      CampaignSaveManager.save(save);

      // The original object's lastPlayed should be unchanged
      expect(save.lastPlayed).toBe(12345);
    });
  });

  describe("load", () => {
    it("should load saved data correctly", () => {
      const original = CampaignSaveManager.createNew("synthetic_collective");
      original.totalXp = 500;
      original.credits = 1000;
      original.completedMissions = ["mission_1", "mission_2"];

      CampaignSaveManager.save(original);

      const loaded = CampaignSaveManager.load("synthetic_collective");

      expect(loaded).not.toBeNull();
      expect(loaded!.factionId).toBe("synthetic_collective");
      expect(loaded!.totalXp).toBe(500);
      expect(loaded!.credits).toBe(1000);
      expect(loaded!.completedMissions).toEqual(["mission_1", "mission_2"]);
    });

    it("should return null for non-existent save", () => {
      const loaded = CampaignSaveManager.load("void_corsairs");
      expect(loaded).toBeNull();
    });

    it("should handle corrupted data gracefully", () => {
      // Store invalid JSON
      localStorageMock.setItem(
        "shattered_stars_campaign_terran_hegemony",
        "not valid json{{{",
      );

      const loaded = CampaignSaveManager.load("terran_hegemony");
      expect(loaded).toBeNull();
    });
  });

  describe("delete", () => {
    it("should remove save from localStorage", () => {
      const save = CampaignSaveManager.createNew("ascendant_empire");
      CampaignSaveManager.save(save);

      expect(CampaignSaveManager.exists("ascendant_empire")).toBe(true);

      CampaignSaveManager.delete("ascendant_empire");

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        "shattered_stars_campaign_ascendant_empire",
      );
    });

    it("should handle delete errors gracefully", () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error("Permission denied");
      });

      expect(() => CampaignSaveManager.delete("terran_hegemony")).not.toThrow();
    });
  });

  describe("exists", () => {
    it("should return true for existing save", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");
      CampaignSaveManager.save(save);

      expect(CampaignSaveManager.exists("terran_hegemony")).toBe(true);
    });

    it("should return false for non-existent save", () => {
      expect(CampaignSaveManager.exists("void_corsairs")).toBe(false);
    });
  });

  describe("getAllSaves", () => {
    it("should return empty array when no saves exist", () => {
      const saves = CampaignSaveManager.getAllSaves();
      expect(saves).toEqual([]);
    });

    it("should return all existing saves", () => {
      const save1 = CampaignSaveManager.createNew("terran_hegemony");
      const save2 = CampaignSaveManager.createNew("free_confederation");

      CampaignSaveManager.save(save1);
      CampaignSaveManager.save(save2);

      const saves = CampaignSaveManager.getAllSaves();
      expect(saves.length).toBe(2);
    });

    it("should sort saves by lastPlayed (most recent first)", () => {
      // Manually store saves with specific lastPlayed values
      // (bypassing save() which updates lastPlayed to Date.now())
      const save1Data = {
        version: 1,
        factionId: "terran_hegemony",
        currentMission: 1,
        completedMissions: [],
        totalXp: 0,
        credits: 0,
        totalKills: 0,
        shipsLost: 0,
        unlockedShips: [],
        lastPlayed: 1000,
      };
      const save2Data = {
        version: 1,
        factionId: "free_confederation",
        currentMission: 1,
        completedMissions: [],
        totalXp: 0,
        credits: 0,
        totalKills: 0,
        shipsLost: 0,
        unlockedShips: [],
        lastPlayed: 2000,
      };

      localStorageMock.setItem(
        "shattered_stars_campaign_terran_hegemony",
        JSON.stringify(save1Data),
      );
      localStorageMock.setItem(
        "shattered_stars_campaign_free_confederation",
        JSON.stringify(save2Data),
      );

      const saves = CampaignSaveManager.getAllSaves();
      expect(saves[0]!.factionId).toBe("free_confederation");
      expect(saves[1]!.factionId).toBe("terran_hegemony");
    });
  });

  describe("completeMission", () => {
    it("should add mission to completedMissions", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");
      const updated = CampaignSaveManager.completeMission(
        save,
        "mission_1",
        100, // xp
        50, // credits
        5, // kills
        1, // ships lost
        [], // unlocks
      );

      expect(updated.completedMissions).toContain("mission_1");
    });

    it("should increment currentMission", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");
      expect(save.currentMission).toBe(1);

      const updated = CampaignSaveManager.completeMission(
        save,
        "mission_1",
        100,
        50,
        5,
        1,
        [],
      );

      expect(updated.currentMission).toBe(2);
    });

    it("should accumulate XP and credits", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");
      save.totalXp = 100;
      save.credits = 50;

      const updated = CampaignSaveManager.completeMission(
        save,
        "mission_1",
        200,
        100,
        0,
        0,
        [],
      );

      expect(updated.totalXp).toBe(300);
      expect(updated.credits).toBe(150);
    });

    it("should accumulate kills and ships lost", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");
      save.totalKills = 10;
      save.shipsLost = 2;

      const updated = CampaignSaveManager.completeMission(
        save,
        "mission_1",
        0,
        0,
        5,
        1,
        [],
      );

      expect(updated.totalKills).toBe(15);
      expect(updated.shipsLost).toBe(3);
    });

    it("should add new unlocks without duplicates", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");
      save.unlockedShips = ["ship_a"];

      const updated = CampaignSaveManager.completeMission(
        save,
        "mission_1",
        0,
        0,
        0,
        0,
        ["ship_b", "ship_a", "ship_c"],
      );

      expect(updated.unlockedShips).toContain("ship_a");
      expect(updated.unlockedShips).toContain("ship_b");
      expect(updated.unlockedShips).toContain("ship_c");
      expect(updated.unlockedShips.length).toBe(3);
    });

    it("should not duplicate completed missions", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");

      const updated1 = CampaignSaveManager.completeMission(
        save,
        "mission_1",
        100,
        50,
        5,
        1,
        [],
      );

      // Complete same mission again
      const updated2 = CampaignSaveManager.completeMission(
        updated1,
        "mission_1",
        100,
        50,
        5,
        1,
        [],
      );

      expect(
        updated2.completedMissions.filter((m) => m === "mission_1").length,
      ).toBe(1);
      // currentMission should not increment again
      expect(updated2.currentMission).toBe(2);
    });

    it("should auto-save after completing mission", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");

      CampaignSaveManager.completeMission(save, "mission_1", 100, 50, 5, 1, []);

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe("migrate", () => {
    it("should update version number", () => {
      const oldSave: LegacyCampaignSave = {
        version: 0,
        factionId: "terran_hegemony",
        currentMission: 3,
        completedMissions: ["m1", "m2"],
        totalXp: 500,
        credits: 200,
        totalKills: 20,
        shipsLost: 5,
        unlockedShips: ["ship1"],
        lastPlayed: Date.now(),
      };

      const migrated = CampaignSaveManager.migrate(oldSave);
      expect(migrated.version).toBe(3);
    });

    it("should preserve all other data during migration", () => {
      const oldSave: LegacyCampaignSave = {
        version: 0,
        factionId: "void_corsairs",
        currentMission: 5,
        completedMissions: ["m1", "m2", "m3", "m4"],
        totalXp: 1000,
        credits: 500,
        totalKills: 50,
        shipsLost: 10,
        unlockedShips: ["ship1", "ship2"],
        lastPlayed: 123456789,
      };

      const migrated = CampaignSaveManager.migrate(oldSave);

      expect(migrated.factionId).toBe("void_corsairs");
      expect(migrated.currentMission).toBe(5);
      expect(migrated.completedMissions).toEqual(["m1", "m2", "m3", "m4"]);
      expect(migrated.totalXp).toBe(1000);
      expect(migrated.credits).toBe(500);
      expect(migrated.totalKills).toBe(50);
      expect(migrated.shipsLost).toBe(10);
      expect(migrated.unlockedShips).toEqual(["ship1", "ship2"]);
      expect(migrated.lastPlayed).toBe(123456789);
    });
  });

  describe("Edge Cases", () => {
    it("should handle all faction IDs", () => {
      const factions: FactionId[] = [
        "terran_hegemony",
        "free_confederation",
        "synthetic_collective",
        "void_corsairs",
        "ascendant_empire",
      ];

      for (const faction of factions) {
        const save = CampaignSaveManager.createNew(faction);
        CampaignSaveManager.save(save);
        const loaded = CampaignSaveManager.load(faction);
        expect(loaded).not.toBeNull();
        expect(loaded!.factionId).toBe(faction);
      }
    });

    it("should handle empty unlocks array", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");
      const updated = CampaignSaveManager.completeMission(
        save,
        "mission_1",
        100,
        50,
        5,
        1,
        [],
      );
      expect(updated.unlockedShips).toEqual([]);
    });

    it("should handle very large XP values", () => {
      const save = CampaignSaveManager.createNew("terran_hegemony");
      save.totalXp = Number.MAX_SAFE_INTEGER - 100;

      const updated = CampaignSaveManager.completeMission(
        save,
        "mission_1",
        50,
        0,
        0,
        0,
        [],
      );

      expect(updated.totalXp).toBe(Number.MAX_SAFE_INTEGER - 50);
    });
  });
});
