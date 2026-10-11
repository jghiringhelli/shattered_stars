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
const PLAYER_FACTION = "free_confederation";

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

  test("Easy enemies fly the novice; no difficulty flies the average", async ({
    page,
  }) => {
    await startSkirmish(page, "easy");
    const easy = await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).aiPilotTiers.enemy_0,
      SCENE,
    );
    expect(easy).toBe("novice");
    await startSkirmish(page, null);
    const fallback = await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).aiPilotTiers.enemy_0,
      SCENE,
    );
    expect(fallback).toBe("average");
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

  test("a hit on the marked target deals the mark's multiplied damage", async ({
    page,
  }) => {
    await startSkirmish(page, "normal");
    const result = await page.evaluate(
      async ({ key, side }) => {
        const scene = (window as any).game.scene.getScene(key);
        scene.scene.pause();
        const { createProjectile } = await import("/src/core/Projectile.ts");
        const { PROJECTILE_MARK_DAMAGE_MULTIPLIER } =
          await import("/src/scenes/arcadeBattle/projectileLevers.ts");
        const attacker = scene.ships.get("ally_0");
        const target = scene.ships.get("enemy_0");
        target.angle = 0;
        target.isCloaked = false;
        target.shields = target.maxShields = 500;
        // From the target's side (not its tail): only the mark lever applies.
        const boltDamage = 10;
        const bolt = () =>
          createProjectile(
            target.x - 5,
            target.y,
            90,
            attacker.id,
            side,
            boltDamage,
          );
        // The wingmen's mark assist may already hold a mark: move it away.
        scene.botFleet.markTarget(side, "nobody", scene.battleClockMs);
        const unmarked = scene.projectileHitDamage(bolt(), attacker, target);
        scene.botFleet.markTarget(side, target.id, scene.battleClockMs);
        const marked = scene.projectileHitDamage(bolt(), attacker, target);
        const before = target.shields;
        scene.resolveProjectileHit(bolt(), target);
        return {
          bonus: boltDamage * (PROJECTILE_MARK_DAMAGE_MULTIPLIER - 1),
          unmarked,
          marked,
          dealt: before - target.shields,
        };
      },
      { key: SCENE, side: PLAYER_FACTION },
    );
    expect(result.marked - result.unmarked).toBe(result.bonus);
    expect(result.dealt).toBe(result.marked);
  });
});
