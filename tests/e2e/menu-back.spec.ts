/**
 * menu-back.spec.ts — one consistent back affordance: ESC leaves every
 * menu screen (to the main menu, or closes an overlay), gamepad B and
 * right-click do the same, and menu transitions stay inside the 400 ms
 * budget.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  injectFakeGamepad,
  suppressWebGLNoise,
  tapFakeGamepadButton,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

/** Menu scenes whose back goes to the main menu. */
const MENU_SCREENS = [
  "SettingsScene",
  "ControlsScene",
  "CreditsScene",
  "EncyclopediaScene",
  "SquadBuilderScene",
  "LobbyScene",
  "DogfightScene",
  "AceDuelScene",
] as const;

async function openScreen(
  page: Page,
  key: string,
  data?: object,
): Promise<void> {
  await page.evaluate(
    ({ k, d }) => {
      const g = (window as any).game;
      g.scene
        .getScenes(true)
        .forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.scene.start(k, d);
    },
    { k: key, d: data },
  );
  await waitForScene(page, key);
  await page.waitForTimeout(350);
}

test.describe("menu back affordance", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?debug=1");
    suppressWebGLNoise(page);
    await waitForMenuReady(page);
  });

  for (const key of MENU_SCREENS) {
    test(`ESC goes back from ${key}`, async ({ page }) => {
      await openScreen(page, key);
      await page.keyboard.press("Escape");
      await waitForScene(page, "MainMenuScene", 5_000);
    });
  }

  test("ESC closes the ship picker overlay", async ({ page }) => {
    await openScreen(page, "ShipPickerScene", {
      slotIndex: 0,
      factionId: "void_corsairs",
      selectedShips: [],
      pointLimit: 200,
    });
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !(window as any).game.scene.isActive("ShipPickerScene"),
    );
  });

  test("gamepad B goes back from Credits", async ({ page }) => {
    await openScreen(page, "CreditsScene");
    await injectFakeGamepad(page);
    await page.waitForTimeout(200);
    await tapFakeGamepadButton(page, 1);
    await waitForScene(page, "MainMenuScene", 5_000);
  });

  test("gamepad B leaves Flight School", async ({ page }) => {
    await openScreen(page, "FlightSchoolScene");
    await injectFakeGamepad(page);
    await page.waitForTimeout(200);
    await tapFakeGamepadButton(page, 1);
    await waitForScene(page, "MainMenuScene", 5_000);
  });

  test("right-click goes back from Controls", async ({ page }) => {
    await openScreen(page, "ControlsScene");
    const box = await page.locator("canvas").boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2, {
      button: "right",
    });
    await waitForScene(page, "MainMenuScene", 5_000);
  });

  test("menu transitions finish within 400 ms", async ({ page }) => {
    const { budget, total } = await page.evaluate(async () => {
      const m = await import("/src/ui/menu/menuTransitions.ts");
      return {
        budget: m.MENU_TRANSITION_BUDGET_MS,
        total: m.MENU_TRANSITION.fadeOutMs + m.MENU_TRANSITION.fadeInMs,
      };
    });
    expect(total).toBeLessThanOrEqual(budget);
    expect(budget).toBe(400);
  });
});
