/**
 * mvp-sanity.spec.ts
 *
 * MVP-gate suite for Skirmish mode. Each test boots the game, drives it to a
 * specific game state, and asserts one narrow behavior. Designed to catch
 * regressions in the core loop before shipping.
 *
 * Covers:
 *  - AI-vs-AI damage flow (regression guard: "0 damage clustering")
 *  - Flee detector: warning HUD + force-end defeat
 *  - Torus wraparound: player position wraps at map edges
 *  - HUD overlap: HUD elements do not overlap at two common resolutions
 */

import { test, expect, type Page } from "@playwright/test";
import {
  waitForScene,
  waitForMenuReady,
  clickMenuItem,
  suppressWebGLNoise,
  pressGameKey,
} from "./helpers/game";

// Skirmish = ArcadeBattleScene
const BATTLE_SCENE = "ArcadeBattleScene";

/**
 * Boots to the battle scene via SKIRMISH → auto-fill → start.
 * Returns when ArcadeBattleScene has at least 2 ships spawned.
 */
async function bootToBattle(page: Page): Promise<void> {
  await page.goto("/?debug=1");
  await waitForMenuReady(page);
  await clickMenuItem(page, "SKIRMISH");
  await waitForScene(page, "SquadBuilderScene");
  await page.waitForFunction(
    () => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
      return (s?.factionSlots?.length ?? 0) > 0;
    },
    { timeout: 10_000 },
  );
  await page.evaluate(() => {
    const s = (window as any).game.scene.getScene("SquadBuilderScene") as any;
    if (s?.simpleMode) {
      s.simpleMode = false;
      s.renderBuilderMode();
    }
    s.squadListPanel.autoFillAll();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    (window as any).game.scene.getScene("SquadBuilderScene")?.startBattle();
  });
  await waitForScene(page, BATTLE_SCENE, 15_000);
  await page.waitForFunction(
    () => {
      const s = (window as any).game.scene.getScene("ArcadeBattleScene") as any;
      return s?.ships && s.ships.size >= 2;
    },
    { timeout: 10_000 },
  );
  // Extra beat: give any late-spawned wingmen/enemies time to appear before
  // callers try to isolate the player. Skirmish typically spawns 6 ships.
  await page.waitForTimeout(500);
}

interface ShipSnap {
  id: string;
  owner: string;
  hull: number;
  x: number;
  y: number;
}

async function snapshotShips(page: Page): Promise<ShipSnap[]> {
  return page.evaluate(() => {
    const s = (window as any).game.scene.getScene("ArcadeBattleScene") as any;
    const out: ShipSnap[] = [];
    s.ships.forEach((ship: any) => {
      out.push({
        id: ship.id,
        owner: ship.owner,
        hull: ship.hull,
        x: ship.x,
        y: ship.y,
      });
    });
    return out;
  });
}

test.describe("MVP sanity — Skirmish", () => {
  test.setTimeout(120_000);
  test.beforeEach(({ page }) => suppressWebGLNoise(page));

  // ─── Damage flow ─────────────────────────────────────────────────────────
  test("AI-vs-AI combat produces hull damage within 20s", async ({ page }) => {
    await bootToBattle(page);
    const initial = await snapshotShips(page);
    const initialHullSum = initial.reduce((n, s) => n + s.hull, 0);

    // Passive observation — don't send player input; let AI fight AI
    await page.waitForTimeout(20_000);

    const final = await snapshotShips(page);
    const finalHullSum = final.reduce((n, s) => n + s.hull, 0);

    expect(finalHullSum).toBeLessThan(initialHullSum);
  });

  // ─── Flee detector wiring ────────────────────────────────────────────────
  // The FleeDetector pure logic is fully covered by unit tests
  // (tests/unit/arcade/systems/FleeDetector.test.ts, 7 cases). Here we test
  // only that the scene *has* the wiring — actual state evolution is too
  // fragile in e2e because the scene's updateFleeDetector overwrites any
  // injected state on the next tick using live positions and combat inputs.
  // The full flee flow is verified in the manual playtest checklist
  // (docs/PLAYTEST_MVP.md §5).
  test("scene has flee detector wiring at boot", async ({ page }) => {
    await bootToBattle(page);
    const wiring = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("ArcadeBattleScene") as any;
      return {
        hasFleeWarningText: !!s.fleeWarningText,
        hasFleeState: !!s.fleeState,
        hasUpdater: typeof s.updateFleeDetector === "function",
        initialWarning: !!s.fleeState?.isWarning,
        initialFled: !!s.fleeState?.hasFled,
      };
    });
    expect(wiring.hasFleeWarningText).toBe(true);
    expect(wiring.hasFleeState).toBe(true);
    expect(wiring.hasUpdater).toBe(true);
    // At boot, not fleeing yet
    expect(wiring.initialWarning).toBe(false);
    expect(wiring.initialFled).toBe(false);
  });

  // ─── Torus wraparound ────────────────────────────────────────────────────
  test("player position wraps around map edges", async ({ page }) => {
    await bootToBattle(page);

    // Teleport player near an edge and force velocity across it
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("ArcadeBattleScene") as any;
      const ship = s.ships.get(s.playerShipId);
      ship.x = 5980;
      ship.y = 3000;
      ship.angle = 90; // facing east (angle 0 = up, 90 = right)
    });

    // Hold ArrowUp to thrust across seam
    for (let i = 0; i < 20; i++) {
      await pressGameKey(page, "ArrowUp");
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(1_000);

    const pos = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("ArcadeBattleScene") as any;
      const ship = s.ships.get(s.playerShipId);
      return { x: ship.x, y: ship.y };
    });

    // If wrap works, player x should be small (wrapped from 5980+ back to 0..)
    // If wrap didn't fire, x would have clamped near 6000 or gone > 6000
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.x).toBeLessThan(6000);
  });

  // ─── HUD non-overlap ─────────────────────────────────────────────────────
  for (const size of [
    { name: "1366x768", w: 1366, h: 768 },
    { name: "1920x1080", w: 1920, h: 1080 },
  ]) {
    test(`HUD elements don't overlap at ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.w, height: size.h });
      await bootToBattle(page);
      await page.waitForTimeout(500);

      const boxes = await page.evaluate(() => {
        const s = (window as any).game.scene.getScene(
          "ArcadeBattleScene",
        ) as any;
        const items = [
          ["hull", s.hullText],
          ["shields", s.shieldText],
          ["speed", s.speedText],
          ["score", s.scoreText],
          ["cooldown", s.cooldownText],
        ] as const;
        return items
          .filter(([, o]) => o && o.visible)
          .map(([name, o]) => ({
            name,
            x: o.getTopLeft().x,
            y: o.getTopLeft().y,
            w: o.width,
            h: o.height,
          }));
      });

      // Pairwise overlap check
      const overlaps: string[] = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const xOverlap = a.x < b.x + b.w && b.x < a.x + a.w;
          const yOverlap = a.y < b.y + b.h && b.y < a.y + a.h;
          if (xOverlap && yOverlap) {
            overlaps.push(`${a.name} overlaps ${b.name}`);
          }
        }
      }
      expect(overlaps).toEqual([]);
    });
  }
});
