/**
 * Quick diagnostic — checks what state the game is in after page load.
 * Usage: npx tsx scripts/qa_debug.ts
 */
import { chromium } from 'playwright';
import * as fs from 'fs';

async function debug(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));

  console.log('Navigating to http://localhost:3003...');
  await page.goto('http://localhost:3003', { timeout: 30_000 });

  // Wait 5s and take snapshot
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'screenshots/debug_5s.png' });
  fs.mkdirSync('screenshots', { recursive: true });

  const s1 = await page.evaluate(() => {
    const g = (window as any).game;
    if (!g) return { game: 'NOT_FOUND' };
    return {
      isBooted: g.isBooted,
      isRunning: g.isRunning,
      rendererType: g.renderer?.type,
      activeScenes: g.scene?.getScenes(true)?.map((s: any) => s.sys?.settings?.key) ?? [],
      allSceneKeys: g.scene?.scenes?.map((s: any) => s.sys?.settings?.key) ?? [],
    };
  });

  console.log('\n=== State at 5s ===');
  console.log(JSON.stringify(s1, null, 2));

  // Wait another 10s
  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'screenshots/debug_15s.png' });

  const s2 = await page.evaluate(() => {
    const g = (window as any).game;
    if (!g) return { game: 'NOT_FOUND' };
    return {
      isBooted: g.isBooted,
      isRunning: g.isRunning,
      activeScenes: g.scene?.getScenes(true)?.map((s: any) => s.sys?.settings?.key) ?? [],
    };
  });

  console.log('\n=== State at 15s ===');
  console.log(JSON.stringify(s2, null, 2));

  console.log('\n=== Console Logs ===');
  logs.forEach((l) => console.log(l));

  await browser.close();
  console.log('\nScreenshots saved: screenshots/debug_5s.png, screenshots/debug_15s.png');
}

debug().catch((err) => {
  console.error('Debug failed:', err);
  process.exit(1);
});
