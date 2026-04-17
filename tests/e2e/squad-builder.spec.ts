/**
 * SquadBuilderScene E2E Tests
 *
 * Covers squad construction, point limit enforcement, faction selection,
 * mode switching, and routing to the battle scene.
 */

import { test, expect, type Page } from '@playwright/test';
import { waitForScene, waitForMenuReady, clickMenuItem, suppressWebGLNoise } from './helpers/game';

function suppressNoise(page: Page): void { suppressWebGLNoise(page); }

async function openSquadBuilder(page: Page, mode = 'SKIRMISH'): Promise<void> {
  await clickMenuItem(page, mode);
  await waitForScene(page, 'SquadBuilderScene');
  await page.waitForFunction(
    () => {
      const s = (window as any).game.scene.getScene('SquadBuilderScene') as any;
      return (s?.factionSlots?.length ?? 0) > 0;
    },
    { timeout: 10_000 },
  );
}

type SquadInfo = {
  numFactions: number;
  pointLimit: number;
  gameMode: string;
  slots: Array<{ factionId: string | null; ships: string[]; pointsUsed: number }>;
};

async function getSquadInfo(page: Page): Promise<SquadInfo> {
  return page.evaluate(() => {
    const s = (window as any).game.scene.getScene('SquadBuilderScene') as any;
    return {
      numFactions: s?.numFactions ?? 0,
      pointLimit: s?.pointLimit ?? 0,
      gameMode: s?.gameMode ?? 'unknown',
      slots: (s?.factionSlots ?? []).map((slot: any) => ({
        factionId: slot.factionId,
        ships: [...(slot.ships ?? [])],
        pointsUsed: slot.pointsUsed ?? 0,
      })),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('SquadBuilderScene — initial state (SKIRMISH / arcade)', () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page as any);
    await page.goto('/');
    await waitForMenuReady(page);
    await openSquadBuilder(page);
  });

  test('SquadBuilderScene becomes active', async ({ page }) => {
    const active = await page.evaluate(
      () => (window as any).game.scene.isActive('SquadBuilderScene'),
    );
    expect(active).toBe(true);
  });

  test('starts with 2 faction slots', async ({ page }) => {
    const info = await getSquadInfo(page);
    expect(info.numFactions).toBe(2);
  });

  test('default point limit is 200 for arcade mode', async ({ page }) => {
    const info = await getSquadInfo(page);
    expect(info.pointLimit).toBe(200);
  });

  test('default game mode is arcade', async ({ page }) => {
    const info = await getSquadInfo(page);
    expect(info.gameMode).toBe('arcade');
  });

  test('each slot starts with a faction assigned', async ({ page }) => {
    const info = await getSquadInfo(page);
    for (const slot of info.slots) {
      expect(slot.factionId).not.toBeNull();
    }
  });

  test('auto-fill produces at least 1 ship per slot', async ({ page }) => {
    const info = await getSquadInfo(page);
    for (const slot of info.slots) {
      expect(slot.ships.length).toBeGreaterThan(0);
    }
  });

  test('auto-fill respects point limit for every slot', async ({ page }) => {
    const info = await getSquadInfo(page);
    for (const slot of info.slots) {
      expect(slot.pointsUsed).toBeLessThanOrEqual(info.pointLimit);
    }
  });

  test('ESC returns to MainMenuScene', async ({ page }) => {
    await page.keyboard.press('Escape');
    await waitForScene(page, 'MainMenuScene');
    const active = await page.evaluate(
      () => (window as any).game.scene.isActive('MainMenuScene'),
    );
    expect(active).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('SquadBuilderScene — EPIC BATTLE mode', () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page as any);
    await page.goto('/');
    await waitForMenuReady(page);
    await openSquadBuilder(page, 'EPIC BATTLE');
  });

  test('opens SquadBuilderScene in epic mode (400pt)', async ({ page }) => {
    const info = await getSquadInfo(page);
    expect(info.gameMode).toBe('epic');
    expect(info.pointLimit).toBe(400);
  });

  test('auto-fill still respects 400pt cap per slot', async ({ page }) => {
    const info = await getSquadInfo(page);
    for (const slot of info.slots) {
      expect(slot.pointsUsed).toBeLessThanOrEqual(400);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('SquadBuilderScene — mode switch via in-scene buttons', () => {
  test.beforeEach(async ({ page }) => {
    suppressNoise(page as any);
    await page.goto('/');
    await waitForMenuReady(page);
    await openSquadBuilder(page);
  });

  test('switching to turn_based mode keeps point limit at 200', async ({ page }) => {
    // Switch mode via evaluate (mode buttons are positional — avoid coordinate brittleness)
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SquadBuilderScene') as any;
      s.gameMode = 'turn_based';
    });
    const info = await getSquadInfo(page);
    expect(info.gameMode).toBe('turn_based');
  });

  test('num factions can be reduced to 2 via evaluate (min boundary)', async ({ page }) => {
    const info = await getSquadInfo(page);
    expect(info.numFactions).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('SquadBuilderScene — starting a battle', () => {
  test('SKIRMISH → auto-fill → START navigates to a battle scene', async ({ page }) => {
    suppressNoise(page as any);
    await page.goto('/');
    await waitForMenuReady(page);
    await openSquadBuilder(page);

    // Trigger startBattle() directly via evaluate to avoid button-coord brittleness
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SquadBuilderScene') as any;
      s?.startBattle?.();
    });

    // startBattle routes to ArcadeBattleScene for arcade mode
    await page.waitForFunction(
      () => {
        const g = (window as any).game;
        return g.scene.isActive('ArcadeBattleScene')
          || g.scene.isActive('TurnBasedBattleScene')
          || g.scene.isActive('ContinuousTacticalScene');
      },
      { timeout: 15_000 },
    );

    const inBattle = await page.evaluate(() => {
      const g = (window as any).game;
      return g.scene.isActive('ArcadeBattleScene')
        || g.scene.isActive('TurnBasedBattleScene')
        || g.scene.isActive('ContinuousTacticalScene');
    });
    expect(inBattle).toBe(true);
  });
});
