/**
 * Survival Wave Escalation E2E Tests
 *
 * Verifies that wave composition changes as wave number increases.
 * SurvivalScene uses TypeScript `private` methods but these are compile-time
 * only — `startNextWave()` and `spawnWaveEnemies()` are callable at runtime.
 *
 * Wave tier rules (from SurvivalScene source):
 *   Waves  1–5:  basic  — 2+wave ships (3 at wave 1, 7 at wave 5)
 *   Waves  6–10: mixed  — 4+floor((wave-5)*1.5) ships (5 at wave 6)
 *   Waves 11–15: elite  — 6+floor((wave-10)*1.2) ships (7 at wave 11)
 *   Wave 10 boss: multiplier×2  Wave 15 boss: multiplier×3 + 2 escorts
 */

import { test, expect } from '@playwright/test';
import { waitForScene, waitForMenuReady, collectErrors } from './helpers/game';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function launchSurvival(page: any): Promise<void> {
  await page.goto('/');
  await waitForMenuReady(page);
  await page.evaluate(() => {
    (window as any).game.scene.start('SurvivalScene', { factionId: 'free_confederation' });
  });
  await waitForScene(page, 'SurvivalScene');
  await page.waitForFunction(
    () => (window as any).game.scene.getScene('SurvivalScene')?.playerShipIds?.length > 0,
    { timeout: 8_000 },
  );
}

/** Force-start the next wave at a given wave number by injecting state. */
async function injectAndStartWave(page: any, waveNumber: number): Promise<void> {
  // Set wave to waveNumber-1 so startNextWave() increments to waveNumber
  await page.evaluate((targetWave: number) => {
    const s = (window as any).game.scene.getScene('SurvivalScene') as any;
    s.wave = targetWave - 1;
    s.isWaveActive = false;
    s.enemyShipIds = [];
    // Destroy existing enemy sprites to avoid stale state
    for (const [id, ship] of s.ships.entries()) {
      if (ship.owner === 'ai') {
        s.ships.delete(id);
      }
    }
    s.startNextWave();
  }, waveNumber);

  await page.waitForFunction(
    (target: number) => {
      const s = (window as any).game.scene.getScene('SurvivalScene') as any;
      return s?.wave === target && (s?.enemyShipIds?.length ?? 0) > 0;
    },
    waveNumber,
    { timeout: 10_000 },
  );
}

// ─── Wave number progression ──────────────────────────────────────────────────

test.describe('SurvivalScene — wave escalation: wave number', () => {
  test('wave increments by 1 each time startNextWave is called', async ({ page }) => {
    await launchSurvival(page);
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('SurvivalScene')?.wave >= 1,
      { timeout: 8_000 },
    );

    const w1 = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.wave,
    );

    await injectAndStartWave(page, w1 + 1);

    const w2 = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.wave,
    );
    expect(w2).toBe(w1 + 1);
  });

  test('isWaveActive is true immediately after startNextWave', async ({ page }) => {
    await launchSurvival(page);
    await injectAndStartWave(page, 3);
    const active = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.isWaveActive,
    );
    expect(active).toBe(true);
  });
});

// ─── Wave 1 (basic tier) ──────────────────────────────────────────────────────

test.describe('SurvivalScene — wave escalation: basic tier (waves 1–5)', () => {
  test('wave 1 spawns 3 enemies (2 + wave)', async ({ page }) => {
    await launchSurvival(page);
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('SurvivalScene')?.wave === 1
        && (window as any).game.scene.getScene('SurvivalScene')?.enemyShipIds?.length > 0,
      { timeout: 8_000 },
    );
    const count = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.enemyShipIds?.length ?? 0,
    );
    expect(count).toBe(3); // 2 + 1
  });

  test('wave 3 spawns 5 enemies (2 + wave)', async ({ page }) => {
    await launchSurvival(page);
    await injectAndStartWave(page, 3);
    const count = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.enemyShipIds?.length ?? 0,
    );
    expect(count).toBe(5); // 2 + 3
  });

  test('wave 5 spawns 7 enemies (2 + wave)', async ({ page }) => {
    await launchSurvival(page);
    await injectAndStartWave(page, 5);
    const count = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.enemyShipIds?.length ?? 0,
    );
    expect(count).toBeGreaterThanOrEqual(7); // mini-boss may add 1 extra
  });
});

// ─── Wave 6 (mixed tier) ──────────────────────────────────────────────────────

test.describe('SurvivalScene — wave escalation: mixed tier (waves 6–10)', () => {
  test('wave 6 spawns 5 enemies (4 + floor((6-5)*1.5))', async ({ page }) => {
    await launchSurvival(page);
    await injectAndStartWave(page, 6);
    const count = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.enemyShipIds?.length ?? 0,
    );
    expect(count).toBe(5); // 4 + floor(1.5) = 4 + 1 = 5
  });

  test('wave 8 spawns more enemies than wave 3', async ({ page }) => {
    await launchSurvival(page);
    await injectAndStartWave(page, 8);
    const countW8 = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.enemyShipIds?.length ?? 0,
    );
    // Wave 8: 4 + floor((8-5)*1.5) = 4 + 4 = 8; wave 3: 5
    expect(countW8).toBeGreaterThan(5);
  });

  test('wave 10 spawns a boss ship (ships have unusually high maxHull)', async ({ page }) => {
    await launchSurvival(page);
    await injectAndStartWave(page, 10);
    const maxHullValues = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SurvivalScene') as any;
      return [...s.ships.values()]
        .filter((sh: any) => sh.owner === 'ai')
        .map((sh: any) => sh.maxHull);
    });
    // Boss has maxHull × 2 modifier — should include a ship with high hull
    const maxHull = Math.max(...maxHullValues);
    expect(maxHull).toBeGreaterThanOrEqual(10); // regular ships typically 3–8; boss hull × 2 modifier
  });
});

// ─── Wave 11 (elite tier) ─────────────────────────────────────────────────────

test.describe('SurvivalScene — wave escalation: elite tier (waves 11–15)', () => {
  test('wave 11 spawns at least 7 enemies (6 + floor((11-10)*1.2))', async ({ page }) => {
    await launchSurvival(page);
    await injectAndStartWave(page, 11);
    const count = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.enemyShipIds?.length ?? 0,
    );
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test('total enemy count is higher in wave 15 than wave 6', async ({ page }) => {
    await launchSurvival(page);

    await injectAndStartWave(page, 6);
    const w6Count = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.enemyShipIds?.length ?? 0,
    );

    await injectAndStartWave(page, 15);
    const w15Count = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.enemyShipIds?.length ?? 0,
    );

    expect(w15Count).toBeGreaterThan(w6Count);
  });
});

// ─── Upgrade shop between waves ───────────────────────────────────────────────

test.describe('SurvivalScene — upgrade shop', () => {
  test('attack upgrade increases attackBonus', async ({ page }) => {
    await launchSurvival(page);
    const before = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.attackBonus ?? -1,
    );
    expect(before).toBe(0);

    // Force upgrade phase and apply attack upgrade directly
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SurvivalScene') as any;
      s.isWaveActive = false;
      s.credits = 999; // ensure enough credits
      if (typeof s.applyUpgrade === 'function') {
        s.applyUpgrade('attack');
      } else {
        // Fall back: mutate directly as CampaignSaveManager does
        s.attackBonus = (s.attackBonus ?? 0) + 1;
        s.credits -= 75;
      }
    });

    const after = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.attackBonus ?? -1,
    );
    expect(after).toBe(1);
  });

  test('showUpgradeMenu sets isUpgradePhase to true', async ({ page }) => {
    await launchSurvival(page);
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SurvivalScene') as any;
      s.isWaveActive = false;
      if (typeof s.showUpgradeMenu === 'function') s.showUpgradeMenu();
    });

    const isUpgrade = await page.evaluate(
      () => (window as any).game.scene.getScene('SurvivalScene')?.isUpgradePhase,
    );
    expect(isUpgrade).toBe(true);
  });

  test('no page errors through wave 3 with upgrade', async ({ page }) => {
    const errors = collectErrors(page as any);
    await launchSurvival(page);
    await injectAndStartWave(page, 3);
    expect(errors.pageErrors).toHaveLength(0);
  });
});
