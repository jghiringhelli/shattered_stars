/**
 * E2E Test Helpers for Shattered Stars
 *
 * Utilities for interacting with the Phaser game via window.game,
 * converting game-world coordinates to viewport coordinates for clicks,
 * and waiting for scene transitions.
 */

import type { Page } from '@playwright/test';

// ─────────────────────────────────────────────
// Scene helpers
// ─────────────────────────────────────────────

/** Wait until a named Phaser scene becomes the active (running) scene. */
export async function waitForScene(
  page: Page,
  sceneKey: string,
  timeout = 30_000
): Promise<void> {
  await page.waitForFunction(
    (key: string) => {
      const g = (window as any).game;
      return g?.isBooted === true && g.scene.isActive(key);
    },
    sceneKey,
    { timeout }
  );
}

/**
 * Wait until the MainMenuScene has finished its stagger-in animation.
 * Menu items slide from x=-200 to x≈640 with delay 500+i*100ms.
 * The LAST item (index 7, CREDITS) finishes at delay=1200ms + 500ms duration = 1700ms.
 * We poll the LAST item's x so we know ALL items are ready to click.
 */
export async function waitForMenuReady(page: Page): Promise<void> {
  // Allow up to 50s for cold Vite boot with 4 parallel workers
  await waitForScene(page, 'MainMenuScene', 50_000);
  await page.waitForFunction(
    () => {
      const g = (window as any).game;
      const scene = g?.scene.getScene('MainMenuScene') as any;
      if (!scene?.menuItems?.length) return false;
      const lastItem = scene.menuItems[scene.menuItems.length - 1];
      return lastItem?.x > 600;
    },
    { timeout: 15_000 }
  );
}

// ─────────────────────────────────────────────
// Coordinate helpers
// ─────────────────────────────────────────────

interface CanvasTransform {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

/** Return conversion factors between Phaser game coords (1280×720) and real viewport pixels. */
async function getCanvasTransform(page: Page): Promise<CanvasTransform> {
  const box = (await page.locator('canvas').boundingBox())!;
  const { gw, gh } = await page.evaluate(() => {
    const g = (window as any).game;
    return { gw: g.scale.gameSize.width as number, gh: g.scale.gameSize.height as number };
  });
  return {
    offsetX: box.x,
    offsetY: box.y,
    scaleX: box.width / gw,
    scaleY: box.height / gh,
  };
}

/** Click at a position expressed in Phaser game-world coordinates (not viewport pixels). */
export async function clickGameCoord(page: Page, gameX: number, gameY: number): Promise<void> {
  const { offsetX, offsetY, scaleX, scaleY } = await getCanvasTransform(page);
  await page.mouse.click(offsetX + gameX * scaleX, offsetY + gameY * scaleY);
}

// ─────────────────────────────────────────────
// Keyboard helpers
// ─────────────────────────────────────────────

/**
 * Dispatch a keydown event directly to window.
 * Phaser 3 registers its keyboard listeners on window (not the canvas),
 * so this reliably fires Phaser key handlers regardless of DOM focus.
 * keyCode is required because Phaser's KeyboardPlugin identifies keys by keyCode.
 */
export async function pressGameKey(page: Page, key: string): Promise<void> {
  const KEY_CODES: Record<string, number> = {
    Escape: 27, Space: 32, Enter: 13,
    ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
  };
  const keyCode = KEY_CODES[key] ?? 0;
  await page.evaluate(([k, kc]: [string, number]) => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: k, code: k, keyCode: kc, which: kc,
      bubbles: true, cancelable: true,
    } as KeyboardEventInit));
  }, [key, keyCode] as [string, number]);
}

// ─────────────────────────────────────────────
// Menu helpers
// ─────────────────────────────────────────────

// MainMenuScene: startY = 250, spacing = 55, centerX = 640
// Items (0-indexed): SKIRMISH SURVIVAL EPIC_BATTLE DOGFIGHT ACE_DUEL CAMPAIGN ONLINE SETTINGS ENCYCLOPEDIA CREDITS
const MENU_POSITIONS: Record<string, number> = {
  SKIRMISH:      0,
  SURVIVAL:      1,
  'EPIC BATTLE': 2,
  DOGFIGHT:      3,
  'ACE DUEL':    4,
  CAMPAIGN:      5,
  ONLINE:        6,
  SETTINGS:      7,
  ENCYCLOPEDIA:  8,
  CREDITS:       9,
};

/** Click a main-menu item by its visible label. */
export async function clickMenuItem(
  page: Page,
  label: keyof typeof MENU_POSITIONS
): Promise<void> {
  const index = MENU_POSITIONS[label];
  if (index === undefined) throw new Error(`Unknown menu label: ${label}`);
  await clickGameCoord(page, 640, 230 + index * 50);
}

// ─────────────────────────────────────────────
// Scene state helpers
// ─────────────────────────────────────────────

/**
 * Read a value from a live Phaser scene using a dot-path accessor string.
 * Works for any depth of properties, including Map getters (e.g. 'ships.size').
 * Note: TypeScript private fields are accessible at JS runtime.
 */
export async function readSceneState<T>(
  page: Page,
  sceneKey: string,
  accessor: string
): Promise<T> {
  return page.evaluate(
    ([key, acc]: [string, string]) => {
      const scene = (window as any).game?.scene.getScene(key) as any;
      if (!scene) return undefined;
      return (acc as string)
        .split('.')
        .reduce((obj: any, k: string) => obj?.[k], scene) as unknown;
    },
    [sceneKey, accessor] as [string, string]
  ) as Promise<T>;
}

// ─────────────────────────────────────────────
// Console / error monitoring
// ─────────────────────────────────────────────

export interface ConsoleErrorLog {
  consoleErrors: string[];
  pageErrors: string[];
}

/**
 * Attach console/pageerror listeners for the duration of a test.
 * Ignores headless WebGL/Framebuffer/favicon noise that does not affect gameplay.
 * Returns the log object — inspect after the test actions complete.
 */
export function collectErrors(page: Page): ConsoleErrorLog {
  const log: ConsoleErrorLog = { consoleErrors: [], pageErrors: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (
        !t.includes('WebGL') &&
        !t.includes('Framebuffer') &&
        !t.includes('favicon') &&
        !t.includes('Failed to process file') && // missing ship art textures
        !t.includes('WebSocket connection')        // no P2P server in test env
      ) {
        log.consoleErrors.push(t);
      }
    }
  });
  page.on('pageerror', (err) => log.pageErrors.push(err.message));
  return log;
}

/**
 * Attach listeners that print but do not collect.
 * Use `collectErrors` when you need to assert zero errors.
 */
export function suppressWebGLNoise(page: Page): void {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (
        !t.includes('WebGL') &&
        !t.includes('Framebuffer') &&
        !t.includes('favicon') &&
        !t.includes('Failed to process file') &&
        !t.includes('WebSocket connection')
      ) {
        console.warn('[console.error]', t);
      }
    }
  });
  page.on('pageerror', (err) => console.error('[page error]', err.message));
}
