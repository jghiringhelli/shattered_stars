/**
 * duel-hud.spec.ts — Dogfight and Ace Duel fly the holographic HUD:
 *
 *  - setup screens are holo panels/buttons at camera zoom 1 and FIGHT! /
 *    DUEL! start the battle with a real mouse click;
 *  - in battle one DuelHud shows round, score and clock, the player's ship
 *    has no floating health bar (the HUD ring carries it) while the others
 *    keep their slim bars;
 *  - the end screen's REMATCH works with a real click and restarts cleanly.
 *
 * Saves review screenshots to screenshots/review/hud2-<scene>-*.png.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickGameCoord,
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

const SHOT_DIR = "screenshots/review";
/** Let a freshly built screen render before a screenshot (ms). */
const SETTLE_MS = 400;
/** Fly a little after the banner so the HUD shows motion (ms). */
const BATTLE_SETTLE_MS = 1_200;

/** Real mouse click on the first object (through containers) with this exact text. */
async function clickText(
  page: Page,
  sceneKey: string,
  text: string,
): Promise<void> {
  const centre = await page.evaluate(
    ({ key, label }) => {
      const scene = (window as any).game.scene.getScene(key);
      const find = (list: any[]): any =>
        list.reduce<any>(
          (hit, obj) =>
            hit ?? (obj.text === label ? obj : find(obj.list ?? [])),
          null,
        );
      const obj = find(scene.children.list);
      if (!obj) return null;
      const bounds = obj.getBounds();
      return { x: bounds.centerX, y: bounds.centerY };
    },
    { key: sceneKey, label: text },
  );
  expect(centre, `"${text}" on ${sceneKey}`).not.toBeNull();
  await clickGameCoord(page, centre!.x, centre!.y);
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(SETTLE_MS);
  await page.locator("canvas").screenshot({ path: `${SHOT_DIR}/${name}` });
}

async function cameraZoom(page: Page, sceneKey: string): Promise<number> {
  return page.evaluate(
    (key) => (window as any).game.scene.getScene(key).cameras.main.zoom,
    sceneKey,
  );
}

async function waitForRound(page: Page, sceneKey: string): Promise<void> {
  await page.waitForFunction(
    (key) => (window as any).game.scene.getScene(key)?.isRoundActive === true,
    sceneKey,
    { timeout: 15_000 },
  );
}

interface HudState {
  round: string;
  score: string;
  clock: string;
  bars: string[];
  ships: string[];
}

async function hudState(page: Page, sceneKey: string): Promise<HudState> {
  return page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    return {
      round: scene.hud.roundLabel,
      score: scene.hud.scoreLabel,
      clock: scene.hud.clockLabel,
      bars: [...scene.healthBars.keys()],
      ships: [...scene.ships.keys()],
    };
  }, sceneKey);
}

async function openMode(
  page: Page,
  label: string,
  sceneKey: string,
): Promise<void> {
  suppressWebGLNoise(page);
  await page.goto("/?debug=1");
  await waitForMenuReady(page);
  await clickMenuItem(page, label);
  await waitForScene(page, sceneKey, 30_000);
  await page.waitForFunction(
    (key) => (window as any).game.scene.getScene(key)?.isSetupPhase === true,
    sceneKey,
  );
}

async function rematchRestartsSetup(
  page: Page,
  sceneKey: string,
): Promise<void> {
  expect(await cameraZoom(page, sceneKey)).toBe(1);
  await clickText(page, sceneKey, "REMATCH");
  await page.waitForFunction(
    (key) => {
      const scene = (window as any).game.scene.getScene(key);
      return scene?.isSetupPhase === true && scene.ships.size === 0;
    },
    sceneKey,
    { timeout: 10_000 },
  );
}

test.describe("Dogfight — holographic HUD", () => {
  test("setup, battle HUD and end screen", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openMode(page, "DOGFIGHT", "DogfightScene");
    expect(await cameraZoom(page, "DogfightScene")).toBe(1);
    await shoot(page, "hud2-dogfight-setup.png");

    await clickText(page, "DogfightScene", "FIGHT!");
    await page.waitForTimeout(250);
    await page
      .locator("canvas")
      .screenshot({ path: `${SHOT_DIR}/hud2-dogfight-banner.png` });
    await waitForRound(page, "DogfightScene");
    const hud = await hudState(page, "DogfightScene");
    expect(hud.round).toBe("ROUND 1");
    expect(hud.score).toBe("0  \u2013  0");
    expect(hud.clock).toMatch(/^(3:00|2:5\d)$/);
    expect(hud.ships.sort()).toEqual(["ai_0", "player_0"]);
    expect(hud.bars).toEqual(["ai_0"]);
    await page.waitForTimeout(BATTLE_SETTLE_MS);
    await shoot(page, "hud2-dogfight-battle.png");

    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("DogfightScene");
      scene.cameras.main.setZoom(1.6);
      scene.playerWins = 2;
      scene.enemyWins = 1;
      scene.endMatch();
    });
    await shoot(page, "hud2-dogfight-end.png");
    await rematchRestartsSetup(page, "DogfightScene");
    expect(errors).toEqual([]);
  });
});

test.describe("Ace Duel — holographic HUD", () => {
  test("setup, battle HUD and end screen", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openMode(page, "ACE DUEL", "AceDuelScene");
    expect(await cameraZoom(page, "AceDuelScene")).toBe(1);
    await shoot(page, "hud2-aceduel-setup.png");

    // A 2v2 matchup shows an ally contact as well as enemies.
    await page.evaluate(async () => {
      const { ACE_MATCHUPS } = await import("/src/data/AceMatchups.ts");
      const scene = (window as any).game.scene.getScene("AceDuelScene");
      scene.selectedMatchup = ACE_MATCHUPS.find(
        (m: any) => m.id === "bomber_squadron",
      );
      scene.showSetupScreen();
    });
    await clickText(page, "AceDuelScene", "DUEL!");
    await waitForRound(page, "AceDuelScene");
    const hud = await hudState(page, "AceDuelScene");
    expect(hud.round).toBe("ROUND 1  \u00b7  BOMBER SQUADRON");
    expect(hud.score).toBe("0  \u2013  0");
    expect(hud.clock).toMatch(/^(3:00|2:5\d)$/);
    expect(hud.ships.sort()).toEqual([
      "side1_0",
      "side1_1",
      "side2_0",
      "side2_1",
    ]);
    expect(hud.bars.sort()).toEqual(["side1_1", "side2_0", "side2_1"]);
    await page.waitForTimeout(BATTLE_SETTLE_MS);
    await shoot(page, "hud2-aceduel-battle.png");

    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("AceDuelScene");
      scene.side1Wins = 1;
      scene.side2Wins = 2;
      scene.endMatch();
    });
    await shoot(page, "hud2-aceduel-end.png");
    await rematchRestartsSetup(page, "AceDuelScene");
    expect(errors).toEqual([]);
  });
});
