/**
 * telemetry-stats.spec.ts — Settings › Advanced › VIEW STATS opens the
 * Stats panel over Settings, summarising the local telemetry log (matches
 * per mode, death causes, Flight School drop-off), and ESC returns to a
 * live Settings screen.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";
import { DOGFIGHT } from "./helpers/battleEntry";

/** A small seeded log: two Dogfight matches, a death, a Flight School exit. */
const SEEDED_LOG = [
  {
    t: 1,
    type: "mode_end",
    session: "e2e",
    data: { mode: "dogfight", outcome: "victory", durationMs: 42000 },
  },
  {
    t: 2,
    type: "mode_end",
    session: "e2e",
    data: { mode: "dogfight", outcome: "defeat", durationMs: 58000 },
  },
  {
    t: 3,
    type: "match_summary",
    session: "e2e",
    data: {
      mode: "dogfight",
      outcome: "victory",
      durationMs: 42000,
      kills: 1,
      playerDeaths: 0,
      shotsPrimary: 20,
      hitsPrimary: 9,
      specials: 4,
    },
  },
  {
    t: 4,
    type: "death",
    session: "e2e",
    data: { mode: "dogfight", cause: "terran_raptor" },
  },
  {
    t: 5,
    type: "tutorial_exit",
    session: "e2e",
    data: { step: "kturn", completed: false },
  },
];

async function openAdvancedSettings(page: Page): Promise<void> {
  await page.addInitScript((log) => {
    localStorage.setItem("ss_telemetry_v1", JSON.stringify(log));
  }, SEEDED_LOG);
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await clickMenuItem(page, "SETTINGS");
  await waitForScene(page, "SettingsScene");
  await page.waitForTimeout(300);
  await page.keyboard.press("6");
  await page.waitForFunction(
    () =>
      (window as any).game.scene.getScene("SettingsScene")?.activeTab ===
      "advanced",
  );
  await page.waitForTimeout(150);
}

/** @returns Every text shown by the Stats panel. */
async function statsTexts(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window as any).game.scene
      .getScene("TelemetryStatsScene")
      .children.list.filter((o: any) => typeof o.text === "string")
      .map((o: any) => o.text as string),
  );
}

test.describe("Telemetry Stats panel", () => {
  test("a Dogfight left mid-match logs a match_summary with its combat stats", async ({
    page,
  }) => {
    await DOGFIGHT.enter(page);
    await page.waitForTimeout(4000);
    await page.evaluate(() =>
      (window as any).game.scene.getScene("DogfightScene").scene.restart(),
    );
    await page.waitForFunction(() =>
      (
        JSON.parse(localStorage.getItem("ss_telemetry_v1") ?? "[]") as any[]
      ).some((e) => e.type === "match_summary"),
    );
    const summary = await page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem("ss_telemetry_v1") ?? "[]") as any[]
        ).find((e) => e.type === "match_summary").data,
    );
    expect(summary.mode).toBe("dogfight");
    expect(summary.outcome).toBe("quit");
    expect(summary.deployedFriendly).toBeGreaterThanOrEqual(1);
    expect(summary.deployedHostile).toBeGreaterThanOrEqual(1);
    expect(summary.durationMs).toBeGreaterThan(0);
  });

  test("opens from Settings › Advanced, summarises the log and closes back to Settings", async ({
    page,
  }) => {
    await openAdvancedSettings(page);
    await page.evaluate(() => {
      const settings = (window as any).game.scene.getScene("SettingsScene");
      const targets = settings.focusTargets;
      targets[targets.length - 1].activate();
    });
    await page.waitForFunction(() =>
      (window as any).game.scene.isActive("TelemetryStatsScene"),
    );
    expect(
      await page.evaluate(() =>
        (window as any).game.scene.isPaused("SettingsScene"),
      ),
    ).toBe(true);

    const texts = await statsTexts(page);
    expect(texts).toContain("YOUR STATS");
    expect(texts).toContain("Dogfight");
    expect(texts).toContain("50%");
    expect(texts.some((t) => t.includes("×1") && t.includes("Raptor"))).toBe(
      true,
    );
    expect(texts.some((t) => t.includes('most left at "kturn"'))).toBe(true);

    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => !(window as any).game.scene.isActive("TelemetryStatsScene"),
    );
    await page.waitForFunction(() =>
      (window as any).game.scene.isActive("SettingsScene"),
    );
    expect(
      await page.evaluate(
        () => (window as any).game.scene.getScene("SettingsScene").activeTab,
      ),
    ).toBe("advanced");
  });
});
