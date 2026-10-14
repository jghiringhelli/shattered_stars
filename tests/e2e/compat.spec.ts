/**
 * compat.spec.ts — graceful degradation instead of a black screen:
 *  - desktop Chrome sees no notice at all (e2e must never get an overlay);
 *  - no Canvas 2D → blocking HTML notice with the minimum versions;
 *  - no WebGL (and not automation-forced) → Canvas renderer + small banner;
 *  - a too-old user agent → dismissible warning, game still boots;
 *  - a bundle that cannot even run → static fallback notice;
 *  - phones/tablets (touch-only) → one-time "desktop only" notice, remembered
 *    after dismissal, plus a rotate hint in portrait; touch taps still work.
 */

import { test, expect, devices, type Page } from "@playwright/test";
import { waitForMenuReady, waitForScene } from "./helpers/game";

const PHASER_CANVAS_RENDERER = 1;
/** Pixel 7 emulation without `defaultBrowserType`, which cannot be set inside a describe. */
function phone(name: "Pixel 7" | "Pixel 7 landscape") {
  const { defaultBrowserType: _ignored, ...options } = devices[name];
  return options;
}

const NOTICE_IDS = ["compat-blocked", "compat-banner", "device-notice", "rotate-hint"];

async function expectNoNotices(page: Page): Promise<void> {
  for (const id of NOTICE_IDS) await expect(page.locator(`#${id}`)).toBeHidden();
}

/** Makes the page look like a normal (non-automated) browser without WebGL. */
async function removeWebGL(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    // A real first launch opens the tester welcome, which these specs are not about.
    window.localStorage.setItem("ss_beta_welcome_v1", "1");
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type.startsWith("webgl") || type === "experimental-webgl") return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
}

test.describe("compat — desktop", () => {
  test("shows no notice and boots on Canvas under automation", async ({ page }) => {
    await page.goto("/");
    await waitForMenuReady(page);
    await expectNoNotices(page);
    const type = await page.evaluate(() => (window as any).game.renderer.type);
    expect(type).toBe(PHASER_CANVAS_RENDERER);
  });

  test("keeps ?renderer=canvas working without a notice", async ({ page }) => {
    await page.goto("/?renderer=canvas");
    await waitForMenuReady(page);
    await expectNoNotices(page);
  });

  test("blocks with the minimum versions when Canvas 2D is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
    await page.goto("/");
    const overlay = page.locator("#compat-blocked");
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText("Chrome 90, Edge 90, Firefox 90, Safari 15");
    await expect(page.locator("#compat-blocked-detail")).toContainText("Canvas");
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("falls back to Canvas with a banner when WebGL is missing", async ({ page }) => {
    await removeWebGL(page);
    await page.goto("/");
    await waitForScene(page, "MainMenuScene", 50_000);
    const banner = page.locator("#compat-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/compatibility mode/i);
    expect(await page.evaluate(() => (window as any).game.renderer.type)).toBe(
      PHASER_CANVAS_RENDERER,
    );
    await page.locator("#compat-banner-dismiss").click();
    await expect(banner).toBeHidden();
  });

  test("restarts on Canvas when WebGL fails while Phaser boots", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    // A real first launch opens the tester welcome, which these specs are not about.
    window.localStorage.setItem("ss_beta_welcome_v1", "1");
      const FRAMEBUFFER_UNSUPPORTED = 0x8cdd;
      for (const Context of [WebGLRenderingContext, WebGL2RenderingContext]) {
        Context.prototype.checkFramebufferStatus = () => FRAMEBUFFER_UNSUPPORTED;
      }
    });
    await page.goto("/");
    await waitForScene(page, "MainMenuScene", 50_000);
    await expect(page.locator("#compat-banner")).toContainText(/compatibility mode/i);
    expect(await page.evaluate(() => (window as any).game.renderer.type)).toBe(
      PHASER_CANVAS_RENDERER,
    );
    await expect(page.locator("canvas")).toHaveCount(1);
  });

  test("shows the static fallback when the bundle cannot run", async ({ page }) => {
    await page.route("**/src/main.ts*", (route) =>
      route.fulfill({ contentType: "text/javascript", body: "let broken = ;" }),
    );
    await page.goto("/");
    await expect(page.locator("#compat-blocked")).toBeVisible();
    await expect(page.locator("#compat-blocked")).toContainText("Safari 15");
  });
});

test.describe("compat — outdated browser", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36",
  });

  test("warns but still boots", async ({ page }) => {
    await page.goto("/");
    await waitForMenuReady(page);
    await expect(page.locator("#compat-banner")).toContainText("Chrome 89");
    await expect(page.locator("#compat-blocked")).toBeHidden();
  });
});

test.describe("compat — phone (Pixel 7 landscape)", () => {
  test.use(phone("Pixel 7 landscape"));

  test("shows the desktop-only notice once, then remembers the dismissal", async ({ page }) => {
    await page.goto("/");
    const notice = page.locator("#device-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/phones are not supported in this beta/i);
    await expect(page.locator("#rotate-hint")).toBeHidden();
    await page.locator("#device-notice-dismiss").click();
    await expect(notice).toBeHidden();
    await page.reload();
    await waitForMenuReady(page);
    await expect(page.locator("#device-notice")).toBeHidden();
  });

  test("menu taps still work after dismissing the notice", async ({ page }) => {
    await page.goto("/");
    await page.locator("#device-notice-dismiss").click();
    await waitForMenuReady(page);
    const box = (await page.locator("canvas").boundingBox())!;
    const gameWidth = await page.evaluate(() => (window as any).game.scale.gameSize.width);
    const scale = box.width / gameWidth;
    await page.touchscreen.tap(box.x + 640 * scale, box.y + 220 * scale);
    await waitForScene(page, "SquadBuilderScene", 30_000);
  });
});

test.describe("compat — phone (Pixel 7 portrait)", () => {
  test.use(phone("Pixel 7"));

  test("asks to rotate while held upright and hides the hint in landscape", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#rotate-hint")).toBeVisible();
    await expect(page.locator("#rotate-hint")).toContainText(/rotate/i);
    await page.setViewportSize({ width: 915, height: 412 });
    await expect(page.locator("#rotate-hint")).toBeHidden();
  });
});
