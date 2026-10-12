/**
 * Spec: the main menu plays its recorded theme.
 *
 * The production build used to 404 on the menu track (it requested a file that
 * was never shipped). The menu must now fetch menu_main in a format the
 * browser decodes, get a 200, log no 404s, and load no other music (music is
 * fetched lazily per context).
 */

import { test, expect, type Response } from "@playwright/test";
import { waitForMenuReady } from "./helpers/game";

const MENU_TRACK_URL = /assets\/audio\/music\/menu_main\.(ogg|mp3)$/;

test.describe("Menu music", () => {
  test("loads the recorded menu theme with no 404s", async ({ page }) => {
    const failedResponses: string[] = [];
    const notFoundConsole: string[] = [];
    const musicRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/assets/audio/music/"))
        musicRequests.push(req.url());
    });
    page.on("response", (res: Response) => {
      if (res.status() >= 400)
        failedResponses.push(`${res.status()} ${res.url()}`);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("404")) {
        notFoundConsole.push(`${msg.text()} @ ${msg.location().url}`);
      }
    });

    await page.goto("/");
    await waitForMenuReady(page);

    // Audio starts on the first user gesture (autoplay policy).
    const menuTrack = page.waitForResponse((res) =>
      MENU_TRACK_URL.test(res.url()),
    );
    await page.keyboard.press("Shift");
    const response = await menuTrack;
    expect(response.status()).toBe(200);

    const decodedSeconds = await page.evaluate(async (url: string) => {
      const bytes = await (await fetch(url)).arrayBuffer();
      const ctx = new OfflineAudioContext(2, 44100, 44100);
      return (await ctx.decodeAudioData(bytes)).duration;
    }, response.url());
    expect(decodedSeconds).toBeGreaterThan(60);

    expect(failedResponses).toEqual([]);
    expect(notFoundConsole).toEqual([]);
    // Lazy per context: the menu fetches its own theme and nothing else.
    expect(musicRequests.every((url) => MENU_TRACK_URL.test(url))).toBe(true);
  });
});
