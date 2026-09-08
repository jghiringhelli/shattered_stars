/**
 * E2E Test Helpers for Shattered Stars
 *
 * Utilities for interacting with the Phaser game via window.game,
 * converting game-world coordinates to viewport coordinates for clicks,
 * and waiting for scene transitions.
 */

import type { Page } from "@playwright/test";

// ─────────────────────────────────────────────
// Scene helpers
// ─────────────────────────────────────────────

/** Wait until a named Phaser scene becomes the active (running) scene. */
export async function waitForScene(
  page: Page,
  sceneKey: string,
  timeout = 30_000,
): Promise<void> {
  await page.waitForFunction(
    (key: string) => {
      const g = (window as any).game;
      return g?.isBooted === true && g.scene.isActive(key);
    },
    sceneKey,
    { timeout },
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
  await waitForScene(page, "MainMenuScene", 50_000);
  await page.waitForFunction(
    () => {
      const g = (window as any).game;
      const scene = g?.scene.getScene("MainMenuScene") as any;
      if (!scene?.menuItems?.length) return false;
      const lastItem = scene.menuItems[scene.menuItems.length - 1];
      return lastItem?.x > 600;
    },
    { timeout: 15_000 },
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
  const box = (await page.locator("canvas").boundingBox())!;
  const { gw, gh } = await page.evaluate(() => {
    const g = (window as any).game;
    return {
      gw: g.scale.gameSize.width as number,
      gh: g.scale.gameSize.height as number,
    };
  });
  return {
    offsetX: box.x,
    offsetY: box.y,
    scaleX: box.width / gw,
    scaleY: box.height / gh,
  };
}

/** Click at a position expressed in Phaser game-world coordinates (not viewport pixels). */
export async function clickGameCoord(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
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
const KEY_CODES: Record<string, number> = {
  Escape: 27,
  Space: 32,
  Enter: 13,
  Tab: 9,
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
  Shift: 16,
  Digit1: 49,
  Digit2: 50,
  Digit3: 51,
  Digit4: 52,
  A: 65,
  B: 66,
  C: 67,
  D: 68,
  E: 69,
  F: 70,
  G: 71,
  Q: 81,
  R: 82,
  S: 83,
  T: 84,
  W: 87,
  X: 88,
  Z: 90,
};

async function dispatchGameKey(
  page: Page,
  type: "keydown" | "keyup",
  key: string,
  shiftKey: boolean,
): Promise<void> {
  const keyCode = KEY_CODES[key] ?? 0;
  await page.evaluate(
    ([t, k, kc, shift]: [string, string, number, boolean]) => {
      window.dispatchEvent(
        new KeyboardEvent(t, {
          key: k,
          code: k,
          keyCode: kc,
          which: kc,
          shiftKey: shift,
          bubbles: true,
          cancelable: true,
        } as KeyboardEventInit),
      );
    },
    [type, key, keyCode, shiftKey] as [string, string, number, boolean],
  );
}

export async function pressGameKey(page: Page, key: string): Promise<void> {
  await dispatchGameKey(page, "keydown", key, false);
}

/**
 * Hold a key down for `holdMs` then release it — required for edge-triggered
 * (JustDown-style) intents, since `page.keyboard.press()` fires keydown+keyup
 * faster than a single Phaser frame can poll. Pass `shift: true` for bindings
 * that require the Shift modifier (dispatches a real Shift keydown/keyup
 * around the main key, matching how KeyboardAdapter tracks its own Shift key).
 */
export async function holdGameKey(
  page: Page,
  key: string,
  holdMs = 150,
  opts: { shift?: boolean } = {},
): Promise<void> {
  const shift = !!opts.shift;
  if (shift) await dispatchGameKey(page, "keydown", "Shift", true);
  await dispatchGameKey(page, "keydown", key, shift);
  await page.waitForTimeout(holdMs);
  await dispatchGameKey(page, "keyup", key, shift);
  if (shift) await dispatchGameKey(page, "keyup", "Shift", false);
}

// ─────────────────────────────────────────────
// Menu helpers
// ─────────────────────────────────────────────

// MainMenuScene: startY = 220, spacing = 46, centerX = 640
// Items (0-indexed): SKIRMISH SURVIVAL EPIC_FORMAT DOGFIGHT ACE_DUEL CAMPAIGN ONLINE SETTINGS CONTROLS ENCYCLOPEDIA CREDITS
const MENU_POSITIONS: Record<string, number> = {
  SKIRMISH: 0,
  SURVIVAL: 1,
  "EPIC FORMAT": 2,
  DOGFIGHT: 3,
  "ACE DUEL": 4,
  CAMPAIGN: 5,
  ONLINE: 6,
  SETTINGS: 7,
  CONTROLS: 8,
  ENCYCLOPEDIA: 9,
  CREDITS: 10,
};

/** Click a main-menu item by its visible label. */
export async function clickMenuItem(
  page: Page,
  label: keyof typeof MENU_POSITIONS,
): Promise<void> {
  const index = MENU_POSITIONS[label];
  if (index === undefined) throw new Error(`Unknown menu label: ${label}`);
  await clickGameCoord(page, 640, 220 + index * 46);
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
  accessor: string,
): Promise<T> {
  return page.evaluate(
    ([key, acc]: [string, string]) => {
      const scene = (window as any).game?.scene.getScene(key) as any;
      if (!scene) return undefined;
      return (acc as string)
        .split(".")
        .reduce((obj: any, k: string) => obj?.[k], scene) as unknown;
    },
    [sceneKey, accessor] as [string, string],
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
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (
        !t.includes("WebGL") &&
        !t.includes("Framebuffer") &&
        !t.includes("favicon") &&
        !t.includes("Failed to process file") && // missing ship art textures
        !t.includes("WebSocket connection") // no P2P server in test env
      ) {
        log.consoleErrors.push(t);
      }
    }
  });
  page.on("pageerror", (err) => log.pageErrors.push(err.message));
  return log;
}

/**
 * Attach listeners that print but do not collect.
 * Use `collectErrors` when you need to assert zero errors.
 */
export function suppressWebGLNoise(page: Page): void {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (
        !t.includes("WebGL") &&
        !t.includes("Framebuffer") &&
        !t.includes("favicon") &&
        !t.includes("Failed to process file") &&
        !t.includes("WebSocket connection")
      ) {
        console.warn("[console.error]", t);
      }
    }
  });
  page.on("pageerror", (err) => console.error("[page error]", err.message));
}

// ─────────────────────────────────────────────
// Debug telemetry (ship positions over time)
// ─────────────────────────────────────────────

export interface ShipPositionSample {
  t: number;
  shipId: string;
  x: number;
  y: number;
  heading?: number;
}

/**
 * Read ship-position telemetry samples from a battle scene running with
 * `?debug=1`. Returns [] if telemetry is disabled or no samples yet.
 */
export async function readShipTelemetry(
  page: Page,
): Promise<ShipPositionSample[]> {
  return page.evaluate(() => {
    const t = (
      window as unknown as { __shipTelemetry?: { getSamples(): unknown[] } }
    ).__shipTelemetry;
    return (t?.getSamples() ?? []) as unknown as never;
  }) as Promise<ShipPositionSample[]>;
}

// ─────────────────────────────────────────────
// Fake gamepad (no real hardware / CDP support needed)
// ─────────────────────────────────────────────

/**
 * Overrides `navigator.getGamepads()` with a mutable fake pad so Phaser's
 * gamepad plugin (which polls the real browser API each frame) picks it up.
 * Call once per page, then drive it with setFakeGamepadButton/Axes.
 */
export async function injectFakeGamepad(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      __fakeGamepadButtons: Set<number>;
      __fakeGamepadAxes: number[];
    };
    w.__fakeGamepadButtons = new Set<number>();
    w.__fakeGamepadAxes = [0, 0, 0, 0];
    const makePad = (): Gamepad =>
      ({
        id: "Fake Test Gamepad",
        index: 0,
        connected: true,
        timestamp: performance.now(),
        mapping: "standard",
        axes: w.__fakeGamepadAxes.slice(),
        buttons: Array.from({ length: 17 }, (_, i) => ({
          pressed: w.__fakeGamepadButtons.has(i),
          touched: w.__fakeGamepadButtons.has(i),
          value: w.__fakeGamepadButtons.has(i) ? 1 : 0,
        })),
        hapticActuators: [],
        vibrationActuator: null,
      }) as unknown as Gamepad;
    navigator.getGamepads = () => [makePad(), null, null, null];
    window.dispatchEvent(
      Object.assign(new Event("gamepadconnected"), { gamepad: makePad() }),
    );
  });
}

/** Set a single fake gamepad button's pressed state (held until changed). */
export async function setFakeGamepadButton(
  page: Page,
  button: number,
  pressed: boolean,
): Promise<void> {
  await page.evaluate(
    ([b, p]: [number, boolean]) => {
      (
        window as unknown as { __fakeGamepadButtons: Set<number> }
      ).__fakeGamepadButtons[p ? "add" : "delete"](b);
    },
    [button, pressed] as [number, boolean],
  );
}

/** Tap a fake gamepad button (press, hold, release) for edge-triggered intents. */
export async function tapFakeGamepadButton(
  page: Page,
  button: number,
  holdMs = 150,
): Promise<void> {
  await setFakeGamepadButton(page, button, true);
  await page.waitForTimeout(holdMs);
  await setFakeGamepadButton(page, button, false);
}

/** Set fake gamepad axes: [leftX, leftY, rightX, rightY], range -1..1. */
export async function setFakeGamepadAxes(
  page: Page,
  axes: [number, number, number, number],
): Promise<void> {
  await page.evaluate((a: number[]) => {
    (window as unknown as { __fakeGamepadAxes: number[] }).__fakeGamepadAxes =
      a;
  }, axes);
}
