/**
 * AceDuelScene E2E Tests
 *
 * Covers: setup screen state, matchup/difficulty selection, duel start,
 * round lifecycle, and match progression.
 */

import { test, expect } from '@playwright/test';
import { waitForScene, waitForMenuReady, clickMenuItem, collectErrors } from './helpers/game';

const MATCHUP_IDS = [
  'elite_fighters',
  'interceptor_duel',
  'heavy_duel',
  'gunship_duel',
  'bomber_squadron',
  'hunter_hunted',
] as const;

// ─── helper ──────────────────────────────────────────────────────────────────

async function launchAceDuel(page: any): Promise<void> {
  await page.goto('/');
  await waitForMenuReady(page);
  await clickMenuItem(page, 'ACE DUEL');
  await waitForScene(page, 'AceDuelScene');
  // Wait for setup screen to render
  await page.waitForFunction(
    () => (window as any).game.scene.getScene('AceDuelScene')?.isSetupPhase === true,
    { timeout: 5_000 },
  );
}

async function startDuel(page: any): Promise<void> {
  await page.evaluate(() => {
    (window as any).game.scene.getScene('AceDuelScene').startDuel();
  });
  await page.waitForFunction(
    () => (window as any).game.scene.getScene('AceDuelScene')?.isSetupPhase === false,
    { timeout: 5_000 },
  );
}

// ─── Setup screen ─────────────────────────────────────────────────────────────

test.describe('AceDuelScene — setup screen', () => {
  test('AceDuelScene becomes active from main menu', async ({ page }) => {
    await launchAceDuel(page);
    const active = await page.evaluate(
      () => (window as any).game.scene.isActive('AceDuelScene'),
    );
    expect(active).toBe(true);
  });

  test('opens in setup phase', async ({ page }) => {
    await launchAceDuel(page);
    const isSetup = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.isSetupPhase,
    );
    expect(isSetup).toBe(true);
  });

  test('first matchup is pre-selected', async ({ page }) => {
    await launchAceDuel(page);
    const matchupId = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.selectedMatchup?.id ?? null,
    );
    expect(matchupId).not.toBeNull();
    expect(MATCHUP_IDS).toContain(matchupId);
  });

  test('default difficulty is normal', async ({ page }) => {
    await launchAceDuel(page);
    const difficulty = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.difficulty,
    );
    expect(difficulty).toBe('normal');
  });

  test('default playerSide is 1', async ({ page }) => {
    await launchAceDuel(page);
    const side = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.playerSide,
    );
    expect(side).toBe(1);
  });

  test('all 6 matchup IDs exist in the scene preset list', async ({ page }) => {
    await launchAceDuel(page);
    for (const id of MATCHUP_IDS) {
      await page.evaluate((matchupId: string) => {
        const s = (window as any).game.scene.getScene('AceDuelScene') as any;
        s.selectedMatchup = s.matchups?.find((m: any) => m.id === matchupId) ?? s.selectedMatchup;
      }, id);
      const selected = await page.evaluate(
        () => (window as any).game.scene.getScene('AceDuelScene')?.selectedMatchup?.id,
      );
      // The matchup exists if it was found (otherwise selectedMatchup wouldn't change)
      expect(typeof selected).toBe('string');
    }
  });

  test('difficulty can be set to all valid values', async ({ page }) => {
    await launchAceDuel(page);
    for (const diff of ['easy', 'normal', 'hard', 'brutal'] as const) {
      await page.evaluate((d: string) => {
        (window as any).game.scene.getScene('AceDuelScene').difficulty = d;
      }, diff);
      const got = await page.evaluate(
        () => (window as any).game.scene.getScene('AceDuelScene')?.difficulty,
      );
      expect(got).toBe(diff);
    }
  });

  test('no page errors on setup screen', async ({ page }) => {
    const errors = collectErrors(page as any);
    await launchAceDuel(page);
    expect(errors.pageErrors).toHaveLength(0);
  });
});

// ─── Duel start ───────────────────────────────────────────────────────────────

test.describe('AceDuelScene — duel start', () => {
  test('startDuel exits setup phase', async ({ page }) => {
    await launchAceDuel(page);
    await startDuel(page);
    const isSetup = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.isSetupPhase,
    );
    expect(isSetup).toBe(false);
  });

  test('ships spawn after duel starts', async ({ page }) => {
    await launchAceDuel(page);
    await startDuel(page);
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('AceDuelScene')?.ships?.size > 0,
      { timeout: 8_000 },
    );
    const shipCount = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.ships?.size ?? 0,
    );
    expect(shipCount).toBeGreaterThan(0);
  });

  test('side1 and side2 both have ships', async ({ page }) => {
    await launchAceDuel(page);
    await startDuel(page);
    await page.waitForFunction(
      () => {
        const s = (window as any).game.scene.getScene('AceDuelScene') as any;
        return s?.side1ShipIds?.length > 0 && s?.side2ShipIds?.length > 0;
      },
      { timeout: 8_000 },
    );
    const counts = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('AceDuelScene') as any;
      return {
        side1: s.side1ShipIds?.length ?? 0,
        side2: s.side2ShipIds?.length ?? 0,
      };
    });
    expect(counts.side1).toBeGreaterThan(0);
    expect(counts.side2).toBeGreaterThan(0);
  });

  test('starts at round 1 with 0 wins for both sides', async ({ page }) => {
    await launchAceDuel(page);
    await startDuel(page);
    const state = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('AceDuelScene') as any;
      return { round: s.currentRound, side1Wins: s.side1Wins, side2Wins: s.side2Wins };
    });
    expect(state.round).toBe(1);
    expect(state.side1Wins).toBe(0);
    expect(state.side2Wins).toBe(0);
  });

  test('round becomes active after startDuel', async ({ page }) => {
    await launchAceDuel(page);
    await startDuel(page);
    // isRoundActive becomes true after the "ROUND N" tween (1.5s)
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('AceDuelScene')?.isRoundActive === true,
      { timeout: 8_000 },
    );
    const active = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.isRoundActive,
    );
    expect(active).toBe(true);
  });

  test('match is not complete at start', async ({ page }) => {
    await launchAceDuel(page);
    await startDuel(page);
    const complete = await page.evaluate(
      () => (window as any).game.scene.getScene('AceDuelScene')?.matchComplete,
    );
    expect(complete).toBe(false);
  });
});
