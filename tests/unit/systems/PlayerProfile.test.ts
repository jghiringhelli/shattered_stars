/**
 * PlayerProfileManager — persistence, XP awards, seed profiles (PRG-6, PRG-8).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

  describe("PRG-8 default profile", () => {
    beforeEach(() => {
      vi.stubEnv("DEV", false);
      vi.stubGlobal("location", { search: "" });
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("gives a player exactly one fresh profile", () => {
      const profiles = PlayerProfileManager.list();
      expect(profiles.map((p) => p.id)).toEqual(["player-default"]);
      expect(profiles[0]!.unlockAll).toBe(false);
      expect(profiles[0]!.totalXp).toBe(0);
    });
    it("seeds the dev and graded test profiles only in a dev build", () => {
      vi.stubEnv("DEV", true);
      const ids = PlayerProfileManager.list().map((p) => p.id);
      expect(ids).toEqual([
        "player-default",
        "dev-unlock-all",
        "test-novice",
        "test-veteran",
        "test-admiral",
      ]);
    });
    it("seeds the dev profiles with ?debug=1", () => {
      vi.stubGlobal("location", { search: "?debug=1" });
      expect(PlayerProfileManager.list().map((p) => p.id)).toContain(
        "dev-unlock-all",
      );
    });
    it("the dev profile unlocks every ship", () => {
      vi.stubEnv("DEV", true);
      const dev = PlayerProfileManager.list().find(
        (p) => p.id === "dev-unlock-all",
      )!;
      for (const def of Object.values(SHIP_DEFINITIONS)) {
        expect(isShipUnlocked(def, dev)).toBe(true);
      }
    });
    it("graded profiles have increasing XP", () => {
      vi.stubEnv("DEV", true);
      const by = (id: string): PlayerProfile =>
        PlayerProfileManager.list().find((p) => p.id === id)!;
      expect(by("test-novice").totalXp).toBeLessThan(
        by("test-veteran").totalXp,
      );
      expect(by("test-veteran").totalXp).toBeLessThan(
        by("test-admiral").totalXp,
      );
    });
    it("drops dev profiles a player's old store still holds, keeping their progress", () => {
      vi.stubEnv("DEV", true);
      PlayerProfileManager.addXp("player-default", 700);
      PlayerProfileManager.setActive("dev-unlock-all");
      vi.stubEnv("DEV", false);
      expect(PlayerProfileManager.list().map((p) => p.id)).toEqual([
        "player-default",
      ]);
      expect(PlayerProfileManager.getActive().id).toBe("player-default");
      expect(PlayerProfileManager.getActive().totalXp).toBe(700);
    });
  });

  describe("active profile", () => {
    beforeEach(() => {
      vi.stubEnv("DEV", true);
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

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

  describe("reset progress", () => {
    it("clears XP, stats and unlocks but keeps the profile and its name", () => {
      PlayerProfileManager.awardBattleResult("player-default", {
        kills: 4,
        won: true,
      });
      const reset = PlayerProfileManager.resetProgress("player-default")!;
      expect(reset.totalXp).toBe(0);
      expect(reset.stats).toEqual({ battles: 0, kills: 0, wins: 0, losses: 0 });
      expect(reset.unlockedShipIds).toEqual([]);
      expect(reset.unlockedFactionIds).toEqual([]);
      expect(reset.id).toBe("player-default");
      expect(PlayerProfileManager.getActive().totalXp).toBe(0);
    });
    it("returns null for an unknown profile", () => {
      expect(PlayerProfileManager.resetProgress("nope")).toBeNull();
    });
  });

  describe("match XP", () => {
    it("awardMatchResult adds the given XP and counts the battle", () => {
      const updated = PlayerProfileManager.awardMatchResult("player-default", {
        xp: 130,
        kills: 3,
        won: true,
      })!;
      expect(updated.totalXp).toBe(130);
      expect(updated.stats).toEqual({
        battles: 1,
        kills: 3,
        wins: 1,
        losses: 0,
      });
    });
    it("awardMatchResult never applies negative XP", () => {
      const updated = PlayerProfileManager.awardMatchResult("player-default", {
        xp: -9,
        kills: 0,
        won: false,
      })!;
      expect(updated.totalXp).toBe(0);
      expect(updated.stats.losses).toBe(1);
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
      vi.stubEnv("DEV", false);
      for (const p of PlayerProfileManager.list().slice(1))
        PlayerProfileManager.delete(p.id);
      const remaining = PlayerProfileManager.list();
      PlayerProfileManager.delete(remaining[0]!.id);
      expect(PlayerProfileManager.list().length).toBe(1);
      vi.unstubAllEnvs();
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
