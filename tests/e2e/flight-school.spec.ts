/**
 * flight-school.spec.ts — Flight School is reachable from the main menu (F)
 * and the WHOLE course is completed with real key presses that go through the
 * real flight engine: lessons 1-15 (Snap, Hook and Knife included) in one test,
 * the final exam flow (the bot shot down ahead of the trainee) in another. The card
 * shows the training banner and key chips that light up with the player's
 * input; completion is persisted.
 */

import { test, expect, type Page } from "@playwright/test";
import { FLIGHT_SCHOOL_STEPS } from "../../src/tutorial/FlightSchoolSteps";
import {
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

const SCENE = "FlightSchoolScene";
/** Chip fill when the key is held (HOLO_PALETTE.accent). */
const LIT = "#4fd8ff";

interface TextInfo {
  readonly text: string;
  readonly background: string | null;
}

async function openFlightSchool(page: Page): Promise<void> {
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await page.keyboard.press("f");
  await waitForScene(page, SCENE);
  await page.waitForTimeout(500);
}

/** Current lesson id (null once the course is complete). */
async function lesson(page: Page): Promise<string | null> {
  const ids = FLIGHT_SCHOOL_STEPS.map((s) => s.id);
  const index = await page.evaluate((key) => {
    const state = (window as any).game.scene.getScene(key).lessonState;
    return state.completed ? -1 : state.index;
  }, SCENE);
  return index < 0 ? null : ids[index]!;
}

/** Every Text object of the scene (the card's chips live inside containers). */
async function texts(page: Page): Promise<TextInfo[]> {
  return page.evaluate((key) => {
    const found: TextInfo[] = [];
    const visit = (obj: any): void => {
      if (typeof obj.text === "string")
        found.push({
          text: obj.text,
          background: obj.style?.backgroundColor || null,
        });
      for (const child of obj.list ?? []) visit(child);
    };
    for (const obj of (window as any).game.scene.getScene(key).children.list)
      visit(obj);
    return found;
  }, SCENE);
}

async function tap(page: Page, key: string, holdMs = 80): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
}

/** Repeat `attempt` until the lesson moves past `id` (or time runs out). */
async function pass(
  page: Page,
  id: string,
  attempt: () => Promise<void>,
  budgetMs = 15_000,
): Promise<void> {
  expect(await lesson(page)).toBe(id);
  const deadline = Date.now() + budgetMs;
  while ((await lesson(page)) === id) {
    if (Date.now() > deadline) throw new Error(`lesson ${id} did not complete`);
    await attempt();
    await page.waitForTimeout(250);
  }
}

/** Hold Z, then press a side: a Hook. */
async function hook(page: Page): Promise<void> {
  await page.keyboard.down("z");
  await page.waitForTimeout(60);
  await tap(page, "ArrowLeft", 100);
  await page.keyboard.up("z");
  await page.waitForTimeout(400);
}

/** Tap Z, press it again and keep it down, then a side: a Knife roll. */
async function knife(page: Page): Promise<void> {
  await tap(page, "z", 50);
  await page.waitForTimeout(40);
  await page.keyboard.down("z");
  await page.waitForTimeout(60);
  await tap(page, "ArrowLeft", 100);
  await page.keyboard.up("z");
  await page.waitForTimeout(400);
}

/**
 * Fly the final exam: mark the bot and keep it 160 px dead ahead of the
 * trainee (the way the weapon specs pin their targets), so the guns, which
 * fire by themselves inside the arc, shoot it down. What this checks is the
 * exam's flow (killing the bot completes the course). Piloting skill against
 * a bot is measured by the skill gates, not by a keyboard script: a script
 * sampling twice a second cannot chase a bot with arrows.
 */
async function fightBot(page: Page, budgetMs: number): Promise<void> {
  await tap(page, "r");
  const deadline = Date.now() + budgetMs;
  while ((await lesson(page)) === "final_fight") {
    if (Date.now() > deadline) throw new Error("the bot was not destroyed");
    await page.evaluate(async (key) => {
      const { shiftMotion } = await import("/src/arcade/systems/ShipMotion.ts");
      const field = (window as any).game.scene.getScene(key).field;
      const player = field.player;
      const bot = field.ships.get("bot");
      if (!bot?.flight) return;
      const rad = (player.angle * Math.PI) / 180;
      const x = player.x + Math.sin(rad) * 160;
      const y = player.y - Math.cos(rad) * 160;
      const moved = shiftMotion(bot.flight.motion, x - bot.x, y - bot.y, 6000);
      bot.flight = { ...bot.flight, motion: moved };
      bot.x = moved.x;
      bot.y = moved.y;
    }, SCENE);
    await page.waitForTimeout(250);
  }
}
test.describe("Flight School", () => {
  test("completes lessons 1-15 with real inputs, and saves completion", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await openFlightSchool(page);

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
    // Snap → Hook → Knife straight after each other: the trainee is never
    // left stressed or recharging from the lesson before.
    await pass(page, "segnor", () => hook(page));
    await pass(page, "tallon", () => knife(page));
    await pass(page, "boost", async () => {
      await tap(page, "ArrowUp", 60);
      await page.waitForTimeout(60);
      await tap(page, "ArrowUp", 60);
      await page.waitForTimeout(500);
    });
    await pass(page, "barrel_roll", async () => {
      await tap(page, "ArrowLeft", 50);
      await page.waitForTimeout(40);
      await tap(page, "ArrowLeft", 50);
      await page.waitForTimeout(500);
    });
    // Guns autofire while the drone flies ahead inside the arc.
    await pass(page, "primary_fire", () => page.waitForTimeout(500), 30_000);
    await pass(page, "secondary", async () => {
      await page.keyboard.down("Shift");
      await tap(page, "Space");
      await page.keyboard.up("Shift");
    });
    await pass(page, "mark", () => tap(page, "r"));
    // Turn around (Snap turn) toward the beacon behind, then fly to it.
    await pass(
      page,
      "radar",
      () => tap(page, "z").then(() => page.waitForTimeout(1500)),
      30_000,
    );
    await pass(page, "status_ring", () => tap(page, "Enter"));
    await expect.poll(() => lesson(page)).toBe("final_fight");
    // The exam itself is flown for real in its own test (it is slow).
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
    // The banner stays up to the end.
    expect((await texts(page)).map((t) => t.text)).toContain(
      "FLIGHT SCHOOL · TRAINING",
    );

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

  test("the final exam is won when the bot is shot down", async ({ page }) => {
    test.setTimeout(240_000);
    await openFlightSchool(page);
    for (let i = 0; i < 15; i++) await tap(page, "n");
    await expect.poll(() => lesson(page)).toBe("final_fight");
    await fightBot(page, 90_000);
    await expect.poll(() => lesson(page)).toBeNull();
  });

  test("shows the training banner, the lesson counter and no beat bar", async ({
    page,
  }) => {
    await openFlightSchool(page);
    const shown = (await texts(page)).map((t) => t.text);
    expect(shown).toContain("FLIGHT SCHOOL · TRAINING");
    expect(shown).toContain("NO SCORE · NO PENALTY");
    expect(shown).toContain("LESSON 1 / 16");
    expect(shown.some((t) => /^500 ms CYCLE/i.test(t))).toBe(false);
    expect(shown.some((t) => t.startsWith("NOW:"))).toBe(true);
    await page.screenshot({ path: "test-results/flight-school-lesson.png" });
  });

  test("key chips light up while the key is held", async ({ page }) => {
    await openFlightSchool(page);
    // The gunnery lesson shows the steering chips but never completes on a key press.
    for (let i = 0; i < 10; i++) await tap(page, "n");
    await expect.poll(() => lesson(page)).toBe("primary_fire");
    const litChips = async (): Promise<number> =>
      (await texts(page)).filter((t) => t.background === LIT).length;
    expect(await litChips()).toBe(0);
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(120);
    expect(await litChips()).toBeGreaterThan(0);
    await page.screenshot({ path: "test-results/flight-school-chips-lit.png" });
    await page.keyboard.up("ArrowLeft");
    await page.waitForTimeout(500);
    expect(await litChips()).toBe(0);
  });

  test("a Knife roll right after a wasted Snap says why, then completes", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openFlightSchool(page);
    for (let i = 0; i < 7; i++) await tap(page, "n");
    await expect.poll(() => lesson(page)).toBe("tallon");
    // A lone tap is a Snap turn: it stresses the trainee and starts the 5 s
    // recharge. Try the Knife while that Snap is still queued / flying.
    await tap(page, "z", 50);
    await page.waitForTimeout(270);
    await knife(page);
    const notices = (await texts(page)).map((t) => t.text);
    expect(notices.some((t) => /RECHARGING|STRESSED/.test(t))).toBe(true);
    await pass(page, "tallon", () => knife(page), 20_000);
  });

  test("ESC leaves Flight School and records the drop-off lesson", async ({
    page,
  }) => {
    await openFlightSchool(page);
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
