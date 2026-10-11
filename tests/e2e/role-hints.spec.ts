/**
 * role-hints.spec.ts — P2-1 role / synergy hints are on screen:
 *  - ship picker: the pilot ability and each upgrade show their role, and
 *    hovering a quick-build toggle shows the build's role tooltip;
 *  - Dogfight setup: the quick-build chooser shows the build's role line;
 *  - encyclopedia: the detail panel shows the signature build's hint;
 *  - campaign armory: hovering a mod shows its role tooltip.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";
import { openCampaignHub } from "./helpers/campaignEntry";

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

/** Screen position of the object with this text (or its parent). */
async function pointAt(
  page: Page,
  key: string,
  text: string,
  parent = false,
): Promise<{ x: number; y: number } | null> {
  const centre = await page.evaluate(
    ({ k, t, p }) => {
      const scene = (window as any).game.scene.getScene(k);
      const find = (list: any[], owner: any): any =>
        list.reduce<any>(
          (hit, obj) =>
            hit ??
            (obj.text === t ? (p ? owner : obj) : find(obj.list ?? [], obj)),
          null,
        );
      const obj = find(scene.children.list, null);
      if (!obj) return null;
      const b = obj.getBounds();
      return { x: b.centerX, y: b.centerY };
    },
    { k: key, t: text, p: parent },
  );
  if (!centre) return null;
  const box = (await page.locator("canvas").boundingBox())!;
  const size = await page.evaluate(() => {
    const g = (window as any).game;
    return { w: g.scale.gameSize.width, h: g.scale.gameSize.height };
  });
  return {
    x: box.x + centre.x * (box.width / size.w),
    y: box.y + centre.y * (box.height / size.h),
  };
}

/** Moves the real mouse onto the object with this text (or its parent). */
async function hoverText(
  page: Page,
  key: string,
  text: string,
  parent = false,
): Promise<void> {
  const at = await pointAt(page, key, text, parent);
  expect(at).not.toBeNull();
  await page.mouse.move(at!.x, at!.y);
}

async function tooltip(page: Page, key: string): Promise<string> {
  return page.evaluate(
    (k) =>
      (window as any).game.scene.getScene(k).data.get("hintTooltip")
        ?.shownText ?? "",
    key,
  );
}

test.describe("Role / synergy hints", () => {
  test("ship picker: ability + upgrade roles, build tooltip on hover", async ({
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
        factionId: "void_corsairs",
        selectedShips: [],
        pointLimit: 200,
      });
    });
    await waitForScene(page, "ShipPickerScene");
    const gotIt = await pointAt(page, "ShipPickerScene", "GOT IT");
    if (gotIt) await page.mouse.click(gotIt.x, gotIt.y);
    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("ShipPickerScene");
      scene.catalogPanel.staging.selectShip("corsair_fang");
      scene.catalogPanel.staging.selectLoadout?.("fang_raider");
      scene.catalogPanel.render();
    });
    const label = await page.evaluate(async () => {
      const { getLoadoutById } = await import("/src/data/ShipLoadouts.ts");
      return getLoadoutById("fang_raider")!.name.toUpperCase();
    });
    const texts = await sceneTexts(page, "ShipPickerScene");
    expect(texts).toContain("Flanker — strikes from behind");
    expect(texts.some((t) => t.startsWith("Best with "))).toBe(true);

    await hoverText(page, "ShipPickerScene", label, true);
    await expect.poll(() => tooltip(page, "ShipPickerScene")).toContain(" — ");
  });

  test("Dogfight setup chooser shows the build's role line", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await clickMenuItem(page, "DOGFIGHT");
    await waitForScene(page, "DogfightScene");
    await expect
      .poll(async () =>
        (await sceneTexts(page, "DogfightScene")).some((t) =>
          t.startsWith("Best with "),
        ),
      )
      .toBe(true);
  });

  test("encyclopedia detail shows the signature build hint", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await page.goto("/");
    await waitForMenuReady(page);
    await clickMenuItem(page, "ENCYCLOPEDIA");
    await waitForScene(page, "EncyclopediaScene");
    const hint = await page.evaluate(
      () =>
        (window as any).game.scene.getScene("EncyclopediaScene").detailPanel
          .hintText.text as string,
    );
    expect(hint).toContain(" — ");
    expect(hint).toContain("Best with ");
  });

  test("campaign armory: hovering a mod's centre shows its role", async ({
    page,
  }) => {
    await openCampaignHub(page, "free_confederation", { credits: 500 });
    await page.evaluate(() =>
      (window as any).game.scene
        .getScene("CampaignScene")
        .selectHubTab("armory"),
    );
    await page.waitForTimeout(200);
    // The card's centre (and lower-right) must react, not just its top-left.
    await hoverText(page, "CampaignScene", "Reinforced Bulkheads", true);
    await expect
      .poll(() => tooltip(page, "CampaignScene"))
      .toContain("Tank — soaks fire and outlasts");
  });
});
