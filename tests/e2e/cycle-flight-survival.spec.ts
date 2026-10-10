/**
 * cycle-flight-survival.spec.ts — Survival flies the X-Wing cycle engine:
 * every ship (flagship, wave enemies) rides template arcs on its own,
 * holding a steering key banks the flagship, and Z queues a K-turn (and
 * costs stress). Weapons and belt damage are neutralised so no ship dies
 * mid-test (dead ships don't fly).
 */

import { test, expect, type Page } from "@playwright/test";
import { holdGameKey } from "./helpers/game";
import { SURVIVAL } from "./helpers/battleEntry";

const SCENE = "SurvivalScene";

interface ShipSnapshot {
  readonly id: string;
  readonly owner: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly currentManeuver: string | null;
  readonly nextManeuver: string | null;
  readonly stress: number;
}

async function readShips(page: Page): Promise<ShipSnapshot[]> {
  return page.evaluate((key) => {
    const scene = (window as unknown as { game: any }).game.scene.getScene(key);
    return [...scene.ships.values()]
      .filter((ship: any) => ship.hull > 0)
      .map((ship: any) => ({
        id: ship.id,
        owner: ship.owner,
        x: ship.x,
        y: ship.y,
        angle: ship.angle,
        currentManeuver: ship.flight.motion.control.currentManeuver,
        nextManeuver: ship.flight.motion.control.nextManeuver,
        stress: ship.flight.stress.level,
      }));
  }, SCENE);
}

async function flagship(page: Page): Promise<ShipSnapshot> {
  const flagshipId = await page.evaluate(
    (key) =>
      (window as unknown as { game: any }).game.scene.getScene(key)
        .playerShipIds[0] as string,
    SCENE,
  );
  return (await readShips(page)).find((s) => s.id === flagshipId)!;
}

/** Signed heading change a→b in degrees, in (-180, 180]. */
const headingChange = (a: number, b: number): number =>
  ((((b - a + 180) % 360) + 360) % 360) - 180;

test.describe("SurvivalScene — cycle-engine flight", () => {
  test("every ship is flying a cycle maneuver and moves on its own", async ({
    page,
  }) => {
    await SURVIVAL.enter(page, { peaceful: true });
    const before = await readShips(page);
    expect(before.some((s) => s.owner === "player")).toBe(true);
    expect(before.some((s) => s.owner === "ai")).toBe(true);
    expect(before.every((s) => s.currentManeuver !== null)).toBe(true);
    await page.waitForTimeout(1200);
    const after = new Map((await readShips(page)).map((s) => [s.id, s]));
    for (const start of before) {
      const end = after.get(start.id)!;
      expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeGreaterThan(20);
    }
  });

  test("holding LEFT banks the flagship at least 40° to the left", async ({
    page,
  }) => {
    await SURVIVAL.enter(page, { peaceful: true });
    const start = await flagship(page);
    await holdGameKey(page, "ArrowLeft", 1200);
    await page.waitForTimeout(600);
    const end = await flagship(page);
    expect(headingChange(start.angle, end.angle)).toBeLessThanOrEqual(-40);
  });

  test("Z queues a K-turn and costs stress", async ({ page }) => {
    await SURVIVAL.enter(page, { peaceful: true });
    await holdGameKey(page, "Z", 150);
    const ship = await flagship(page);
    expect([ship.currentManeuver, ship.nextManeuver]).toContain("kturn");
    expect(ship.stress).toBeGreaterThan(0);
  });
});
