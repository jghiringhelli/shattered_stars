/**
 * SurvivalSteering — specification: Survival's AI ships are bots whose tier
 * follows the wave (novice early, average mid, expert late), elites fly one
 * tier up, milestone bosses are experts and escorts are average pilots.
 */

import { describe, it, expect } from "vitest";
import {
  AVERAGE_LAST_WAVE,
  NOVICE_LAST_WAVE,
  SURVIVAL_BOSS_TIER,
  SURVIVAL_ESCORT_TIER,
  survivalEnemyTier,
  survivalWaveTier,
  tierAbove,
} from "../../../../src/arcade/systems/SurvivalSteering";

describe("survivalWaveTier", () => {
  it("regulars of the opening waves are novices", () => {
    expect(survivalWaveTier(1)).toBe("novice");
    expect(survivalWaveTier(NOVICE_LAST_WAVE)).toBe("novice");
  });

  it("regulars of the middle waves are average pilots", () => {
    expect(survivalWaveTier(NOVICE_LAST_WAVE + 1)).toBe("average");
    expect(survivalWaveTier(AVERAGE_LAST_WAVE)).toBe("average");
  });

  it("regulars after the middle waves are experts", () => {
    expect(survivalWaveTier(AVERAGE_LAST_WAVE + 1)).toBe("expert");
    expect(survivalWaveTier(40)).toBe("expert");
  });
});

describe("tierAbove", () => {
  it("climbs one rung", () => {
    expect(tierAbove("novice")).toBe("average");
    expect(tierAbove("average")).toBe("expert");
  });

  it("expert stays expert", () => {
    expect(tierAbove("expert")).toBe("expert");
  });
});

describe("survivalEnemyTier", () => {
  it("a regular flies the wave's tier", () => {
    expect(survivalEnemyTier(2, "regular")).toBe("novice");
  });

  it("an elite flies one tier above the wave's regulars", () => {
    expect(survivalEnemyTier(2, "elite")).toBe("average");
    expect(survivalEnemyTier(6, "elite")).toBe("expert");
  });

  it("an elite never exceeds expert", () => {
    expect(survivalEnemyTier(12, "elite")).toBe("expert");
  });

  it("every milestone boss is an expert, the first one included", () => {
    expect(SURVIVAL_BOSS_TIER).toBe("expert");
    expect(survivalEnemyTier(5, "boss")).toBe("expert");
    expect(survivalEnemyTier(20, "boss")).toBe("expert");
  });
});

describe("escorts", () => {
  it("fly as average pilots", () => {
    expect(SURVIVAL_ESCORT_TIER).toBe("average");
  });
});
