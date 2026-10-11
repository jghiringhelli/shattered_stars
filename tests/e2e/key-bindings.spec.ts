/**
 * key-bindings.spec.ts — every physical key combination reaches the right
 * maneuver in a real battle (Dogfight, shared pilot controls). The headless
 * KeyComboTelemetry battery proves each maneuver then ends where X-Wing
 * puts it; this spec proves the keyboard gets there.
 */

import { test, expect, type Page } from "@playwright/test";
import { DOGFIGHT } from "./helpers/battleEntry";

const SCENE = DOGFIGHT.sceneKey;

/** The player's control state. */
async function control(page: Page): Promise<any> {
  return page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    const ship = scene.ships.get(scene.playerShipIds[0]);
    return { ...ship.flight.motion.control, maneuverPath: undefined };
  }, SCENE);
}

/** Waits until the player has queued or is flying `maneuver`. */
async function expectManeuver(page: Page, maneuver: string): Promise<void> {
  await page.waitForFunction(
    ({ key, m }) => {
      const scene = (window as any).game.scene.getScene(key);
      const c = scene.ships.get(scene.playerShipIds[0]).flight.motion.control;
      return c.nextManeuver === m || c.currentManeuver === m;
    },
    { key: SCENE, m: maneuver },
    { timeout: 2_000 },
  );
}

async function pressKey(page: Page, key: string, shift = false): Promise<void> {
  if (shift) await page.keyboard.down("Shift");
  await page.keyboard.down(key);
  await page.waitForTimeout(80);
  await page.keyboard.up(key);
  if (shift) await page.keyboard.up("Shift");
}

async function doubleTap(page: Page, key: string): Promise<void> {
  await pressKey(page, key);
  await page.waitForTimeout(60);
  await pressKey(page, key);
}

test.describe("key bindings — Dogfight", () => {
  test.beforeEach(async ({ page }) => {
    await DOGFIGHT.enter(page, { peaceful: true });
    await page.waitForTimeout(400);
  });

  const single: ReadonlyArray<[string, string, boolean, string]> = [
    ["Q", "q", false, "turn_left"],
    ["E", "e", false, "turn_right"],
    ["Z", "z", false, "kturn"],
    ["Shift+Q", "Q", true, "segnor_left"],
    ["Shift+E", "E", true, "segnor_right"],
    ["T", "t", false, "tallon_left"],
    ["Shift+T", "T", true, "tallon_right"],
  ];
  for (const [label, key, shift, maneuver] of single) {
    test(`${label} → ${maneuver}`, async ({ page }) => {
      await pressKey(page, key, shift);
      await expectManeuver(page, maneuver);
    });
  }

  test("↓↓ → K-turn, throttle unchanged", async ({ page }) => {
    const before = (await control(page)).speed;
    await doubleTap(page, "ArrowDown");
    await expectManeuver(page, "kturn");
    expect((await control(page)).speed).toBe(before);
  });

  test("↑↑ → boost, throttle unchanged", async ({ page }) => {
    const before = (await control(page)).speed;
    await doubleTap(page, "ArrowUp");
    await page.waitForTimeout(50);
    const after = await control(page);
    expect(after.boostCooldown).toBeGreaterThan(0);
    expect(after.speed).toBe(before);
  });

  test("hold ← + ↑↑ → Tallon left", async ({ page }) => {
    await page.keyboard.down("ArrowLeft");
    await doubleTap(page, "ArrowUp");
    await page.keyboard.up("ArrowLeft");
    await expectManeuver(page, "tallon_left");
  });

  test("hold → + ↓↓ → Segnor right", async ({ page }) => {
    await page.keyboard.down("ArrowRight");
    await doubleTap(page, "ArrowDown");
    await page.keyboard.up("ArrowRight");
    await expectManeuver(page, "segnor_right");
  });

  test("← then → quickly → barrel roll, no drift queued after", async ({
    page,
  }) => {
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(40);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(80);
    await page.keyboard.up("ArrowLeft");
    await page.waitForTimeout(60);
    await page.keyboard.up("ArrowRight");
    const after = await control(page);
    expect(after.barrelRollCooldown).toBeGreaterThan(0);
    expect(after.nextManeuver).toBeNull();
  });

  test("↑ once → one throttle notch", async ({ page }) => {
    const before = (await control(page)).speed;
    await pressKey(page, "ArrowUp");
    await page.waitForTimeout(50);
    expect((await control(page)).speed).toBe(before + 1);
  });

  test("R → MARK_TARGET reaches the pilot's mark latch", async ({ page }) => {
    const takeMark = (): Promise<boolean> =>
      page.evaluate(
        (key) =>
          (window as any).game.scene.getScene(key).pilot.takeMarkRequest(),
        SCENE,
      );
    expect(await takeMark()).toBe(false);
    await pressKey(page, "r");
    await page.waitForTimeout(50);
    expect(await takeMark()).toBe(true);
    expect(await takeMark()).toBe(false);
  });
});
