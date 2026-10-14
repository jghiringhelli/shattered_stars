/**
 * version-tag.spec.ts — the main menu names the exact build (package.json
 * version, git short SHA, build date). The feedback bundle carries it too (feedback.spec.ts).
 */

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { suppressWebGLNoise, waitForMenuReady } from "./helpers/game";

const PACKAGE_VERSION = (
  JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    version: string;
  }
).version;

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
      `^v${PACKAGE_VERSION.replace(/\./g, "\\.")} BETA · [0-9a-z]+ · \\d{4}-\\d{2}-\\d{2}$`,
    ),
  );
});
