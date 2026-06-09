/**
 * Visual QA screenshots for SquadBuilderScene.
 * Run: node scripts/squad_builder_vqa.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3003';
const OUT = 'screenshots/vqa/squad-builder-qa';
fs.mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  const f = path.join(OUT, name + '.png');
  await page.screenshot({ path: f });
  console.log('📸', f);
};

const waitForScene = async (page, key) => {
  await page.waitForFunction((k) => (window).game?.scene?.isActive(k), key, { timeout: 20000 });
  await page.waitForTimeout(800);
};

const jumpTo = async (page, key, cfg) => {
  await page.evaluate(([k, c]) => {
    const g = window.game;
    g.scene.getScenes(true).forEach((s) => g.scene.stop(s.sys.settings.key));
    setTimeout(() => g.scene.start(k, c), 150);
  }, [key, cfg ?? {}]);
};

(async () => {
  const br = await chromium.launch({ headless: true });
  const pg = await br.newPage({ viewport: { width: 1280, height: 720 } });

  // Suppress WebGL noise
  pg.on('console', () => {});

  await pg.goto(BASE);
  await pg.waitForFunction(() => window.game?.isBooted, { timeout: 15000 });
  await pg.waitForTimeout(3000); // let boot finish

  // ── 1. Default state: 2 squads, 1v1 ─────────────────────────────────────────
  await jumpTo(pg, 'SquadBuilderScene', { initialMode: 'arcade' });
  await waitForScene(pg, 'SquadBuilderScene');
  await pg.waitForFunction(
    () => window.game.scene.getScene('SquadBuilderScene')?.factionSlots?.length > 0,
    { timeout: 10000 },
  );
  await pg.waitForTimeout(500);
  await shot(pg, '01_default_1v1');

  // ── 2. Expanded card (click header strip on first card) ──────────────────────
  // Trigger via JS since we can't reliably hit the pixel
  await pg.evaluate(() => {
    const s = window.game.scene.getScene('SquadBuilderScene');
    // Force first card to expanded by emitting changed after toggling
    const squadListPanel = s.squadListPanel;
    // Access the cards array and toggle expanded state
    const card = squadListPanel.cards?.[0];
    if (card) {
      card.expanded = true;
      card.emit('changed');
    }
    squadListPanel.render();
  });
  await pg.waitForTimeout(400);
  await shot(pg, '02_card_expanded');

  // ── 3. Team assignment — move slot 0 to T2 (same team error scenario) ───────
  await pg.evaluate(() => {
    const s = window.game.scene.getScene('SquadBuilderScene');
    s.squads.forEach((sq) => { sq.teamId = 1; });
    s.squadListPanel.render();
  });
  await pg.waitForTimeout(300);
  await shot(pg, '03_all_same_team');

  // ── 4. Attempt start with all same team — error message ─────────────────────
  await pg.evaluate(() => {
    window.game.scene.getScene('SquadBuilderScene').startBattle();
  });
  await pg.waitForTimeout(300);
  await shot(pg, '04_start_error_same_team');

  // ── 5. Reset to 1v1, clear ships, attempt start ───────────────────────────
  await pg.evaluate(() => {
    const s = window.game.scene.getScene('SquadBuilderScene');
    s.squads[0].teamId = 1;
    s.squads[1].teamId = 2;
    s.squads[0].ships = [];
    s.squads[0].pointsUsed = 0;
    s.squadListPanel.render();
  });
  await pg.waitForTimeout(300);
  await pg.evaluate(() => {
    window.game.scene.getScene('SquadBuilderScene').startBattle();
  });
  await pg.waitForTimeout(300);
  await shot(pg, '05_start_error_no_ships');

  // ── 6. 2v2 layout ────────────────────────────────────────────────────────────
  await pg.evaluate(() => {
    const s = window.game.scene.getScene('SquadBuilderScene');
    // Reset + add two more squads
    const { makeSquad } = window.__squadTypes ?? {};
    s.squads = [
      { teamId: 1, factionId: 'terran_hegemony', controller: 'player', ships: [], loadoutChoices: {}, pointsUsed: 0 },
      { teamId: 1, factionId: 'free_confederation', controller: 'ai', ships: [], loadoutChoices: {}, pointsUsed: 0 },
      { teamId: 2, factionId: 'synthetic_collective', controller: 'ai', ships: [], loadoutChoices: {}, pointsUsed: 0 },
      { teamId: 2, factionId: 'void_corsairs', controller: 'ai', ships: [], loadoutChoices: {}, pointsUsed: 0 },
    ];
    s.squadListPanel.update({ squads: s.squads });
    s.squadListPanel.autoFillAll();
    s.squadListPanel.render();
  });
  await pg.waitForTimeout(500);
  await shot(pg, '06_2v2_layout');

  // ── 7. FFA: 4 teams, 1 squad each ────────────────────────────────────────────
  await pg.evaluate(() => {
    const s = window.game.scene.getScene('SquadBuilderScene');
    s.squads = [
      { teamId: 1, factionId: 'terran_hegemony', controller: 'player', ships: [], loadoutChoices: {}, pointsUsed: 0 },
      { teamId: 2, factionId: 'free_confederation', controller: 'ai', ships: [], loadoutChoices: {}, pointsUsed: 0 },
      { teamId: 3, factionId: 'synthetic_collective', controller: 'ai', ships: [], loadoutChoices: {}, pointsUsed: 0 },
      { teamId: 4, factionId: 'void_corsairs', controller: 'ai', ships: [], loadoutChoices: {}, pointsUsed: 0 },
    ];
    s.squadListPanel.update({ squads: s.squads });
    s.squadListPanel.autoFillAll();
    s.squadListPanel.render();
  });
  await pg.waitForTimeout(500);
  await shot(pg, '07_ffa_4teams');

  // ── 8. Epic mode ──────────────────────────────────────────────────────────────
  await jumpTo(pg, 'SquadBuilderScene', { initialMode: 'epic' });
  await waitForScene(pg, 'SquadBuilderScene');
  await pg.waitForFunction(
    () => window.game.scene.getScene('SquadBuilderScene')?.factionSlots?.length > 0,
    { timeout: 10000 },
  );
  await pg.waitForTimeout(500);
  await shot(pg, '08_epic_mode');

  console.log('\n✅ Done — screenshots in', OUT);
  await br.close();
})();
