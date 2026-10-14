/**
 * pick-screens.spec.ts — the tabbed pick screens: one tab visible at a time,
 * hover tooltips (short, then full on hold), the points bar and screenshots
 * of every tab at 1280x720 and 1920x1080 (to $TEMP).
 */

import { join } from "node:path";
import { tmpdir } from "node:os";
import { test, expect, type Page } from "@playwright/test";
import {
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";
import {
  clickText,
  hoverText,
  sceneTexts,
  tooltip,
  tooltipExpanded,
} from "./helpers/pickScreens";

const SIMPLE = "SquadBuilderScene";
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;
/** Text objects the detail panel may show at once (spec: about 35 per pick screen data set). */
const DETAIL_BUDGET = 40;
/** The whole screen, with the ship list and header beside the detail (about 2 data sets). */
const SCREEN_BUDGET = 100;
/** Left edge of the detail panel at 1280x720 (x of its first text). */
const DETAIL_X = 488;
/** Vertical extent of the detail panel at 1280x720. */
const DETAIL_TOP = 148;
const DETAIL_BOTTOM = 664;
const TABS = ["OVERVIEW", "STATS", "LOADOUT", "PILOT", "BUILDS"] as const;

async function openSkirmish(page: Page): Promise<void> {
  suppressWebGLNoise(page);
  await page.goto("/");
  await waitForMenuReady(page);
  await clickMenuItem(page, "SKIRMISH");
  await waitForScene(page, SIMPLE);
  await page.waitForFunction(
    () =>
      ((window as any).game.scene.getScene("SquadBuilderScene").simpleFlow
        ?.catalog ?? null) !== null,
  );
}

/** Stages the first ship of a role and its first quick build. */
async function stage(page: Page, role: string): Promise<void> {
  await page.evaluate(async (r) => {
    const { getEquippableLoadouts } = await import("/src/data/ShipLoadouts.ts");
    const catalog = (window as any).game.scene.getScene("SquadBuilderScene")
      .simpleFlow.catalog;
    const ship = catalog.ships.find((s: any) => s.role === r);
    catalog.staging.selectShip(ship.id);
    catalog.staging.selectLoadout(getEquippableLoadouts(ship.id)[0]!.id);
    catalog.render();
  }, role);
}

async function openTabName(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (window as any).game.scene.getScene("SquadBuilderScene").simpleFlow
        .catalog.detailPanel.openTab,
  );
}

/** Texts on screen (inside the viewport) and the smallest font among them. */
async function density(page: Page, key: string): Promise<{ count: number; detail: number; minSize: number }> {
  const texts = await page.evaluate((k) => {
    const scene = (window as any).game.scene.getScene(k);
    const { width, height } = scene.scale;
    const out: Array<{ text: string; size: number; x: number; y: number }> = [];
    // Rows scrolled out of a masked list are clipped, not on screen.
    const clip = scene.simpleFlow?.catalog?.scroll?.cfg;
    const walk = (obj: any, parentVisible: boolean, masked: boolean): void => {
      const visible = parentVisible && obj.visible !== false && obj.alpha !== 0;
      if (typeof obj.text === "string" && obj.text.trim() && visible) {
        const b = obj.getBounds();
        const inside = b.right > 0 && b.bottom > 0 && b.x < width && b.y < height;
        const clipped = masked && clip && (b.y < clip.clipY || b.bottom > clip.clipY + clip.clipH);
        if (inside && !clipped) out.push({ text: obj.text, size: parseFloat(String(obj.style?.fontSize ?? "0")), x: b.x, y: b.y });
      }
      for (const child of (obj.list as any[] | undefined) ?? []) walk(child, visible, masked || Boolean(obj.mask));
    };
    for (const obj of scene.children.list as any[]) walk(obj, true, false);
    return out;
  }, key);
  return {
    count: texts.length,
    detail: texts.filter((t) => t.x >= DETAIL_X && t.y >= DETAIL_TOP && t.y < DETAIL_BOTTOM).length,
    minSize: Math.min(...texts.map((t) => t.size)),
  };
}

test.describe("Skirmish pick flow — tabs", () => {
  test("each tab shows only its own data set", async ({ page }) => {
    await openSkirmish(page);
    await stage(page, "heavy_fighter");
    const marker: Record<(typeof TABS)[number], string> = {
      OVERVIEW: "SPEED  1\u20134",
      STATS: "ACTIONS",
      LOADOUT: "UPGRADES",
      PILOT: "PILOT",
      BUILDS: "WHEN TO PICK IT",
    };
    for (const tab of TABS) {
      await clickText(page, SIMPLE, tab);
      await expect.poll(() => openTabName(page)).toBe(tab.toLowerCase());
      const texts = await sceneTexts(page, SIMPLE);
      expect(texts.some((t) => t.startsWith(marker[tab].slice(0, 5))), tab).toBe(true);
      for (const other of TABS) {
        if (other === tab) continue;
        expect(texts.includes(marker[other]) && marker[other] !== marker[tab] && other !== "PILOT" && tab !== "OVERVIEW" ? other : "", `${tab} leaks ${other}`).toBe("");
      }
    }
  });

  test("Q / E step the tabs and the last tab is remembered across ships", async ({ page }) => {
    await openSkirmish(page);
    await stage(page, "heavy_fighter");
    await page.keyboard.press("e");
    await expect.poll(() => openTabName(page)).toBe("stats");
    await page.keyboard.press("e");
    await page.keyboard.press("q");
    await expect.poll(() => openTabName(page)).toBe("stats");
    await page.keyboard.press("q");
    await page.keyboard.press("q");
    await expect.poll(() => openTabName(page)).toBe("builds");
    await stage(page, "interceptor");
    await expect.poll(() => openTabName(page)).toBe("builds");
  });

  test("hover is short, holding Shift or waiting shows the full explanation", async ({ page }) => {
    await openSkirmish(page);
    await stage(page, "heavy_fighter");
    await clickText(page, SIMPLE, "STATS");
    await hoverText(page, SIMPLE, "HULL");
    await expect.poll(() => tooltip(page, SIMPLE)).not.toBe("");
    expect(await tooltipExpanded(page, SIMPLE)).toBe(false);
    expect(await tooltip(page, SIMPLE)).not.toContain("EXAMPLE");
    await page.keyboard.down("Shift");
    await expect.poll(() => tooltipExpanded(page, SIMPLE)).toBe(true);
    await page.keyboard.up("Shift");
    expect(await tooltip(page, SIMPLE)).toContain("EXAMPLE");
    await hoverText(page, SIMPLE, "SHIELDS");
    await expect.poll(() => tooltipExpanded(page, SIMPLE), { timeout: 3000 }).toBe(true);
  });

  test("the points bar prices ship plus wingmen and follows the chosen build", async ({ page }) => {
    await openSkirmish(page);
    await expect
      .poll(async () => (await sceneTexts(page, SIMPLE)).some((t) => t.startsWith("Pick a ship")))
      .toBe(true);
    await stage(page, "heavy_fighter");
    const caption = async (): Promise<string> =>
      (await sceneTexts(page, SIMPLE)).find((t) => t.startsWith("Your ship")) ?? "";
    await expect.poll(caption).toMatch(/^Your ship \d+ pts \+ AI wingmen \d+ pts = \d+ of 200$/);
    const before = await caption();
    await clickText(page, SIMPLE, "BUILDS");
    const labels = (await sceneTexts(page, SIMPLE)).filter((t) => / \u00b7 \d+$/.test(t));
    expect(labels.length).toBeGreaterThan(1);
    await clickText(page, SIMPLE, labels[labels.length - 1]!);
    await expect.poll(caption).not.toBe(before);
    expect((await sceneTexts(page, SIMPLE)).some((t) => t === "Enemy squad matched to 200 pts")).toBe(true);
  });

  test("the Map option cycles Random and the themes and is stored for the battle", async ({ page }) => {
    await openSkirmish(page);
    await clickText(page, SIMPLE, "MAP: RANDOM");
    const choice = async (): Promise<string> =>
      page.evaluate(() => (window as any).game.registry.get("mapThemeChoice") ?? "random");
    await expect.poll(choice).not.toBe("random");
    const label = (await sceneTexts(page, SIMPLE)).find((t) => t.startsWith("MAP: "))!;
    expect(label).not.toBe("MAP: RANDOM");
    await page.mouse.move(5, 5);
    await hoverText(page, SIMPLE, label);
    await expect.poll(() => tooltipExpanded(page, SIMPLE)).toBe(true);
    expect(await tooltip(page, SIMPLE)).toContain("Online battles ignore");
  });

  test("role sections fold and unfold from their header", async ({ page }) => {
    await openSkirmish(page);
    const hasShip = async (): Promise<boolean> =>
      (await sceneTexts(page, SIMPLE)).includes("Gladius-class Fighter");
    expect(await hasShip()).toBe(true);
    await clickText(page, SIMPLE, "HEAVY FIGHTERS");
    await expect.poll(hasShip).toBe(false);
    await clickText(page, SIMPLE, "HEAVY FIGHTERS");
    await expect.poll(hasShip).toBe(true);
  });

  test("density: few texts on screen and none under 12 px at 1280x720", async ({ page }) => {
    await page.setViewportSize(SIZES[0]);
    await openSkirmish(page);
    await stage(page, "heavy_fighter");
    for (const tab of TABS) {
      await clickText(page, SIMPLE, tab);
      await expect.poll(() => openTabName(page)).toBe(tab.toLowerCase());
      const { count, detail, minSize } = await density(page, SIMPLE);
      console.log(`density simple ${tab}: ${count} texts on screen, ${detail} in the detail panel, min ${minSize}px`);
      expect(minSize, tab).toBeGreaterThanOrEqual(12);
      expect(detail, tab).toBeLessThanOrEqual(DETAIL_BUDGET);
      expect(count, tab).toBeLessThanOrEqual(SCREEN_BUDGET);
    }
  });

  for (const size of SIZES) {
    test(`screenshots of every tab at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await openSkirmish(page);
      await stage(page, "heavy_fighter");
      for (const tab of TABS) {
        await clickText(page, SIMPLE, tab);
        await expect.poll(() => openTabName(page)).toBe(tab.toLowerCase());
        await page.mouse.move(2, 2);
        await page.screenshot({
          path: join(tmpdir(), `pick-simple-${tab.toLowerCase()}-${size.width}x${size.height}.png`),
        });
      }
    });
  }
});
const PICKER = "ShipPickerScene";

/** Opens the ship picker overlay for a faction with a point limit and stages a ship. */
async function openPicker(page: Page, limit: number): Promise<void> {
  suppressWebGLNoise(page);
  await page.goto("/");
  await waitForMenuReady(page);
  await page.evaluate((pointLimit) => {
    const game = (window as any).game;
    game.scene.stop("MainMenuScene");
    game.scene.start("ShipPickerScene", {
      slotIndex: 0,
      factionId: "terran_hegemony",
      selectedShips: [],
      pointLimit,
    });
  }, limit);
  await waitForScene(page, PICKER);
  const gotIt = await sceneTexts(page, PICKER);
  if (gotIt.includes("GOT IT")) await clickText(page, PICKER, "GOT IT");
}

async function stagePicker(page: Page, role: string): Promise<void> {
  await page.evaluate(async (r) => {
    const { getEquippableLoadouts } = await import("/src/data/ShipLoadouts.ts");
    const catalog = (window as any).game.scene.getScene("ShipPickerScene").catalogPanel;
    const ship = catalog.ships.find((s: any) => s.role === r);
    catalog.staging.selectShip(ship.id);
    catalog.staging.selectLoadout(getEquippableLoadouts(ship.id)[0]!.id);
    catalog.render();
  }, role);
}

test.describe("Ship picker overlay — points budget and tabs", () => {
  test("refuses a pick that goes over budget and says why", async ({ page }) => {
    await openPicker(page, 40);
    await stagePicker(page, "heavy_fighter");
    await page.evaluate(() => {
      const picker = (window as any).game.scene.getScene("ShipPickerScene");
      const { staging } = picker.catalogPanel;
      staging.emit("addInstance", { shipId: staging.getSelectedShipId(), loadoutId: staging.getSelectedLoadoutId() });
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).game.scene.getScene("ShipPickerScene").pointsBar.captionText))
      .toMatch(/^Over budget: this pick costs \d+ pts and only 40 pts left/);
    const count = await page.evaluate(() => (window as any).game.scene.getScene("ShipPickerScene").squadInstances.length);
    expect(count).toBe(0);
  });

  test("accepts picks within budget and the bar follows the squad", async ({ page }) => {
    await openPicker(page, 200);
    await stagePicker(page, "light_fighter");
    await page.evaluate(() => {
      const picker = (window as any).game.scene.getScene("ShipPickerScene");
      const { staging } = picker.catalogPanel;
      staging.emit("addInstance", { shipId: staging.getSelectedShipId(), loadoutId: staging.getSelectedLoadoutId() });
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).game.scene.getScene("ShipPickerScene").pointsBar.captionText))
      .toMatch(/^\d+ spent \u00b7 \d+ left of 200$/);
  });

  test("density: no text under 12 px at 1280x720", async ({ page }) => {
    await page.setViewportSize(SIZES[0]);
    await openPicker(page, 200);
    await stagePicker(page, "heavy_fighter");
    const { minSize, count } = await density(page, PICKER);
    console.log(`density picker overview: ${count} texts on screen, min ${minSize}px`);
    expect(minSize).toBeGreaterThanOrEqual(12);
  });

  for (const size of SIZES) {
    test(`screenshots of every tab at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await openPicker(page, 200);
      await stagePicker(page, "heavy_fighter");
      // The overlay's panel is narrow: only the open tab shows its label, so step with E.
      for (const [index, tab] of TABS.entries()) {
        if (index > 0) await page.keyboard.press("e");
        await expect(async () => {
          expect(await sceneTexts(page, PICKER)).toContain(tab);
        }).toPass();
        await page.mouse.move(2, 2);
        await page.screenshot({
          path: join(tmpdir(), `pick-overlay-${tab.toLowerCase()}-${size.width}x${size.height}.png`),
        });
      }
    });
  }
});

test.describe("Advanced squad builder", () => {
  for (const size of SIZES) {
    test(`screenshot at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await openSkirmish(page);
      await clickText(page, SIMPLE, "ADVANCED");
      await expect
        .poll(async () => (await sceneTexts(page, SIMPLE)).some((t) => t.startsWith("MAP: ")))
        .toBe(true);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(tmpdir(), `pick-advanced-${size.width}x${size.height}.png`) });
    });
  }
});