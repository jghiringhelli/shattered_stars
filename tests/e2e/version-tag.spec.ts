/**
 * version-tag.spec.ts — the main menu names the exact build (package.json
 * version, git short SHA, build date), and REPORT A BUG attaches it together
 * with settings and recent telemetry.
 */

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clickGameCoord,
  suppressWebGLNoise,
  waitForMenuReady,
} from "./helpers/game";

const PACKAGE_VERSION = (
  JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    version: string;
  }
).version;
/** Clicks land a little inside the left-aligned link text. */
const LINK_CLICK_INSET = 20;

test("the main menu shows version, commit and build date", async ({ page }) => {
  await page.goto("/");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  const tag = await page.evaluate(
    () =>
      (window as any).game.scene.getScene("MainMenuScene").versionTag?.text ??
      "",
  );
  expect(tag).toMatch(
    new RegExp(
      `^v${PACKAGE_VERSION.replace(/\./g, "\\.")} ALPHA · [0-9a-z]+ · \\d{4}-\\d{2}-\\d{2}$`,
    ),
  );
});

test("REPORT A BUG pre-fills the build, settings and recent telemetry", async ({
  page,
}) => {
  await page.goto("/");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  const link = await page.evaluate(() => {
    (window as any).__bugUrl = "";
    window.open = ((url: string) => {
      (window as any).__bugUrl = url;
      return null;
    }) as typeof window.open;
    const scene = (window as any).game.scene.getScene("MainMenuScene");
    const text = scene.children.list.find(
      (o: any) => o.text === "REPORT A BUG",
    );
    return { x: text.x as number, y: text.y as number };
  });
  await clickGameCoord(page, link.x + LINK_CLICK_INSET, link.y);
  await page.waitForFunction(() => (window as any).__bugUrl !== "");
  const body = await page.evaluate(
    () => new URL((window as any).__bugUrl).searchParams.get("body") ?? "",
  );
  expect(body).toContain(`Build: v${PACKAGE_VERSION} ALPHA`);
  expect(body).toContain("Settings:");
  expect(body).toContain("telemetry events:");
});
