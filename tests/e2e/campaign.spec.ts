/**
 * CampaignScene E2E Tests
 *
 * Covers: faction selection, mission map, briefing, launch to CampaignBattleScene.
 * Uses page.evaluate to drive scene methods directly — more reliable than
 * clicking pixel coordinates on a canvas.
 */

import { test, expect } from '@playwright/test';
import { waitForScene, waitForMenuReady, clickMenuItem, collectErrors } from './helpers/game';

const FACTIONS = [
  'terran_hegemony',
  'free_confederation',
  'synthetic_collective',
  'void_corsairs',
  'ascendant_empire',
] as const;

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

async function selectFirstMission(page: any): Promise<void> {
  await page.evaluate(() => {
    const s = (window as any).game.scene.getScene('CampaignScene') as any;
    const m1 = s.campaignData?.missions?.find((m: any) => m.missionNumber === 1);
    if (m1) s.selectMission(m1);
  });
  await page.waitForFunction(
    () => (window as any).game.scene.getScene('CampaignScene')?.currentPhase === 'briefing',
    { timeout: 5_000 },
  );
}

// ─── Faction Select phase ─────────────────────────────────────────────────────

test.describe('CampaignScene — faction select', () => {
  test('CampaignScene becomes active from main menu', async ({ page }) => {
    await launchCampaign(page);
    const active = await page.evaluate(
      () => (window as any).game.scene.isActive('CampaignScene'),
    );
    expect(active).toBe(true);
  });

  test('opens in faction_select phase', async ({ page }) => {
    await launchCampaign(page);
    const phase = await page.evaluate(
      () => (window as any).game.scene.getScene('CampaignScene')?.currentPhase,
    );
    expect(phase).toBe('faction_select');
  });

  test('selectedFaction is null on open', async ({ page }) => {
    await launchCampaign(page);
    const faction = await page.evaluate(
      () => (window as any).game.scene.getScene('CampaignScene')?.selectedFaction,
    );
    expect(faction).toBeNull();
  });

  test('selecting a faction transitions to mission_map phase', async ({ page }) => {
    await launchCampaign(page);
    await selectFaction(page, 'terran_hegemony');
    const phase = await page.evaluate(
      () => (window as any).game.scene.getScene('CampaignScene')?.currentPhase,
    );
    expect(phase).toBe('mission_map');
  });

  test('selectedFaction is set after selection', async ({ page }) => {
    await launchCampaign(page);
    await selectFaction(page, 'free_confederation');
    const faction = await page.evaluate(
      () => (window as any).game.scene.getScene('CampaignScene')?.selectedFaction,
    );
    expect(faction).toBe('free_confederation');
  });

  test('all 5 factions can be selected without page errors', async ({ page }) => {
    const errors = collectErrors(page as any);
    await launchCampaign(page);

    for (const fid of FACTIONS) {
      await page.evaluate((f: string) => {
        const s = (window as any).game.scene.getScene('CampaignScene') as any;
        s.selectFaction(f);
        // Return to faction select for next iteration
        s.showFactionSelect();
      }, fid);
    }

    expect(errors.pageErrors).toHaveLength(0);
  });
});

// ─── Mission Map phase ────────────────────────────────────────────────────────

test.describe('CampaignScene — mission map', () => {
  test('campaignData has at least 1 mission', async ({ page }) => {
    await launchCampaign(page);
    await selectFaction(page, 'terran_hegemony');
    const count = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('CampaignScene') as any;
      return s.campaignData?.missions?.length ?? 0;
    });
    expect(count).toBeGreaterThan(0);
  });

  test('saveData initialises with currentMission = 1 for a fresh campaign', async ({ page }) => {
    await launchCampaign(page);
    await selectFaction(page, 'free_confederation');
    const current = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('CampaignScene') as any;
      return s.saveData?.currentMission;
    });
    expect(current).toBe(1);
  });

  test('all 5 factions have missions defined', async ({ page }) => {
    await launchCampaign(page);

    for (const fid of FACTIONS) {
      const count = await page.evaluate((f: string) => {
        const s = (window as any).game.scene.getScene('CampaignScene') as any;
        s.selectFaction(f);
        const n = s.campaignData?.missions?.length ?? 0;
        s.showFactionSelect();
        return n;
      }, fid);
      expect(count).toBeGreaterThan(0);
    }
  });

  test('selecting mission 1 transitions to briefing phase', async ({ page }) => {
    await launchCampaign(page);
    await selectFaction(page, 'terran_hegemony');
    await selectFirstMission(page);
    const phase = await page.evaluate(
      () => (window as any).game.scene.getScene('CampaignScene')?.currentPhase,
    );
    expect(phase).toBe('briefing');
  });

  test('selectedMission is non-null after selectMission', async ({ page }) => {
    await launchCampaign(page);
    await selectFaction(page, 'terran_hegemony');
    await selectFirstMission(page);
    const hasMission = await page.evaluate(
      () => (window as any).game.scene.getScene('CampaignScene')?.selectedMission != null,
    );
    expect(hasMission).toBe(true);
  });
});

// ─── Briefing phase ───────────────────────────────────────────────────────────

test.describe('CampaignScene — briefing and launch', () => {
  async function reachBriefing(page: any): Promise<void> {
    await launchCampaign(page);
    await selectFaction(page, 'terran_hegemony');
    await selectFirstMission(page);
  }

  test('briefing phase shows a named mission', async ({ page }) => {
    await reachBriefing(page);
    const missionTitle = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('CampaignScene') as any;
      return s.selectedMission?.title ?? null;
    });
    expect(typeof missionTitle).toBe('string');
    expect((missionTitle as string).length).toBeGreaterThan(0);
  });

  test('launchMission starts CampaignBattleScene', async ({ page }) => {
    await reachBriefing(page);
    await page.evaluate(
      () => (window as any).game.scene.getScene('CampaignScene').launchMission(),
    );
    await waitForScene(page, 'CampaignBattleScene');
  });

  test('CampaignBattleScene receives factionId and mission', async ({ page }) => {
    await reachBriefing(page);
    await page.evaluate(
      () => (window as any).game.scene.getScene('CampaignScene').launchMission(),
    );
    await waitForScene(page, 'CampaignBattleScene');

    const state = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('CampaignBattleScene') as any;
      return {
        factionId: s?.factionId ?? null,
        missionTitle: s?.mission?.title ?? null,
      };
    });
    expect(state.factionId).toBe('terran_hegemony');
    expect(typeof state.missionTitle).toBe('string');
  });

  test('CampaignBattleScene spawns player ships', async ({ page }) => {
    await reachBriefing(page);
    await page.evaluate(
      () => (window as any).game.scene.getScene('CampaignScene').launchMission(),
    );
    await waitForScene(page, 'CampaignBattleScene');

    // Wait for ship sprites to be created via createShipSprite()
    await page.waitForFunction(
      () => {
        const s = (window as any).game.scene.getScene('CampaignBattleScene') as any;
        return (s?.shipSprites?.size ?? 0) > 0;
      },
      { timeout: 15_000 },
    );

    const spriteCount = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene('CampaignBattleScene') as any;
      return s?.shipSprites?.size ?? 0;
    });
    expect(spriteCount).toBeGreaterThan(0);
  });
});
