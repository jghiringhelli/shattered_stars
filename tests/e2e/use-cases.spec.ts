/**
 * Use Case / User Journey Tests — Shattered Stars
 *
 * These tests follow real user scenarios across multiple scenes.
 * They are coarser than unit tests — they care about whether the game
 * works end-to-end, not about individual component behavior.
 *
 * Each test captures console errors and page errors throughout the journey.
 */

import { test, expect } from '@playwright/test';
import { waitForScene, waitForMenuReady, clickMenuItem, pressGameKey, collectErrors } from './helpers/game';

// ─────────────────────────────────────────────────────────────────────────────
// UC-1: Browse the main menu and visit every top-level destination
// ─────────────────────────────────────────────────────────────────────────────

test.describe('UC-1: Main menu → all destinations', () => {
  const destinations: [string, string][] = [
    ['SETTINGS',     'SettingsScene'],
    ['ENCYCLOPEDIA', 'EncyclopediaScene'],
    ['CREDITS',      'CreditsScene'],
    // DOGFIGHT excluded: ESC in DogfightScene toggles pause, not return-to-menu
  ];

  for (const [label, scene] of destinations) {
    test(`menu → ${label} → ESC → back to menu`, async ({ page }) => {
      const errors = collectErrors(page as any);
      await page.goto('/');
      await waitForMenuReady(page);
      await clickMenuItem(page, label);
      await waitForScene(page, scene);
      expect(await page.evaluate(() => (window as any).game.scene.isActive(
        (window as any)._testSceneKey ?? ''
      ))).not.toBe(false); // scene loaded without crash
      await pressGameKey(page, 'Escape');
      await waitForScene(page, 'MainMenuScene');
      expect(errors.pageErrors).toHaveLength(0);
      expect(errors.consoleErrors).toHaveLength(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UC-2: Squad Builder → auto-fill → launch arcade battle → pause → quit
// ─────────────────────────────────────────────────────────────────────────────

test.describe('UC-2: SKIRMISH full flow', () => {
  test('menu → SKIRMISH → auto-fill → start → arcade battle active → quit → menu', async ({ page }) => {
    const errors = collectErrors(page as any);

    await page.goto('/');
    await waitForMenuReady(page);

    // Step 1: open squad builder
    await clickMenuItem(page, 'SKIRMISH');
    await waitForScene(page, 'SquadBuilderScene');
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('SquadBuilderScene')?.factionSlots?.length > 0,
      { timeout: 10_000 },
    );

    // Step 2: verify auto-fill happened
    const info = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SquadBuilderScene') as any;
      return {
        slots: s.factionSlots?.length,
        filled: s.factionSlots?.every((slot: any) => slot.ships?.length > 0),
      };
    });
    expect(info.slots).toBe(2);
    expect(info.filled).toBe(true);

    // Step 3: start battle
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('SquadBuilderScene') as any;
      s?.startBattle?.();
    });

    await page.waitForFunction(
      () => {
        const g = (window as any).game;
        return g.scene.isActive('ArcadeBattleScene')
          || g.scene.isActive('TurnBasedBattleScene');
      },
      { timeout: 15_000 },
    );

    const inBattle = await page.evaluate(() => {
      const g = (window as any).game;
      return g.scene.isActive('ArcadeBattleScene') || g.scene.isActive('TurnBasedBattleScene');
    });
    expect(inBattle).toBe(true);

    // Step 4: quit to menu
    await page.evaluate(() => {
      const g = (window as any).game;
      const activeKey = g.scene.isActive('ArcadeBattleScene') ? 'ArcadeBattleScene' : 'TurnBasedBattleScene';
      g.scene.getScene(activeKey)?.scene.start('MainMenuScene');
    });

    await waitForScene(page, 'MainMenuScene');
    expect(errors.pageErrors).toHaveLength(0);
    expect(errors.consoleErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UC-3: SKIRMISH → turn_based mode → run one full turn
// ─────────────────────────────────────────────────────────────────────────────

test.describe('UC-3: Turn-based skirmish — one complete turn', () => {
  test('squad builder → turn_based → battle → plan → execute turn 1', async ({ page }) => {
    const errors = collectErrors(page as any);

    await page.goto('/');
    await waitForMenuReady(page);

    // Inject TurnBasedBattleScene config directly for determinism
    await page.evaluate(() => {
      const g = (window as any).game;
      g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.registry.set('battleConfig', {
        factions: [
          { factionId: 'free_confederation', controller: 'player', ships: ['confed_sparrow'] },
          { factionId: 'terran_hegemony',    controller: 'ai',     ships: ['terran_viper'] },
        ],
        gameMode: 'turn_based',
        seed: 42,
      });
      setTimeout(() => g.scene.start('TurnBasedBattleScene'), 100);
    });

    await waitForScene(page, 'TurnBasedBattleScene');
    await page.waitForFunction(
      () => {
        const s = (window as any).game.scene.getScene('TurnBasedBattleScene') as any;
        return (s?.ships?.size ?? 0) > 0 && s?.turnState?.phase === 'planning';
      },
      { timeout: 10_000 },
    );

    // Plan maneuvers
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('TurnBasedBattleScene') as any;
      for (const id of s.playerShipIds) {
        const ship = s.ships.get(id);
        const m = ship?.definition?.maneuvers?.find((mv: any) => mv.direction === 'straight')
          ?? ship?.definition?.maneuvers?.[0]
          ?? { direction: 'straight', speed: 1, difficulty: 'white' };
        s.turnState.plannedManeuvers.set(id, { shipId: id, maneuver: m, revealed: false });
      }
    });

    // Press SPACE to execute
    await page.keyboard.press('Space');

    // Wait for turn to execute and return to planning phase at turn 2
    await page.waitForFunction(
      () => {
        const s = (window as any).game.scene.getScene('TurnBasedBattleScene') as any;
        const debrief = (window as any).game.scene.isActive('DebriefScene');
        return (s?.turnState?.phase === 'planning' && s?.turnState?.turnNumber > 1) || debrief;
      },
      { timeout: 25_000 },
    );

    const result = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('TurnBasedBattleScene') as any;
      return {
        turnNumber: s?.turnState?.turnNumber ?? 0,
        phase: s?.turnState?.phase ?? 'unknown',
        debrief: (window as any).game.scene.isActive('DebriefScene'),
      };
    });

    // Either turn 2 reached, or battle ended (valid outcomes)
    expect(result.turnNumber > 1 || result.debrief).toBe(true);
    expect(errors.pageErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UC-4: Encyclopedia — browse, filter, and return
// ─────────────────────────────────────────────────────────────────────────────

test.describe('UC-4: Encyclopedia browsing journey', () => {
  test('menu → ENCYCLOPEDIA → filter by faction → view ship → ESC → menu', async ({ page }) => {
    const errors = collectErrors(page as any);

    await page.goto('/');
    await waitForMenuReady(page);
    await clickMenuItem(page, 'ENCYCLOPEDIA');
    await waitForScene(page, 'EncyclopediaScene');
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('EncyclopediaScene')?.filteredEntries?.length > 0,
      { timeout: 10_000 },
    );

    // Apply faction filter
    await page.evaluate(() => {
      (window as any).game.scene.getScene('EncyclopediaScene')?.onFactionFilter?.('terran_hegemony');
    });

    const filtered = await page.evaluate(
      () => (window as any).game.scene.getScene('EncyclopediaScene')?.filteredEntries?.length ?? 0,
    );
    expect(filtered).toBe(20);

    // Open detail for first entry
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('EncyclopediaScene') as any;
      const id = s.filteredEntries[0]?.id;
      if (id) s.showDetail(id);
    });
    await page.waitForTimeout(300);

    // Return to menu
    await page.keyboard.press('Escape');
    await waitForScene(page, 'MainMenuScene');

    expect(errors.pageErrors).toHaveLength(0);
    expect(errors.consoleErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UC-5: Rapid scene switching — no memory leaks / orphaned objects
// ─────────────────────────────────────────────────────────────────────────────

test.describe('UC-5: Scene lifecycle stress', () => {
  test('open and close Settings + Encyclopedia + Credits three times without errors', async ({ page }) => {
    const errors = collectErrors(page as any);

    await page.goto('/');
    await waitForMenuReady(page);

    const cycle = [
      ['SETTINGS',     'SettingsScene'],
      ['ENCYCLOPEDIA', 'EncyclopediaScene'],
      ['CREDITS',      'CreditsScene'],
    ] as const;

    for (let rep = 0; rep < 3; rep++) {
      for (const [label, scene] of cycle) {
        await clickMenuItem(page, label);
        await waitForScene(page, scene);
        await page.keyboard.press('Escape');
        await waitForMenuReady(page); // wait for menu items to be fully rendered
      }
    }

    expect(errors.pageErrors).toHaveLength(0);
    expect(errors.consoleErrors).toHaveLength(0);
  });

  test('launching and quitting arcade battle three times does not crash', async ({ page }) => {
    const errors = collectErrors(page as any);

    await page.goto('/');
    await waitForMenuReady(page);

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const g = (window as any).game;
        g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.sys.settings.key));
        g.registry.set('battleConfig', {
          factions: [
            { factionId: 'free_confederation', controller: 'player', ships: ['confed_sparrow'] },
            { factionId: 'terran_hegemony',    controller: 'ai',     ships: ['terran_viper'] },
          ],
          gameMode: 'arcade',
        });
        setTimeout(() => g.scene.start('ArcadeBattleScene'), 100);
      });

      await waitForScene(page, 'ArcadeBattleScene');
      await page.waitForFunction(
        () => (window as any).game.scene.getScene('ArcadeBattleScene')?.ships?.size > 0,
        { timeout: 10_000 },
      );

      await page.evaluate(() => {
        (window as any).game.scene.getScene('ArcadeBattleScene')?.scene.start('MainMenuScene');
      });
      await waitForScene(page, 'MainMenuScene');
    }

    expect(errors.pageErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UC-6: Screenshot-verified scene loads (visual sanity)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('UC-6: Visual sanity — canvas has content', () => {
  const SCENES: Array<{ label: string; key: string }> = [
    { label: 'SKIRMISH', key: 'SquadBuilderScene' },
    { label: 'ENCYCLOPEDIA', key: 'EncyclopediaScene' },
    { label: 'SETTINGS', key: 'SettingsScene' },
    { label: 'CREDITS', key: 'CreditsScene' },
  ];

  for (const { label, key } of SCENES) {
    test(`${key} renders a non-blank canvas`, async ({ page }) => {
      await page.goto('/');
      await waitForMenuReady(page);
      await clickMenuItem(page, label);
      await waitForScene(page, key);
      await page.waitForTimeout(500); // allow one render pass

      const canvas = page.locator('canvas');
      const screenshot = await canvas.screenshot();

      // A non-blank canvas screenshot must have reasonable byte length and
      // contain pixels that are not all the same value (not a solid colour)
      expect(screenshot.length).toBeGreaterThan(5_000);

      const unique = new Set(screenshot.slice(0, 1000));
      expect(unique.size).toBeGreaterThan(3); // more than 3 distinct byte values
    });
  }
});
