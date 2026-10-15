/**
 * ux-qol.spec.ts — the UX/QoL batch: ONE pause menu in every battle (with
 * RESTART, CONTROLS, SEND FEEDBACK, QUIT TO MENU), the hotkey legend on F1,
 * the shared results panel (REMATCH / CHANGE SQUAD / MAIN MENU + stats, R to
 * restart), the main-menu last-battle card, keyboard navigation of the duel
 * setups, ESC on Boss Raid setup and the Survival history, the 12 px text
 * floor and the Controls tabs.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  ALL_BATTLES,
  BOSS_RAID,
  DOGFIGHT,
  SKIRMISH,
} from "./helpers/battleEntry";
import {
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

const PAUSE_LABELS = [
  "RESUME",
  "RESTART",
  "SETTINGS",
  "CONTROLS",
  "SEND FEEDBACK",
  "QUIT TO MENU",
];

/** Every Text in a scene's display list (recursing into containers). */
async function sceneTexts(page: Page, key: string): Promise<string[]> {
  return page.evaluate((k) => {
    const scene = (window as any).game.scene.getScene(k);
    const out: string[] = [];
    const walk = (list: any[]): void =>
      list.forEach((o) => {
        if (typeof o.text === "string" && o.visible !== false) out.push(o.text);
        if (Array.isArray(o.list)) walk(o.list);
      });
    walk(scene.children.list);
    return out;
  }, key);
}

/** Smallest font size (px) among the scene's visible Text objects. */
async function smallestFontPx(page: Page, key: string): Promise<number> {
  return page.evaluate((k) => {
    const scene = (window as any).game.scene.getScene(k);
    let min = Infinity;
    const walk = (list: any[]): void =>
      list.forEach((o) => {
        if (typeof o.text === "string" && o.text.trim() && o.visible !== false) {
          const px = parseFloat(o.style?.fontSize ?? "");
          if (Number.isFinite(px)) min = Math.min(min, px);
        }
        if (Array.isArray(o.list)) walk(o.list);
      });
    walk(scene.children.list);
    return min;
  }, key);
}

async function openMenu(page: Page): Promise<void> {
  suppressWebGLNoise(page);
  await page.goto("/?debug=1");
  await waitForMenuReady(page);
}

async function goTo(page: Page, key: string, data?: object): Promise<void> {
  await page.evaluate(
    async ([k, d]) => {
      await (window as any).ensureScene?.(k);
      (window as any).game.scene.start(k, d);
    },
    [key, data] as const,
  );
  await waitForScene(page, key, 30_000);
  await page.waitForTimeout(600);
}

for (const entry of ALL_BATTLES) {
  test(`${entry.sceneKey}: the shared pause menu lists all six entries`, async ({
    page,
  }) => {
    await entry.enter(page, { peaceful: true });
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => {
        const texts = await sceneTexts(page, entry.sceneKey);
        return PAUSE_LABELS.every((label) => texts.includes(label));
      })
      .toBe(true);
  });
}

test("F1 opens the hotkey legend over the battle and ESC closes it", async ({
  page,
}) => {
  await SKIRMISH.enter(page, { peaceful: true });
  await page.keyboard.press("F1");
  const legend = page.locator("#ss-hotkey-legend");
  await expect(legend).toBeVisible();
  await expect(legend).toContainText("Steer");
  await expect(legend).toContainText("Mark Target");
  await page.keyboard.press("Escape");
  await expect(legend).toHaveCount(0);
});

test("duel legend leaves out squad controls", async ({ page }) => {
  await DOGFIGHT.enter(page, { peaceful: true });
  await page.keyboard.press("F1");
  const legend = page.locator("#ss-hotkey-legend");
  await expect(legend).toBeVisible();
  await expect(legend).not.toContainText("Mark Target");
});

test("Skirmish results: stats, three actions and R restarts", async ({
  page,
}) => {
  await SKIRMISH.enter(page, { peaceful: true });
  await page.evaluate(() =>
    (window as any).game.scene.getScene("ArcadeBattleScene").showEndScreen(true),
  );
  await expect
    .poll(async () => (await sceneTexts(page, "ArcadeBattleScene")).join("|"))
    .toContain("MAIN MENU");
  const texts = await sceneTexts(page, "ArcadeBattleScene");
  for (const label of ["REMATCH", "CHANGE SQUAD", "MAIN MENU", "DURATION", "ACCURACY"])
    expect(texts).toContain(label);
  await page.keyboard.press("r");
  await page.waitForFunction(
    () => {
      const scene = (window as any).game.scene.getScene("ArcadeBattleScene");
      return scene.sys.isActive() && !scene.gameEnded && scene.ships?.size > 0;
    },
    undefined,
    { timeout: 15_000 },
  );
});

test("the main menu shows the last battle and CONTINUE relaunches the mode", async ({
  page,
}) => {
  await SKIRMISH.enter(page, { peaceful: true });
  await page.evaluate(async () => {
    const { saveLastLaunch } = await import("/src/systems/setup/setupMemory.ts");
    const game = (window as any).game;
    saveLastLaunch({
      label: "SKIRMISH",
      scene: "ArcadeBattleScene",
      battleConfig: game.registry.get("battleConfig"),
    });
    game.scene.getScene("ArcadeBattleScene").showEndScreen(true);
  });
  await page.waitForTimeout(500);
  await page.evaluate(() =>
    (window as any).game.scene.getScene("ArcadeBattleScene").scene.start("MainMenuScene"),
  );
  await waitForScene(page, "MainMenuScene", 30_000);
  await expect
    .poll(async () => (await sceneTexts(page, "MainMenuScene")).join("|"))
    .toContain("Last: Skirmish — Victory");
  await page.keyboard.press("r");
  await waitForScene(page, "ArcadeBattleScene", 30_000);
});

test("Boss Raid setup leaves on ESC", async ({ page }) => {
  await openMenu(page);
  await goTo(page, "EpicBattleScene");
  await page.keyboard.press("Escape");
  await waitForScene(page, "MainMenuScene", 30_000);
});

test("Survival run history leaves on ESC and has an empty-state hint", async ({
  page,
}) => {
  await openMenu(page);
  await goTo(page, "SurvivalSummaryScene", { historyOnly: true });
  expect((await sceneTexts(page, "SurvivalSummaryScene")).join("|")).toContain(
    "No runs yet",
  );
  await page.keyboard.press("Escape");
  await waitForScene(page, "SurvivalSetupScene", 30_000);
});

test("Dogfight setup is keyboard-navigable (arrow focuses BACK, ENTER presses it)", async ({
  page,
}) => {
  await openMenu(page);
  await goTo(page, "DogfightScene");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(
    () => (window as any).game.scene.getScene("DogfightScene").setupNav.index,
  );
  expect(focused).toBeGreaterThanOrEqual(0);
  await page.keyboard.press("Enter");
  await waitForScene(page, "MainMenuScene", 30_000);
});

test("Controls screen groups the bindings into four tabs", async ({ page }) => {
  await openMenu(page);
  await goTo(page, "ControlsScene");
  const flight = await sceneTexts(page, "ControlsScene");
  expect(flight.length).toBeLessThan(60);
  expect(flight).toContain("Steer");
  await page.keyboard.press("2");
  await expect
    .poll(async () => (await sceneTexts(page, "ControlsScene")).includes("Cloak"))
    .toBe(true);
});

for (const key of [
  "MainMenuScene",
  "ControlsScene",
  "SettingsScene",
  "SquadBuilderScene",
  "SurvivalSetupScene",
  "CampaignScene",
]) {
  test(`${key}: no text below 12 px at 1280x720`, async ({ page }) => {
    await openMenu(page);
    if (key === "SquadBuilderScene") {
      await goTo(page, key, { initialMode: "arcade" });
      await page.evaluate(() => {
        const s = (window as any).game.scene.getScene("SquadBuilderScene");
        s.simpleMode = false;
        s.renderBuilderMode();
      });
      await page.waitForTimeout(500);
    } else if (key !== "MainMenuScene") {
      await goTo(page, key);
    }
    expect(await smallestFontPx(page, key)).toBeGreaterThanOrEqual(12);
  });
}

test("the accessibility preset (settings document) turns every comfort setting on", async ({
  page,
}) => {
  await openMenu(page);
  const prefs = await page.evaluate(async () => {
    const { applyAccessibilityPreset } = await import(
      "/src/ui/settings/accessibilityPreset.ts"
    );
    const { DEFAULT_SETTINGS } = await import("/src/systems/settingsSchema.ts");
    return applyAccessibilityPreset(DEFAULT_SETTINGS).accessibility;
  });
  expect(prefs).toMatchObject({
    highContrastHud: true,
    reduceFlashes: true,
    reduceMotion: true,
    textScale: 1.15,
  });
});

test("Boss Raid pause menu is the shared one", async ({ page }) => {
  await BOSS_RAID.enter(page, { peaceful: true });
  await page.keyboard.press("Escape");
  await expect
    .poll(async () =>
      (await sceneTexts(page, "EpicBattleScene")).includes("QUIT TO MENU"),
    )
    .toBe(true);
});
