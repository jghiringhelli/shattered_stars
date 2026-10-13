/**
 * skirmish-bots.spec.ts — the Skirmish AI is the skill-gate bots: every AI
 * ship flies a BotPilot at the battle's difficulty tier, R marks the
 * player's HUD target for the squad (HUD shows it marked, a wingman goes
 * after it), and a hit on the marked target deals the mark's multiplied damage.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  holdGameKey,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

const SCENE = "ArcadeBattleScene";
/** The player's team side key (squads without a teamId: the player's is team 0). */
const PLAYER_SIDE = "team_0";

/** Starts a Skirmish: kestrel + two wingmen against three venoms. */
async function startSkirmish(
  page: Page,
  aiDifficulty: string | null,
): Promise<void> {
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await page.evaluate((difficulty) => {
    const g = (window as any).game;
    g.scene
      .getScenes(true)
      .forEach((s: any) => g.scene.stop(s.sys.settings.key));
    g.registry.set("battleConfig", {
      factions: [
        {
          factionId: "free_confederation",
          controller: "player",
          ships: ["confed_kestrel", "confed_kestrel", "confed_kestrel"],
        },
        {
          factionId: "void_corsairs",
          controller: "ai",
          ships: ["corsair_venom", "corsair_venom", "corsair_venom"],
        },
      ],
      ...(difficulty ? { aiDifficulty: difficulty } : {}),
      seed: 42,
    });
    setTimeout(() => g.scene.start("ArcadeBattleScene"), 100);
  }, aiDifficulty);
  await waitForScene(page, SCENE, 30_000);
  await page.waitForFunction(
    (key) => (window as any).game.scene.getScene(key)?.ships?.size === 6,
    SCENE,
  );
}

test.describe("Skirmish AI flies the skill-gate bots", () => {
  test("enemies fly the difficulty's tier, wingmen the wingman tier", async ({
    page,
  }) => {
    await startSkirmish(page, "hard");
    const tiers = await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).aiPilotTiers,
      SCENE,
    );
    expect(tiers).toEqual({
      ally_0: "average",
      ally_1: "average",
      enemy_0: "expert",
      enemy_1: "expert",
      enemy_2: "expert",
    });
  });

  test("Easy enemies: an average leader and novice wingmen; no difficulty flies the average", async ({
    page,
  }) => {
    // squadSkillPlan("easy", "classic"): average, novice, novice (a squad
    // that never marks loses outright, so Easy keeps a marking leader).
    await startSkirmish(page, "easy");
    const easy = await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).aiPilotTiers,
      SCENE,
    );
    expect(easy).toMatchObject({
      enemy_0: "average",
      enemy_1: "novice",
      enemy_2: "novice",
    });
    await startSkirmish(page, null);
    const fallback = await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).aiPilotTiers,
      SCENE,
    );
    expect(fallback).toMatchObject({
      enemy_0: "average",
      enemy_1: "average",
      enemy_2: "average",
    });
  });

  test("AI ships fly and pick targets on their own", async ({ page }) => {
    await startSkirmish(page, "normal");
    const start = await page.evaluate((key) => {
      const s = (window as any).game.scene.getScene(key).ships.get("enemy_0");
      return { x: s.x, y: s.y };
    }, SCENE);
    await page.waitForFunction(
      (key) => {
        const scene = (window as any).game.scene.getScene(key);
        return ["enemy_0", "enemy_1", "enemy_2", "ally_0", "ally_1"].every(
          (id) => scene.aiTargetOf(id) !== null,
        );
      },
      SCENE,
      { timeout: 15_000 },
    );
    await page.waitForFunction(
      ({ key, from }) => {
        const s = (window as any).game.scene.getScene(key).ships.get("enemy_0");
        return Math.hypot(s.x - from.x, s.y - from.y) > 50;
      },
      { key: SCENE, from: start },
      { timeout: 10_000 },
    );
  });
});

test.describe("Skirmish squad mark (R)", () => {
  test("R marks the HUD target; the HUD shows it and a wingman goes after it", async ({
    page,
  }) => {
    await startSkirmish(page, "normal");
    await page.waitForFunction(
      (key) => !!(window as any).game.scene.getScene(key).hudReadout?.targetId,
      SCENE,
      { timeout: 30_000 },
    );
    const hudTarget = await page.evaluate(
      (key) =>
        (window as any).game.scene.getScene(key).hudReadout.targetId as string,
      SCENE,
    );
    await holdGameKey(page, "R", 120);
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).playerMarkedTargetId !== null,
      SCENE,
      { timeout: 5_000 },
    );
    const markedId = await page.evaluate(
      (key) =>
        (window as any).game.scene.getScene(key).playerMarkedTargetId as string,
      SCENE,
    );
    expect(markedId).toBe(hudTarget);
    await page.waitForFunction(
      ({ key, id }) =>
        (window as any).game.scene.getScene(key).hudReadout?.markedId === id,
      { key: SCENE, id: markedId },
      { timeout: 5_000 },
    );
    await page.waitForFunction(
      ({ key, id }) => {
        const scene = (window as any).game.scene.getScene(key);
        return ["ally_0", "ally_1"].some(
          (ally) => scene.aiTargetOf(ally) === id,
        );
      },
      { key: SCENE, id: markedId },
      { timeout: 6_000 },
    );
  });

  test("a primary hit on the marked target carries the squad mark's bonus (shared DiceAttack)", async ({
    page,
  }) => {
    await startSkirmish(page, "normal");
    const result = await page.evaluate(
      async ({ key, side }) => {
        const scene = (window as any).game.scene.getScene(key);
        scene.scene.pause();
        const rng = await import("/src/utils/random.ts");
        const always = rng.createSeededRng(1);
        always.next = () => 0; // every roll hits
        rng.setDefaultRng(always);
        const attacker = scene.ships.get("ally_0");
        const target = scene.ships.get("enemy_0");
        // From the target's side (not its tail, not its nose): only the mark lever applies.
        target.angle = 0;
        attacker.x = target.x - 100;
        attacker.y = target.y;
        attacker.angle = 90;
        target.shields = target.maxShields = 500;
        const shot = () => {
          scene.hitLedger.clear();
          const before = target.shields;
          scene.fireAt(attacker, target);
          return before - target.shields;
        };
        // The wingmen's mark assist may already hold a mark: move it away.
        scene.botFleet.markTarget(side, "nobody", scene.battleClockMs);
        const unmarked = shot();
        scene.botFleet.markTarget(side, target.id, scene.battleClockMs);
        const marked = shot();
        rng.setDefaultRng(rng.createRng());
        return { unmarked, marked };
      },
      { key: SCENE, side: PLAYER_SIDE },
    );
    expect(result.unmarked).toBeGreaterThan(0);
    expect(result.marked).toBeGreaterThan(result.unmarked);
  });
});
