/**
 * asset-loading.spec.ts — boot loads only the main menu's art; ship sprites,
 * portraits and encyclopedia art arrive per scene (preload gate) or on
 * demand, so the first menu needs a few MB instead of ~110 MB.
 */

import { test, expect, type Page } from "@playwright/test";
import { DOGFIGHT } from "./helpers/battleEntry";
import {
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

/** Loaded texture keys matching a prefix (ignores the generated placeholders). */
async function loadedKeys(page: Page, prefix: string): Promise<string[]> {
  return page.evaluate(
    (p) =>
      (window as any).game.textures
        .getTextureKeys()
        .filter((key: string) => key.startsWith(p)),
    prefix,
  );
}

test("the main menu loads no ship sprites, portraits or encyclopedia art", async ({
  page,
}) => {
  await page.goto("/");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  const placeholders = await page.evaluate(async () => {
    const { FACTION_COLORS, SHIP_SIZES } = await import("/src/config.ts");
    return Object.keys(FACTION_COLORS).flatMap((f) =>
      Object.keys(SHIP_SIZES).map((s) => `ship_${f}_${s}`),
    );
  });
  const ships = (await loadedKeys(page, "ship_")).filter(
    (key) => !placeholders.includes(key),
  );
  expect(ships).toEqual([]);
  expect(await loadedKeys(page, "portrait_")).toEqual([]);
});

test("a battle shows every ship's own art, not the placeholder", async ({
  page,
}) => {
  await DOGFIGHT.enter(page, { peaceful: true });
  await page.waitForFunction(
    () => {
      const scene = (window as any).game.scene.getScene("DogfightScene");
      const ids = [...scene.ships.values()].map((s: any) => s.definitionId);
      return (
        ids.length >= 2 &&
        ids.every((id: string) => scene.textures.exists(`ship_${id}`))
      );
    },
    undefined,
    { timeout: 15_000 },
  );
});

test("the encyclopedia downloads a ship's art when it is shown", async ({
  page,
}) => {
  await page.goto("/");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await clickMenuItem(page, "ENCYCLOPEDIA");
  await waitForScene(page, "EncyclopediaScene");
  await expect
    .poll(async () => (await loadedKeys(page, "ship_art_")).length, {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
});
