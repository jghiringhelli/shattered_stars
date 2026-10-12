/**
 * SurvivalScene E2E — a battle node of the Survival roguelite (ADR-0004).
 *
 * Launched straight (menus, quick play) SurvivalScene starts a quick run
 * whose first combat node is already entered: the node's waves arrive one
 * after the other, clearing the last returns to the sector map where the
 * power draft (with spendable rerolls) waits; losing the fleet ends the run.
 */

import { test, expect } from "@playwright/test";
import { waitForScene, waitForMenuReady, collectErrors } from "./helpers/game";

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

/** Starts a run whose first node is forced to `kind`, straight into battle. */
async function launchNode(page: any, kind: string): Promise<void> {
  await page.goto("/");
  await waitForMenuReady(page);
  await page.evaluate(async (nodeKind: string) => {
    const game = (window as any).game;
    const { runServiceOf } =
      await import("/src/systems/survival/RoguelikeRunService.ts");
    const svc = runServiceOf(game.registry) as any;
    const run = svc.startRun({
      faction: "free_confederation",
      flagshipId: "confed_wasp",
      loadoutId: null,
      ascension: 0,
      seed: 77,
    });
    const first = run.map.rows[0][0].id;
    svc.apply((r: any) => ({
      ...r,
      activeNodeId: first,
      activeKind: nodeKind,
      path: [first],
    }));
    game.scene.start("SurvivalScene", {
      factionId: "free_confederation",
      fromRun: true,
    });
  }, kind);
  await waitForScene(page, "SurvivalScene");
}

/** Kills the current wave through the scene's own destroy path. */
async function clearWave(page: any): Promise<void> {
  await page.waitForFunction(
    () => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      return s?.isWaveActive === true && s.enemyShipIds.length > 0;
    },
    undefined,
    { timeout: 15_000 },
  );
  await page.evaluate(() => {
    const s = (window as any).game.scene.getScene("SurvivalScene") as any;
    for (const id of [...s.enemyShipIds]) s.destroyShip(id, true);
    s.checkWaveComplete();
  });
}

/** Clicks the first enabled card of the map's open choice panel. */
async function clickMapCard(page: any, index = 0): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as any).game.scene.getScene("SurvivalMapScene")?.choicePanel
        ?.isOpen === true,
    undefined,
    { timeout: 8_000 },
  );
  await page.evaluate((i: number) => {
    const s = (window as any).game.scene.getScene("SurvivalMapScene") as any;
    const groups = s.choicePanel.container.list.filter(
      (o: any) => o.type === "Container",
    );
    const group = groups[i];
    group.list[group.list.length - 1].emit("pointerdown");
  }, index);
}

// ─── Initial state ────────────────────────────────────────────────────────────

test.describe("SurvivalScene — initial state", () => {
  test("becomes active with at least one player ship at full hull", async ({
    page,
  }) => {
    await launchSurvival(page);
    const result = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      const id = s.playerShipIds?.[0];
      const ship = s.ships?.get(id);
      return {
        active: (window as any).game.scene.isActive("SurvivalScene"),
        ships: s.playerShipIds?.length ?? 0,
        hull: ship?.hull ?? 0,
        maxHull: ship?.maxHull ?? 0,
      };
    });
    expect(result.active).toBe(true);
    expect(result.ships).toBeGreaterThanOrEqual(1);
    expect(result.hull).toBe(result.maxHull);
    expect(result.maxHull).toBeGreaterThan(0);
  });

  test("starts a quick run on its first combat node", async ({ page }) => {
    await launchSurvival(page);
    const state = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      return {
        score: s.score,
        kind: s.rules.plan.kind,
        sector: s.rules.plan.sector,
        enemy: s.rules.plan.enemyFaction,
        saved: s.service.hasSavedRun(),
      };
    });
    expect(state.score).toBe(0);
    expect(state.kind).toBe("combat");
    expect(state.sector).toBe(1);
    expect(state.enemy).not.toBe("free_confederation");
    expect(state.saved).toBe(true);
  });

  test("no page errors on load", async ({ page }) => {
    const errors = collectErrors(page as any);
    await launchSurvival(page);
    expect(errors.pageErrors).toHaveLength(0);
  });
});

// ─── Wave spawning ────────────────────────────────────────────────────────────

test.describe("SurvivalScene — waves", () => {
  test("wave 1 of the node starts and spawns enemies", async ({ page }) => {
    await launchSurvival(page);
    await page.waitForFunction(
      () => {
        const s = (window as any).game.scene.getScene("SurvivalScene") as any;
        return s?.wave >= 1 && (s?.enemyShipIds?.length ?? 0) > 0;
      },
      { timeout: 8_000 },
    );
    const state = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      return {
        wave: s.wave,
        enemies: s.enemyShipIds.length,
        active: s.isWaveActive,
        total: s.ships.size,
        player: s.playerShipIds.length,
      };
    });
    expect(state.wave).toBe(1);
    expect(state.enemies).toBeGreaterThan(0);
    expect(state.active).toBe(true);
    expect(state.total).toBe(state.player + state.enemies);
  });

  test("clearing a wave that is not the last sends the next one", async ({
    page,
  }) => {
    // Every node kind is one wave today (ADR-0004); the scene still flies
    // multi-wave nodes, so give this combat node's plan a second wave
    // before its first wave arrives (2 s after the scene starts).
    await launchNode(page, "combat");
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      s.rules.plan.waves = 2;
    });
    await clearWave(page);
    await page.waitForFunction(
      () => {
        const s = (window as any).game.scene.getScene("SurvivalScene") as any;
        return s?.wave === 2 && s.isWaveActive === true;
      },
      undefined,
      { timeout: 8_000 },
    );
    const salvage = await page.evaluate(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any).rules
          .salvageEarned,
    );
    expect(salvage).toBeGreaterThan(0);
  });
});

// ─── Node cleared → map + power draft ─────────────────────────────────────────

test.describe("SurvivalScene — node cleared", () => {
  test("clearing the node returns to the map with a power draft", async ({
    page,
  }) => {
    await launchSurvival(page);
    await clearWave(page);
    await waitForScene(page, "SurvivalMapScene", 10_000);
    const before = await page.evaluate(() => {
      const map = (window as any).game.scene.getScene(
        "SurvivalMapScene",
      ) as any;
      const run = map.run;
      const invested = Object.values(run.progression.branch).reduce(
        (a: number, b: any) => a + b,
        0,
      );
      return {
        invested,
        pending: run.pendingRewards.map((r: any) => r.kind),
        cleared: run.stats.nodesCleared,
      };
    });
    expect(before.pending).toEqual(["power"]);
    expect(before.cleared).toBe(1);
    await clickMapCard(page, 0);
    const after = await page.evaluate(() => {
      const run = (
        (window as any).game.scene.getScene("SurvivalMapScene") as any
      ).run;
      return {
        invested: Object.values(run.progression.branch).reduce(
          (a: number, b: any) => a + b,
          0,
        ),
        pending: run.pendingRewards.length,
        bonuses: run.progression.bonuses,
      };
    });
    expect(after.pending).toBe(0);
    expect(after.invested).toBeGreaterThanOrEqual(before.invested as number);
  });

  test("a reroll card spends a reroll charge and redraws", async ({ page }) => {
    await launchSurvival(page);
    await clearWave(page);
    await waitForScene(page, "SurvivalMapScene", 10_000);
    const read = () =>
      page.evaluate(() => {
        const run = (
          (window as any).game.scene.getScene("SurvivalMapScene") as any
        ).run;
        return { rerolls: run.rerolls, spent: run.rerollsSpentHere };
      });
    const before = await read();
    expect(before.rerolls).toBeGreaterThan(0);
    await clickMapCard(page, 3);
    const after = await read();
    expect(after.rerolls).toBe(before.rerolls - 1);
    expect(after.spent).toBe(1);
  });
});

// ─── Boss rewards (Hangar) ────────────────────────────────────────────────────

test.describe("SurvivalMapScene — hangar", () => {
  test("a pending hangar reward opens the Hangar and graduates the hull", async ({
    page,
  }) => {
    await launchSurvival(page);
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      s.service.apply((r: any) => ({
        ...r,
        activeNodeId: null,
        activeKind: null,
        pendingRewards: [{ kind: "hangar" }],
      }));
      s.scene.start("SurvivalMapScene");
    });
    await waitForScene(page, "SurvivalMapScene");
    await clickMapCard(page, 0);
    const hull = await page.evaluate(
      () =>
        ((window as any).game.scene.getScene("SurvivalMapScene") as any).run
          .progression.hull,
    );
    expect(hull).toBe("ace");
  });
});

// ─── Game over ────────────────────────────────────────────────────────────────

test.describe("SurvivalScene — game over", () => {
  test("losing all player ships ends the run into the summary", async ({
    page,
  }) => {
    await launchSurvival(page);
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      for (const id of [...s.playerShipIds]) s.destroyShip(id, false);
      s.checkWaveComplete();
    });
    await waitForScene(page, "SurvivalSummaryScene", 10_000);
    const meta = await page.evaluate(
      () => (window as any).game.registry.get("survivalRunService").meta,
    );
    expect(meta.history[0].outcome).toBe("defeat");
    expect(meta.history[0].cause).toContain("Destroyed by");
  });
});
