/**
 * flight-school.spec.ts — Flight School is reachable from the main menu (F)
 * and can be completed with scripted key presses that go through the real
 * flight engine; completion is persisted and the menu stops recommending it.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

const SCENE = "FlightSchoolScene";

/** Current lesson id (null once the course is complete). */
async function lesson(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const s = (window as any).game.scene.getScene(key);
    const state = s.lessonState;
    return state.completed
      ? null
      : [
          "throttle_up",
          "throttle_down",
          "drift",
          "bank",
          "hard_turn",
          "kturn",
          "segnor",
          "tallon",
          "boost",
          "barrel_roll",
          "primary_fire",
          "secondary",
          "mark",
          "radar",
          "status_ring",
          "final_fight",
        ][state.index]!;
  }, SCENE);
}

async function tap(page: Page, key: string, holdMs = 80): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
}

/**
 * Repeat `attempt` until the lesson moves past `id` (or time runs out).
 */
async function pass(
  page: Page,
  id: string,
  attempt: () => Promise<void>,
  budgetMs = 12_000,
): Promise<void> {
  expect(await lesson(page)).toBe(id);
  const deadline = Date.now() + budgetMs;
  while ((await lesson(page)) === id) {
    if (Date.now() > deadline) throw new Error(`lesson ${id} did not complete`);
    await attempt();
    await page.waitForTimeout(250);
  }
}

test.describe("Flight School", () => {
  test("is offered on the menu, completed with real inputs, and saved", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await page.goto("/?debug=1");
    suppressWebGLNoise(page);
    await waitForMenuReady(page);
    await page.keyboard.press("f");
    await waitForScene(page, SCENE);
    await page.waitForTimeout(500);

    await pass(page, "throttle_up", () =>
      tap(page, "ArrowUp").then(() => page.waitForTimeout(400)),
    );
    await pass(page, "throttle_down", () =>
      tap(page, "ArrowDown").then(() => page.waitForTimeout(400)),
    );
    await pass(page, "drift", () => tap(page, "ArrowLeft"));
    await pass(page, "bank", () => tap(page, "ArrowRight", 450));
    await pass(page, "hard_turn", () => tap(page, "q"));
    await pass(page, "kturn", () =>
      tap(page, "z").then(() => page.waitForTimeout(600)),
    );
    await pass(page, "segnor", async () => {
      await page.keyboard.down("Shift");
      await tap(page, "Q");
      await page.keyboard.up("Shift");
      await page.waitForTimeout(400);
    });
    await pass(page, "tallon", () =>
      tap(page, "t").then(() => page.waitForTimeout(400)),
    );
    await pass(page, "boost", async () => {
      await tap(page, "ArrowUp", 60);
      await page.waitForTimeout(60);
      await tap(page, "ArrowUp", 60);
      await page.waitForTimeout(500);
    });
    await pass(page, "barrel_roll", async () => {
      await page.keyboard.down("ArrowLeft");
      await page.waitForTimeout(40);
      await page.keyboard.down("ArrowRight");
      await page.waitForTimeout(80);
      await page.keyboard.up("ArrowLeft");
      await page.waitForTimeout(60);
      await page.keyboard.up("ArrowRight");
      await page.waitForTimeout(500);
    });
    // Guns autofire while the drone flies ahead inside the arc.
    await pass(page, "primary_fire", () => page.waitForTimeout(500), 25_000);
    await pass(page, "secondary", async () => {
      await page.keyboard.down("Shift");
      await tap(page, "Space");
      await page.keyboard.up("Shift");
    });
    await pass(page, "mark", () => tap(page, "r"));
    // Turn around (K-turn) toward the beacon behind, then fly to it.
    await pass(
      page,
      "radar",
      () => tap(page, "z").then(() => page.waitForTimeout(1500)),
      30_000,
    );
    await pass(page, "status_ring", () => tap(page, "Enter"));
    expect(await lesson(page)).toBe("final_fight");
    // The exam bot is live; skip it with the lesson-skip key.
    await tap(page, "n");
    await expect.poll(() => lesson(page)).toBeNull();

    const progress = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("ss_flight_school_v1") ?? "{}"),
    );
    expect(progress.completed).toBe(true);
    const events = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("ss_telemetry_v1") ?? "[]").map(
        (e: any) => e.type,
      ),
    );
    expect(events).toContain("tutorial_step");
    expect(events).toContain("tutorial_exit");

    // Back to the menu: the card no longer offers SKIP (course done).
    await tap(page, "Enter");
    await waitForScene(page, "MainMenuScene");
    const hasSkip = await page.evaluate(() =>
      (window as any).game.scene
        .getScene("MainMenuScene")
        .children.list.some((c: any) => c.name === "flightSchoolSkip"),
    );
    expect(hasSkip).toBe(false);
  });

  test("ESC leaves Flight School and records the drop-off lesson", async ({
    page,
  }) => {
    await page.goto("/?debug=1");
    suppressWebGLNoise(page);
    await waitForMenuReady(page);
    await page.keyboard.press("f");
    await waitForScene(page, SCENE);
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await waitForScene(page, "MainMenuScene");
    const exit = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("ss_telemetry_v1") ?? "[]").find(
        (e: any) => e.type === "tutorial_exit",
      ),
    );
    expect(exit.data).toEqual({ step: "throttle_up", completed: false });
  });
});
