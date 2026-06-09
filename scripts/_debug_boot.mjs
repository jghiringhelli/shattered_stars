import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

console.log('Navigating...');
await page.goto('http://localhost:3003', { timeout: 30_000 });
console.log('Page loaded. Waiting 20s for game to boot...');
await page.waitForTimeout(20_000);
await page.screenshot({ path: 'screenshots/vqa/debug_boot.png' });

const state = await page.evaluate(() => {
  const g = window.game;
  if (!g) return { game: 'not found' };
  return {
    isBooted: g.isBooted,
    activeScenes: g.scene?.getScenes(true)?.map(s => s.sys?.settings?.key),
    allScenes: g.scene?.scenes?.map(s => ({ key: s.sys?.settings?.key, active: s.sys?.settings?.active })),
  };
});

console.log(JSON.stringify({ state, errors }, null, 2));
await browser.close();
