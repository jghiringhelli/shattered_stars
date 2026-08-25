/**
 * SurvivalScene E2E — roguelite leveling (ADR-0003).
 *
 * Covers the controller + choice-panel wiring that replaced the old credits shop:
 * initial state, wave spawning, the power draft after a regular wave, the
 * milestone Hangar, applying a choice, and the game-over path.
 *
 * SurvivalScene starts immediately when launched — no setup screen.
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

/** Clear the current wave and force the wave-complete check to run now. */
async function clearWave(page: any): Promise<void> {
  await page.evaluate(() => {
    const s = (window as any).game.scene.getScene("SurvivalScene") as any;
    for (const id of s.enemyShipIds) {
      const ship = s.ships.get(id);
      if (ship) ship.hull = 0;
    }
    s.enemyShipIds = [];
    s.checkWaveComplete();
  });
}

/** Trigger the first choice card by emitting its interactive pointerdown. */
async function clickFirstCard(page: any): Promise<void> {
  await page.evaluate(() => {
    const s = (window as any).game.scene.getScene("SurvivalScene") as any;
    const container = s.choicePanel.container;
    const groups = container.list.filter((o: any) => o.type === "Container");
    const group = groups[0];
    const hit = group.list[group.list.length - 1];
    hit.emit("pointerdown");
  });
}

/**
 * Resolves every sequential choice panel of a wave. Each wave now presents two
 * parallel decisions (the power draft / Hangar, then the escort track), shown
 * one panel after the other; this clicks the first card of each until the
 * choice phase ends.
 */
async function clickThroughChoices(page: any): Promise<void> {
  for (let i = 0; i < 2; i++) {
    const open = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      return s?.isChoicePhase === true && s?.choicePanel?.isOpen === true;
    });
    if (!open) break;
    await clickFirstCard(page);
  }
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

  test("starts at score 0 and not in a choice phase", async ({ page }) => {
    await launchSurvival(page);
    const state = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      return { score: s.score, choicePhase: s.isChoicePhase };
    });
    expect(state.score).toBe(0);
    expect(state.choicePhase).toBe(false);
  });

  test("no page errors on load", async ({ page }) => {
    const errors = collectErrors(page as any);
    await launchSurvival(page);
    expect(errors.pageErrors).toHaveLength(0);
  });
});

// ─── Wave spawning ────────────────────────────────────────────────────────────

test.describe("SurvivalScene — waves", () => {
  test("wave 1 starts and spawns enemies", async ({ page }) => {
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
});

// ─── Power draft (regular level) ──────────────────────────────────────────────

test.describe("SurvivalScene — power draft", () => {
  test("clearing a regular wave opens the power draft panel", async ({
    page,
  }) => {
    await launchSurvival(page);
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.isWaveActive === true,
      { timeout: 8_000 },
    );
    await clearWave(page);
    await page.waitForFunction(
      () => {
        const s = (window as any).game.scene.getScene("SurvivalScene") as any;
        return s?.isChoicePhase === true && s?.choicePanel?.isOpen === true;
      },
      { timeout: 6_000 },
    );
    const open = await page.evaluate(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.choicePanel?.isOpen,
    );
    expect(open).toBe(true);
  });

  test("picking a power invests in the run and resumes into the next wave", async ({
    page,
  }) => {
    await launchSurvival(page);
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.isWaveActive === true,
      { timeout: 8_000 },
    );
    await clearWave(page);
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.choicePanel?.isOpen === true,
      { timeout: 6_000 },
    );

    const before = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      const st = s.run.state;
      const invested = Object.values(st.branch).reduce(
        (a: number, b: any) => a + b,
        0,
      );
      return { invested, escorts: st.escorts, rerolls: st.rerolls };
    });

    await clickThroughChoices(page);

    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.isChoicePhase === false,
      { timeout: 6_000 },
    );
    const after = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      const st = s.run.state;
      const invested = Object.values(st.branch).reduce(
        (a: number, b: any) => a + b,
        0,
      );
      return {
        invested,
        escorts: st.escorts,
        rerolls: st.rerolls,
        wave: s.wave,
        active: s.isWaveActive,
      };
    });

    // A regular-level draft always advances the run in some way.
    const advanced =
      after.invested > before.invested ||
      after.escorts > before.escorts ||
      after.rerolls > before.rerolls;
    expect(advanced).toBe(true);
    expect(after.wave).toBe(2);
    expect(after.active).toBe(true);
  });
});

// ─── Milestone Hangar ─────────────────────────────────────────────────────────

test.describe("SurvivalScene — hangar", () => {
  test("hangar opens with options and a choice resumes the run", async ({
    page,
  }) => {
    await launchSurvival(page);
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      s.isWaveActive = false;
      s.showHangar();
    });
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.choicePanel?.isOpen === true,
      { timeout: 6_000 },
    );
    const opened = await page.evaluate(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.isChoicePhase,
    );
    expect(opened).toBe(true);

    await clickThroughChoices(page);
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.isChoicePhase === false,
      { timeout: 6_000 },
    );
    const resumed = await page.evaluate(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.isWaveActive,
    );
    expect(resumed).toBe(true);
  });
});

// ─── Game over ────────────────────────────────────────────────────────────────

test.describe("SurvivalScene — game over", () => {
  test("losing all player ships ends the wave", async ({ page }) => {
    await launchSurvival(page);
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      for (const id of s.playerShipIds) {
        const ship = s.ships.get(id);
        if (ship) ship.hull = 0;
      }
      s.checkWaveComplete();
    });
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.isWaveActive !== true,
      { timeout: 5_000 },
    );
    const active = await page.evaluate(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.isWaveActive,
    );
    expect(active).not.toBe(true);
  });
});
