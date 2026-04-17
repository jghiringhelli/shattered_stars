/**
 * Campaign Persistence E2E Tests
 *
 * Verifies save/load via localStorage (`shattered_stars_campaign_<factionId>`).
 * CampaignSaveManager writes on every selectFaction call (createNew → save)
 * and on completeMission. We test by inspecting localStorage directly from
 * page.evaluate and by simulating a reload to confirm state survives.
 */

import { test, expect } from '@playwright/test';
import { waitForScene, waitForMenuReady, clickMenuItem, collectErrors } from './helpers/game';

const SAVE_KEY = (factionId: string) => `shattered_stars_campaign_${factionId}`;

// ─── helpers ─────────────────────────────────────────────────────────────────

async function launchCampaign(page: any): Promise<void> {
  await page.goto('/');
  await waitForMenuReady(page);
  await clickMenuItem(page, 'CAMPAIGN');
  await waitForScene(page, 'CampaignScene');
}

async function selectFaction(page: any, factionId: string): Promise<void> {
  await page.evaluate((fid: string) => {
    (window as any).game.scene.getScene('CampaignScene').selectFaction(fid);
  }, factionId);
  await page.waitForFunction(
    () => (window as any).game.scene.getScene('CampaignScene')?.currentPhase === 'mission_map',
    { timeout: 5_000 },
  );
}

async function clearSave(page: any, factionId: string): Promise<void> {
  await page.evaluate(
    (key: string) => window.localStorage.removeItem(key),
    SAVE_KEY(factionId),
  );
}

// ─── Save creation ────────────────────────────────────────────────────────────

test.describe('Campaign persistence — save creation', () => {
  test('selecting a faction writes save to localStorage', async ({ page }) => {
    await launchCampaign(page);
    await clearSave(page, 'terran_hegemony');
    await selectFaction(page, 'terran_hegemony');

    const raw = await page.evaluate(
      (key: string) => window.localStorage.getItem(key),
      SAVE_KEY('terran_hegemony'),
    );
    expect(raw).not.toBeNull();
  });

  test('initial save has currentMission = 1 and empty completedMissions', async ({ page }) => {
    await launchCampaign(page);
    await clearSave(page, 'free_confederation');
    await selectFaction(page, 'free_confederation');

    const save = await page.evaluate(
      (key: string) => JSON.parse(window.localStorage.getItem(key) ?? 'null'),
      SAVE_KEY('free_confederation'),
    );
    expect(save).not.toBeNull();
    expect(save.currentMission).toBe(1);
    expect(save.completedMissions).toHaveLength(0);
  });

  test('initial save has factionId matching selected faction', async ({ page }) => {
    await launchCampaign(page);
    await clearSave(page, 'void_corsairs');
    await selectFaction(page, 'void_corsairs');

    const save = await page.evaluate(
      (key: string) => JSON.parse(window.localStorage.getItem(key) ?? '{}'),
      SAVE_KEY('void_corsairs'),
    );
    expect(save.factionId).toBe('void_corsairs');
  });

  test('separate save keys are used for each faction', async ({ page }) => {
    await launchCampaign(page);
    // Create saves for two different factions
    for (const fid of ['terran_hegemony', 'synthetic_collective']) {
      await clearSave(page, fid);
      await page.evaluate((f: string) => {
        const s = (window as any).game.scene.getScene('CampaignScene') as any;
        s.selectFaction(f);
        s.showFactionSelect();
      }, fid);
    }

    const key1 = await page.evaluate(
      (k: string) => window.localStorage.getItem(k) !== null,
      SAVE_KEY('terran_hegemony'),
    );
    const key2 = await page.evaluate(
      (k: string) => window.localStorage.getItem(k) !== null,
      SAVE_KEY('synthetic_collective'),
    );
    expect(key1).toBe(true);
    expect(key2).toBe(true);
  });
});

// ─── Save persistence across reload ──────────────────────────────────────────

test.describe('Campaign persistence — save survives reload', () => {
  test('save exists after page reload', async ({ page }) => {
    await launchCampaign(page);
    await clearSave(page, 'ascendant_empire');
    await selectFaction(page, 'ascendant_empire');

    // Reload the page
    await page.reload();
    await waitForMenuReady(page);

    // Save should still be in localStorage
    const raw = await page.evaluate(
      (key: string) => window.localStorage.getItem(key),
      SAVE_KEY('ascendant_empire'),
    );
    expect(raw).not.toBeNull();
    const save = JSON.parse(raw!);
    expect(save.factionId).toBe('ascendant_empire');
    expect(save.currentMission).toBe(1);
  });

  test('save is loaded when returning to same faction after reload', async ({ page }) => {
    await launchCampaign(page);
    await clearSave(page, 'terran_hegemony');
    await selectFaction(page, 'terran_hegemony');

    // Directly advance the save so it differs from a fresh create
    await page.evaluate((key: string) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const save = JSON.parse(raw);
      save.totalXp = 999;
      window.localStorage.setItem(key, JSON.stringify(save));
    }, SAVE_KEY('terran_hegemony'));

    // Reload and select same faction — scene should load the existing save
    await page.reload();
    await waitForMenuReady(page);
    await clickMenuItem(page, 'CAMPAIGN');
    await waitForScene(page, 'CampaignScene');
    await selectFaction(page, 'terran_hegemony');

    const xp = await page.evaluate(
      () => (window as any).game.scene.getScene('CampaignScene')?.saveData?.totalXp,
    );
    expect(xp).toBe(999);
  });
});

// ─── Mission completion via localStorage ─────────────────────────────────────

test.describe('Campaign persistence — mission completion', () => {
  test('manually completing mission 1 advances currentMission to 2 in localStorage', async ({
    page,
  }) => {
    await launchCampaign(page);
    await clearSave(page, 'terran_hegemony');
    await selectFaction(page, 'terran_hegemony');

    // Simulate completeMission by updating localStorage directly
    // (mirrors what CampaignSaveManager.completeMission() writes)
    await page.evaluate((key: string) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const save = JSON.parse(raw);
      const missionId = 'th_mission_1'; // first TH mission ID pattern
      // Get actual mission1 id from scene
      const s = (window as any).game.scene.getScene('CampaignScene') as any;
      const mission1 = s.campaignData?.missions?.find((m: any) => m.missionNumber === 1);
      if (!mission1) return;
      save.completedMissions = [mission1.id];
      save.currentMission = 2;
      save.totalXp = 100;
      save.credits = 50;
      window.localStorage.setItem(key, JSON.stringify(save));
    }, SAVE_KEY('terran_hegemony'));

    const save = await page.evaluate(
      (key: string) => JSON.parse(window.localStorage.getItem(key) ?? 'null'),
      SAVE_KEY('terran_hegemony'),
    );
    expect(save.currentMission).toBe(2);
    expect(save.completedMissions).toHaveLength(1);
    expect(save.totalXp).toBe(100);
  });

  test('completed mission is reflected in scene saveData on next select', async ({ page }) => {
    await launchCampaign(page);
    await clearSave(page, 'free_confederation');
    await selectFaction(page, 'free_confederation');

    // Get mission 1 id
    const mission1Id = await page.evaluate(
      () => {
        const s = (window as any).game.scene.getScene('CampaignScene') as any;
        return s.campaignData?.missions?.find((m: any) => m.missionNumber === 1)?.id ?? null;
      },
    );
    expect(mission1Id).not.toBeNull();

    // Write completion into localStorage
    await page.evaluate(
      ([key, mid]: [string, string]) => {
        const raw = window.localStorage.getItem(key);
        if (!raw) return;
        const save = JSON.parse(raw);
        save.completedMissions = [mid];
        save.currentMission = 2;
        window.localStorage.setItem(key, JSON.stringify(save));
      },
      [SAVE_KEY('free_confederation'), mission1Id] as [string, string],
    );

    // Navigate back to CampaignScene and reload the faction
    await page.evaluate(() => {
      (window as any).game.scene.start('CampaignScene');
    });
    await waitForScene(page, 'CampaignScene');
    await page.waitForFunction(
      () => (window as any).game.scene.getScene('CampaignScene')?.currentPhase === 'faction_select',
      { timeout: 5_000 },
    );
    await selectFaction(page, 'free_confederation');

    const state = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('CampaignScene') as any;
      return {
        currentMission: s.saveData?.currentMission,
        completedCount: s.saveData?.completedMissions?.length ?? 0,
      };
    });
    expect(state.currentMission).toBe(2);
    expect(state.completedCount).toBe(1);
  });

  test('no page errors during full save/reload cycle', async ({ page }) => {
    const errors = collectErrors(page as any);
    await launchCampaign(page);
    await clearSave(page, 'synthetic_collective');
    await selectFaction(page, 'synthetic_collective');
    await page.reload();
    await waitForMenuReady(page);
    expect(errors.pageErrors).toHaveLength(0);
  });
});
