/**
 * ship-overlay.spec.ts — the per-ship hull/shield overlay and the repair
 * feedback (shimmer + repair drones) in live battle scenes.
 *
 * Skirmish: every ship has an overlay whose shield segments match its
 * miniature shield tokens; a hit removes a segment and flashes; an allied
 * repair-field event shimmers the hull bar and launches drones from the
 * projector; own shield regen restores shields through the repair channel.
 * Dogfight: the same overlay on the opponent, and the hull-repair knob
 * repairs hull after its out-of-fire pause.
 *
 * A screenshot for visual review is written to the OS temp dir (not the repo).
 */

import * as os from "node:os";
import * as path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { DOGFIGHT, SKIRMISH } from "./helpers/battleEntry";

/** Real-time HP per miniature point (src/config.ts DURABILITY_SCALE). */
const DURABILITY_SCALE = 12;
/** Readability cap on drawn shield segments (overlayLayout.ts). */
const MAX_SHIELD_SEGMENTS = 10;

/**
 * Shield segments a ship's overlay should draw, computed independently.
 * @param maxShields - Real-time shield cap.
 * @returns Expected segment count.
 */
function expectedSegments(maxShields: number): number {
  if (maxShields <= 0) return 0;
  return Math.min(
    MAX_SHIELD_SEGMENTS,
    Math.max(1, Math.round(maxShields / DURABILITY_SCALE)),
  );
}

interface OverlayRow {
  id: string;
  hasOverlay: boolean;
  maxShields: number;
  shields: number;
  segmentCount: number;
  litSegments: number;
  side: string;
}

/**
 * Every living ship of a scene with its overlay's state.
 * @param page - The page.
 * @param sceneKey - Scene to inspect.
 * @returns One row per living ship.
 */
async function overlayRows(
  page: Page,
  sceneKey: string,
): Promise<OverlayRow[]> {
  return page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    const rows: any[] = [];
    for (const [id, ship] of scene.ships) {
      if (ship.hull <= 0) continue;
      const bar = scene.healthBars.get(id);
      const state = bar?.getOverlayState();
      rows.push({
        id,
        hasOverlay: Boolean(bar),
        maxShields: ship.maxShields,
        shields: ship.shields,
        segmentCount: state?.segmentCount ?? -1,
        litSegments: state?.litSegments ?? -1,
        side: state?.side ?? "none",
      });
    }
    return rows;
  }, sceneKey);
}

test("Skirmish: every ship carries an overlay with one segment per shield token", async ({
  page,
}) => {
  await SKIRMISH.enter(page);
  const rows = await overlayRows(page, SKIRMISH.sceneKey);
  expect(rows.length).toBeGreaterThanOrEqual(2);
  for (const row of rows) {
    expect(row.hasOverlay).toBe(true);
    expect(row.segmentCount).toBe(expectedSegments(row.maxShields));
  }
  const sides = new Set(rows.map((row) => row.side));
  expect(sides.has("player")).toBe(true);
  expect(sides.has("enemy")).toBe(true);
});

test("Skirmish: a hit removes a shield segment and flashes the overlay", async ({
  page,
}) => {
  await SKIRMISH.enter(page);
  const result = await page.evaluate((scale) => {
    const scene = (window as any).game.scene.getScene("ArcadeBattleScene");
    const [id, ship] = [...scene.ships].find(
      ([shipId, s]: [string, any]) =>
        s.hull > 0 && s.maxShields >= scale && shipId !== scene.playerShipId,
    )!;
    const bar = scene.healthBars.get(id);
    ship.shields = ship.maxShields;
    bar.update(ship.hull, ship.shields);
    const before = bar.getOverlayState();
    ship.shields = ship.maxShields - scale;
    bar.update(ship.hull, ship.shields);
    return { before, after: bar.getOverlayState() };
  }, DURABILITY_SCALE);
  expect(result.after.litSegments).toBe(result.before.litSegments - 1);
  expect(result.after.damageFlash).toBe(true);
  expect(result.after.visible).toBe(true);
});

test("Skirmish: an allied repair field shimmers the hull bar and sends drones", async ({
  page,
}) => {
  await SKIRMISH.enter(page);
  const result = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("ArcadeBattleScene");
    const friendly = [...scene.ships.values()].filter(
      (s: any) => s.hull > 0 && s.faction === scene.playerFaction,
    );
    const source = friendly.find((s: any) => s.id === scene.playerShipId);
    const target = friendly.find((s: any) => s.id !== scene.playerShipId);
    scene.repairFeedback.publishRepair({
      shipId: target.id,
      kind: "hull",
      amount: 6,
      sourceShipId: source.id,
      sourceKind: "aura",
    });
    const overlay = scene.healthBars.get(target.id).getOverlayState();
    return { overlay, feedback: scene.repairFeedback.debugState() };
  });
  expect(result.overlay.hullShimmer).toBe(true);
  expect(result.overlay.lastRepair).toEqual({
    kind: "hull",
    sourceKind: "aura",
  });
  expect(result.feedback.activeDrones).toBeGreaterThanOrEqual(2);
  expect(result.feedback.lastEvent.sourceKind).toBe("aura");

  await page.waitForTimeout(500);
  const dronesStillFlying = await page.evaluate(
    () =>
      (window as any).game.scene
        .getScene("ArcadeBattleScene")
        .repairFeedback.debugState().activeDrones,
  );
  expect(dronesStillFlying).toBeGreaterThanOrEqual(1);
  await page.screenshot({
    path: path.join(os.tmpdir(), "ship-overlay-skirmish.png"),
  });
});

test("Skirmish: own shield regen flows through the repair channel", async ({
  page,
}) => {
  await SKIRMISH.enter(page);
  await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("ArcadeBattleScene");
    const ship = scene.ships.get(scene.playerShipId);
    ship.modifiers = { ...ship.modifiers, shieldRegenPerSecond: 5 };
    ship.shields = 0;
  });
  await page.waitForFunction(
    () => {
      const scene = (window as any).game.scene.getScene("ArcadeBattleScene");
      const state = scene.healthBars.get(scene.playerShipId).getOverlayState();
      return state.shieldShimmer && state.lastRepair?.kind === "shield";
    },
    undefined,
    { timeout: 5_000 },
  );
  const delivered = await page.evaluate(
    () =>
      (window as any).game.scene
        .getScene("ArcadeBattleScene")
        .repairFeedback.debugState().deliveredEvents,
  );
  expect(delivered).toBeGreaterThan(0);
});

test("Dogfight: the opponent's overlay tracks shields, and hull repair resumes out of fire", async ({
  page,
}) => {
  await DOGFIGHT.enter(page, { peaceful: true });
  const rows = await overlayRows(page, DOGFIGHT.sceneKey);
  const opponent = rows.find((row) => row.hasOverlay)!;
  expect(opponent.segmentCount).toBe(expectedSegments(opponent.maxShields));
  expect(opponent.side).toBe("enemy");

  const halfHull = await page.evaluate((id) => {
    const scene = (window as any).game.scene.getScene("DogfightScene");
    const ship = scene.ships.get(id);
    ship.modifiers = { ...ship.modifiers, hullRepairPerSecond: 2 };
    ship.hull = ship.maxHull / 2;
    return ship.hull;
  }, opponent.id);
  await page.waitForFunction(
    ({ id, from }) => {
      const scene = (window as any).game.scene.getScene("DogfightScene");
      return scene.ships.get(id).hull > from;
    },
    { id: opponent.id, from: halfHull },
    { timeout: 10_000 },
  );
  const state = await page.evaluate((id) => {
    const scene = (window as any).game.scene.getScene("DogfightScene");
    return scene.healthBars.get(id).getOverlayState();
  }, opponent.id);
  expect(state.hullShimmer).toBe(true);
  expect(state.lastRepair?.kind).toBe("hull");

  const drones = await page.evaluate((id) => {
    const scene = (window as any).game.scene.getScene("DogfightScene");
    scene.repairFeedback.publishRepair({
      shipId: id,
      kind: "shield",
      amount: 12,
      sourceShipId: null,
      sourceKind: "astromech",
    });
    return scene.repairFeedback.debugState().activeDrones;
  }, opponent.id);
  expect(drones).toBeGreaterThanOrEqual(1);
});
