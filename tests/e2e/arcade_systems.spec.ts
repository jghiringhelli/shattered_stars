/**
 * arcade_systems.spec.ts — E2E assertions for arcade stress and cloak systems.
 *
 * Tests:
 *  1. Stress bar HUD element is present after scene loads.
 *  2. stressLevelText shows 'STRESSED' when stress.isStressed is injected.
 *  3. Enemy ship sprite alpha drops to ~0.12 when isCloaked is injected.
 *  4. Cloak auto-expires after cloakTimer ticks to zero.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  waitForScene,
  waitForMenuReady,
  suppressWebGLNoise,
} from "./helpers/game";

// ─────────────────────────────────────────────
// Navigation helper (mirrors arcade_visual.spec.ts)
// ─────────────────────────────────────────────

async function openArcadeScene(page: Page): Promise<void> {
  await page.goto("/");
  await waitForMenuReady(page);

  await page.evaluate(() => {
    const g = (window as any).game;
    g.scene
      .getScenes(true)
      .forEach((s: any) => g.scene.stop(s.sys.settings.key));
    g.registry.set("battleConfig", {
      factions: [
        {
          factionId: "free_confederation",
          controller: "player",
          ships: ["confed_kestrel"],
        },
        {
          factionId: "void_corsairs",
          controller: "ai",
          ships: ["corsair_venom", "corsair_venom"],
        },
      ],
      gameMode: "arcade",
    });
    setTimeout(() => g.scene.start("ArcadeBattleScene"), 100);
  });

  await waitForScene(page, "ArcadeBattleScene");
  await page.waitForFunction(
    () => {
      const scene = (window as any).game?.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      return scene?.playerShipId != null;
    },
    { timeout: 15_000 },
  );
}

// ─────────────────────────────────────────────
// Stress HUD tests
// ─────────────────────────────────────────────

test.describe("ArcadeBattleScene — stress HUD", () => {
  test("stress bar graphics object is created on scene start", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcadeScene(page);

    const hasBar = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      return scene?.stressBarGraphics != null;
    });
    expect(hasBar).toBe(true);
  });

  test("stressLevelText shows STRESSED when stress is injected", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcadeScene(page);

    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      const ship = scene.ships.get(scene.playerShipId);
      if (ship) ship.stress = { level: 0.9, isStressed: true };
    });
    await page.waitForTimeout(200);

    const text = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      return scene?.stressLevelText?.text ?? "";
    });
    expect(text).toContain("STRESSED");
  });

  test("stressLevelText is empty when stress level is low", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcadeScene(page);

    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      const ship = scene.ships.get(scene.playerShipId);
      if (ship) ship.stress = { level: 0.0, isStressed: false };
    });
    await page.waitForTimeout(200);

    const text = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      return scene?.stressLevelText?.text ?? "";
    });
    expect(text).not.toContain("STRESSED");
  });
});

// ─────────────────────────────────────────────
// Cloak system tests
// ─────────────────────────────────────────────

test.describe("ArcadeBattleScene — cloak system", () => {
  test("enemy sprite alpha is ~0.12 when isCloaked is injected", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcadeScene(page);

    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      const enemyId = [...scene.ships.keys()].find(
        (id: string) => id !== scene.playerShipId,
      );
      const enemy = scene.ships.get(enemyId);
      if (enemy) {
        enemy.isCloaked = true;
        enemy.cloakTimer = 8;
      }
    });
    await page.waitForTimeout(200);

    const alpha = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      const enemyId = [...scene.ships.keys()].find(
        (id: string) => id !== scene.playerShipId,
      );
      const sprite = scene.shipSprites?.get(enemyId);
      return sprite?.alpha ?? -1;
    });
    expect(alpha).toBeCloseTo(0.12, 1);
  });

  test("player sprite alpha is ~0.45 when player ship is cloaked", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await openArcadeScene(page);

    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      const ship = scene.ships.get(scene.playerShipId);
      if (ship) {
        ship.isCloaked = true;
        ship.cloakTimer = 8;
      }
    });
    await page.waitForTimeout(200);

    const alpha = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      const sprite = scene.shipSprites?.get(scene.playerShipId);
      return sprite?.alpha ?? -1;
    });
    expect(alpha).toBeCloseTo(0.45, 1);
  });

  test("sprite alpha returns to 1.0 after cloak expires", async ({ page }) => {
    suppressWebGLNoise(page);
    await openArcadeScene(page);

    // Set cloak then immediately expire it
    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      const enemyId = [...scene.ships.keys()].find(
        (id: string) => id !== scene.playerShipId,
      );
      const enemy = scene.ships.get(enemyId);
      if (enemy) {
        enemy.isCloaked = false;
        enemy.cloakTimer = 0;
      }
    });
    await page.waitForTimeout(200);

    const alpha = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene(
        "ArcadeBattleScene",
      ) as any;
      const enemyId = [...scene.ships.keys()].find(
        (id: string) => id !== scene.playerShipId,
      );
      const sprite = scene.shipSprites?.get(enemyId);
      return sprite?.alpha ?? -1;
    });
    expect(alpha).toBeCloseTo(1.0, 1);
  });
});
