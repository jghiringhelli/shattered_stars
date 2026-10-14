/**
 * sortie-briefing.spec.ts — the shared pre-sortie briefing and the Settings
 * default difficulty on the duel / raid setup screens:
 *  - Dogfight: the card shows a codename, then launches by itself in ≤ 3 s;
 *  - Ace Duel: ENTER skips it at once;
 *  - Boss Raid: a real click on BEGIN ASSAULT briefs; gamepad A skips;
 *  - Settings › Default Difficulty "brutal" preselects brutal / mythic.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickMenuItem,
  injectFakeGamepad,
  suppressWebGLNoise,
  tapFakeGamepadButton,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";
import { clickText } from "./helpers/pickScreens";

const AUTO_LAUNCH_LIMIT_MS = 3000;
const GAMEPAD_A = 0;
const BEGIN_ASSAULT_LABEL = "BEGIN ASSAULT";

async function openMode(page: Page, label: string, key: string): Promise<void> {
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await clickMenuItem(page, label);
  await waitForScene(page, key, 30_000);
  await page.waitForFunction((k) => {
    const g = (window as any).game;
    return (
      g.scene.isActive(k) &&
      !g.scene.isActive("MainMenuScene") &&
      g.scene.getScene(k).isSetupPhase === true
    );
  }, key);
}

async function brief(page: Page, key: string): Promise<void> {
  await page.evaluate((k) => {
    (window as any).game.scene.getScene(k).briefSortie();
  }, key);
}

async function card(page: Page, key: string): Promise<any> {
  return page.evaluate((k) => {
    const c = (window as any).game.scene.getScene(k).data.get("sortieBriefing");
    return c
      ? { open: c.isOpen, durationMs: c.durationMs, briefing: c.briefing }
      : null;
  }, key);
}

async function shipCount(page: Page, key: string): Promise<number> {
  return page.evaluate(
    (k) => (window as any).game.scene.getScene(k).ships?.size ?? 0,
    key,
  );
}

test.describe("Sortie briefing", () => {
  test("Dogfight briefs, then launches by itself within 3 s", async ({
    page,
  }) => {
    await openMode(page, "DOGFIGHT", "DogfightScene");
    await brief(page, "DogfightScene");
    const shown = await card(page, "DogfightScene");
    expect(shown.open).toBe(true);
    expect(shown.durationMs).toBeLessThanOrEqual(AUTO_LAUNCH_LIMIT_MS);
    expect(shown.briefing.codename).toMatch(/^OPERATION /);
    expect(shown.briefing.mode).toBe("DOGFIGHT");
    expect(await shipCount(page, "DogfightScene")).toBe(0);
    const started = Date.now();
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("DogfightScene").ships?.size ??
          0) >= 2,
      undefined,
      { timeout: AUTO_LAUNCH_LIMIT_MS + 1500 },
    );
    expect(Date.now() - started).toBeLessThan(AUTO_LAUNCH_LIMIT_MS + 1000);
    expect(await card(page, "DogfightScene")).toBeNull();
  });

  test("Ace Duel: ENTER skips the briefing", async ({ page }) => {
    await openMode(page, "ACE DUEL", "AceDuelScene");
    await brief(page, "AceDuelScene");
    expect((await card(page, "AceDuelScene")).briefing.mood).toBe("rivalry");
    await page.waitForTimeout(150);
    await page.keyboard.press("Enter");
    await expect
      .poll(() => shipCount(page, "AceDuelScene"), { timeout: 800 })
      .toBeGreaterThanOrEqual(2);
  });

  test("Boss Raid: BEGIN ASSAULT briefs, gamepad A skips", async ({ page }) => {
    await openMode(page, "BOSS RAID", "EpicBattleScene");
    await injectFakeGamepad(page);
    await clickText(page, "EpicBattleScene", BEGIN_ASSAULT_LABEL);
    await expect
      .poll(async () => (await card(page, "EpicBattleScene"))?.briefing.mode)
      .toBe("BOSS RAID");
    await page.waitForTimeout(150);
    await tapFakeGamepadButton(page, GAMEPAD_A, 80);
    await expect
      .poll(() => shipCount(page, "EpicBattleScene"), { timeout: 1000 })
      .toBeGreaterThanOrEqual(2);
  });
});

test.describe("Settings default difficulty", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "shattered_stars_settings",
        JSON.stringify({
          version: 2,
          gameplay: { defaultDifficulty: "brutal" },
        }),
      );
    });
  });

  const cases: ReadonlyArray<[string, string, string]> = [
    ["DOGFIGHT", "DogfightScene", "brutal"],
    ["ACE DUEL", "AceDuelScene", "brutal"],
    ["BOSS RAID", "EpicBattleScene", "mythic"],
  ];
  for (const [label, key, expected] of cases) {
    test(`${label} preselects ${expected}`, async ({ page }) => {
      await openMode(page, label, key);
      const difficulty = await page.evaluate(
        (k) => (window as any).game.scene.getScene(k).difficulty,
        key,
      );
      expect(difficulty).toBe(expected);
    });
  }
});
