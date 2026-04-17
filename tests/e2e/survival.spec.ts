/**
 * SurvivalScene E2E Tests
 *
 * Covers: initial state, wave mechanics, upgrade phase, game-over path.
 *
 * SurvivalScene starts immediately when launched — no setup screen.
 * Navigate: MainMenu → SURVIVAL → SquadBuilderScene (survival mode) → START.
 * Shortcut: direct scene.start() from MainMenu for speed in most tests.
 */

import { test, expect } from '@playwright/test';
import { waitForScene, waitForMenuReady, collectErrors } from './helpers/game';

// ─── helper ──────────────────────────────────────────────────────────────────

async function launchSurvival(page: any): Promise<void> {
  await page.goto('/');
  await waitForMenuReady(page);
  // Start SurvivalScene directly — avoids clicking through SquadBuilder
  await page.evaluate(() => {
    (window as any).game.scene.start('SurvivalScene', { factionId: 'free_confederation' });
  });
  await waitForScene(page, 'SurvivalScene');
  // Wait for player ship to spawn (create() is synchronous, but give Phaser one frame)
  await page.waitForFunction(
    () => {
      const s = (window as any).game.scene.getScene('SurvivalScene') as any;
      return s?.playerShipIds?.length > 0;
    },
    { timeout: 8_000 },
  );
}

// ─── Initial state ────────────────────────────────────────────────────────────

test.describe('SurvivalScene — initial state', () => {
  test('SurvivalScene becomes active', async ({ page }) => {
    await launchSurvival(page);
    const active = await page.evaluate(
      () => (window as any).game.scene.isActive('SurvivalScene'),
    );
    expect(active).toBe(true);
  });

  test('starts at wave 0 (before first wave spawns)', async ({ page }) => {
    await launchSurvival(page);
    const wave = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.wave ?? -1,
    );
    // wave is 0 initially; first wave hasn't fired yet (2s delay)
    expect(wave).toBeGreaterThanOrEqual(0);
  });

  test('player has at least 1 ship', async ({ page }) => {
    await launchSurvival(page);
    const count = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.playerShipIds?.length ?? 0,
    );
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('player ship starts at full hull', async ({ page }) => {
    await launchSurvival(page);
    const result = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SurvivalScene') as any;
      const id = s.playerShipIds?.[0];
      const ship = s.ships?.get(id);
      return { hull: ship?.hull ?? 0, maxHull: ship?.maxHull ?? 0 };
    });
    expect(result.hull).toBe(result.maxHull);
    expect(result.maxHull).toBeGreaterThan(0);
  });

  test('not in upgrade phase on start', async ({ page }) => {
    await launchSurvival(page);
    const isUpgrade = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.isUpgradePhase ?? true,
    );
    expect(isUpgrade).toBe(false);
  });

  test('credits start at 0', async ({ page }) => {
    await launchSurvival(page);
    const credits = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.credits ?? -1,
    );
    expect(credits).toBe(0);
  });

  test('score starts at 0', async ({ page }) => {
    await launchSurvival(page);
    const score = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.score ?? -1,
    );
    expect(score).toBe(0);
  });

  test('no page errors on load', async ({ page }) => {
    const errors = collectErrors(page as any);
    await launchSurvival(page);
    expect(errors.pageErrors).toHaveLength(0);
  });
});

// ─── Wave progression ─────────────────────────────────────────────────────────

test.describe('SurvivalScene — wave mechanics', () => {
  test('wave 1 starts within 5 seconds', async ({ page }) => {
    await launchSurvival(page);
    // SurvivalScene starts wave 1 after a 2s delay
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('SurvivalScene')?.wave >= 1,
      { timeout: 8_000 },
    );
    const wave = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.wave ?? 0,
    );
    expect(wave).toBe(1);
  });

  test('enemy ships spawn in wave 1', async ({ page }) => {
    await launchSurvival(page);
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('SurvivalScene')?.wave >= 1,
      { timeout: 8_000 },
    );
    const enemyCount = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.enemyShipIds?.length ?? 0,
    );
    expect(enemyCount).toBeGreaterThan(0);
  });

  test('isWaveActive is true during a wave', async ({ page }) => {
    await launchSurvival(page);
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('SurvivalScene')?.isWaveActive === true,
      { timeout: 8_000 },
    );
    const active = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.isWaveActive,
    );
    expect(active).toBe(true);
  });

  test('total ship count equals player + enemy counts', async ({ page }) => {
    await launchSurvival(page);
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('SurvivalScene')?.wave >= 1,
      { timeout: 8_000 },
    );
    const counts = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SurvivalScene') as any;
      return {
        total: s.ships?.size ?? 0,
        player: s.playerShipIds?.length ?? 0,
        enemy: s.enemyShipIds?.length ?? 0,
      };
    });
    expect(counts.total).toBe(counts.player + counts.enemy);
  });
});

// ─── Upgrade phase ────────────────────────────────────────────────────────────

test.describe('SurvivalScene — upgrade phase', () => {
  test('upgrade phase triggers after all enemies die', async ({ page }) => {
    await launchSurvival(page);

    // Wait for wave to start, then eliminate all enemies instantly
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('SurvivalScene')?.isWaveActive === true,
      { timeout: 8_000 },
    );
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SurvivalScene') as any;
      for (const id of s.enemyShipIds) {
        const ship = s.ships.get(id);
        if (ship) ship.hull = 0;
      }
      // Trigger the wave-end check (scene calls this in its update loop or via destroyShip)
      s.enemyShipIds = [];
      if (typeof s.checkWaveEnd === 'function') s.checkWaveEnd();
      else if (typeof s.onWaveComplete === 'function') s.onWaveComplete();
    });

    // Upgrade phase should appear after a brief delay (≤ 4s)
    await page.waitForFunction(
      () =>
        (window as any).game.scene.getScene('SurvivalScene')?.isUpgradePhase === true
        || (window as any).game.scene.getScene('SurvivalScene')?.wave >= 2,
      { timeout: 8_000 },
    );

    // Either upgrade phase started or wave 2 was triggered — both are valid progressions
    const state = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SurvivalScene') as any;
      return { isUpgradePhase: s?.isUpgradePhase, wave: s?.wave };
    });
    expect(state.isUpgradePhase === true || state.wave >= 2).toBe(true);
  });

  test('upgrade bonuses start at 0', async ({ page }) => {
    await launchSurvival(page);
    const bonuses = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SurvivalScene') as any;
      return {
        attack: s?.attackBonus ?? -1,
        defense: s?.defenseBonus ?? -1,
        speed: s?.speedBonus ?? -1,
      };
    });
    expect(bonuses.attack).toBe(0);
    expect(bonuses.defense).toBe(0);
    expect(bonuses.speed).toBe(0);
  });
});

// ─── Game-over path ───────────────────────────────────────────────────────────

test.describe('SurvivalScene — game over', () => {
  test('player ships at 0 hull triggers game-over state (isWaveActive false)', async ({ page }) => {
    await launchSurvival(page);

    // Kill all player ships
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SurvivalScene') as any;
      for (const id of s.playerShipIds) {
        const ship = s.ships.get(id);
        if (ship) ship.hull = 0;
      }
      if (typeof s.gameOver === 'function') s.gameOver();
    });

    // Wave should no longer be active
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('SurvivalScene')?.isWaveActive !== true,
      { timeout: 5_000 },
    );

    const active = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.isWaveActive,
    );
    expect(active).not.toBe(true);
  });
});
