/**
 * scene-lifecycle.spec.ts — restarting a battle scene must release what the
 * previous run subscribed to (input handlers, pilot listeners). Otherwise
 * every rematch stacks another PAUSE handler and pause stops toggling.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  waitForScene,
  waitForMenuReady,
  clickMenuItem,
  suppressWebGLNoise,
} from "./helpers/game";
import { ACE_DUEL, ALL_BATTLES, DOGFIGHT } from "./helpers/battleEntry";

/** Live InputManager subscription count, read through the Dogfight pilot. */
async function subscriptionCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { game: any }).game.scene.getScene("DogfightScene")
        .pilot.source.subscriptions.length,
  );
}

async function startDogfightMatch(page: Page): Promise<void> {
  await waitForScene(page, "DogfightScene", 30_000);
  await page.evaluate(() =>
    (window as unknown as { game: any }).game.scene
      .getScene("DogfightScene")
      .startMatch(),
  );
  await page.waitForFunction(
    () =>
      ((window as unknown as { game: any }).game.scene.getScene("DogfightScene")
        ?.ships?.size ?? 0) >= 2,
  );
}

test("restarting Dogfight does not stack input subscriptions", async ({
  page,
}) => {
  await page.goto("/");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await clickMenuItem(page, "DOGFIGHT");
  await startDogfightMatch(page);
  const firstRun = await subscriptionCount(page);

  for (let restart = 0; restart < 2; restart++) {
    await page.evaluate(() =>
      (window as unknown as { game: any }).game.scene
        .getScene("DogfightScene")
        .scene.restart(),
    );
    await page.waitForTimeout(300);
    await startDogfightMatch(page);
  }

  expect(await subscriptionCount(page)).toBe(firstRun);
});

test("restarting Dogfight mid-round starts clean, with no errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await clickMenuItem(page, "DOGFIGHT");
  await startDogfightMatch(page);
  await page.waitForTimeout(500);

  await page.evaluate(() =>
    (window as unknown as { game: any }).game.scene
      .getScene("DogfightScene")
      .scene.restart(),
  );
  await page.waitForTimeout(1_000);

  const state = await page.evaluate(() => {
    const scene = (window as unknown as { game: any }).game.scene.getScene(
      "DogfightScene",
    );
    return { setup: scene.isSetupPhase, ships: scene.ships.size };
  });
  expect(state).toEqual({ setup: true, ships: 0 });
  expect(errors).toEqual([]);
});

for (const battle of ALL_BATTLES) {
  test(`${battle.sceneKey}: restarting mid-battle raises no errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await battle.enter(page);
    await page.waitForTimeout(800);
    await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).scene.restart(),
      battle.sceneKey,
    );
    await page.waitForTimeout(1_500);
    expect(errors).toEqual([]);
  });
}

for (const battle of [DOGFIGHT, ACE_DUEL]) {
  test(`${battle.sceneKey}: nobody fires during the ROUND banner`, async ({
    page,
  }) => {
    await battle.enter(page);
    const durability = () =>
      page.evaluate(
        (key) =>
          [...(window as any).game.scene.getScene(key).ships.values()].map(
            (ship: any) => [ship.hull, Math.floor(ship.shields)],
          ),
        battle.sceneKey,
      );
    const atSpawn = await durability();
    await page
      .waitForFunction(
        (key) =>
          (window as any).game.scene.getScene(key).isRoundActive === true,
        battle.sceneKey,
        { polling: 16, timeout: 5_000 },
      )
      .catch(() => undefined);
    const beforeFight = await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      return { active: scene.isRoundActive, round: scene.currentRound };
    }, battle.sceneKey);
    expect(beforeFight.round).toBe(1);
    expect(await durability()).toEqual(atSpawn);
  });
}
