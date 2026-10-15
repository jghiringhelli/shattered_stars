/**
 * progressSummary — level and unlock counts shown on the profile panel.
 */

import { describe, it, expect } from "vitest";
import {
  XP_PER_LEVEL,
  levelOf,
  summarizeProgress,
} from "../../../src/data/progressSummary";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";

const SHIPS = Object.values(SHIP_DEFINITIONS);
const FRESH = {
  totalXp: 0,
  unlockAll: false,
  unlockedFactionIds: [],
  unlockedShipIds: [],
} as const;

describe("levelOf", () => {
  it("starts at level 1 with no XP", () => {
    expect(levelOf(0)).toBe(1);
  });

  it("gains a level every XP_PER_LEVEL", () => {
    expect(levelOf(XP_PER_LEVEL - 1)).toBe(1);
    expect(levelOf(XP_PER_LEVEL)).toBe(2);
    expect(levelOf(XP_PER_LEVEL * 3 + 1)).toBe(4);
  });

  it("treats negative XP as none", () => {
    expect(levelOf(-50)).toBe(1);
  });
});

describe("summarizeProgress", () => {
  it("shows a fresh profile with only the starting roster", () => {
    const summary = summarizeProgress(FRESH, SHIPS);
    expect(summary.level).toBe(1);
    expect(summary.xpIntoLevel).toBe(0);
    expect(summary.unlockedFactions).toBe(3);
    expect(summary.totalFactions).toBe(5);
    expect(summary.totalShips).toBe(SHIPS.length);
    expect(summary.unlockedShips).toBeGreaterThan(0);
    expect(summary.unlockedShips).toBeLessThan(SHIPS.length);
  });

  it("reports XP earned inside the current level", () => {
    const summary = summarizeProgress(
      { ...FRESH, totalXp: XP_PER_LEVEL + 120 },
      SHIPS,
    );
    expect(summary.level).toBe(2);
    expect(summary.xpIntoLevel).toBe(120);
  });

  it("counts everything unlocked for an unlock-all profile", () => {
    const summary = summarizeProgress({ ...FRESH, unlockAll: true }, SHIPS);
    expect(summary.unlockedShips).toBe(SHIPS.length);
    expect(summary.unlockedFactions).toBe(summary.totalFactions);
  });
});
