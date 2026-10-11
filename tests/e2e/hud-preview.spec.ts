/**
 * HUD preview — renders every holographic HUD component in HudPreviewScene,
 * asserts it runs without errors, that edge arrows cover all four screen
 * edges and stay on screen at any zoom, and saves review screenshots to
 * screenshots/review/hud-*.png.
 */

import { test, expect, type Page } from "@playwright/test";
import { collectErrors, waitForScene } from "./helpers/game";

const SHOT_DIR = "screenshots/review";
const SCENE_KEY = "HudPreviewScene";
const FROZEN_TIME_MS = 1500;
const VIEW = { width: 1280, height: 720 } as const;
const EDGE_INSET = 26;
const EDGE_TOLERANCE = 1;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const CLIPS = {
  radar: { x: 530, y: 516, width: 220, height: 204 },
  ring: { x: 520, y: 240, width: 240, height: 240 },
  weapons: { x: 720, y: 616, width: 350, height: 100 },
  menu: { x: 0, y: 0, width: 330, height: 290 },
} as const satisfies Record<string, Rect>;

async function startPreview(page: Page): Promise<void> {
  await page.goto("/");
  await waitForScene(page, "MainMenuScene", 60_000);
  await page.evaluate((key) => {
    const game = (window as any).game;
    for (const scene of game.scene.getScenes(true))
      game.scene.stop(scene.scene.key);
    game.scene.start(key);
  }, SCENE_KEY);
  await waitForScene(page, SCENE_KEY);
}

async function waitFrames(page: Page, frames: number): Promise<void> {
  const start = await page.evaluate(
    () => (window as any).game.loop.frame as number,
  );
  await page.waitForFunction(
    (target) => (window as any).game.loop.frame >= target,
    start + frames,
  );
}

async function setPreview(
  page: Page,
  state: Record<string, unknown>,
): Promise<void> {
  await page.evaluate(
    ({ key, s }) => (window as any).game.scene.getScene(key).setPreviewState(s),
    { key: SCENE_KEY, s: state },
  );
  await waitFrames(page, 3);
}

async function edgeArrows(page: Page): Promise<Point[]> {
  return page.evaluate(
    (key) => (window as any).game.scene.getScene(key).edgeArrowPositions(),
    SCENE_KEY,
  );
}

async function expectArrowsClearOfCluster(page: Page): Promise<void> {
  const [arrows, cluster] = await page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    return [scene.edgeArrowPositions(), scene.hudClusterBounds()] as [
      Point[],
      Rect[],
    ];
  }, SCENE_KEY);
  expect(cluster.length).toBe(3);
  for (const a of arrows) {
    for (const r of cluster) {
      const inside =
        a.x > r.x && a.x < r.x + r.width && a.y > r.y && a.y < r.y + r.height;
      expect(
        inside,
        `arrow ${JSON.stringify(a)} overlaps HUD widget ${JSON.stringify(r)}`,
      ).toBe(false);
    }
  }
}

/** Convert a rect in game coordinates (1280×720) to page pixels. */
async function toPageClip(page: Page, rect: Rect): Promise<Rect> {
  const box = (await page.locator("canvas").boundingBox())!;
  const sx = box.width / VIEW.width;
  const sy = box.height / VIEW.height;
  return {
    x: box.x + rect.x * sx,
    y: box.y + rect.y * sy,
    width: rect.width * sx,
    height: rect.height * sy,
  };
}

async function shoot(page: Page, name: string, rect?: Rect): Promise<void> {
  const path = `${SHOT_DIR}/hud-${name}.png`;
  if (rect === undefined) {
    await page.locator("canvas").screenshot({ path });
    return;
  }
  await page.screenshot({ path, clip: await toPageClip(page, rect) });
}

function expectAllOnScreen(arrows: ReadonlyArray<Point>): void {
  for (const a of arrows) {
    expect(a.x).toBeGreaterThanOrEqual(EDGE_INSET - EDGE_TOLERANCE);
    expect(a.x).toBeLessThanOrEqual(VIEW.width - EDGE_INSET + EDGE_TOLERANCE);
    expect(a.y).toBeGreaterThanOrEqual(EDGE_INSET - EDGE_TOLERANCE);
    expect(a.y).toBeLessThanOrEqual(VIEW.height - EDGE_INSET + EDGE_TOLERANCE);
  }
}

const near = (value: number, target: number): boolean =>
  Math.abs(value - target) <= EDGE_TOLERANCE;

test.describe("HUD preview", () => {
  test("renders every holo HUD component and saves review screenshots", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await startPreview(page);
    const consoleErrorsAtStart = errors.consoleErrors.length;
    const calm = {
      frozen: true,
      timeMs: FROZEN_TIME_MS,
      zoom: 1,
      stress: 0.05,
      isStressed: false,
      hull: 6,
      shields: 2.5,
    };

    await test.step("overview + radar with contacts", async () => {
      await setPreview(page, { ...calm, showMenu: true });
      await shoot(page, "overview");
      await shoot(page, "radar", CLIPS.radar);
    });

    await test.step("edge arrows on all four sides", async () => {
      await setPreview(page, { showMenu: false });
      const arrows = await edgeArrows(page);
      expect(arrows.some((a) => near(a.x, EDGE_INSET))).toBe(true);
      expect(arrows.some((a) => near(a.x, VIEW.width - EDGE_INSET))).toBe(true);
      expect(arrows.some((a) => near(a.y, EDGE_INSET))).toBe(true);
      expect(arrows.some((a) => near(a.y, VIEW.height - EDGE_INSET))).toBe(
        true,
      );
      expectAllOnScreen(arrows);
      await expectArrowsClearOfCluster(page);
      await shoot(page, "edges");
    });

    await test.step("status ring calm vs stressed", async () => {
      await setPreview(page, { ...calm, zoom: 1.6, showMenu: false });
      await shoot(page, "ring-calm", CLIPS.ring);
      await setPreview(page, {
        stress: 0.92,
        isStressed: true,
        hull: 2,
        shields: 0.5,
      });
      await shoot(page, "ring-stressed", CLIPS.ring);
    });

    await test.step("weapon bar with cooldowns and charges", async () => {
      await setPreview(page, { ...calm, showMenu: false });
      await shoot(page, "weapons", CLIPS.weapons);
    });

    await test.step("HUD is pixel-stable across camera zoom", async () => {
      for (const zoom of [0.8, 2]) {
        await setPreview(page, { ...calm, zoom, showMenu: false });
        expectAllOnScreen(await edgeArrows(page));
        await expectArrowsClearOfCluster(page);
        await shoot(page, `zoom-${Math.round(zoom * 100)}`);
      }
    });

    await test.step("menu panel and button states", async () => {
      await setPreview(page, { ...calm, showMenu: true });
      await shoot(page, "menu", CLIPS.menu);
    });

    await test.step("animates without errors", async () => {
      await setPreview(page, {
        frozen: false,
        stress: undefined,
        isStressed: undefined,
      });
      await waitFrames(page, 60);
      expect(
        await page.evaluate(
          (key) => (window as any).game.scene.isActive(key),
          SCENE_KEY,
        ),
      ).toBe(true);
    });

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors.slice(consoleErrorsAtStart)).toEqual([]);
  });
});
