/**
 * settings-accessibility.spec.ts — the one Settings screen:
 *  - choices persist across a page reload (audio bus, colour vision);
 *  - rebinding MARK_TARGET to K in Settings › Controls makes K (not R)
 *    mark in Skirmish;
 *  - a colourblind palette reaches the in-battle HUD (radar blips).
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";
import { DOGFIGHT } from "./helpers/battleEntry";

/** Deuteranopia palette enemy / standard enemy (src/ui/theme/signalPalettes.ts). */
const DEUTAN_ENEMY = 0xffb000;
const STANDARD_ENEMY = 0xff4d4d;

async function openSettings(page: Page): Promise<void> {
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await clickMenuItem(page, "SETTINGS");
  await waitForScene(page, "SettingsScene");
  await page.waitForTimeout(300);
}

async function openTab(page: Page, key: string, tab: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForFunction(
    (t) =>
      (window as any).game.scene.getScene("SettingsScene")?.activeTab === t,
    tab,
  );
  await page.waitForTimeout(150);
}

async function stored(page: Page): Promise<any> {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("shattered_stars_settings") ?? "{}"),
  );
}

test.describe("Settings", () => {
  test("audio and colour-vision choices persist across a reload", async ({
    page,
  }) => {
    await openSettings(page);
    // Audio tab: focus Master Volume, three steps down (0.8 → 0.5).
    await page.keyboard.press("ArrowDown");
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
    await openTab(page, "4", "accessibility");
    // Colour Vision: standard → protanopia → deuteranopia.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const saved = await stored(page);
    expect(saved.version).toBe(2);
    expect(saved.audio.master).toBeCloseTo(0.5, 5);
    expect(saved.accessibility.colorVision).toBe("deuteranopia");

    await page.reload();
    await waitForMenuReady(page);
    const applied = await page.evaluate(() =>
      (window as any).game.registry.get("preferences"),
    );
    expect(applied.audio.master).toBeCloseTo(0.5, 5);
    expect(applied.accessibility.colorVision).toBe("deuteranopia");
  });

  test("rebinding MARK_TARGET to K: K marks in Skirmish, R no longer does", async ({
    page,
  }) => {
    await openSettings(page);
    await openTab(page, "2", "controls");
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SettingsScene");
      s.focusTargets
        .find((t: any) => t.config?.label === "Mark Target")
        .activate();
    });
    await page.waitForTimeout(150);
    await page.keyboard.press("k");
    await expect
      .poll(
        async () =>
          (await stored(page)).controls?.profiles?.[0]?.keyboard?.MARK_TARGET,
      )
      .toEqual({ key: "K" });

    // Fresh page: the profile is applied at boot.
    await page.reload();
    await waitForMenuReady(page);
    await page.evaluate(() => {
      const g = (window as any).game;
      g.scene
        .getScenes(true)
        .forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.registry.set("battleConfig", {
        factions: [
          {
            factionId: "free_confederation",
            controller: "player",
            ships: ["confed_kestrel"],
          },
          {
            factionId: "void_corsairs",
            controller: "ai",
            ships: ["corsair_venom"],
          },
        ],
        gameMode: "arcade",
      });
      setTimeout(() => g.scene.start("ArcadeBattleScene"), 100);
    });
    await waitForScene(page, "ArcadeBattleScene");
    await page.waitForFunction(
      () =>
        (window as any).game.scene.getScene("ArcadeBattleScene")
          ?.playerShipId != null,
    );
    // Count the scene's MARK_TARGET handling (the R/K press → mark path).
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("ArcadeBattleScene");
      const original = s.markHudTarget.bind(s);
      (window as any).__marks = 0;
      s.markHudTarget = (ship: unknown) => {
        (window as any).__marks++;
        original(ship);
      };
    });
    const marks = (): Promise<number> =>
      page.evaluate(() => (window as any).__marks);
    await page.keyboard.press("r");
    await page.waitForTimeout(300);
    expect(await marks()).toBe(0);
    await page.keyboard.press("k");
    await expect.poll(marks, { timeout: 2_000 }).toBe(1);
  });

  test("a colourblind palette recolours the in-battle radar", async ({
    page,
  }) => {
    await openSettings(page);
    await openTab(page, "4", "accessibility");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    expect((await stored(page)).accessibility.colorVision).toBe("deuteranopia");

    await DOGFIGHT.enter(page, { peaceful: true });
    const radarColours = (): Promise<number[]> =>
      page.evaluate(
        () =>
          (window as any).game.scene.getScene("DogfightScene").hud.battle.radar
            .blips.commandBuffer,
      );
    await expect
      .poll(async () => (await radarColours()).includes(DEUTAN_ENEMY))
      .toBe(true);
    expect((await radarColours()).includes(STANDARD_ENEMY)).toBe(false);
  });
});
