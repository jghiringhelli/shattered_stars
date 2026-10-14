/**
 * pick-screens-survival-campaign.spec.ts — the Survival pick screens: the
 * starter screen (faction, ship cards, OVERVIEW / LOADOUT / BUILDS tabs) and
 * the choice overlays (power draft, relic offer, shop). One tab at a time,
 * tabs switch with the mouse and Q / E (not while typing the seed), every
 * tag / price / note explains itself on hover (short, then full), text
 * density and minimum font size, and screenshots of every screen and tab at
 * 1280x720 and 1920x1080 (to $TEMP, pick-survival-*.png).
 *
 * The Campaign panels live in pick-screens-campaign.spec.ts.
 */

import { join } from "node:path";
import { tmpdir } from "node:os";
import { test, expect, type Page } from "@playwright/test";
import {
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";
import {
  clickText,
  hoverText,
  tooltip,
  tooltipExpanded,
  visibleTexts,
} from "./helpers/pickScreens";

const SETUP = "SurvivalSetupScene";
const MAP = "SurvivalMapScene";
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;
/**
 * Text elements of one whole starter screen at most, per tab: 17 belong to
 * the screen itself, the rest to the shared ship detail panel (header, badge,
 * tabs, tab body) — BUILDS is its densest tab (the build guide).
 */
const MAX_STARTER_TEXTS = { overview: 42, loadout: 42, builds: 50 } as const;
/** Text elements of one choice overlay at most. */
const MAX_OVERLAY_TEXTS = 35;
/** Smallest readable font at 1280x720 (px). */
const MIN_FONT = 12;
/** Longer than the tooltip's hold time, so the full explanation shows (ms). */
const HOLD_MS = 1000;
const TABS = ["overview", "loadout", "builds"] as const;
const OVERLAYS = ["powers", "relics", "shop"] as const;

type Overlay = (typeof OVERLAYS)[number];

const shot = (name: string, size: { width: number; height: number }): string =>
  join(tmpdir(), `pick-survival-${name}-${size.width}x${size.height}.png`);

async function openSetup(page: Page): Promise<void> {
  suppressWebGLNoise(page);
  await page.goto("/");
  await waitForMenuReady(page);
  await page.evaluate(() => {
    const game = (window as any).game;
    game.scene.stop("MainMenuScene");
    game.scene.start("SurvivalSetupScene");
  });
  await waitForScene(page, SETUP);
  await page.waitForTimeout(200);
}

async function setupTab(page: Page): Promise<string> {
  return page.evaluate(
    (k) => (window as any).game.scene.getScene(k).detailPanel.openTab,
    SETUP,
  );
}

async function openSetupTab(page: Page, tab: string): Promise<void> {
  await page.evaluate(
    ({ k, t }) => (window as any).game.scene.getScene(k).detailPanel.open(t),
    { k: SETUP, t: tab },
  );
  await page.mouse.move(2, 2);
  await page.waitForTimeout(150);
}

/** Launches a seeded run and opens the map scene. */
async function openMap(page: Page): Promise<void> {
  await openSetup(page);
  await page.evaluate((k) => {
    const setup = (window as any).game.scene.getScene(k);
    setup.controls.setSeedCode("PICK01");
    setup.launchRun();
  }, SETUP);
  await waitForScene(page, MAP);
  await page.waitForTimeout(200);
}

/** Shows a choice overlay on the map scene, built from the real view models. */
async function showOverlay(page: Page, overlay: Overlay): Promise<void> {
  await page.evaluate(
    async ({ k, kind }) => {
      const vm = await import("/src/ui/survival/choiceViewModels.ts");
      const map = (window as any).game.scene.getScene(k);
      const run = map.service.run;
      if (kind === "powers") {
        const { ATOMS } = await import("/src/data/survival/powers.ts");
        map.choicePanel.show(
          "Choose a power",
          vm.powerCards(ATOMS.slice(0, 3), 1),
          () => {},
        );
      } else if (kind === "relics") {
        const { getRelic } = await import("/src/data/survival/relicCatalog.ts");
        const relics = ["predator_optics", "wing_link", "black_market_codes"].map(
          (id) => getRelic(id)!,
        );
        map.choicePanel.show("Choose a relic", vm.relicCards(relics, run), () => {});
      } else {
        const { shopStock } = await import("/src/systems/survival/ShopService.ts");
        map.choicePanel.show(
          "Shop",
          vm.shopCards(shopStock(run, "s1-r2-c0")),
          () => {},
        );
      }
    },
    { k: MAP, kind: overlay },
  );
  await page.mouse.move(2, 2);
  await page.waitForTimeout(200);
}

/** The texts of the open choice overlay (the map behind it is covered). */
async function overlayTexts(
  page: Page,
): Promise<Array<{ text: string; size: number }>> {
  return page.evaluate((k) => {
    const panel = (window as any).game.scene.getScene(k).choicePanel;
    const out: Array<{ text: string; size: number }> = [];
    const walk = (obj: any): void => {
      if (typeof obj.text === "string" && obj.text.trim())
        out.push({ text: obj.text, size: parseFloat(String(obj.style.fontSize)) });
      for (const child of obj.list ?? []) walk(child);
    };
    walk(panel.container);
    return out;
  }, MAP);
}

test.describe("Survival starter screen — tabs", () => {
  for (const size of SIZES) {
    test(`screenshots of every tab at ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await openSetup(page);
      for (const tab of TABS) {
        await openSetupTab(page, tab);
        expect(await setupTab(page)).toBe(tab);
        await page.screenshot({ path: shot(`starter-${tab}`, size) });
      }
    });
  }

  test("every tab keeps the screen light and readable at 1280x720", async ({
    page,
  }) => {
    await page.setViewportSize(SIZES[0]);
    await openSetup(page);
    const counts: string[] = [];
    for (const tab of TABS) {
      await openSetupTab(page, tab);
      const texts = await visibleTexts(page, SETUP);
      counts.push(`${tab}: ${texts.length}`);
      expect(
        texts.length,
        `${tab}: ${texts.map((t) => t.text.replace(/\n/g, "/")).join(" | ")}`,
      ).toBeLessThanOrEqual(MAX_STARTER_TEXTS[tab]);
      expect(
        texts.filter((t) => t.size < MIN_FONT),
        `${tab} small texts`,
      ).toEqual([]);
    }
    console.log(`TEXT COUNTS starter ${counts.join(" | ")}`);
  });

  test("tabs switch with the mouse and with Q / E, but not while typing the seed", async ({
    page,
  }) => {
    await openSetup(page);
    await openSetupTab(page, "overview");
    await clickText(page, SETUP, "LOADOUT");
    await expect.poll(() => setupTab(page)).toBe("loadout");
    await page.mouse.move(2, 2);
    await page.keyboard.press("e");
    await expect.poll(() => setupTab(page)).toBe("builds");
    await page.keyboard.press("q");
    await expect.poll(() => setupTab(page)).toBe("loadout");
    await clickText(page, SETUP, "SEED: RANDOM");
    await page.keyboard.press("e");
    await page.waitForTimeout(100);
    expect(await setupTab(page)).toBe("loadout");
  });

  test("a ship card, the ascension readout and LAUNCH explain themselves", async ({
    page,
  }) => {
    await openSetup(page);
    await hoverText(page, SETUP, "Raptor Strike Fighter");
    await expect.poll(() => tooltip(page, SETUP)).not.toBe("");
    expect(await tooltipExpanded(page, SETUP)).toBe(false);
    const short = await tooltip(page, SETUP);
    await page.waitForTimeout(HOLD_MS);
    expect((await tooltip(page, SETUP)).length).toBeGreaterThan(short.length);
    await page.mouse.move(2, 2);

    await hoverText(page, SETUP, "ASCENSION 0/0");
    await expect.poll(() => tooltip(page, SETUP)).toContain("Ascension 0");
    await page.mouse.move(2, 2);

    await hoverText(page, SETUP, "LAUNCH");
    await expect.poll(() => tooltip(page, SETUP)).toContain("Launch run");
    await page.keyboard.down("Shift");
    await expect.poll(() => tooltipExpanded(page, SETUP)).toBe(true);
    expect(await tooltip(page, SETUP)).toContain("40 salvage");
    await page.keyboard.up("Shift");
  });
});

test.describe("Survival choice overlays", () => {
  for (const size of SIZES) {
    test(`screenshots of every overlay at ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await openMap(page);
      for (const overlay of OVERLAYS) {
        await showOverlay(page, overlay);
        await page.screenshot({ path: shot(overlay, size) });
      }
    });
  }

  test("each overlay keeps the screen light and readable at 1280x720", async ({
    page,
  }) => {
    await page.setViewportSize(SIZES[0]);
    await openMap(page);
    const counts: string[] = [];
    for (const overlay of OVERLAYS) {
      await showOverlay(page, overlay);
      const texts = await overlayTexts(page);
      counts.push(`${overlay}: ${texts.length}`);
      expect(
        texts.length,
        `${overlay}: ${texts.map((t) => t.text.replace(/\n/g, "/")).join(" | ")}`,
      ).toBeLessThanOrEqual(MAX_OVERLAY_TEXTS);
      expect(
        texts.filter((t) => t.size < MIN_FONT),
        `${overlay} small texts: ${texts.map((t) => t.text).join(" | ")}`,
      ).toEqual([]);
    }
    console.log(`TEXT COUNTS overlays ${counts.join(" | ")}`);
  });

  test("a relic tag and the set note explain themselves, short then full", async ({
    page,
  }) => {
    await openMap(page);
    await showOverlay(page, "relics");
    await hoverText(page, MAP, "MARK");
    await expect.poll(() => tooltip(page, MAP)).toContain("Tag: mark");
    expect(await tooltipExpanded(page, MAP)).toBe(false);
    await page.waitForTimeout(HOLD_MS);
    expect(await tooltip(page, MAP)).toContain("Target Painter");
    await page.mouse.move(2, 2);

    await hoverText(page, MAP, "Hunter 1/3");
    await expect.poll(() => tooltip(page, MAP)).toContain("Hunter");
  });

  test("a shop price explains salvage with real prices", async ({ page }) => {
    await openMap(page);
    await showOverlay(page, "shop");
    const price = (await visibleTexts(page, MAP)).find((t) =>
      /^\d+ \u2699$/.test(t.text),
    )?.text;
    expect(price, "a priced shop item").toBeTruthy();
    await hoverText(page, MAP, price!);
    await expect.poll(() => tooltip(page, MAP)).toContain("Price");
    await page.waitForTimeout(HOLD_MS);
    expect(await tooltip(page, MAP)).toContain("relic 60 / 90 / 130");
  });

  test("clicking a tag still picks the card", async ({ page }) => {
    await openMap(page);
    await page.evaluate(async (k) => {
      const vm = await import("/src/ui/survival/choiceViewModels.ts");
      const { getRelic } = await import("/src/data/survival/relicCatalog.ts");
      const map = (window as any).game.scene.getScene(k);
      (window as any).__picked = -1;
      map.choicePanel.show(
        "Choose a relic",
        vm.relicCards([getRelic("predator_optics")!], map.service.run),
        (i: number) => ((window as any).__picked = i),
      );
    }, MAP);
    await clickText(page, MAP, "MARK");
    await expect
      .poll(() => page.evaluate(() => (window as any).__picked))
      .toBe(0);
  });
});
