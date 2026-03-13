/**
 * Playwright Global Setup — Pre-warm the Vite dev server.
 *
 * Vite cold TypeScript compilation on first request takes ~50s.
 * With 4 parallel workers all navigating simultaneously, each exceeds
 * the per-test timeout. This setup runs once before any test, loads the
 * page, and waits for Phaser to boot — so all workers get a warm cache.
 */

import { chromium } from '@playwright/test';

export default async function globalSetup(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:3003', { timeout: 120_000 });
    await page.waitForFunction(
      () => (window as any).game?.isBooted === true,
      { timeout: 90_000 }
    );
  } finally {
    await browser.close();
  }
}
