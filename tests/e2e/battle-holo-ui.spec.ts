/**
 * battle-holo-ui.spec.ts — Boss Raid and Continuous Tactical on the
 * holographic UI and the X-Wing round tempo: the boss spawns in real-time
 * hit points, the holo pause menu's RESUME button hit-tests and resumes, and
 * a tactical match restarted after its end screen runs again (Phaser reuses
 * the scene instance, so stale pause/ship state used to freeze it).
 */

import { test, expect, type Page } from "@playwright/test";
import { BOSS_RAID, CONTINUOUS } from "./helpers/battleEntry";

/** RESUME is the first button of the centred pause panel (HoloPauseOverlay layout). */
const RESUME_BUTTON_Y_FROM_CENTER = -100;

async function clickGamePoint(page: Page, x: number, y: number): Promise<void> {
  const box = (await page.locator("canvas").boundingBox())!;
  const { gw, gh } = await page.evaluate(() => {
    const g = (window as any).game;
    return { gw: g.scale.gameSize.width, gh: g.scale.gameSize.height };
  });
  await page.mouse.click(
    box.x + x * (box.width / gw),
    box.y + y * (box.height / gh),
  );
}

test("Boss Raid: the boss spawns at BOSS_HP_SCALE real-time hit points", async ({
  page,
}) => {
  await BOSS_RAID.enter(page, { peaceful: true });
  const boss = await page.evaluate(async () => {
    const { BOSS_DEFINITIONS } =
      await import("/src/scenes/epicRaid/bossDefinitions.ts");
    const { BOSS_HP_SCALE } =
      await import("/src/arcade/systems/EpicRaidCombat.ts");
    const scene = (window as any).game.scene.getScene("EpicBattleScene");
    const def = BOSS_DEFINITIONS[scene.selectedBossFaction];
    return {
      hull: scene.boss.maxTotalHull,
      expectedHull: def.totalHull * BOSS_HP_SCALE,
      shields: scene.boss.maxShields,
      expectedShields: def.shields * BOSS_HP_SCALE,
      hasHud: scene.raidHud !== null,
    };
  });
  expect(boss.hull).toBe(boss.expectedHull);
  expect(boss.shields).toBe(boss.expectedShields);
  expect(boss.hasHud).toBe(true);
});

test("Boss Raid: ESC opens the holo pause menu and RESUME resumes the raid", async ({
  page,
}) => {
  await BOSS_RAID.enter(page, { peaceful: true });
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => (window as any).game.scene.getScene("EpicBattleScene").isPaused,
  );
  const { width, height } = await page.evaluate(() => {
    const g = (window as any).game;
    return { width: g.scale.gameSize.width, height: g.scale.gameSize.height };
  });
  await clickGamePoint(
    page,
    width / 2,
    height / 2 + RESUME_BUTTON_Y_FROM_CENTER,
  );
  await page.waitForFunction(
    () => !(window as any).game.scene.getScene("EpicBattleScene").isPaused,
    undefined,
    { timeout: 3_000 },
  );
});

test("Continuous Tactical: a match restarted after its end screen runs again", async ({
  page,
}) => {
  await CONTINUOUS.enter(page);
  await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene(
      "ContinuousTacticalScene",
    );
    const attacker = scene.ships.get(scene.playerShipIds[0]);
    for (const id of [...scene.enemyShipIds]) {
      scene.applyDamage(attacker, scene.ships.get(id), 9_999);
    }
  });
  await page.waitForFunction(
    () =>
      (window as any).game.scene.getScene("ContinuousTacticalScene").isPaused,
  );
  await page.evaluate(() =>
    (window as any).game.scene
      .getScene("ContinuousTacticalScene")
      .scene.restart(),
  );
  await page.waitForFunction(
    () =>
      ((window as any).game.scene.getScene("ContinuousTacticalScene").ships
        ?.size ?? 0) > 0,
  );
  const state = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene(
      "ContinuousTacticalScene",
    );
    const ids = [...scene.playerShipIds, ...scene.enemyShipIds];
    return {
      paused: scene.isPaused,
      listedShipsExist: ids.every(
        (id: string) => scene.ships.get(id)?.hull > 0,
      ),
      listedCount: ids.length,
      shipCount: scene.ships.size,
    };
  });
  expect(state.paused).toBe(false);
  expect(state.listedShipsExist).toBe(true);
  expect(state.listedCount).toBe(state.shipCount);
});
