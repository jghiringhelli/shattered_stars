/**
 * space-map.spec.ts — seamless torus view and themed parallax space.
 *
 * Near an arena seam the far side must be drawn (extra "torus_copy" cameras
 * show the world displaced by ±arena size), stars/backdrop must exist beyond
 * the 0..6000 square, every theme must start a battle without errors, and the
 * copies must stay cheap. Screenshots of every theme go to the OS temp dir.
 */

import { test, expect, type Page } from "@playwright/test";
import * as os from "os";
import * as path from "path";
import { MAP_THEME_IDS } from "../../src/rendering/spaceMap/mapThemes";
import {
  collectErrors,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

const SCENE = "ArcadeBattleScene";
const ARENA = 6000;

/** Starts a Skirmish with `perSide` kestrels vs venoms on the given map. */
async function startSkirmish(
  page: Page,
  options: { mapTheme?: string; perSide?: number } = {},
): Promise<void> {
  await page.evaluate(
    ({ mapTheme, perSide }) => {
      const g = (window as any).game;
      g.scene
        .getScenes(true)
        .forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.registry.set("spaceQualityCap", 3);
      g.registry.set("battleConfig", {
        factions: [
          {
            factionId: "free_confederation",
            controller: "player",
            ships: Array(perSide).fill("confed_kestrel"),
          },
          {
            factionId: "void_corsairs",
            controller: "ai",
            ships: Array(perSide).fill("corsair_venom"),
          },
        ],
        seed: 42,
        ...(mapTheme ? { mapTheme } : {}),
      });
      setTimeout(() => g.scene.start("ArcadeBattleScene"), 100);
    },
    { mapTheme: options.mapTheme, perSide: options.perSide ?? 3 },
  );
  await waitForScene(page, SCENE, 30_000);
  await page.waitForFunction(
    ([key, count]) =>
      (window as any).game.scene.getScene(key)?.ships?.size === count,
    [SCENE, (options.perSide ?? 3) * 2] as const,
  );
  await installTeleport(page);
}

/**
 * Defines window.__teleport(scene, shipId, x, y): moves a ship (its pose and the
 * planned maneuver path) and points the camera at it.
 */
async function installTeleport(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__teleport = (s: any, id: string, x: number, y: number) => {
      const ship = s.ships.get(id);
      const dx = x - ship.x;
      const dy = y - ship.y;
      const c = ship.control;
      ship.control = {
        ...c,
        maneuverPath: c.maneuverPath.map((p: any) => ({ ...p, x: p.x + dx, y: p.y + dy })),
        maneuverTarget: c.maneuverTarget
          ? { ...c.maneuverTarget, x: c.maneuverTarget.x + dx, y: c.maneuverTarget.y + dy }
          : null,
      };
      ship.x = x;
      ship.y = y;
      if (id === s.playerShipId) {
        s.cameraVirtualX = x;
        s.cameraVirtualY = y;
        s.cameras.main.centerOn(x, y);
      }
    };
  });
}

async function openGame(page: Page): Promise<void> {
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
}

test.describe("Seamless torus view", () => {
  test("a ship across the seam is drawn on the near side by a copy camera", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await openGame(page);
    await startSkirmish(page);
    const result = await page.evaluate(
      async ([key, arena]) => {
        const s = (window as any).game.scene.getScene(key);
        const tp = (window as any).__teleport;
        tp(s, s.playerShipId, 60, 3000);
        tp(s, "enemy_0", arena - 40, 3000);
        tp(s, "enemy_1", 3000, 3000);
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const main = s.cameras.main;
        const copy = s.cameras.getCamera("torus_copy_0");
        const backdrop = s.cameras.getCamera("space_backdrop");
        const across = s.shipSprites.get("enemy_0");
        const middle = s.shipSprites.get("enemy_1");
        const centerX = main.scrollX + main.width / 2;
        const screenX =
          copy.x +
          copy.width / 2 +
          main.zoom * (across.x - copy.scrollX - copy.width / 2);
        return {
          copyVisible: copy.visible,
          copyIsBeforeMain: s.cameras.cameras.indexOf(copy) < s.cameras.cameras.indexOf(main),
          backdropFirst: s.cameras.cameras[0] === backdrop,
          acrossInMain: across.willRender(main),
          acrossInCopy: across.willRender(copy),
          acrossInBackdrop: across.willRender(backdrop),
          middleInCopy: middle.willRender(copy),
          expectedScreenX: main.width / 2 + main.zoom * (across.x - arena - centerX),
          screenX,
          copyRightEdge: copy.x + copy.width,
          copyLeftEdge: copy.x,
          seamScreenX: main.width / 2 + main.zoom * (0 - centerX),
        };
      },
      [SCENE, ARENA] as const,
    );
    expect(result.copyVisible).toBe(true);
    expect(result.backdropFirst).toBe(true);
    expect(result.copyIsBeforeMain).toBe(true);
    expect(result.acrossInCopy).toBe(true);
    expect(result.acrossInBackdrop).toBe(false);
    expect(result.middleInCopy).toBe(false);
    expect(Math.abs(result.screenX - result.expectedScreenX)).toBeLessThan(2);
    expect(result.copyLeftEdge).toBe(0);
    expect(Math.abs(result.copyRightEdge - result.seamScreenX)).toBeLessThan(2);
    expect([...errors.consoleErrors, ...errors.pageErrors]).toEqual([]);
  });

  test("a corner needs three copies and no copy away from the seams", async ({
    page,
  }) => {
    await openGame(page);
    await startSkirmish(page);
    const counts = await page.evaluate(
      async ([key]) => {
        const s = (window as any).game.scene.getScene(key);
        const frames = () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
        const visibleCopies = () =>
          s.cameras.cameras.filter(
            (c: any) => c.name.startsWith("torus_copy_") && c.visible,
          ).length;
        const place = async (x: number, y: number) => {
          (window as any).__teleport(s, s.playerShipId, x, y);
          await frames();
          return visibleCopies();
        };
        return {
          center: await place(3000, 3000),
          edge: await place(30, 3000),
          corner: await place(30, 30),
        };
      },
      [SCENE] as const,
    );
    expect(counts).toEqual({ center: 0, edge: 1, corner: 3 });
  });

  test("backdrop layers and decor exist beyond the arena and wrap seamlessly", async ({
    page,
  }) => {
    await openGame(page);
    await startSkirmish(page, { mapTheme: "kessa_lane" });
    const info = await page.evaluate(
      async ([key]) => {
        const s = (window as any).game.scene.getScene(key);
        const tp = (window as any).__teleport;
        tp(s, s.playerShipId, 20, 20);
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const main = s.cameras.main;
        const backdrop = s.cameras.getCamera("space_backdrop");
        const tiles = s.children.list.filter((o: any) => o.type === "TileSprite");
        const readOffsets = () => tiles.map((t: any) => t.tilePositionX);
        const before = readOffsets();
        tp(s, s.playerShipId, 5990, 20);
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const after = readOffsets();
        return {
          theme: (window as any).game.registry.get("activeMapTheme"),
          tileCount: tiles.length,
          tilesOnlyOnBackdrop: tiles.every(
            (t: any) =>
              (t.cameraFilter & backdrop.id) === 0 &&
              (t.cameraFilter & main.id) !== 0,
          ),
          images: s.children.list.filter(
            (o: any) => o.type === "Image" && o.texture.key === "space_decor_atlas",
          ).length,
          maxJump: Math.max(
            ...before.map((b: number, i: number) => Math.abs(after[i] - b)),
          ),
          backdropColor: backdrop.backgroundColor.color,
          mainTransparent: main.transparent,
        };
      },
      [SCENE] as const,
    );
    expect(info.theme).toBe("kessa_lane");
    expect(info.tileCount).toBeGreaterThanOrEqual(4);
    expect(info.tilesOnlyOnBackdrop).toBe(true);
    expect(info.images).toBeGreaterThan(10);
    // Crossing the seam moves layers by the camera step, never by a whole arena.
    expect(info.maxJump).toBeLessThan(ARENA * 0.1);
    expect(info.mainTransparent).toBe(true);
  });

  test("copies stay cheap in a large battle", async ({ page }) => {
    await openGame(page);
    await startSkirmish(page, { perSide: 20 });
    const timings = await page.evaluate(
      async ([key]) => {
        const s = (window as any).game.scene.getScene(key);
        const manager = s.cameras;
        const original = manager.render.bind(manager);
        let total = 0;
        let calls = 0;
        manager.render = (renderer: unknown, list: unknown) => {
          const start = performance.now();
          original(renderer, list);
          total += performance.now() - start;
          calls++;
        };
        const measure = (x: number, y: number) =>
          new Promise<{ renderMs: number; copies: number }>((resolve) => {
            total = 0;
            calls = 0;
            let frames = 0;
            const tick = () => {
              (window as any).__teleport(s, s.playerShipId, x, y);
              if (++frames < 90) {
                requestAnimationFrame(tick);
                return;
              }
              resolve({
                renderMs: total / Math.max(1, calls),
                copies: manager.cameras.filter(
                  (c: any) => c.name.startsWith("torus_copy_") && c.visible,
                ).length,
              });
            };
            requestAnimationFrame(tick);
          });
        const middle = await measure(3000, 3000);
        const corner = await measure(30, 30);
        manager.render = original;
        return { middle, corner, ships: s.ships.size, fps: (window as any).game.loop.actualFps };
      },
      [SCENE] as const,
    );
    console.log(`PERF ${JSON.stringify(timings)}`);
    expect(timings.ships).toBe(40);
    expect(timings.middle.copies).toBe(0);
    expect(timings.corner.copies).toBe(3);
    // Software GL (headless): copies add a few ms; a GPU renders them for free.
    expect(timings.corner.renderMs).toBeLessThan(45);
    expect(timings.corner.renderMs).toBeLessThan(timings.middle.renderMs * 3 + 3);
  });

  test("every map theme starts a battle; screenshots go to the temp dir", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const errors = collectErrors(page);
    await openGame(page);
    for (const themeId of MAP_THEME_IDS) {
      await startSkirmish(page, { mapTheme: themeId });
      await page.evaluate(async () => {
        const s = (window as any).game.scene.getScene("ArcadeBattleScene");
        (window as any).__teleport(s, s.playerShipId, 40, 3000);
        await new Promise((r) => setTimeout(r, 1200));
      });
      const active = await page.evaluate(() =>
        (window as any).game.registry.get("activeMapTheme"),
      );
      expect(active).toBe(themeId);
      await page.screenshot({
        path: path.join(os.tmpdir(), `ss-map-${themeId}.png`),
      });
    }
    expect([...errors.consoleErrors, ...errors.pageErrors]).toEqual([]);
  });
});
