/**
 * pause-flow.spec.ts — the pause menu must be fully usable from the keyboard
 * and gamepad in every battle scene, and Settings opened from it must sit on
 * top of the (frozen) battle and return to the pause menu.
 *
 * Regressions covered (alpha audit): Settings rendered under the paused
 * battle with clicks falling through; the quit confirmation ignored
 * Enter/ESC (soft-lock); the Skirmish/Boss Raid/Continuous pause menus had
 * no keyboard focus; ESC didn't close the pause menu in some modes.
 */

import { test, expect, type Page } from "@playwright/test";
import { ALL_BATTLES, DOGFIGHT, type BattleEntry } from "./helpers/battleEntry";
import { injectFakeGamepad, tapFakeGamepadButton } from "./helpers/game";

/** Arrow-down presses from "nothing focused" to SETTINGS / QUIT per pause UI. */
const MENU_STEPS: Readonly<Record<string, { settings: number; quit: number }>> =
  {
    ArcadeBattleScene: { settings: 2, quit: 3 },
  };
const DEFAULT_STEPS = { settings: 3, quit: 4 } as const;
/** Gap between key presses so each lands in its own frame. */
const KEY_GAP_MS = 120;
const GAMEPAD = { A: 0, B: 1, DPAD_DOWN: 13, DPAD_LEFT: 14, START: 9 } as const;

const stepsFor = (sceneKey: string) => MENU_STEPS[sceneKey] ?? DEFAULT_STEPS;

async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(KEY_GAP_MS);
  }
}

/** Battle flag `isPaused` (the game-level pause, not Phaser's scene pause). */
async function battlePaused(page: Page, key: string): Promise<boolean> {
  return page.evaluate(
    (k) => (window as any).game.scene.getScene(k).isPaused === true,
    key,
  );
}

/** Whether the "Quit to menu?" confirmation is in the scene's display list. */
async function confirmOpen(page: Page, key: string): Promise<boolean> {
  return page.evaluate((k) => {
    const scene = (window as any).game.scene.getScene(k);
    const hasText = (objects: any[]): boolean =>
      objects.some(
        (o) =>
          (typeof o.text === "string" && o.text.startsWith("Quit to menu?")) ||
          (Array.isArray(o.list) && hasText(o.list)),
      );
    return hasText(scene.children.list);
  }, key);
}

async function openPause(page: Page, entry: BattleEntry): Promise<void> {
  await page.keyboard.press("Escape");
  await expect.poll(() => battlePaused(page, entry.sceneKey)).toBe(true);
  await page.waitForTimeout(300); // pause panel tween
}

async function openQuitConfirm(page: Page, entry: BattleEntry): Promise<void> {
  await openPause(page, entry);
  await press(page, "ArrowDown", stepsFor(entry.sceneKey).quit);
  await press(page, "Enter");
  await expect.poll(() => confirmOpen(page, entry.sceneKey)).toBe(true);
}

for (const entry of ALL_BATTLES) {
  test(`${entry.sceneKey}: Settings opens on top of the paused battle and returns to the pause menu`, async ({
    page,
  }) => {
    await entry.enter(page, { peaceful: true });
    await openPause(page, entry);
    await press(page, "ArrowDown", stepsFor(entry.sceneKey).settings);
    await press(page, "Enter");
    await page.waitForFunction(() =>
      (window as any).game.scene.isActive("SettingsScene"),
    );
    const order = await page.evaluate((k) => {
      const g = (window as any).game;
      const keys = g.scene.scenes.map((s: any) => s.sys.settings.key);
      return {
        settingsAbove: keys.indexOf("SettingsScene") > keys.indexOf(k),
        battleFrozen: g.scene.getScene(k).sys.isPaused(),
      };
    }, entry.sceneKey);
    expect(order).toEqual({ settingsAbove: true, battleFrozen: true });

    // A click where the pause menu's buttons sit must not reach the battle.
    await page.mouse.click(640, 400);
    expect(await confirmOpen(page, entry.sceneKey)).toBe(false);

    await press(page, "Escape");
    await page.waitForFunction((k) => {
      const g = (window as any).game;
      return !g.scene.isActive("SettingsScene") && g.scene.isActive(k);
    }, entry.sceneKey);
    expect(await battlePaused(page, entry.sceneKey)).toBe(true);
    await press(page, "Escape");
    await expect.poll(() => battlePaused(page, entry.sceneKey)).toBe(false);
  });

  test(`${entry.sceneKey}: the keyboard alone can quit the battle`, async ({
    page,
  }) => {
    await entry.enter(page, { peaceful: true });
    await openQuitConfirm(page, entry);

    // ENTER on the default (CANCEL) closes the dialog and stays paused.
    await press(page, "Enter");
    await expect.poll(() => confirmOpen(page, entry.sceneKey)).toBe(false);
    expect(await battlePaused(page, entry.sceneKey)).toBe(true);

    // ESC closes the dialog too, without un-pausing the battle.
    await press(page, "Enter");
    await expect.poll(() => confirmOpen(page, entry.sceneKey)).toBe(true);
    await press(page, "Escape");
    await expect.poll(() => confirmOpen(page, entry.sceneKey)).toBe(false);
    await page.waitForTimeout(300);
    expect(await battlePaused(page, entry.sceneKey)).toBe(true);

    // ← then ENTER confirms and leaves the battle.
    await press(page, "Enter");
    await expect.poll(() => confirmOpen(page, entry.sceneKey)).toBe(true);
    await press(page, "ArrowLeft");
    await press(page, "Enter");
    await page.waitForFunction(
      (k) => !(window as any).game.scene.isActive(k),
      entry.sceneKey,
      { timeout: 10_000 },
    );
  });
}

test("Dogfight: a gamepad alone can cancel and confirm the quit dialog", async ({
  page,
}) => {
  await DOGFIGHT.enter(page, { peaceful: true });
  await injectFakeGamepad(page);
  await openPause(page, DOGFIGHT);
  for (let i = 0; i < DEFAULT_STEPS.quit; i++)
    await tapFakeGamepadButton(page, GAMEPAD.DPAD_DOWN);
  await tapFakeGamepadButton(page, GAMEPAD.A);
  await expect.poll(() => confirmOpen(page, DOGFIGHT.sceneKey)).toBe(true);
  await tapFakeGamepadButton(page, GAMEPAD.B);
  await expect.poll(() => confirmOpen(page, DOGFIGHT.sceneKey)).toBe(false);
  expect(await battlePaused(page, DOGFIGHT.sceneKey)).toBe(true);

  await tapFakeGamepadButton(page, GAMEPAD.A);
  await expect.poll(() => confirmOpen(page, DOGFIGHT.sceneKey)).toBe(true);
  await tapFakeGamepadButton(page, GAMEPAD.DPAD_LEFT);
  await tapFakeGamepadButton(page, GAMEPAD.A);
  await page.waitForFunction(() =>
    (window as any).game.scene.isActive("MainMenuScene"),
  );
});
