/**
 * CampaignAiSteering — specification: act 1 is the learning act (regular
 * enemies novice, aces and bosses average, every tutorial enemy novice);
 * from act 2 regular enemies are average and aces and bosses experts;
 * escorts and wingmen are average pilots.
 */

import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_ESCORT_TIER,
  campaignEnemyTier,
  isTutorialMission,
} from "../../../../src/arcade/systems/CampaignAiSteering";
import { FACTION_CAMPAIGNS } from "../../../../src/data/CampaignData";

const ACT_ONE_FIRST = { act: 1, missionNumber: 1 };
const FIRST_BLOOD = { act: 1, missionNumber: 2 };
const ACT_ONE_THIRD = { act: 1, missionNumber: 3 };
const ACT_TWO_FIRST = { act: 2, missionNumber: 1 };

describe("isTutorialMission", () => {
  it("the navigation course and First Blood are tutorials", () => {
    expect(isTutorialMission(ACT_ONE_FIRST)).toBe(true);
    expect(isTutorialMission(FIRST_BLOOD)).toBe(true);
  });

  it("later act-1 missions and other acts are not", () => {
    expect(isTutorialMission(ACT_ONE_THIRD)).toBe(false);
    expect(isTutorialMission(ACT_TWO_FIRST)).toBe(false);
  });

  it("every faction's first combat mission is a tutorial", () => {
    for (const campaign of Object.values(FACTION_CAMPAIGNS)) {
      const firstCombat = campaign.missions.find((m) => m.enemies.length > 0);
      expect(firstCombat && isTutorialMission(firstCombat)).toBe(true);
    }
  });
});

describe("campaignEnemyTier", () => {
  it("a regular act-1 enemy is a novice", () => {
    expect(campaignEnemyTier(ACT_ONE_THIRD, {})).toBe("novice");
  });

  it("an act-1 ace or boss is an average pilot", () => {
    expect(campaignEnemyTier(ACT_ONE_THIRD, { isAce: true })).toBe("average");
    expect(campaignEnemyTier(ACT_ONE_THIRD, { isBoss: true })).toBe("average");
  });

  it("a regular enemy from act 2 on is an average pilot", () => {
    expect(campaignEnemyTier(ACT_TWO_FIRST, {})).toBe("average");
  });

  it("an ace is an expert", () => {
    expect(campaignEnemyTier(ACT_TWO_FIRST, { isAce: true })).toBe("expert");
  });

  it("a boss is an expert", () => {
    expect(campaignEnemyTier(ACT_TWO_FIRST, { isBoss: true })).toBe("expert");
  });

  it("every enemy of a tutorial is a novice", () => {
    expect(campaignEnemyTier(FIRST_BLOOD, {})).toBe("novice");
    expect(campaignEnemyTier(FIRST_BLOOD, { isAce: true })).toBe("novice");
  });
});

describe("escorts", () => {
  it("fly as average pilots", () => {
    expect(CAMPAIGN_ESCORT_TIER).toBe("average");
  });
});
