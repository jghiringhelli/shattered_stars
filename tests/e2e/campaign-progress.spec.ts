/**
 * campaign-progress.spec.ts — persistence across scenarios: a bonus
 * objective grants research on victory (autosaved); flags, research,
 * armory and credits survive a reload; a v2 save migrates without loss; a
 * story flag from an earlier mission changes a later one; and winning the
 * final mission leads to the campaign-complete screen.
 */

import { test, expect, type Page } from "@playwright/test";
import { clickMenuItem, waitForMenuReady, waitForScene } from "./helpers/game";
import {
  BATTLE,
  launchCampaignMission,
  openCampaignHub,
  storedSave,
} from "./helpers/campaignEntry";

test("a bonus objective grants research points on victory (autosaved)", async ({
  page,
}) => {
  await launchCampaignMission(page, {
    factionId: "terran_hegemony",
    missionId: "heg_1_3",
    noCombat: true,
    noScript: true,
  });
  await page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    const flagship = scene.ships.get(scene.playerShipIds[0]);
    for (const id of [...scene.enemyShipIds]) {
      const enemy = scene.ships.get(id);
      enemy.hull = 0;
      scene.killShip(enemy, flagship);
    }
  }, BATTLE);
  await page.waitForFunction(
    (key) => (window as any).game.scene.getScene(key)?.missionComplete === true,
    BATTLE,
    { timeout: 10_000 },
  );
  const save = await storedSave(page, "terran_hegemony");
  expect(save.completedMissions).toContain("heg_1_3");
  expect(save.bonusObjectivesCompleted).toContain("heg_1_3:survive");
  expect(save.researchPoints).toBeGreaterThanOrEqual(1);
  expect(save.branchChoices).toEqual({ slot_3: "heg_1_3" });
});

test("flags, research, armory and credits survive a reload", async ({
  page,
}) => {
  await openCampaignHub(page, "ascendant_empire", {
    credits: 777,
    storyFlags: { asc_temple_intact: true },
    research: { hull_doctrine: "A" },
    researchPoints: 4,
    armory: { installed: { rapid_cyclers: 220 } },
  });
  await page.reload();
  await openCampaignHubWithoutSeeding(page, "ascendant_empire");
  const save = await page.evaluate(
    () => (window as any).game.scene.getScene("CampaignScene").saveData,
  );
  expect(save).toMatchObject({
    version: 3,
    credits: 777,
    storyFlags: { asc_temple_intact: true },
    research: { hull_doctrine: "A" },
    researchPoints: 4,
    armory: { installed: { rapid_cyclers: 220 } },
  });
});

test("a v2 save loads as v3 without losing progress", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    window.localStorage.setItem(
      "shattered_stars_campaign_void_corsairs",
      JSON.stringify({
        version: 2,
        factionId: "void_corsairs",
        currentMission: 4,
        completedMissions: ["cors_1_1", "cors_1_2", "cors_1_3"],
        totalXp: 450,
        credits: 300,
        totalKills: 7,
        shipsLost: 0,
        unlockedShips: [],
        lastPlayed: 1,
        campaignPilots: [],
        pendingEvolution: false,
      }),
    ),
  );
  await openCampaignHubWithoutSeeding(page, "void_corsairs");
  const save = await page.evaluate(
    () => (window as any).game.scene.getScene("CampaignScene").saveData,
  );
  expect(save).toMatchObject({
    version: 3,
    credits: 300,
    totalXp: 450,
    heroPowerRanks: { cloak_dash: 1, scatter_mines: 1 },
  });
});

test("a story flag from an earlier mission changes a later one (resupplied station)", async ({
  page,
}) => {
  await launchCampaignMission(page, {
    factionId: "terran_hegemony",
    missionId: "heg_2_4",
    noCombat: true,
    noScript: true,
    noObjectives: true,
    save: { storyFlags: { heg_convoy_intact: true } },
  });
  const state = await page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    return {
      title: scene.plan.title,
      relief: [...scene.ships.values()].some((s: any) =>
        s.tags.includes("relief"),
      ),
    };
  }, BATTLE);
  expect(state).toEqual({
    title: "Station Defense (Resupplied)",
    relief: true,
  });
});

test("winning the final mission shows the campaign-complete screen", async ({
  page,
}) => {
  const done = [
    "heg_1_1",
    "heg_1_2",
    "heg_1_3",
    "heg_1_4",
    "heg_1_5",
    "heg_2_1",
    "heg_2_2",
    "heg_2_3",
    "heg_2_4",
    "heg_2_5",
    "heg_3_1",
    "heg_3_2",
    "heg_3_3",
    "heg_3_4",
  ];
  await launchCampaignMission(page, {
    factionId: "terran_hegemony",
    missionId: "heg_3_5",
    noCombat: true,
    noScript: true,
    save: {
      completedMissions: done,
      currentMission: 15,
      storyFlags: { heg_lance_lost: true },
    },
  });
  await page.evaluate(
    (key) => (window as any).game.scene.getScene(key).director.debugWin(),
    BATTLE,
  );
  await waitForScene(page, "DebriefScene", 20_000);
  await page.evaluate(() =>
    (window as any).game.scene.getScene("DebriefScene").transitionToCampaign(),
  );
  await waitForScene(page, "CampaignCompleteScene", 20_000);
  const epilogue = await page.evaluate(
    () => (window as any).game.scene.getScene("CampaignCompleteScene").epilogue,
  );
  expect(epilogue.length).toBeGreaterThanOrEqual(3);
  expect(epilogue.some((l: any) => l.text.includes("Lance"))).toBe(true);
  expect((await storedSave(page, "terran_hegemony")).campaignComplete).toBe(
    true,
  );
});

/** Opens the campaign hub for a faction using whatever save is stored. */
async function openCampaignHubWithoutSeeding(
  page: Page,
  factionId: string,
): Promise<void> {
  await waitForMenuReady(page);
  await clickMenuItem(page, "CAMPAIGN");
  await waitForScene(page, "CampaignScene");
  await page.evaluate(
    (f) =>
      (window as any).game.scene.getScene("CampaignScene").selectFaction(f),
    factionId,
  );
}
