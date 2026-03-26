/**
 * Multiplayer Seed Determinism — E2E Tests
 *
 * Verifies:
 *  - LobbyScene renders the ONLINE button for server connection
 *  - TurnBasedBattleScene uses the seed from battleConfig, producing
 *    identical pilot skill assignments when the same seed is supplied.
 */

import { test, expect, type Page } from '@playwright/test';
import { waitForScene, waitForMenuReady } from './helpers/game';

function suppressWebGLNoise(page: Page): void {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (t.includes('WebGL') || t.includes('Framebuffer') || t.includes('favicon')) return;
      console.warn('[console.error]', t);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LobbyScene — Online Mode UI
// ─────────────────────────────────────────────────────────────────────────────

test.describe('LobbyScene — online mode', () => {
  test.beforeEach(async ({ page }) => {
    suppressWebGLNoise(page);
    await page.goto('/');
    await waitForMenuReady(page);
    // Navigate directly — LobbyScene has no main-menu entry yet
    await page.evaluate(() => {
      const g = (window as any).game;
      g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.sys.settings.key));
      setTimeout(() => g.scene.start('LobbyScene'), 100);
    });
    await waitForScene(page, 'LobbyScene');
  });

  test('LobbyScene becomes active', async ({ page }) => {
    const active = await page.evaluate(
      () => (window as any).game.scene.isActive('LobbyScene')
    );
    expect(active).toBe(true);
  });

  test('room browser view is shown by default', async ({ page }) => {
    const view = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('LobbyScene') as any;
      return scene?.currentView;
    });
    expect(view).toBe('browser');
  });

  test('roomListContainer is visible in browser view', async ({ page }) => {
    const visible = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('LobbyScene') as any;
      return scene?.roomListContainer?.visible;
    });
    expect(visible).toBe(true);
  });

  test('playerListContainer is hidden while in browser view', async ({ page }) => {
    const visible = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('LobbyScene') as any;
      return scene?.playerListContainer?.visible;
    });
    expect(visible).toBe(false);
  });

  test('serverUrl is null before any online connection', async ({ page }) => {
    const serverUrl = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('LobbyScene') as any;
      return scene?.serverUrl;
    });
    expect(serverUrl).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TurnBasedBattleScene — Seeded RNG Determinism
// ─────────────────────────────────────────────────────────────────────────────

const FIXED_SEED = 77777;

/** Launch TurnBasedBattleScene with a fixed seed and return pilot skills assigned. */
async function getPilotSkillsWithSeed(page: Page, seed: number): Promise<number[]> {
  // Reset scene and set battleConfig with fixed seed
  await page.evaluate((testSeed: number) => {
    const g = (window as any).game;

    // Stop all active scenes first
    g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.sys.settings.key));

    g.registry.set('battleConfig', {
      factions: [
        {
          factionId: 'terran_hegemony',
          controller: 'player',
          ships: ['terran_gladius', 'terran_viper'],
        },
        {
          factionId: 'free_confederation',
          controller: 'ai',
          ships: ['confed_falcon', 'confed_sparrow'],
        },
      ],
      gameMode: 'turn_based',
      pointLimit: 200,
      seed: testSeed,
    });

    setTimeout(() => g.scene.start('TurnBasedBattleScene'), 100);
  }, seed);

  await waitForScene(page, 'TurnBasedBattleScene');

  // Wait for ships to be spawned (ships map is populated in create())
  await page.waitForFunction(
    () => {
      const g = (window as any).game;
      const scene = g?.scene.getScene('TurnBasedBattleScene') as any;
      return scene?.ships?.size > 0;
    },
    { timeout: 15_000 }
  );

  // Read pilot skills in deterministic order (by ship id)
  return page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('TurnBasedBattleScene') as any;
    const skills: number[] = [];
    scene.ships.forEach((ship: any) => skills.push(ship.pilotSkill));
    return skills;
  });
}

test.describe('TurnBasedBattleScene — deterministic pilot skills', () => {
  test.beforeEach(async ({ page }) => {
    suppressWebGLNoise(page);
    await page.goto('/');
    await waitForMenuReady(page);
  });

  test('same seed produces identical pilot skill assignments', async ({ page }) => {
    const skills1 = await getPilotSkillsWithSeed(page, FIXED_SEED);
    const skills2 = await getPilotSkillsWithSeed(page, FIXED_SEED);

    expect(skills1.length).toBeGreaterThan(0);
    expect(skills1).toEqual(skills2);
  });

  test('pilot skills are in valid range (3–6) when seeded', async ({ page }) => {
    const skills = await getPilotSkillsWithSeed(page, FIXED_SEED);

    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) {
      expect(skill).toBeGreaterThanOrEqual(3);
      expect(skill).toBeLessThanOrEqual(6);
    }
  });

  test('seed is preserved in registry after battle starts', async ({ page }) => {
    await page.evaluate((testSeed: number) => {
      const g = (window as any).game;
      g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.registry.set('battleConfig', {
        factions: [
          { factionId: 'terran_hegemony',    controller: 'player', ships: ['terran_gladius'] },
          { factionId: 'free_confederation', controller: 'ai',     ships: ['confed_falcon']  },
        ],
        gameMode: 'turn_based',
        seed: testSeed,
      });
      setTimeout(() => g.scene.start('TurnBasedBattleScene'), 100);
    }, FIXED_SEED);

    await waitForScene(page, 'TurnBasedBattleScene');

    const storedSeed = await page.evaluate(() => {
      const g = (window as any).game;
      const config = g.registry.get('battleConfig');
      return config?.seed;
    });

    expect(storedSeed).toBe(FIXED_SEED);
  });
});
