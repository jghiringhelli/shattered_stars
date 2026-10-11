/**
 * survival-daily.spec.ts — the offline Daily challenge in Survival setup:
 * DAILY opens today's fixed run (seed, faction, flagship, ascension); its
 * launch card starts exactly that run; a finished daily shows up in the
 * panel's local history with its score.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickGameCoord,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

async function openSetup(page: Page): Promise<void> {
  await page.goto("/");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await page.evaluate(() => {
    const game = (window as any).game;
    game.scene.stop("MainMenuScene");
    game.scene.start("SurvivalSetupScene");
  });
  await waitForScene(page, "SurvivalSetupScene");
  await page.waitForTimeout(200);
}

async function clickDaily(page: Page): Promise<void> {
  const at = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("SurvivalSetupScene");
    const b = scene.children.getByName("dailyButton").getBounds();
    return { x: b.centerX, y: b.centerY };
  });
  await clickGameCoord(page, at.x, at.y);
}

async function panelCardNames(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("SurvivalSetupScene");
    const root = scene.panel.container;
    return (root.list as any[])
      .filter((c) => c.list)
      .map((c) => c.list.find((t: any) => t.text && t.originX === 0)?.text)
      .filter(Boolean);
  });
}

async function today(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const { dailyChallengeFor } =
      await import("/src/systems/survival/DailyChallenge.ts");
    return dailyChallengeFor(new Date());
  });
}

test.describe("Survival daily challenge", () => {
  test("DAILY launches today's fixed run", async ({ page }) => {
    await openSetup(page);
    await clickDaily(page);
    await expect
      .poll(() => panelCardNames(page))
      .toContain("LAUNCH TODAY'S RUN");
    const daily = await today(page);
    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("SurvivalSetupScene");
      const card = (scene.panel.container.list as any[]).filter(
        (c) => c.list,
      )[0];
      card.list[card.list.length - 1].emit("pointerdown");
    });
    await waitForScene(page, "SurvivalMapScene");
    const run = await page.evaluate(
      () => (window as any).game.registry.get("survivalRunService").run,
    );
    expect(run.seed).toBe(daily.seed);
    expect(run.faction).toBe(daily.faction);
    expect(run.flagship.definitionId).toBe(daily.flagshipId);
    expect(run.ascension).toBe(daily.ascension);
  });

  test("a finished daily run is listed with its score", async ({ page }) => {
    await openSetup(page);
    await page.evaluate(() => {
      const service = (window as any).game.registry.get("survivalRunService");
      const scene = (window as any).game.scene.getScene("SurvivalSetupScene");
      scene.launchDaily();
      service.abandon();
    });
    await openSetup(page);
    await clickDaily(page);
    const daily = await today(page);
    await expect
      .poll(() => panelCardNames(page))
      .toContain(`${daily.key} · ABANDONED`);
  });
});
