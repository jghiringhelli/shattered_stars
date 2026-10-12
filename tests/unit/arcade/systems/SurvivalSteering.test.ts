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
  survivalBossTier,
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

  it("experts arrive mid sector 3 (effective wave 11), not at its first node", () => {
    expect(AVERAGE_LAST_WAVE).toBe(10);
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

  it("an elite flies the wave's tier (its edge is hull, a die and its affix)", () => {
    expect(survivalEnemyTier(2, "elite")).toBe("novice");
    expect(survivalEnemyTier(6, "elite")).toBe("average");
    expect(survivalEnemyTier(12, "elite")).toBe("expert");
  });

  it("every milestone boss of the endless waves is an expert, the first one included", () => {
    expect(SURVIVAL_BOSS_TIER).toBe("expert");
    expect(survivalEnemyTier(5, "boss")).toBe("expert");
    expect(survivalEnemyTier(20, "boss")).toBe("expert");
  });
});

describe("survivalBossTier", () => {
  it("a roguelite sector boss flies one tier above its sector's regulars", () => {
    expect(survivalBossTier(1)).toBe("average");
    expect(survivalBossTier(2)).toBe("expert");
    expect(survivalBossTier(3)).toBe("expert");
  });

  it("sectors past the table keep the last sector's tier", () => {
    expect(survivalBossTier(9)).toBe("expert");
  });
});

describe("escorts", () => {
  it("fly as average pilots", () => {
    expect(SURVIVAL_ESCORT_TIER).toBe("average");
  });
});
