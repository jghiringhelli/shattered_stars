/**
 * skirmish-menu-shots.spec.ts — screenshots of the Skirmish setup for visual
 * review (no assertions about pixels): the three steps, every ship detail tab
 * and every wingmen type. PNGs go to test-results/skirmish-menu/ at 1280x720
 * and 1920x1080, named `<size>-<step>-<what>.png`.
 *
 * Run: npx playwright test tests/e2e/skirmish-menu-shots.spec.ts
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { clickMenuItem, suppressWebGLNoise, waitForMenuReady, waitForScene } from "./helpers/game";
import { clickText } from "./helpers/pickScreens";

const SCENE = "SquadBuilderScene";
const OUT_DIR = join("test-results", "skirmish-menu");
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;
const DETAIL_TABS = ["OVERVIEW", "STATS", "LOADOUT", "PILOT", "BUILDS"] as const;
const WINGMEN: ReadonlyArray<readonly [label: string, slug: string]> = [
  ["AUTO", "auto"],
  ["SAME ROLE AS MY SHIP", "same-role"],
  ["FIGHTERS", "fighters"],
  ["STRIKERS", "strikers"],
  ["SUPPORT-HEAVY", "support-heavy"],
  ["CUSTOM", "custom"],
];
const ROLE_CHIPS = ["LGT", "HVY", "INT", "BMB", "GUN", "SUP"] as const;

type Step = "ship" | "wingmen" | "battle";

async function openSkirmish(page: Page): Promise<void> {
  suppressWebGLNoise(page);
  await page.goto("/");
  await waitForMenuReady(page);
  await clickMenuItem(page, "SKIRMISH");
  await waitForScene(page, SCENE);
  await page.waitForFunction(
    () => ((window as any).game.scene.getScene("SquadBuilderScene").simpleFlow?.catalog ?? null) !== null,
  );
}

async function openStep(page: Page, step: Step): Promise<void> {
  await page.evaluate((s) => (window as any).game.scene.getScene("SquadBuilderScene").simpleFlow.showStep(s), step);
  await expect
    .poll(() => page.evaluate(() => (window as any).game.scene.getScene("SquadBuilderScene").simpleFlow.openStep))
    .toBe(step);
}

/** Stages the first ship of a role and its first quick build (what clicking its card does). */
async function stage(page: Page, role: string): Promise<void> {
  await page.evaluate(async (r) => {
    const { getEquippableLoadouts } = await import("/src/data/ShipLoadouts.ts");
    const catalog = (window as any).game.scene.getScene("SquadBuilderScene").simpleFlow.catalog;
    const ship = catalog.ships.find((s: any) => s.role === r);
    catalog.staging.selectShip(ship.id);
    catalog.staging.selectLoadout(getEquippableLoadouts(ship.id)[0]!.id);
    catalog.render();
  }, role);
}

async function shot(page: Page, name: string): Promise<void> {
  const size = page.viewportSize()!;
  await page.mouse.move(2, 2);
  await page.screenshot({ path: join(OUT_DIR, `${size.width}x${size.height}-${name}.png`) });
}

test.describe("Skirmish menu screenshots", () => {
  test.beforeAll(() => {
    mkdirSync(OUT_DIR, { recursive: true });
  });

  for (const size of SIZES) {
    test(`step 1 — your ship at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await openSkirmish(page);
      await shot(page, "1-ship-nothing-staged");
      await stage(page, "heavy_fighter");
      for (const tab of DETAIL_TABS) {
        await clickText(page, SCENE, tab);
        await expect
          .poll(() =>
            page.evaluate(
              () => (window as any).game.scene.getScene("SquadBuilderScene").simpleFlow.catalog.detailPanel.openTab,
            ),
          )
          .toBe(tab.toLowerCase());
        await shot(page, `1-ship-tab-${tab.toLowerCase()}`);
      }
    });

    test(`step 1 — every role section at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await openSkirmish(page);
      for (const chip of ROLE_CHIPS) {
        await clickText(page, SCENE, chip);
        await shot(page, `1-ship-role-${chip.toLowerCase()}`);
      }
      await clickText(page, SCENE, "ALL");
      await shot(page, "1-ship-role-all");
    });

    test(`step 2 — your wingmen at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await openSkirmish(page);
      await openStep(page, "wingmen");
      await shot(page, "2-wingmen-nothing-staged");
      await openStep(page, "ship");
      await stage(page, "heavy_fighter");
      await openStep(page, "wingmen");
      for (const [label, slug] of WINGMEN) {
        await clickText(page, SCENE, label);
        await expect
          .poll(() => page.evaluate(() => (window as any).game.scene.getScene("SquadBuilderScene").wingmen))
          .toBe(slug.replace(/-/g, "_"));
        await shot(page, `2-wingmen-${slug}`);
      }
    });

    test(`step 3 — the enemy and battle at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await openSkirmish(page);
      await stage(page, "heavy_fighter");
      await openStep(page, "battle");
      await shot(page, "3-battle-default");
      await clickText(page, SCENE, "Hard");
      await clickText(page, SCENE, "SCENARIO: NONE");
      await shot(page, "3-battle-hard-with-scenario");
    });
  }
});
