/**
 * skirmish-picker-ux.spec.ts — the Skirmish pick flow groups ships into role
 * sections with filter chips, explains every tag / stat / build on hover and
 * guides the selected quick build (how to fly, pros & cons, cost).
 * Screenshots of each layout go to $TEMP (1280x720 and 1920x1080).
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

const SIMPLE = "SquadBuilderScene";
const PICKER = "ShipPickerScene";
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;

/** Every Text string in a scene, containers included. */
async function sceneTexts(page: Page, key: string): Promise<string[]> {
  return page.evaluate((k) => {
    const scene = (window as any).game.scene.getScene(k);
    const collect = (obj: any): string[] => [
      ...(typeof obj.text === "string" ? [obj.text] : []),
      ...((obj.list as any[] | undefined) ?? []).flatMap(collect),
    ];
    return (scene.children.list as any[]).flatMap(collect);
  }, key);
}

/** Moves the real mouse onto the first object with this text. */
async function hoverText(page: Page, key: string, text: string): Promise<void> {
  const centre = await page.evaluate(
    ({ k, t }) => {
      const scene = (window as any).game.scene.getScene(k);
      const find = (list: any[]): any =>
        list.reduce<any>(
          (hit, obj) => hit ?? (obj.text === t ? obj : find(obj.list ?? [])),
          null,
        );
      const obj = find(scene.children.list);
      if (!obj) return null;
      const b = obj.getBounds();
      return { x: b.centerX, y: b.centerY };
    },
    { k: key, t: text },
  );
  expect(centre, `text "${text}" on screen`).not.toBeNull();
  const box = (await page.locator("canvas").boundingBox())!;
  const size = await page.evaluate(() => {
    const g = (window as any).game;
    return { w: g.scale.gameSize.width, h: g.scale.gameSize.height };
  });
  await page.mouse.move(
    box.x + centre!.x * (box.width / size.w),
    box.y + centre!.y * (box.height / size.h),
  );
}

async function tooltip(page: Page, key: string): Promise<string> {
  return page.evaluate(
    (k) =>
      (window as any).game.scene.getScene(k).data.get("hintTooltip")
        ?.shownText ?? "",
    key,
  );
}

/** Clicks the object with this text (real mouse). */
async function clickText(page: Page, key: string, text: string): Promise<void> {
  await hoverText(page, key, text);
  await page.mouse.down();
  await page.mouse.up();
}

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

async function shot(page: Page, name: string): Promise<void> {
  const size = page.viewportSize()!;
  await page.screenshot({
    path: join(tmpdir(), `skirmish-ux-${name}-${size.width}x${size.height}.png`),
  });
}

test.describe("Skirmish pick flow — role sections and explanations", () => {
  test("ships are grouped into role sections with headers and counts", async ({
    page,
  }) => {
    await openSkirmish(page);
    const texts = await sceneTexts(page, SIMPLE);
    for (const title of ["LIGHT FIGHTERS", "HEAVY FIGHTERS", "INTERCEPTORS"]) {
      expect(texts, title).toContain(title);
    }
    expect(texts.some((t) => /^\d+ SHIPS? · \d+ BUILDS?$/.test(t))).toBe(true);
    // Capitals are not flyable in Skirmish: a notice says so.
    expect(texts.some((t) => t.startsWith("EPIC FORMAT ONLY"))).toBe(true);
  });

  test("role chips filter the sections and sort chips cycle", async ({
    page,
  }) => {
    await openSkirmish(page);
    await clickText(page, SIMPLE, "BMB");
    await expect
      .poll(async () => (await sceneTexts(page, SIMPLE)).includes("BOMBERS"))
      .toBe(true);
    const texts = await sceneTexts(page, SIMPLE);
    expect(texts).not.toContain("INTERCEPTORS");
    await clickText(page, SIMPLE, "ALL");
    await expect
      .poll(async () => (await sceneTexts(page, SIMPLE)).includes("INTERCEPTORS"))
      .toBe(true);
    await clickText(page, SIMPLE, "PTS");
    await expect
      .poll(async () => (await sceneTexts(page, SIMPLE)).includes("PTS ↑"))
      .toBe(true);
  });

  test("hovering a role chip, a stat and the points explains them", async ({
    page,
  }) => {
    await openSkirmish(page);
    await hoverText(page, SIMPLE, "INT");
    await expect
      .poll(() => tooltip(page, SIMPLE))
      .toContain("Very agile hunters");
    expect(await tooltip(page, SIMPLE)).toContain("EXAMPLE");
    await hoverText(page, SIMPLE, "PTS");
    await expect.poll(() => tooltip(page, SIMPLE)).toContain("Sort by points");
  });

  test("selecting a ship and a build shows stats, tabs and guide text", async ({
    page,
  }) => {
    await openSkirmish(page);
    await page.evaluate(async () => {
      const { getEquippableLoadouts } =
        await import("/src/data/ShipLoadouts.ts");
      const catalog = (window as any).game.scene.getScene("SquadBuilderScene")
        .simpleFlow.catalog;
      const ship = catalog.ships.find((s: any) => s.role === "interceptor");
      catalog.staging.selectShip(ship.id);
      catalog.staging.selectLoadout(getEquippableLoadouts(ship.id)[0]!.id);
      catalog.render();
    });
    await hoverText(page, SIMPLE, "ATTACK");
    await expect.poll(() => tooltip(page, SIMPLE)).toContain("attack dice");
    await hoverText(page, SIMPLE, "BUILD");
    await expect
      .poll(() => tooltip(page, SIMPLE))
      .toContain("pilot, ability, slots");
    await clickText(page, SIMPLE, "HOW TO FLY");
    await expect
      .poll(async () => (await sceneTexts(page, SIMPLE)).includes("WHEN TO PICK IT"))
      .toBe(true);
    await clickText(page, SIMPLE, "COST");
    await expect
      .poll(async () => (await sceneTexts(page, SIMPLE)).includes("COST BREAKDOWN"))
      .toBe(true);
    await clickText(page, SIMPLE, "PROS & CONS");
    await expect
      .poll(async () => (await sceneTexts(page, SIMPLE)).includes("STRENGTHS"))
      .toBe(true);
  });

  for (const size of SIZES) {
    test(`screenshots of the picker at ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await openSkirmish(page);
      await page.evaluate(async () => {
        const { getEquippableLoadouts } =
          await import("/src/data/ShipLoadouts.ts");
        const catalog = (window as any).game.scene.getScene("SquadBuilderScene")
          .simpleFlow.catalog;
        const ship = catalog.ships.find((s: any) => s.role === "heavy_fighter");
        catalog.staging.selectShip(ship.id);
        catalog.staging.selectLoadout(getEquippableLoadouts(ship.id)[0]!.id);
        catalog.render();
      });
      await page.mouse.move(5, 5);
      await page.waitForTimeout(300);
      await shot(page, "sections");
      await hoverText(page, SIMPLE, "HOW TO FLY");
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(300);
      await shot(page, "guide");
      await hoverText(page, SIMPLE, "INT");
      await page.waitForTimeout(500);
      await shot(page, "tooltip");
      expect(await tooltip(page, SIMPLE)).not.toBe("");
    });
  }

  test("the picker overlay lists capital ships as epic-format only", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await page.evaluate(() => {
      const game = (window as any).game;
      game.scene.stop("MainMenuScene");
      game.scene.start("ShipPickerScene", {
        slotIndex: 0,
        factionId: "terran_hegemony",
        selectedShips: [],
        pointLimit: 200,
      });
    });
    await waitForScene(page, PICKER);
    await expect
      .poll(async () =>
        (await sceneTexts(page, PICKER)).some((t) =>
          t.startsWith("EPIC FORMAT ONLY"),
        ),
      )
      .toBe(true);
  });
});
