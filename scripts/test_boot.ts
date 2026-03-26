import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('LOG:', msg.text()));
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));
  
  await page.setViewportSize({ width: 1280, height: 720 });
  console.log('Navigating...');
  await page.goto('http://localhost:3003', { timeout: 30000 });
  
  console.log('Waiting for game...');
  await page.waitForTimeout(5000);
  
  // Check game state
  const gameState = await page.evaluate(() => {
    const g = (window as any).game;
    return {
      exists: !!g,
      isBooted: g?.isBooted,
      isRunning: g?.isRunning,
      scenes: g?.scene?.getScenes(true)?.map((s: any) => s.sys?.settings?.key) ?? []
    };
  });
  
  console.log('Game state:', JSON.stringify(gameState, null, 2));
  
  await browser.close();
}

test().catch(console.error);
