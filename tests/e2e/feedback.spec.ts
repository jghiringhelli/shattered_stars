/**
 * feedback.spec.ts — the public-beta feedback loop: SEND FEEDBACK (main-menu
 * footer, pause menu, Settings > Advanced) saves a redacted bundle and opens
 * a prefilled issue, only on a click; the tester welcome shows once and can
 * be reopened.
 */

import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DOGFIGHT } from "./helpers/battleEntry";
import {
  clickGameCoord,
  suppressWebGLNoise,
  waitForMenuReady,
} from "./helpers/game";

const FEEDBACK = "#ss-feedback-dialog";
const WELCOME = "#ss-welcome-dialog";
const WELCOME_SEEN_KEY = "ss_beta_welcome_v1";
/** Clicks land a little inside the left-aligned footer links. */
const LINK_CLICK_INSET = 12;
const KEY_GAP_MS = 120;
const FAKE_TOKEN = "gh" + "p_abcdefghijklmnopqrstuvwxyz0123456789";

async function openMenu(page: Page, query = ""): Promise<void> {
  await page.goto(`/${query}`);
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
}

/** Position of a main-menu text object, in game coordinates. */
async function menuText(
  page: Page,
  label: string,
): Promise<{ x: number; y: number }> {
  return page.evaluate((text) => {
    const scene = (window as any).game.scene.getScene("MainMenuScene");
    const found = scene.children.list.find((o: any) => o.text === text);
    return { x: found.x as number, y: found.y as number };
  }, label);
}

async function clickFooter(page: Page, label: string): Promise<void> {
  const at = await menuText(page, label);
  await clickGameCoord(page, at.x + LINK_CLICK_INSET, at.y);
}

/** Replace window.open so the opened URL can be read. */
async function captureOpen(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__opened = [] as string[];
    window.open = ((url: string) => {
      (window as any).__opened.push(url);
      return null;
    }) as typeof window.open;
  });
}

test("the main-menu footer opens the feedback panel with the privacy promise", async ({
  page,
}) => {
  await openMenu(page);
  await clickFooter(page, "SEND FEEDBACK");
  await expect(page.locator(FEEDBACK)).toBeVisible();
  await expect(page.getByTestId("feedback-privacy")).toContainText(
    "Nothing is sent automatically",
  );
  await expect(page.locator(FEEDBACK)).toContainText("How to give feedback");
  await page.keyboard.press("Escape");
  await expect(page.locator(FEEDBACK)).toHaveCount(0);
});

test("DOWNLOAD ONLY saves a redacted bundle and opens nothing", async ({
  page,
}) => {
  await openMenu(page);
  await captureOpen(page);
  await clickFooter(page, "SEND FEEDBACK");
  await page.selectOption("#ss-feedback-kind", "balance");
  await page.fill("#ss-feedback-note", `Boost is weak. token ${FAKE_TOKEN}`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "DOWNLOAD ONLY" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^shattered-stars-feedback-[a-z0-9-]+-\d{8}-\d{6}\.json$/,
  );
  const bundle = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(bundle.format).toBe("shattered-stars-feedback");
  expect(bundle.kind).toBe("balance");
  expect(bundle.build.tag).toMatch(/^v\d+\.\d+\.\d+(-[0-9A-Za-z.]+)? BETA · /);
  expect(bundle.context.mode).toBe("menu");
  expect(bundle.environment.userAgent).toBeTruthy();
  expect(bundle.note).toContain("Boost is weak");
  expect(JSON.stringify(bundle)).not.toContain(FAKE_TOKEN);
  expect(await page.evaluate(() => (window as any).__opened)).toEqual([]);
});

test("SEND saves the file and opens a prefilled GitHub issue", async ({
  page,
}) => {
  await openMenu(page);
  await captureOpen(page);
  await clickFooter(page, "SEND FEEDBACK");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /^SEND \(/ }).click(),
  ]);
  const opened = await page.evaluate(
    () => (window as any).__opened as string[],
  );
  expect(opened).toHaveLength(1);
  const url = new URL(opened[0]!);
  expect(url.href).toContain(
    "github.com/jghiringhelli/shattered_stars/issues/new",
  );
  expect(url.searchParams.get("title")).toMatch(/^\[Bug\] menu: /);
  const body = url.searchParams.get("body") ?? "";
  expect(body).toContain("BETA");
  expect(body).toContain(download.suggestedFilename());
});

test("nothing is downloaded or opened until the player presses a button", async ({
  page,
}) => {
  await openMenu(page);
  await captureOpen(page);
  let downloads = 0;
  page.on("download", () => downloads++);
  await clickFooter(page, "SEND FEEDBACK");
  await page.waitForTimeout(500);
  expect(downloads).toBe(0);
  expect(await page.evaluate(() => (window as any).__opened)).toEqual([]);
});

test("the pause menu has SEND FEEDBACK and keeps the battle paused", async ({
  page,
}) => {
  await DOGFIGHT.enter(page, { peaceful: true });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(KEY_GAP_MS);
  }
  await page.keyboard.press("Enter");
  await expect(page.locator(FEEDBACK)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(FEEDBACK)).toHaveCount(0);
  const paused = await page.evaluate(
    (key) => (window as any).game.scene.getScene(key).isPaused === true,
    DOGFIGHT.sceneKey,
  );
  expect(paused).toBe(true);
});

test("Settings > Advanced offers SEND FEEDBACK", async ({ page }) => {
  await openMenu(page);
  await page.evaluate(() => (window as any).game.scene.start("SettingsScene"));
  await page.waitForFunction(() =>
    (window as any).game.scene.isActive("SettingsScene"),
  );
  await page.waitForTimeout(300);
  await page.keyboard.press("6");
  await page.waitForFunction(
    () =>
      (window as any).game.scene.getScene("SettingsScene")?.activeTab ===
      "advanced",
  );
  await page.waitForTimeout(200);
  const button = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("SettingsScene");
    const find = (list: any[]): any => {
      for (const o of list) {
        if (
          typeof o.text === "string" &&
          o.text.toUpperCase() === "SEND FEEDBACK"
        )
          return o;
        const hit = Array.isArray(o.list) ? find(o.list) : null;
        if (hit) return hit;
      }
      return null;
    };
    const o = find(scene.children.list);
    if (!o) return null;
    const m = o.getWorldTransformMatrix();
    return { x: m.tx as number, y: m.ty as number };
  });
  expect(button).not.toBeNull();
  await clickGameCoord(page, button!.x, button!.y);
  await expect(page.locator(FEEDBACK)).toBeVisible();
});
test("the tester welcome opens on request, marks itself seen and can be reopened", async ({
  page,
}) => {
  await openMenu(page, "?welcome=1");
  await expect(page.locator(WELCOME)).toBeVisible();
  await expect(page.locator(WELCOME)).toContainText("BETA");
  await expect(page.locator(WELCOME)).toContainText("Flight School");
  await expect(page.locator(WELCOME)).toContainText("Known issues");
  await page.getByRole("button", { name: "LET ME PLAY" }).click();
  await expect(page.locator(WELCOME)).toHaveCount(0);
  expect(
    await page.evaluate((k) => localStorage.getItem(k), WELCOME_SEEN_KEY),
  ).toBe("1");
  await clickFooter(page, "TESTER INFO");
  await expect(page.locator(WELCOME)).toBeVisible();
});

test("the welcome never opens by itself in an automated browser", async ({
  page,
}) => {
  await openMenu(page);
  await page.waitForTimeout(500);
  await expect(page.locator(WELCOME)).toHaveCount(0);
});

test("the welcome's Flight School button starts Flight School", async ({
  page,
}) => {
  await openMenu(page, "?welcome=1");
  await page.getByRole("button", { name: "FLIGHT SCHOOL" }).click();
  await page.waitForFunction(() =>
    (window as any).game.scene.isActive("FlightSchoolScene"),
  );
});
