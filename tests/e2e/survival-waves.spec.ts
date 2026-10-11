/**
 * Survival wave-escalation E2E — threat-driven sizing (ADR-0003).
 *
 * Wave composition now scales with fleet threat (computeThreat), not a fixed tier
 * table: enemy count grows with level, milestone waves (every 5th) add a boss.
 * The run controller owns the level, so waves advance via startNextWave().
 */

import { test, expect } from "@playwright/test";
import { waitForScene, waitForMenuReady } from "./helpers/game";

async function launchSurvival(page: any): Promise<void> {
  await page.goto("/");
  await waitForMenuReady(page);
  await page.evaluate(() => {
    (window as any).game.scene.start("SurvivalScene", {
      factionId: "free_confederation",
    });
  });
  await waitForScene(page, "SurvivalScene");
  await page.waitForFunction(
    () =>
      ((window as any).game.scene.getScene("SurvivalScene") as any)
        ?.playerShipIds?.length > 0,
    { timeout: 8_000 },
  );
}

/** Advance the controller to a given wave number by clearing + restarting waves. */
async function advanceToWave(page: any, target: number): Promise<void> {
  await page.evaluate((n: number) => {
    const s = (window as any).game.scene.getScene("SurvivalScene") as any;
    const clearEnemies = () => {
      for (const id of [...s.enemyShipIds]) s.ships.delete(id);
      s.enemyShipIds = [];
    };
    while (s.run.level < n) {
      clearEnemies();
      s.isChoicePhase = false;
      s.startNextWave();
    }
  }, target);
  await page.waitForFunction(
    (n: number) => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      return s?.run?.level === n && (s?.enemyShipIds?.length ?? 0) > 0;
    },
    target,
    { timeout: 10_000 },
  );
}

function enemyCount(page: any): Promise<number> {
  return page.evaluate(
    () =>
      ((window as any).game.scene.getScene("SurvivalScene") as any)
        ?.enemyShipIds?.length ?? 0,
  );
}

// ─── Wave number ──────────────────────────────────────────────────────────────

test.describe("SurvivalScene — wave escalation", () => {
  test("startNextWave advances the controller level", async ({ page }) => {
    await launchSurvival(page);
    await advanceToWave(page, 3);
    const level = await page.evaluate(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)?.run
          ?.level,
    );
    expect(level).toBe(3);
  });

  test("every wave spawns at least one enemy", async ({ page }) => {
    await launchSurvival(page);
    await advanceToWave(page, 2);
    expect(await enemyCount(page)).toBeGreaterThanOrEqual(1);
  });

  test("later waves are at least as large as early waves", async ({ page }) => {
    await launchSurvival(page);
    await advanceToWave(page, 2);
    const early = await enemyCount(page);
    await advanceToWave(page, 8);
    const later = await enemyCount(page);
    expect(later).toBeGreaterThanOrEqual(early);
  });

  test("enemy count never exceeds the hard cap", async ({ page }) => {
    await launchSurvival(page);
    await advanceToWave(page, 12);
    // MAX_ENEMIES (40) + elites + a possible boss — comfortably under 60.
    expect(await enemyCount(page)).toBeLessThanOrEqual(60);
  });
});

// ─── Milestone boss ───────────────────────────────────────────────────────────

test.describe("SurvivalScene — milestone boss", () => {
  test("wave 5 is a milestone and spawns a high-hull boss", async ({
    page,
  }) => {
    await launchSurvival(page);
    await advanceToWave(page, 5);
    const result = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      const boss = [...s.ships.values()].find((sh: any) =>
        String(sh.id).startsWith("boss_"),
      );
      return {
        milestone: s.run.isMilestone,
        bossHull: boss?.maxHull ?? 0,
        equippedHull: boss?.combatStats.maxHull ?? Infinity,
      };
    });
    expect(result.milestone).toBe(true);
    // Boss hull is its equipped (already x4-scaled) hull multiplied 2+ times.
    expect(result.bossHull).toBeGreaterThanOrEqual(2 * result.equippedHull);
  });
});
