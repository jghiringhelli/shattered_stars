/**
 * qa_debug.ts — Boot diagnostic + scene screenshot tool for focused QA.
 * Takes screenshots of specific scenes by jumping directly to them.
 * Usage: npx tsx scripts/qa_scenes.ts
 */
import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3003';
const OUT_DIR  = path.join('screenshots', 'qa', 'focused_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
fs.mkdirSync(OUT_DIR, { recursive: true });

const errors: string[] = [];

async function shot(page: Page, name: string): Promise<string> {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸  ${file}`);
  return file;
}

async function waitForScene(page: Page, key: string, ms = 20_000): Promise<void> {
  await page.waitForFunction(
    (k: string) => {
      const g = (window as any).game;
      return g?.scene?.getScenes(true).some((s: any) => s.sys?.settings?.key === k);
    },
    key,
    { timeout: ms },
  );
}

async function jumpTo(page: Page, sceneKey: string): Promise<void> {
  await page.evaluate((k: string) => {
    const g = (window as any).game;
    const active = g?.scene?.getScenes(true).map((s: any) => s.sys?.settings?.key) ?? [];
    active.forEach((key: string) => g.scene.stop(key));
    setTimeout(() => g.scene.start(k), 150);
  }, sceneKey);
  await waitForScene(page, sceneKey, 12_000);
  await page.waitForTimeout(800);
}

async function run(): Promise<void> {
  console.log(`\nFocused QA → ${OUT_DIR}\n`);
  const browser = await chromium.launch();
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  try {
    // Boot — wait up to 120s for cold start + asset loading
    console.log('[boot] Loading game…');
    await page.goto(BASE_URL, { timeout: 30_000 });
    await page.waitForFunction(
      () => !!(window as any).game?.isBooted,
      { timeout: 60_000 },
    );

    // Check if loader finished or stuck
    const loaderStatus = await page.evaluate(() => {
      const g = (window as any).game;
      const scenes = g?.scene?.getScenes(true).map((s: any) => s.sys?.settings?.key) ?? [];
      const boot = g?.scene?.getScene('BootScene') as any;
      return {
        activeScenes: scenes,
        loaderProgress: boot?.load?.progress ?? 'n/a',
        loaderActive: boot?.load?.isLoading?.() ?? 'n/a',
      };
    });
    console.log('[boot] Status:', JSON.stringify(loaderStatus));

    await waitForScene(page, 'MainMenuScene', 90_000);
    await page.waitForTimeout(1500);

    // ── Main Menu ───────────────────────────────────────────────────────────
    console.log('[1] Main Menu');
    await shot(page, '01_main_menu');

    // ── Lobby (Multiplayer) ─────────────────────────────────────────────────
    console.log('[2] Lobby Scene');
    await jumpTo(page, 'LobbyScene');
    await shot(page, '02_lobby');
    await page.waitForTimeout(3000); // let AI players join
    await shot(page, '02b_lobby_players_joined');

    // ── SquadBuilder ────────────────────────────────────────────────────────
    console.log('[3] SquadBuilder');
    await jumpTo(page, 'SquadBuilderScene');
    await shot(page, '03_squad_builder');

    // ── ArcadeBattle ────────────────────────────────────────────────────────
    console.log('[4] Arcade Battle');
    await jumpTo(page, 'ArcadeBattleScene');
    await shot(page, '04_arcade_battle');
    await page.waitForTimeout(2000);
    await shot(page, '04b_arcade_battle_live');

    // ── Campaign ───────────────────────────────────────────────────────────
    console.log('[5] Campaign');
    await jumpTo(page, 'CampaignScene');
    await shot(page, '05_campaign');

    // ── Debrief (Campaign portrait test) ───────────────────────────────────
    console.log('[6] Debrief');
    await jumpTo(page, 'DebriefScene');
    await shot(page, '06_debrief_load');
    await page.waitForTimeout(2000);
    await shot(page, '06b_debrief_dialogue');

    // ── Encyclopedia ────────────────────────────────────────────────────────
    console.log('[7] Encyclopedia');
    await jumpTo(page, 'EncyclopediaScene');
    await shot(page, '07_encyclopedia');

    // ── Settings ────────────────────────────────────────────────────────────
    console.log('[8] Settings');
    await jumpTo(page, 'SettingsScene');
    await shot(page, '08_settings');

    // ── Survival ────────────────────────────────────────────────────────────
    console.log('[9] Survival');
    await jumpTo(page, 'SurvivalScene');
    await shot(page, '09_survival');

    // ── TurnBasedBattle ─────────────────────────────────────────────────────
    console.log('[10] TurnBasedBattle');
    await jumpTo(page, 'TurnBasedBattleScene');
    await shot(page, '10_turn_based');

  } catch (err) {
    console.error('QA failed:', (err as Error).message);
    await shot(page, 'ERROR_STATE');
  }

  // Write error log
  const errorFile = path.join(OUT_DIR, 'errors.json');
  fs.writeFileSync(errorFile, JSON.stringify(errors, null, 2));
  console.log(`\nErrors captured: ${errors.length} → ${errorFile}`);

  await browser.close();
  console.log(`\nDone → ${OUT_DIR}`);
}

run();
