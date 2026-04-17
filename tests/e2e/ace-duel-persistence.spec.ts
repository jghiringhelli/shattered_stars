/**
 * AceDuelScene Persistence E2E Tests
 *
 * Verifies that completed matchups are saved to and loaded from localStorage
 * under key `shattered_stars_ace_duel` (JSON array of matchup ID strings).
 *
 * Win flow: playerSide wins 2 rounds → endMatch() → completedMatchups.add(id)
 * → localStorage.setItem('shattered_stars_ace_duel', JSON.stringify([...]))
 * `endMatch()` is private but callable at runtime (TypeScript private is compile-time only).
 */

import { test, expect } from '@playwright/test';
import { waitForScene, waitForMenuReady, clickMenuItem, collectErrors } from './helpers/game';

const STORAGE_KEY = 'shattered_stars_ace_duel';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function launchAceDuel(page: any): Promise<void> {
  await page.goto('/');
  await waitForMenuReady(page);
  await clickMenuItem(page, 'ACE DUEL');
  await waitForScene(page, 'AceDuelScene');
  await page.waitForFunction(
    () => (window as any).game.scene.getScene('AceDuelScene')?.isSetupPhase === true,
    { timeout: 5_000 },
  );
}

async function clearStorage(page: any): Promise<void> {
  await page.evaluate((key: string) => window.localStorage.removeItem(key), STORAGE_KEY);
}

async function getStoredMatchups(page: any): Promise<string[]> {
  return page.evaluate(
    (key: string) => JSON.parse(window.localStorage.getItem(key) ?? '[]'),
    STORAGE_KEY,
  );
}

/** Force a player win by setting side wins and calling endMatch(). */
async function forcePlayerWin(page: any): Promise<void> {
  await page.evaluate(() => {
    const s = (window as any).game.scene.getScene('AceDuelScene') as any;
    s.playerSide = 1;
    s.side1Wins = 2;
    s.side2Wins = 0;
    if (typeof s.endMatch === 'function') s.endMatch();
  });
  await page.waitForFunction(
    () => (window as any).game.scene.getScene('AceDuelScene')?.matchComplete === true,
    { timeout: 8_000 },
  );
}

// ─── Initial state ────────────────────────────────────────────────────────────

test.describe('AceDuel persistence — initial state', () => {
  test('localStorage is absent before any win', async ({ page }) => {
    await launchAceDuel(page);
    await clearStorage(page);

    const stored = await page.evaluate(
      (key: string) => window.localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(stored).toBeNull();
  });

  test('completedMatchups Set is empty at scene start', async ({ page }) => {
    await launchAceDuel(page);
    await clearStorage(page);
    // Reload to clear the in-memory Set (since it's loaded in create())
    await page.reload();
    await waitForMenuReady(page);
    await clickMenuItem(page, 'ACE DUEL');
    await waitForScene(page, 'AceDuelScene');
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('AceDuelScene')?.isSetupPhase === true,
    );

    const size = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.completedMatchups?.size ?? -1,
    );
    expect(size).toBe(0);
  });
});

// ─── Win registration ─────────────────────────────────────────────────────────

test.describe('AceDuel persistence — win registration', () => {
  test('winning a match saves matchup ID to localStorage', async ({ page }) => {
    await launchAceDuel(page);
    await clearStorage(page);

    const matchupId = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.selectedMatchup?.id ?? null,
    );
    expect(matchupId).not.toBeNull();

    await forcePlayerWin(page);

    const stored = await getStoredMatchups(page);
    expect(stored).toContain(matchupId);
  });

  test('matchComplete is true after win', async ({ page }) => {
    await launchAceDuel(page);
    await clearStorage(page);
    await forcePlayerWin(page);

    const complete = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.matchComplete,
    );
    expect(complete).toBe(true);
  });

  test('losing a match does NOT save to localStorage', async ({ page }) => {
    await launchAceDuel(page);
    await clearStorage(page);

    // Force a loss (player side 1, side 2 wins)
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('AceDuelScene') as any;
      s.playerSide = 1;
      s.side1Wins = 0;
      s.side2Wins = 2;
      if (typeof s.endMatch === 'function') s.endMatch();
    });
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('AceDuelScene')?.matchComplete === true,
      { timeout: 8_000 },
    );

    const stored = await getStoredMatchups(page);
    expect(stored).toHaveLength(0);
  });

  test('winning multiple different matchups stores all IDs', async ({ page }) => {
    await launchAceDuel(page);
    await clearStorage(page);

    const matchups = ['elite_fighters', 'interceptor_duel'] as const;
    for (const id of matchups) {
      // Restart scene fresh for each win
      await page.evaluate((mid: string) => {
        const s = (window as any).game.scene.getScene('AceDuelScene') as any;
        // ACE_MATCHUPS is module-level, not an instance property — set id directly
        s.selectedMatchup = { id: mid };
        s.matchComplete = false;
        s.playerSide = 1;
        s.side1Wins = 2;
        s.side2Wins = 0;
        if (typeof s.endMatch === 'function') s.endMatch();
      }, id);
      await page.waitForFunction(
        () => (window as any).game.scene.getScene('AceDuelScene')?.matchComplete === true,
        { timeout: 8_000 },
      );
      // Reset matchComplete so second win can be registered
      await page.evaluate(
        () => ((window as any).game.scene.getScene('AceDuelScene') as any).matchComplete = false,
      );
    }

    const stored = await getStoredMatchups(page);
    for (const id of matchups) {
      expect(stored).toContain(id);
    }
  });
});

// ─── Persistence across reload ────────────────────────────────────────────────

test.describe('AceDuel persistence — survives reload', () => {
  test('completed matchup is still in localStorage after page reload', async ({ page }) => {
    await launchAceDuel(page);
    await clearStorage(page);

    const matchupId = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.selectedMatchup?.id,
    );
    await forcePlayerWin(page);

    // Reload
    await page.reload();
    await waitForMenuReady(page);

    const stored = await getStoredMatchups(page);
    expect(stored).toContain(matchupId);
  });

  test('completedMatchups Set is populated from localStorage on scene start', async ({ page }) => {
    // Seed localStorage before opening the scene
    await page.goto('/');
    await waitForMenuReady(page);
    await page.evaluate(
      ([key, data]: [string, string]) => window.localStorage.setItem(key, data),
      [STORAGE_KEY, JSON.stringify(['elite_fighters', 'heavy_duel'])] as [string, string],
    );

    await clickMenuItem(page, 'ACE DUEL');
    await waitForScene(page, 'AceDuelScene');
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('AceDuelScene')?.isSetupPhase === true,
    );

    const size = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.completedMatchups?.size ?? 0,
    );
    expect(size).toBe(2);

    const hasElite = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.completedMatchups?.has('elite_fighters'),
    );
    expect(hasElite).toBe(true);
  });

  test('no page errors through win + reload cycle', async ({ page }) => {
    const errors = collectErrors(page as any);
    await launchAceDuel(page);
    await clearStorage(page);
    await forcePlayerWin(page);
    await page.reload();
    await waitForMenuReady(page);
    expect(errors.pageErrors).toHaveLength(0);
  });
});
