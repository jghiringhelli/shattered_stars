/**
 * campaign-missions-smoke.spec.ts — every campaign mission (78 faction
 * missions and the 8 Coalition missions of Acts IV-V) boots in the real
 * scene with its script and variants, compiles its objectives and runs for a
 * few seconds without a page error.
 */

import { test, expect } from "@playwright/test";
import {
  COALITION_CAMPAIGN,
  FACTION_CAMPAIGNS,
} from "../../src/data/CampaignData";
import { waitForMenuReady, waitForScene } from "./helpers/game";
import { BATTLE } from "./helpers/campaignEntry";

const RUN_MS = 2_500;
const FACTION_MISSIONS = Object.values(FACTION_CAMPAIGNS).flatMap((campaign) =>
  campaign.missions.map((m) => ({ campaign: campaign.factionId, id: m.id })),
);
const COALITION_MISSIONS = COALITION_CAMPAIGN.missions.map((m) => ({
  campaign: "coalition",
  id: m.id,
}));

test.describe("every campaign mission boots", () => {
  for (const { campaign, id } of [...FACTION_MISSIONS, ...COALITION_MISSIONS]) {
    test(`${id} runs without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/?debug=1");
      await waitForMenuReady(page);
      await page.evaluate(
        async ({ campaignId, missionId }) => {
          const data = await import("/src/data/CampaignData.ts");
          const { CampaignSaveManager } = await import("/src/systems/CampaignSaveManager.ts");
          const coalition = campaignId === "coalition";
          const lead = coalition ? "void_corsairs" : campaignId;
          const source = coalition ? data.COALITION_CAMPAIGN : (data.FACTION_CAMPAIGNS as any)[campaignId];
          let mission = source.missions.find((m: any) => m.id === missionId);
          let save = CampaignSaveManager.createNew(lead as any);
          if (coalition) {
            const launch = await import("/src/campaign/coalition/coalitionLaunch.ts");
            mission = launch.missionForLead(mission, lead as any);
            save = launch.createCoalitionSave(lead as any, CampaignSaveManager.createNew(lead as any, [], "coalition"), null);
          }
          const game = (window as any).game;
          game.scene.stop("MainMenuScene");
          game.scene.start("CampaignBattleScene", { factionId: lead, mission, saveData: save });
          const scene = game.scene.getScene("CampaignBattleScene");
          scene.processCombat = () => undefined;
        },
        { campaignId: campaign, missionId: id },
      );
      await waitForScene(page, BATTLE, 30_000);
      await page.waitForFunction(
        (key) => ((window as any).game.scene.getScene(key)?.ships?.size ?? 0) >= 1,
        BATTLE,
        { timeout: 20_000 },
      );
      await page.waitForTimeout(RUN_MS);
      const state = await page.evaluate((key) => {
        const scene = (window as any).game.scene.getScene(key);
        return {
          objectives: scene.plan.objectives.length,
          beats: scene.plan.script.length,
          day: scene.mission.day,
        };
      }, BATTLE);
      expect(state.objectives).toBeGreaterThan(0);
      expect(state.beats).toBeGreaterThanOrEqual(3);
      expect(state.day).toBeGreaterThanOrEqual(0);
      expect(errors).toEqual([]);
    });
  }
});
