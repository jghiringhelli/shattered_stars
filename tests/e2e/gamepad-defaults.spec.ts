/**
 * gamepad-defaults.spec.ts — the default gamepad layout reaches every flight
 * special (the alpha audit found Snap turn, Hook, Knife, boost and barrel
 * roll unbound on gamepad), and right-stick flicks fire once per flick.
 *
 * Layout: A boost · LB/RB hard turns · LT = the MANEUVER button (tap Snap
 * turn · hold + left stick ←/→ Hook · double-tap + stick Knife) · left-stick
 * double-flick or right-stick flick ←/→ barrel roll · right stick ↓ Snap
 * turn · X secondary · D-pad ↓ cycle weapon · commander orders on LT / RT /
 * D-pad ← / → (a capital ship cannot maneuver).
 */

import { test, expect, type Page } from "@playwright/test";
import { DOGFIGHT } from "./helpers/battleEntry";
import {
  injectFakeGamepad,
  setFakeGamepadAxes,
  setFakeGamepadButton,
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
      "MANEUVER",
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

/** Unlock every special and dash on the flown ship (the card is not under test). */
async function unlockFlight(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { UNRESTRICTED_CAPABILITIES } =
      await import("/src/core/flightCapabilityTypes.ts");
    const scene = (window as any).game.scene.getScene("DogfightScene");
    const ship = scene.ships.get(scene.secondaryWeapons.playerShipId());
    const holder = ship.flight ? ship.flight.motion : ship;
    holder.control = {
      ...holder.control,
      capabilities: UNRESTRICTED_CAPABILITIES,
    };
  });
}

/** The flown ship's control state. */
function playerControl(page: Page): Promise<any> {
  return page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("DogfightScene");
    const ship = scene.ships.get(scene.secondaryWeapons.playerShipId());
    return (ship.flight ? ship.flight.motion : ship).control;
  });
}

test("a double-flick of the left stick to one side barrel-rolls", async ({
  page,
}) => {
  await DOGFIGHT.enter(page, { peaceful: true });
  await injectFakeGamepad(page);
  await unlockFlight(page);
  expect((await playerControl(page)).barrelRollCooldown).toBe(0);
  for (let i = 0; i < 2; i++) {
    await setFakeGamepadAxes(page, [-1, 0, 0, 0]);
    await page.waitForTimeout(70);
    await setFakeGamepadAxes(page, [0, 0, 0, 0]);
    if (i === 0) await page.waitForTimeout(50);
  }
  await expect
    .poll(async () => (await playerControl(page)).barrelRollCooldown)
    .toBeGreaterThan(0);
});

test("alternating left-stick flicks ← → never roll", async ({ page }) => {
  await DOGFIGHT.enter(page, { peaceful: true });
  await injectFakeGamepad(page);
  await unlockFlight(page);
  for (let i = 0; i < 6; i++) {
    await setFakeGamepadAxes(page, [i % 2 === 0 ? -1 : 1, 0, 0, 0]);
    await page.waitForTimeout(70);
    await setFakeGamepadAxes(page, [0, 0, 0, 0]);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(150);
  expect((await playerControl(page)).barrelRollCooldown).toBe(0);
});

test("tapping LT is a Snap turn", async ({ page }) => {
  await DOGFIGHT.enter(page, { peaceful: true });
  await injectFakeGamepad(page);
  await unlockFlight(page);
  await tapFakeGamepadButton(page, BUTTON.LT);
  await expect
    .poll(async () => {
      const c = await playerControl(page);
      return [c.nextManeuver, c.currentManeuver].includes("kturn");
    })
    .toBe(true);
});

test("holding LT and pushing the left stick ← is a Hook Loop", async ({
  page,
}) => {
  await DOGFIGHT.enter(page, { peaceful: true });
  await injectFakeGamepad(page);
  await unlockFlight(page);
  await setFakeGamepadButton(page, BUTTON.LT, true);
  await page.waitForTimeout(80);
  await setFakeGamepadAxes(page, [-1, 0, 0, 0]);
  await page.waitForTimeout(150);
  await setFakeGamepadAxes(page, [0, 0, 0, 0]);
  await setFakeGamepadButton(page, BUTTON.LT, false);
  await expect
    .poll(async () => {
      const c = await playerControl(page);
      return [c.nextManeuver, c.currentManeuver].includes("segnor_left");
    })
    .toBe(true);
});