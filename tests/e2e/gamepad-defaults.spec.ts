/**
 * gamepad-defaults.spec.ts — the default gamepad layout reaches every flight
 * special (the alpha audit found K-turn, Segnor, Tallon, boost and barrel
 * roll unbound on gamepad), and right-stick flicks fire once per flick.
 *
 * Layout: A boost · LB/RB hard turns · LT/RT Tallon · D-pad ←/→ Segnor ·
 * right stick ←/→ barrel roll · right stick ↓ K-turn · X secondary ·
 * D-pad ↓ cycle weapon · commander orders on LT / RT / D-pad ← / → (a
 * capital ship can fly neither Tallon nor Segnor).
 */

import { test, expect, type Page } from "@playwright/test";
import { DOGFIGHT } from "./helpers/battleEntry";
import {
  injectFakeGamepad,
  setFakeGamepadAxes,
  tapFakeGamepadButton,
} from "./helpers/game";

const BUTTON = {
  A: 0,
  X: 2,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  D_DOWN: 13,
  D_LEFT: 14,
  D_RIGHT: 15,
};
/** Hold a flick long enough for several polls (must still fire once). */
const FLICK_HOLD_MS = 300;

/** Start recording every gamepad intent the live InputManager dispatches. */
async function recordIntents(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      ((window as any).game.scene.getScene("DogfightScene").input.gamepad
        ?.total ?? 0) > 0,
  );
  await page.evaluate(() => {
    // The pilot's intent source is the app's InputManager singleton.
    const inputManager = (window as any).game.scene.getScene("DogfightScene")
      .pilot.source;
    const w = window as unknown as { __gamepadIntents: string[] };
    w.__gamepadIntents = [];
    inputManager.onAny((event: { intent: string; source: string }) => {
      if (event.source === "gamepad") w.__gamepadIntents.push(event.intent);
    });
  });
}

async function recorded(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __gamepadIntents: string[] }).__gamepadIntents,
  );
}

test("every flight special has a default gamepad input", async ({ page }) => {
  await DOGFIGHT.enter(page, { peaceful: true });
  await injectFakeGamepad(page);
  await recordIntents(page);
  for (const button of Object.values(BUTTON))
    await tapFakeGamepadButton(page, button);
  await setFakeGamepadAxes(page, [0, 0, 0, 1]);
  await page.waitForTimeout(FLICK_HOLD_MS);
  await setFakeGamepadAxes(page, [0, 0, 0, 0]);
  await page.waitForTimeout(FLICK_HOLD_MS);
  const intents = await recorded(page);
  expect(intents).toEqual(
    expect.arrayContaining([
      "BOOST",
      "FIRE_SECONDARY",
      "KTURN",
      "SHARP_TURN_LEFT",
      "SHARP_TURN_RIGHT",
      "WEAPON_CYCLE",
      "TALLON_LEFT",
      "TALLON_RIGHT",
      "SEGNOR_LEFT",
      "SEGNOR_RIGHT",
      "COMMANDER_ORDER_1",
      "COMMANDER_ORDER_2",
      "COMMANDER_ORDER_3",
      "COMMANDER_ORDER_4",
    ]),
  );
});

test("a right-stick flick barrel-rolls once, however long it is held", async ({
  page,
}) => {
  await DOGFIGHT.enter(page, { peaceful: true });
  await injectFakeGamepad(page);
  await recordIntents(page);
  await setFakeGamepadAxes(page, [0, 0, 1, 0]);
  await page.waitForTimeout(FLICK_HOLD_MS);
  await setFakeGamepadAxes(page, [0, 0, 0, 0]);
  await page.waitForTimeout(FLICK_HOLD_MS);
  await setFakeGamepadAxes(page, [0, 0, -1, 0]);
  await page.waitForTimeout(FLICK_HOLD_MS);
  await setFakeGamepadAxes(page, [0, 0, 0, 0]);
  const rolls = (await recorded(page)).filter((i) =>
    i.startsWith("BARREL_ROLL"),
  );
  expect(rolls).toEqual(["BARREL_ROLL_RIGHT", "BARREL_ROLL_LEFT"]);
});
