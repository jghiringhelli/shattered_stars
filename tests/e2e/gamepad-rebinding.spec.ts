/**
 * gamepad-rebinding.spec.ts — Settings › Gamepad with a simulated pad:
 *  - D-pad moves the menu focus ring (same navigation model as arrows);
 *  - rebinding Mark Target to Back/View is persisted in the control profile and,
 *    after a reload, Back/View (not R3) marks the HUD target in Dogfight;
 *  - conflicts swap (X for Hero Power 2 moves Fire Secondary to L3) and the
 *    reserved Start button is refused.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  injectFakeGamepad,
  suppressWebGLNoise,
  tapFakeGamepadButton,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";
import { DOGFIGHT } from "./helpers/battleEntry";

const BACK_VIEW = 8;
const X = 2;
const START = 9;
const R3 = 11;
const DPAD_DOWN = 13;

async function openGamepadTab(page: Page): Promise<void> {
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await injectFakeGamepad(page);
  await page.evaluate(() => {
    const g = (window as any).game;
    g.scene
      .getScenes(true)
      .forEach((s: any) => g.scene.stop(s.sys.settings.key));
    g.scene.start("SettingsScene", { tab: "gamepad", instant: true });
  });
  await waitForScene(page, "SettingsScene");
  await page.waitForFunction(
    () =>
      (window as any).game.scene.getScene("SettingsScene")?.activeTab ===
      "gamepad",
  );
  await page.waitForTimeout(200);
}

async function armRow(page: Page, label: string): Promise<void> {
  await page.evaluate((l) => {
    const s = (window as any).game.scene.getScene("SettingsScene");
    s.focusTargets.find((t: any) => t.config?.label === l).activate();
  }, label);
  await page.waitForTimeout(150);
}

async function storedGamepad(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("shattered_stars_settings") ?? "{}")
        .controls?.profiles?.[0]?.gamepad ?? {},
  );
}

async function notice(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (window as any).game.scene.getScene("SettingsScene").notice?.text ?? "",
  );
}

test.describe("Settings › Gamepad", () => {
  test("D-pad moves the focus ring", async ({ page }) => {
    await openGamepadTab(page);
    const focused = (): Promise<number> =>
      page.evaluate(
        () =>
          (window as any).game.scene.getScene("SettingsScene").focus
            .focusedIndex,
      );
    expect(await focused()).toBe(-1);
    await tapFakeGamepadButton(page, DPAD_DOWN);
    await expect.poll(focused).toBe(0);
    await tapFakeGamepadButton(page, DPAD_DOWN);
    await expect.poll(focused).toBe(1);
  });

  test("Back/View rebinding persists and marks in Dogfight after a reload", async ({
    page,
  }) => {
    await openGamepadTab(page);
    await armRow(page, "Mark Target");
    await tapFakeGamepadButton(page, BACK_VIEW);
    await expect
      .poll(() => storedGamepad(page))
      .toEqual({ MARK_TARGET: BACK_VIEW });

    await DOGFIGHT.enter(page, { peaceful: true });
    await injectFakeGamepad(page);
    await page.waitForTimeout(300);
    const marked = (): Promise<string | null> =>
      page.evaluate(() => {
        const s = (window as any).game.scene.getScene("DogfightScene");
        return s.crew.markedTargetOf("player", s.time.now);
      });
    await tapFakeGamepadButton(page, R3);
    await page.waitForTimeout(300);
    expect(await marked()).toBeNull();
    await tapFakeGamepadButton(page, BACK_VIEW);
    await expect.poll(marked, { timeout: 2_000 }).toBe("ai_0");
  });

  test("a taken button swaps; Start is refused", async ({ page }) => {
    await openGamepadTab(page);
    await armRow(page, "Hero Power 2");
    await tapFakeGamepadButton(page, X);
    await expect
      .poll(() => storedGamepad(page))
      .toEqual({ HERO_POWER_2: X, FIRE_SECONDARY: 10 });
    expect(await notice(page)).toContain("Swapped");

    await armRow(page, "Cloak");
    await tapFakeGamepadButton(page, START);
    await expect.poll(() => notice(page)).toContain("reserved");
    expect(await storedGamepad(page)).toEqual({
      HERO_POWER_2: X,
      FIRE_SECONDARY: 10,
    });
  });
});
