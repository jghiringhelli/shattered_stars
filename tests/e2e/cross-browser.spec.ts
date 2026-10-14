/**
 * cross-browser.spec.ts — Firefox / WebKit / Chromium smoke, opt-in:
 *
 *   $env:BROWSERS="all"; npx playwright test tests/e2e/cross-browser.spec.ts
 *   BROWSER_URL=http://localhost:4173 BROWSER_PROD=1 selects a production build (no window.game);
 *   the default is the dev server.
 *
 * Needs `npx playwright install firefox webkit`. Each browser runs twice: on the
 * Canvas renderer automation forces, and on WebGL (navigator.webdriver hidden,
 * as a real visitor's browser reports it). Steps: boot -> main menu is not
 * black -> Flight School (F) -> ten seconds of flight -> no console errors ->
 * first gesture unlocked audio and the menu track was requested.
 * Skipped unless BROWSERS is set; playwright.config.ts is untouched.
 */

import {
  chromium,
  firefox,
  webkit,
  expect,
  test,
  type BrowserType,
  type LaunchOptions,
  type Page,
} from "@playwright/test";

const ENABLED = Boolean(process.env["BROWSERS"]);
const BASE_URL = process.env["BROWSER_URL"] ?? "http://localhost:3003";
const MENU_SETTLE_MS = 6000;
const FLIGHT_MS = 10_000;
const MIN_DISTINCT_COLORS = 50;
/** Dev builds expose window.game; set BROWSER_PROD=1 for a production build (no hooks). */
const EXPECT_HOOKS = !process.env["BROWSER_PROD"];
const BOOT_TIMEOUT_MS = 90_000;
/** WebKit's close() can hang; the test must not. */
const CLOSE_TIMEOUT_MS = 5000;
const MENU_TRACK = /assets\/audio\/music\/menu_main\.(ogg|mp3)/;

const BROWSERS: ReadonlyArray<readonly [string, BrowserType]> = [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
];

/**
 * Per-browser launch options. Headless Chromium's default GL can fail WebGL
 * init, so name the backend. Firefox's content-process sandbox cannot start in
 * some locked-down Windows environments ("Failed to launch tab subprocess"), so
 * it runs with the sandbox off — local smoke testing only.
 */
function launchOptions(name: string): LaunchOptions {
  if (name === "chromium") {
    return { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] };
  }
  if (name === "firefox") {
    return {
      env: { ...process.env, MOZ_DISABLE_CONTENT_SANDBOX: "1", MOZ_DISABLE_SOCKET_PROCESS: "1" } as Record<string, string>,
      firefoxUserPrefs: { "security.sandbox.content.level": 0, "network.process.enabled": false },
    };
  }
  return {};
}

/** Distinct 4-bit-per-channel colours in a screenshot (a black or flat screen has ~1), decoded in the page itself. */
async function distinctColors(page: Page): Promise<number> {
  const base64 = (await page.screenshot({ type: "png" })).toString("base64");
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < pixels.length; i += 4) {
      seen.add(((pixels[i]! >> 4) << 8) | ((pixels[i + 1]! >> 4) << 4) | (pixels[i + 2]! >> 4));
    }
    return seen.size;
  }, base64);
}

test.describe("cross-browser smoke (BROWSERS=all)", () => {
  test.skip(!ENABLED, "set BROWSERS=all to run");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  for (const [name, type] of BROWSERS) {
    for (const renderer of ["canvas", "webgl"] as const) {
      test(`${name} / ${renderer}: boot, menu, flight school, audio`, async () => {
        const browser = await type.launch(launchOptions(name));
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        const errors: string[] = [];
        const music: string[] = [];
        page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
        page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        page.on("request", (r) => MENU_TRACK.test(r.url()) && music.push(r.url()));
        if (renderer === "webgl") {
          await page.addInitScript(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => false });
            // A real first launch opens the tester welcome; this smoke starts after it.
            window.localStorage.setItem("ss_beta_welcome_v1", "1");
          });
        }
        await page.goto(`${BASE_URL}/?debug=1`);
        await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
        await page.waitForTimeout(MENU_SETTLE_MS);
        expect(await distinctColors(page), `${name} menu is blank`).toBeGreaterThan(MIN_DISTINCT_COLORS);
        await expect(page.locator("#compat-blocked")).toBeHidden();

        await page.keyboard.press("f");
        await page.keyboard.down("ArrowLeft");
        await page.waitForTimeout(FLIGHT_MS);
        await page.keyboard.up("ArrowLeft");
        expect(await distinctColors(page), `${name} flight is blank`).toBeGreaterThan(MIN_DISTINCT_COLORS);

        // Playwright's Windows WebKit build ships without Web Audio; the game must still run silently.
        const hasWebAudio = await page.evaluate(() => typeof AudioContext !== "undefined");
        if (hasWebAudio) {
          expect(music.length, "menu track requested after first gesture").toBeGreaterThan(0);
        } else {
          console.log(`${name}: no Web Audio in this build; audio assertion skipped`);
        }
        const rendererType = await page.evaluate(() => {
          const game = (window as unknown as { game?: { renderer: { type: number } } }).game;
          return game ? game.renderer.type : -1;
        });
        console.log(`${name}/${renderer}: Phaser renderer type ${rendererType} (1 canvas, 2 webgl, -1 unknown)`);
        const real = errors.filter((e) => !/favicon|404/.test(e));
        expect(real, real.join("\n")).toHaveLength(0);
        await Promise.race([
          browser.close(),
          new Promise((resolve) => setTimeout(resolve, CLOSE_TIMEOUT_MS)),
        ]);
      });
    }
  }
});
