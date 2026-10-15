/**
 * Lazy scene registration (src/scenes/lazy): scenes other than boot/menu/settings load their chunk on
 * first start. Uses waitForScene (not waitForMenuReady, which pre-registers every scene for the other specs).
 */
import { expect, test } from "@playwright/test";
import { waitForScene } from "./helpers/game";

test.describe("lazy scenes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForScene(page, "MainMenuScene", 50_000);
  });

  test("only boot, menu and settings scenes are registered at boot", async ({ page }) => {
    const registered = await page.evaluate(() => {
      const g = (window as any).game;
      return ["MainMenuScene", "SettingsScene", "CampaignScene", "SurvivalScene", "ArcadeBattleScene"].map(
        (key) => [key, Boolean(g.scene.getScene(key))],
      );
    });
    expect(Object.fromEntries(registered)).toEqual({
      MainMenuScene: true,
      SettingsScene: true,
      CampaignScene: false,
      SurvivalScene: false,
      ArcadeBattleScene: false,
    });
  });

  test("starting an unloaded scene through the manager loads and runs it", async ({ page }) => {
    await page.evaluate(() => (window as any).game.scene.start("EncyclopediaScene"));
    await waitForScene(page, "EncyclopediaScene", 30_000);
    expect(await page.evaluate(() => Boolean((window as any).game.scene.getScene("EncyclopediaScene")))).toBe(true);
  });

  test("a scene's own start keeps it running until the next scene has loaded", async ({ page }) => {
    const menuStillRunning = await page.evaluate(() => {
      const g = (window as any).game;
      g.scene.getScene("MainMenuScene").scene.start("SurvivalSetupScene");
      return g.scene.isActive("MainMenuScene");
    });
    expect(menuStillRunning).toBe(true);
    await waitForScene(page, "SurvivalSetupScene", 30_000);
    await page.waitForFunction(() => !(window as any).game.scene.isActive("MainMenuScene"));
  });

  test("ensureScene registers a scene without starting it", async ({ page }) => {
    await page.evaluate(() => (window as any).ensureScene("CampaignScene"));
    const state = await page.evaluate(() => {
      const g = (window as any).game;
      return { registered: Boolean(g.scene.getScene("CampaignScene")), active: g.scene.isActive("CampaignScene") };
    });
    expect(state).toEqual({ registered: true, active: false });
  });

  test("loading scenes raises no page errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.evaluate(() => (window as any).game.scene.start("FlightSchoolScene"));
    await waitForScene(page, "FlightSchoolScene", 30_000);
    expect(errors).toEqual([]);
  });
});
