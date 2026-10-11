/**
 * Survival wave-escalation E2E — threat-driven sizing (ADR-0003/ADR-0004).
 *
 * Wave composition scales with fleet threat (computeThreat) times the
 * battle node's multiplier (sector, row, ascension); the run controller owns
 * the level, so waves advance via startNextWave(). Sector bosses arrive on
 * the last wave of a boss node.
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

// ─── Sector boss ──────────────────────────────────────────────────────────────

test.describe("SurvivalScene — sector boss", () => {
  test("a boss node sends a high-hull boss with phases on its last wave", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMenuReady(page);
    await page.evaluate(async () => {
      const game = (window as any).game;
      const { runServiceOf } =
        await import("/src/systems/survival/RoguelikeRunService.ts");
      const svc = runServiceOf(game.registry) as any;
      const run = svc.startRun({
        faction: "free_confederation",
        flagshipId: "confed_wasp",
        loadoutId: null,
        ascension: 0,
        seed: 99,
      });
      const first = run.map.rows[0][0].id;
      svc.apply((r: any) => ({
        ...r,
        map: {
          ...r.map,
          rows: r.map.rows.map((row: any[]) =>
            row.map((n: any) => (n.id === first ? { ...n, type: "boss" } : n)),
          ),
        },
        activeNodeId: first,
        activeKind: "boss",
        path: [first],
      }));
      game.scene.start("SurvivalScene", {
        factionId: "free_confederation",
        fromRun: true,
      });
    });
    await waitForScene(page, "SurvivalScene");
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.isWaveActive === true,
      undefined,
      { timeout: 10_000 },
    );
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      for (const id of [...s.enemyShipIds]) s.ships.delete(id);
      s.enemyShipIds = [];
      s.startNextWave();
    });
    const result = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      const boss = [...s.ships.values()].find((sh: any) =>
        String(sh.id).startsWith("boss_"),
      );
      return {
        kind: s.rules.plan.kind,
        phases: s.rules.plan.bossPhases,
        bossHull: boss?.maxHull ?? 0,
        equippedHull: boss?.combatStats.maxHull ?? Infinity,
        tracked: boss ? s.bossPhases.get(boss.id) : undefined,
      };
    });
    expect(result.kind).toBe("boss");
    expect(result.phases).toBeGreaterThanOrEqual(1);
    expect(result.tracked).toBe(1);
    // Boss hull is its equipped (already scaled) hull multiplied 2+ times.
    expect(result.bossHull).toBeGreaterThanOrEqual(2 * result.equippedHull);
  });
});

// ─── Spawns inside the belt, Drive applied once ───────────────────────────────

test.describe("SurvivalScene — spawn arc and Drive", () => {
  test("every wave up to 12 spawns inside the safe radius, facing the centre", async ({
    page,
  }) => {
    await launchSurvival(page);
    const results = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      const c = 3000;
      const out: {
        wave: number;
        worst: number;
        safe: number;
        facing: number;
      }[] = [];
      for (let w = 0; w < 12; w++) {
        for (const id of [...s.enemyShipIds]) s.ships.delete(id);
        s.enemyShipIds = [];
        s.startNextWave();
        let worst = 0;
        let facing = 0;
        for (const id of s.enemyShipIds) {
          const sh = s.ships.get(id);
          worst = Math.max(worst, Math.hypot(sh.x - c, sh.y - c));
          const toCenter =
            ((Math.atan2(c - sh.y, c - sh.x) * 180) / Math.PI + 90 + 360) % 360;
          facing = Math.max(
            facing,
            Math.abs(((sh.angle - toCenter + 540) % 360) - 180),
          );
        }
        out.push({
          wave: s.wave,
          worst,
          safe: s.beltConfig.safeRadius,
          facing,
        });
      }
      return out;
    });
    for (const r of results) {
      expect(r.worst).toBeLessThan(r.safe);
      expect(r.facing).toBeLessThan(1);
    }
  });

  test("Drive powers raise flagship and escort top speed once, however often re-applied", async ({
    page,
  }) => {
    await launchSurvival(page);
    const speeds = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      const anchor = s.ships.get(s.playerShipIds[0]);
      const escort = s.spawnPlayerShip(
        {
          definitionId: anchor.definitionId,
          x: anchor.x + 80,
          y: anchor.y + 50,
          loadoutId: null,
        },
        true,
      );
      const read = () =>
        s.playerShipIds.map(
          (id: string) => s.ships.get(id).flight.motion.control.maxSpeed,
        );
      const before = read();
      s.run.state.bonuses.speed = 4;
      s.applyBonusesToFleet();
      const once = read();
      s.applyBonusesToFleet();
      s.applyBonusesToFleet();
      return {
        before,
        once,
        again: read(),
        boost: [anchor, escort].map(
          (sh: any) => sh.modifiers.boostCooldownMultiplier,
        ),
      };
    });
    expect(speeds.once).toEqual(speeds.before.map((v: number) => v + 1));
    expect(speeds.again).toEqual(speeds.once);
    for (const b of speeds.boost) expect(b).toBeCloseTo(0.85 ** 3);
  });
});
