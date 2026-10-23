/**
 * battle-holo-ui.spec.ts — Boss Raid and Continuous Tactical on the
 * holographic UI and the X-Wing round tempo: the boss spawns in real-time
 * hit points, the holo pause menu's RESUME button hit-tests and resumes, and
 * a tactical match restarted after its end screen runs again (Phaser reuses
 * the scene instance, so stale pause/ship state used to freeze it).
 */

import { test, expect, type Page } from "@playwright/test";
import {
  BOSS_RAID,
  CONTINUOUS,
  DOGFIGHT,
  SKIRMISH,
} from "./helpers/battleEntry";

/** RESUME is the first button of the centred pause panel (BattlePauseMenu layout). */
const RESUME_BUTTON_Y_FROM_CENTER = -116;

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
    const def =
      BOSS_DEFINITIONS[
        scene.selectedBossFaction as keyof typeof BOSS_DEFINITIONS
      ];
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

test("Boss Raid: leaving the page pauses the raid and coming back does not resume it", async ({
  page,
}) => {
  await BOSS_RAID.enter(page, { peaceful: true });
  await page.evaluate(() => (window as any).game.events.emit("hidden"));
  await page.waitForFunction(
    () => (window as any).game.scene.getScene("EpicBattleScene").isPaused,
  );
  await page.evaluate(() => (window as any).game.events.emit("visible"));
  expect(
    await page.evaluate(
      () => (window as any).game.scene.getScene("EpicBattleScene").isPaused,
    ),
  ).toBe(true);
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

/** Pins the player ship's stress each frame and reads the HUD stress row. */
async function pinStress(
  page: Page,
  sceneKey: string,
  stress: { level: number; isStressed: boolean } | null,
): Promise<void> {
  await page.evaluate(
    ({ key, value }) => {
      const w = window as any;
      const scene = w.game.scene.getScene(key);
      const ship = () => scene.ships.get(scene.secondaryWeapons.playerShipId());
      w.__stressPin = value;
      if (w.__stressPinInstalled === key) return;
      w.__stressPinInstalled = key;
      scene.events.on("preupdate", () => {
        const s = ship();
        if (!s || !w.__stressPin) return;
        if (s.flight) s.flight = { ...s.flight, stress: w.__stressPin };
        else s.stress = w.__stressPin;
      });
    },
    { key: sceneKey, value: stress },
  );
}

/** Sets the player ship's stress once (the engine then keeps updating it). */
async function setStressOnce(
  page: Page,
  sceneKey: string,
  stress: { level: number; isStressed: boolean },
): Promise<void> {
  await page.evaluate(
    ({ key, value }) => {
      const scene = (window as any).game.scene.getScene(key);
      const ship = scene.ships.get(scene.secondaryWeapons.playerShipId());
      if (ship.flight) ship.flight = { ...ship.flight, stress: value };
      else ship.stress = value;
    },
    { key: sceneKey, value: stress },
  );
}

async function stressRow(
  page: Page,
  sceneKey: string,
): Promise<{ counter: string; label: string } | null> {
  return page.evaluate((key) => {
    const texts: string[] = [];
    const walk = (list: any[]): void =>
      list.forEach((o) => {
        if (typeof o.text === "string") texts.push(o.text);
        if (Array.isArray(o.list)) walk(o.list);
      });
    walk((window as any).game.scene.getScene(key).children.list);
    const counter = texts.find((t) => /^STRESS \d+%$/.test(t));
    const label = texts.find((t) =>
      /^(CALM|NORMAL|RECOVERING|STRESSED)( !)?$/.test(t),
    );
    return counter && label ? { counter, label } : null;
  }, sceneKey);
}

for (const entry of [DOGFIGHT, SKIRMISH, BOSS_RAID]) {
  test(`${entry.sceneKey}: the HUD shows a stress counter and CALM / NORMAL / STRESSED / RECOVERING`, async ({
    page,
  }) => {
    await entry.enter(page, { peaceful: true });
    const readRow = () => stressRow(page, entry.sceneKey);
    await expect.poll(readRow).toEqual({ counter: "STRESS 0%", label: "CALM" });

    await pinStress(page, entry.sceneKey, { level: 0.42, isStressed: false });
    await expect
      .poll(readRow)
      .toEqual({ counter: "STRESS 42%", label: "NORMAL" });

    await pinStress(page, entry.sceneKey, { level: 0.95, isStressed: true });
    await expect
      .poll(readRow)
      .toEqual({ counter: "STRESS 95%", label: "STRESSED" });

    // Stop pinning and start from a latched bar: the pilot clears by itself
    // (passive drain), so the level falls while the red moves stay refused.
    await pinStress(page, entry.sceneKey, null);
    await setStressOnce(page, entry.sceneKey, {
      level: 0.95,
      isStressed: true,
    });
    await expect
      .poll(async () => (await readRow())?.label)
      .toMatch(/^RECOVERING( !)?$/);

    await pinStress(page, entry.sceneKey, { level: 0, isStressed: false });
    await expect.poll(readRow).toEqual({ counter: "STRESS 0%", label: "CALM" });
  });
}
