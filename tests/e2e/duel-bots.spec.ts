/**
 * duel-bots.spec.ts — the duel scenes' AI is the skill-gate bots, flying
 * with the player's controls:
 *
 *  - Dogfight: the AI opponent is a BotPilot of the difficulty's tier
 *    (normal = average, brutal = expert with faster reactions); it moves and
 *    turns toward the player. Online the opponent is a human — no bot.
 *  - Dogfight: R marks the HUD's target — stored for the player's side and
 *    shown on the HUD contact (isMarked).
 *  - Ace Duel 2v2: the player's escort (an average bot) focuses and shoots
 *    the target the player marked, with the squad-mark bonus.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";
import { DOGFIGHT } from "./helpers/battleEntry";

const DOGFIGHT_KEY = "DogfightScene";
const ACE_KEY = "AceDuelScene";
/** Brutal halves the expert's 120 ms reaction delay. */
const BRUTAL_REACTION_MS = 60;
/** How close (°) the AI's nose must come to the player once it turned around. */
const ON_TARGET_DEG = 30;
const TURN_WINDOW_MS = 5_000;
const SAMPLE_MS = 100;
/** The player re-marks this often (a mark lapses after 8 s). */
const REMARK_EVERY_MS = 2_000;

async function openDogfightSetup(page: Page): Promise<void> {
  suppressWebGLNoise(page);
  await page.goto("/?debug=1");
  await waitForMenuReady(page);
  await clickMenuItem(page, "DOGFIGHT");
  await waitForScene(page, DOGFIGHT_KEY, 30_000);
}

/** Starts a peaceful Dogfight (no weapons) at a difficulty. */
async function startDogfight(page: Page, difficulty: string): Promise<void> {
  await openDogfightSetup(page);
  await page.evaluate(
    ({ key, level }) => {
      const s = (window as any).game.scene.getScene(key);
      s.difficulty = level;
      s.processCombat = () => undefined;
      s.startMatch();
    },
    { key: DOGFIGHT_KEY, level: difficulty },
  );
}

/** The target Ace Duel side 1 (the player's) has marked, or null. */
async function sideOneMark(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const s = (window as any).game.scene.getScene(key);
    return s.crew.markedTargetOf("side1", s.time.now);
  }, ACE_KEY);
}

/** The enemy the player's escort's bot is trying to shoot. */
async function escortTarget(page: Page): Promise<string | null> {
  return page.evaluate(
    (key) => (window as any).game.scene.getScene(key).crew.targetOf("side1_1"),
    ACE_KEY,
  );
}

/** The AI's nose off the bearing to the player (°, 0–180). */
async function aiOffNose(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const s = (window as any).game.scene.getScene(key);
    const ai = s.ships.get("ai_0");
    const player = s.ships.get(s.playerShipIds[0]);
    const bearing =
      (Math.atan2(player.x - ai.x, -(player.y - ai.y)) * 180) / Math.PI;
    const off = (((bearing - ai.angle + 180) % 360) + 360) % 360;
    return Math.abs(off - 180);
  }, DOGFIGHT_KEY);
}

test.describe("Dogfight — the AI opponent is a bot", () => {
  test("normal difficulty flies an average bot", async ({ page }) => {
    await startDogfight(page, "normal");
    const tier = await page.evaluate(
      (key) =>
        (window as any).game.scene.getScene(key).crew.pilots.get("ai_0").tier,
      DOGFIGHT_KEY,
    );
    expect(tier).toBe("average");
  });

  test("brutal difficulty flies a faster-reacting expert", async ({ page }) => {
    await startDogfight(page, "brutal");
    const profile = await page.evaluate(
      (key) =>
        (window as any).game.scene.getScene(key).crew.pilots.get("ai_0")
          .profile,
      DOGFIGHT_KEY,
    );
    expect(profile.tier).toBe("expert");
    expect(profile.reactionMs).toBe(BRUTAL_REACTION_MS);
  });

  test("the bot turns around onto a player behind it", async ({ page }) => {
    await startDogfight(page, "normal");
    // Point the AI away from the player (who is south of it).
    await page.evaluate(async (key) => {
      const { createCycleFlight } =
        await import("/src/arcade/systems/CycleFlight.ts");
      const { equipFlight } =
        await import("/src/arcade/systems/QuickBuildEquip.ts");
      const s = (window as any).game.scene.getScene(key);
      const ai = s.ships.get("ai_0");
      const pose = { x: ai.x, y: ai.y, angle: 0 };
      s.setFlight(
        ai,
        equipFlight(createCycleFlight(ai.definitionId, pose), ai.modifiers),
      );
    }, DOGFIGHT_KEY);
    const start = await page.evaluate(
      (key) => ({
        ...(window as any).game.scene.getScene(key).ships.get("ai_0"),
      }),
      DOGFIGHT_KEY,
    );
    expect(await aiOffNose(page)).toBeGreaterThan(150);
    let best = 180;
    for (
      let t = 0;
      t < TURN_WINDOW_MS && best > ON_TARGET_DEG;
      t += SAMPLE_MS
    ) {
      await page.waitForTimeout(SAMPLE_MS);
      best = Math.min(best, await aiOffNose(page));
    }
    expect(best).toBeLessThanOrEqual(ON_TARGET_DEG);
    const end = await page.evaluate(
      (key) => ({
        ...(window as any).game.scene.getScene(key).ships.get("ai_0"),
      }),
      DOGFIGHT_KEY,
    );
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeGreaterThan(20);
  });

  test("online the opponent is a remote human — no bot", async ({ page }) => {
    suppressWebGLNoise(page);
    await page.goto("/?debug=1");
    await waitForMenuReady(page);
    await page.evaluate((key) => {
      const game = (window as any).game;
      game.scene.stop("MainMenuScene");
      game.scene.start(key, { isOnlineMode: true, seed: 7 });
    }, DOGFIGHT_KEY);
    await page.waitForFunction(
      (key) => (window as any).game.scene.getScene(key)?.crew != null,
      DOGFIGHT_KEY,
      { timeout: 15_000 },
    );
    const bots = await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).crew.pilots.size,
      DOGFIGHT_KEY,
    );
    expect(bots).toBe(0);
  });
});

test.describe("Dogfight — R marks the HUD target", () => {
  test("the mark is stored and the HUD contact shows it", async ({ page }) => {
    await DOGFIGHT.enter(page, { peaceful: true });
    await page.evaluate((key) => {
      const hud = (window as any).game.scene.getScene(key).hud;
      const plain = hud.update.bind(hud);
      hud.update = (snapshot: any) => {
        hud.__last = snapshot;
        plain(snapshot);
      };
    }, DOGFIGHT_KEY);
    await page.keyboard.down("r");
    await page.waitForTimeout(80);
    await page.keyboard.up("r");
    const state = (): Promise<{ stored: string | null; hud: boolean }> =>
      page.evaluate((key) => {
        const s = (window as any).game.scene.getScene(key);
        const contact = s.hud.__last?.contacts.find(
          (c: any) => c.id === "ai_0",
        );
        return {
          stored: s.crew.markedTargetOf("player", s.time.now),
          hud: contact?.isMarked === true,
        };
      }, DOGFIGHT_KEY);
    await expect.poll(state, { timeout: 2_000 }).toEqual({
      stored: "ai_0",
      hud: true,
    });
  });
});

test.describe("Ace Duel 2v2 — the escort shoots the player's mark", () => {
  test.setTimeout(90_000);

  test("the escort is an average bot and fires on the marked target", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await page.goto("/?debug=1");
    await waitForMenuReady(page);
    await clickMenuItem(page, "ACE DUEL");
    await waitForScene(page, ACE_KEY, 30_000);
    await page.evaluate(async (key) => {
      const { ACE_MATCHUPS } = await import("/src/data/AceMatchups.ts");
      const s = (window as any).game.scene.getScene(key);
      s.selectedMatchup = ACE_MATCHUPS.find(
        (m: any) => m.id === "bomber_squadron",
      );
      s.difficulty = "hard";
      const fireAt = s.fireAt.bind(s);
      s.__shots = [];
      s.fireAt = (a: any, t: any) => {
        s.__shots.push({
          attacker: a.id,
          target: t.id,
          marked: s.crew.isMarkedShot(a.id, t.id, s.time.now),
        });
        fireAt(a, t);
      };
      s.startDuel();
    }, ACE_KEY);
    const tiers = await page.evaluate((key) => {
      const pilots = (window as any).game.scene.getScene(key).crew.pilots;
      return Object.fromEntries(
        [...pilots.entries()].map(([id, p]: [string, any]) => [id, p.tier]),
      );
    }, ACE_KEY);
    expect(tiers).toEqual({
      side1_1: "average",
      side2_0: "expert",
      side2_1: "expert",
    });

    await page.keyboard.down("r");
    await page.waitForTimeout(80);
    await page.keyboard.up("r");
    await expect
      .poll(() => sideOneMark(page), { timeout: 2_000 })
      .not.toBeNull();
    const markedId = (await sideOneMark(page))!;
    // The player keeps the same target marked (as re-pressing R would).
    await page.evaluate(
      ({ key, id, every }) => {
        const s = (window as any).game.scene.getScene(key);
        s.time.addEvent({
          delay: every,
          loop: true,
          callback: () => s.crew?.markTarget("side1", id, s.time.now),
        });
      },
      { key: ACE_KEY, id: markedId, every: REMARK_EVERY_MS },
    );
    await expect
      .poll(() => escortTarget(page), { timeout: 5_000 })
      .toBe(markedId);
    await page.waitForFunction(
      ({ key, id }) =>
        (window as any).game.scene
          .getScene(key)
          .__shots.some(
            (s: any) => s.attacker === "side1_1" && s.target === id && s.marked,
          ),
      { key: ACE_KEY, id: markedId },
      { polling: 100, timeout: 45_000 },
    );
  });
});
