/**
 * Visual QA script — tours every major scene, captures screenshots and
 * console logs, then writes a JSON summary alongside the PNGs.
 *
 * Usage:
 *   npx tsx scripts/visual_qa.ts
 *
 * The Vite dev server must already be running on port 3003 before executing.
 * Output goes to screenshots/qa/<timestamp>/
 */

import { chromium, type Page, type Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3003';
const OUT_DIR = path.join('screenshots', 'qa', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

// ------------------------------------------------------------------ helpers --

const logs: Array<{ time: string; level: string; text: string }> = [];

function save(page: Page): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  page.on('console', (msg) => {
    logs.push({ time: new Date().toISOString(), level: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    logs.push({ time: new Date().toISOString(), level: 'pageerror', text: err.message });
  });
}

async function shot(page: Page, name: string): Promise<string> {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸  ${file}`);
  return file;
}

async function waitForScene(page: Page, key: string, ms = 15_000): Promise<void> {
  await page.waitForFunction(
    (k: string) => {
      const g = (window as any).game;
      if (!g || !g.scene) return false;
      const scenes = g.scene.getScenes(true); // active/running scenes only
      return scenes.some((s: any) => s.sys?.settings?.key === k);
    },
    key,
    { timeout: ms },
  );
}

async function pressKey(page: Page, key: string, code: string, keyCode: number): Promise<void> {
  await page.evaluate(
    ([k, c, kc]: [string, string, number]) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: c, keyCode: kc, bubbles: true }));
    },
    [key, code, keyCode] as [string, string, number],
  );
  await page.waitForTimeout(50);
  await page.evaluate(
    ([k, c, kc]: [string, string, number]) => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: k, code: c, keyCode: kc, bubbles: true }));
    },
    [key, code, keyCode] as [string, string, number],
  );
}

async function holdKey(page: Page, key: string, code: string, keyCode: number, ms: number): Promise<void> {
  await page.evaluate(
    ([k, c, kc]: [string, string, number]) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: c, keyCode: kc, bubbles: true }));
    },
    [key, code, keyCode] as [string, string, number],
  );
  await page.waitForTimeout(ms);
  await page.evaluate(
    ([k, c, kc]: [string, string, number]) => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: k, code: c, keyCode: kc, bubbles: true }));
    },
    [key, code, keyCode] as [string, string, number],
  );
}

// Force-jump to a scene: stop everything first, then start target
async function jumpToScene(page: Page, sceneKey: string): Promise<void> {
  await page.evaluate((k: string) => {
    const g = (window as any).game;
    if (!g) return;
    // Stop all currently running scenes so we get a clean slate
    const active: any[] = g.scene.getScenes(true) ?? [];
    for (const s of active) {
      g.scene.stop(s.sys.settings.key);
    }
    // Give Phaser one tick to process stops, then start target
    setTimeout(() => g.scene.start(k), 100);
  }, sceneKey);
}

// -------------------------------------------------------------------- main --

async function run(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\nVisual QA run → ${OUT_DIR}\n`);

  const browser: Browser = await chromium.launch();  // default args match E2E test setup
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  save(page);

  try {
    // ── 1. Boot + Main Menu ──────────────────────────────────────────────────
    console.log('[ 1 / 7 ]  Boot → Main Menu');
    await page.goto(BASE_URL, { timeout: 90_000 });
    await waitForScene(page, 'MainMenuScene', 90_000);
    await page.waitForTimeout(2200); // wait for stagger-in animation to finish
    await shot(page, '01_main_menu');

    // ── 2. SKIRMISH → Squad Builder ──────────────────────────────────────────
    console.log('[ 2 / 7 ]  SKIRMISH → Squad Builder (arcade mode)');
    // Navigate via keyboard: down to SKIRMISH (item 0), press Enter
    await pressKey(page, 'Enter', 'Enter', 13);
    await waitForScene(page, 'SquadBuilderScene', 8_000);
    await page.waitForTimeout(500);
    await shot(page, '02_squad_builder_arcade');

    // ── 3. Launch arcade battle ──────────────────────────────────────────────
    console.log('[ 3 / 7 ]  Squad Builder → Launch ArcadeBattle');
    // Click START BATTLE button (look for it, or use page.evaluate)
    await page.evaluate(() => {
      const g = (window as any).game;
      const sb = g?.scene?.getScene('SquadBuilderScene') as any;
      // Directly call startBattle via registry path: set mode=arcade already
      // The start button is in the scene — trigger pointerdown event on it
      if (sb?.startButton) {
        const btn = sb.startButton;
        btn.emit('pointerdown');
      } else {
        // Fallback: jump directly
        g?.scene?.start('ArcadeBattleScene');
      }
    });
    await waitForScene(page, 'ArcadeBattleScene', 10_000);
    await page.waitForTimeout(800);
    await shot(page, '03_arcade_battle_start');

    // ── 4. Arcade gameplay — turn and fire ───────────────────────────────────
    console.log('[ 4 / 7 ]  Arcade gameplay simulation');

    // Thrust up to speed 4
    for (let i = 0; i < 3; i++) {
      await pressKey(page, 'ArrowUp', 'ArrowUp', 38);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);
    await shot(page, '04a_arcade_thrust');

    // Hold right to turn
    await holdKey(page, 'ArrowRight', 'ArrowRight', 39, 1200);
    await page.waitForTimeout(300);
    await shot(page, '04b_arcade_turning_right');

    // Fire several shots
    for (let i = 0; i < 5; i++) {
      await pressKey(page, ' ', 'Space', 32);
      await page.waitForTimeout(600);
    }
    await shot(page, '04c_arcade_fired_shots');

    // Turn left and hold
    await holdKey(page, 'ArrowLeft', 'ArrowLeft', 37, 1000);
    await page.waitForTimeout(200);

    // Let the battle run for 5 more seconds
    await page.waitForTimeout(5000);
    await shot(page, '04d_arcade_mid_battle');

    // ── 5. Pause overlay ─────────────────────────────────────────────────────
    console.log('[ 5 / 7 ]  Pause overlay');
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    });
    await page.waitForTimeout(400);
    await shot(page, '05_pause_overlay');

    // Resume
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    });
    await page.waitForTimeout(200);

    // ── 6. Other scenes via direct jump ──────────────────────────────────────
    const scenesToVisit: Array<[string, string]> = [
      ['MainMenuScene',        '06_main_menu_return'],
      ['SurvivalScene',        '07_survival_scene'],
      ['AceDuelScene',         '08_ace_duel_scene'],
      ['EpicBattleScene',      '09_epic_battle_scene'],
      ['CampaignScene',        '10_campaign_scene'],
      ['SettingsScene',        '11_settings_scene'],
      ['CreditsScene',         '12_credits_scene'],
    ];

    for (const [sceneKey, shotName] of scenesToVisit) {
      console.log(`[ 6 / 7 ]  Jump to ${sceneKey}`);
      await jumpToScene(page, sceneKey);
      try {
        await waitForScene(page, sceneKey, 10_000);
        await page.waitForTimeout(1500); // let scene render fully

        // For CreditsScene, fast-forward scroll so content is visible
        if (sceneKey === 'CreditsScene') {
          await page.evaluate(() => {
            const cs = (window as any).game?.scene?.getScene('CreditsScene') as any;
            if (cs?.creditsContainer) {
              cs.creditsContainer.y = cs.scale.height * 0.4; // put first credits at ~40% down screen
            }
          });
          await page.waitForTimeout(200);
        }

        await shot(page, shotName);
      } catch {
        console.log(`         ⚠  ${sceneKey} did not become active in time`);
        await shot(page, `${shotName}_timeout`);
      }
    }

    // ── 7. Write console log summary ─────────────────────────────────────────
    console.log('[ 7 / 7 ]  Writing logs');
    const errors = logs.filter((l) => l.level === 'error' || l.level === 'pageerror');
    const warnings = logs.filter((l) => l.level === 'warning' || l.level === 'warn');

    const summary = {
      run: OUT_DIR,
      totalLogs: logs.length,
      errors: errors.length,
      warnings: warnings.length,
      errorMessages: errors.map((l) => l.text),
      warningMessages: warnings.map((l) => l.text),
      allLogs: logs,
    };

    const summaryFile = path.join(OUT_DIR, 'console_log.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`\n  Logs written → ${summaryFile}`);
    console.log(`  Errors: ${errors.length}  Warnings: ${warnings.length}\n`);

    if (errors.length > 0) {
      console.log('  ERROR MESSAGES:');
      errors.forEach((e) => console.log(`    ✗  ${e.text}`));
    }

  } finally {
    await browser.close();
  }

  console.log(`\nDone. Screenshots in: ${OUT_DIR}\n`);
}

run().catch((err) => {
  console.error('Visual QA failed:', err);
  process.exit(1);
});
