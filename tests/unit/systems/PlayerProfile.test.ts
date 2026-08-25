/**
 * PlayerProfileManager — persistence, XP awards, seed profiles (PRG-6, PRG-8).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PlayerProfileManager,
  createProfile,
  type PlayerProfile,
} from "../../../src/systems/PlayerProfile";
import { XP_REWARDS, isShipUnlocked } from "../../../src/data/ProgressionData";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";

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
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

describe("PlayerProfileManager", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("PRG-8 seed profiles", () => {
    it("seeds player + dev unlock-all + graded test profiles on first use", () => {
      const profiles = PlayerProfileManager.list();
      const ids = profiles.map((p) => p.id);
      expect(ids).toContain("player-default");
      expect(ids).toContain("dev-unlock-all");
      expect(ids).toContain("test-novice");
      expect(ids).toContain("test-veteran");
      expect(ids).toContain("test-admiral");
    });
    it("the dev profile unlocks every ship", () => {
      const dev = PlayerProfileManager.list().find(
        (p) => p.id === "dev-unlock-all",
      )!;
      for (const def of Object.values(SHIP_DEFINITIONS)) {
        expect(isShipUnlocked(def, dev)).toBe(true);
      }
    });
    it("graded profiles have increasing XP", () => {
      const by = (id: string): PlayerProfile =>
        PlayerProfileManager.list().find((p) => p.id === id)!;
      expect(by("test-novice").totalXp).toBeLessThan(
        by("test-veteran").totalXp,
      );
      expect(by("test-veteran").totalXp).toBeLessThan(
        by("test-admiral").totalXp,
      );
    });
  });

  describe("active profile", () => {
    it("defaults to the fresh player and can be switched", () => {
      expect(PlayerProfileManager.getActive().id).toBe("player-default");
      PlayerProfileManager.setActive("dev-unlock-all");
      expect(PlayerProfileManager.getActive().id).toBe("dev-unlock-all");
    });
    it("ignores unknown active ids", () => {
      PlayerProfileManager.setActive("does-not-exist");
      expect(PlayerProfileManager.getActive().id).toBe("player-default");
    });
  });

  describe("PRG-6 XP awards", () => {
    it("awardBattleResult adds kill XP + win bonus and updates stats", () => {
      const before = PlayerProfileManager.getActive().totalXp;
      const updated = PlayerProfileManager.awardBattleResult("player-default", {
        kills: 3,
        won: true,
      })!;
      expect(updated.totalXp).toBe(
        before + 3 * XP_REWARDS.perKill + XP_REWARDS.win,
      );
      expect(updated.stats.battles).toBe(1);
      expect(updated.stats.kills).toBe(3);
      expect(updated.stats.wins).toBe(1);
    });
    it("a loss grants the loss reward and increments losses", () => {
      const updated = PlayerProfileManager.awardBattleResult("player-default", {
        kills: 0,
        won: false,
      })!;
      expect(updated.totalXp).toBe(XP_REWARDS.loss);
      expect(updated.stats.losses).toBe(1);
    });
    it("addXp never applies negative XP", () => {
      const p = PlayerProfileManager.addXp("player-default", -500)!;
      expect(p.totalXp).toBe(0);
    });
    it("XP persists across reads", () => {
      PlayerProfileManager.addXp("player-default", 250);
      expect(PlayerProfileManager.getActive().totalXp).toBe(250);
    });
  });

  describe("create and delete", () => {
    it("creates a profile and persists it", () => {
      const p = PlayerProfileManager.create("Nueva");
      expect(PlayerProfileManager.list().some((x) => x.id === p.id)).toBe(true);
    });
    it("refuses to delete the last remaining profile", () => {
      for (const p of PlayerProfileManager.list().slice(1))
        PlayerProfileManager.delete(p.id);
      const remaining = PlayerProfileManager.list();
      PlayerProfileManager.delete(remaining[0].id);
      expect(PlayerProfileManager.list().length).toBe(1);
    });
  });

  describe("createProfile factory", () => {
    it("applies defaults and overrides", () => {
      const p = createProfile("X", { totalXp: 999, unlockAll: true });
      expect(p.totalXp).toBe(999);
      expect(p.unlockAll).toBe(true);
      expect(p.stats.battles).toBe(0);
    });
  });
});
