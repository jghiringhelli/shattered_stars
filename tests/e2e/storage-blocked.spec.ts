/**
 * storage-blocked.spec.ts — the game must boot and play when browser storage
 * is unavailable (Safari "block all cookies", sandboxed iframes) or full.
 * Before the safe key/value store, the first-boot tutorial write threw and
 * left a black screen.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

/** Every localStorage access throws, as with storage blocked by policy. */
function blockStorage(): void {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });
}

/** Reads work, every write throws, as with a full quota. */
function fillStorageQuota(): void {
  Storage.prototype.setItem = function setItem(): void {
    throw new DOMException("Quota exceeded", "QuotaExceededError");
  };
}

const MODES = [
  { name: "blocked", init: blockStorage },
  { name: "full", init: fillStorageQuota },
] as const;

/** Start a Dogfight from the menu and wait for both ships. */
async function playDogfight(page: Page): Promise<void> {
  await clickMenuItem(page, "DOGFIGHT");
  await waitForScene(page, "DogfightScene", 30_000);
  await page.evaluate(() =>
    (window as any).game.scene.getScene("DogfightScene").startMatch(),
  );
  await page.waitForFunction(
    () =>
      ((window as any).game.scene.getScene("DogfightScene")?.ships?.size ??
        0) >= 2,
    undefined,
    { timeout: 15_000 },
  );
}

for (const mode of MODES) {
  test(`boots to the menu and plays a match with storage ${mode.name}`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(mode.init);
    await page.goto("/");
    suppressWebGLNoise(page);
    await waitForMenuReady(page);
    await playDogfight(page);
    expect(pageErrors).toEqual([]);
  });
}

test("warns the player that progress won't be saved when storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(blockStorage);
  await page.goto("/");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await expect(page.locator("#storage-warning-toast")).toContainText(
    "won't be saved",
  );
});

test("keeps settings for the session when storage is full", async ({
  page,
}) => {
  await page.addInitScript(fillStorageQuota);
  await page.goto("/");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  const roundTrip = await page.evaluate(async () => {
    const { browserStore } = await import("/src/systems/keyValueStore.ts");
    browserStore().setItem("ss_e2e_probe", "kept");
    return browserStore().getItem("ss_e2e_probe");
  });
  expect(roundTrip).toBe("kept");
});
