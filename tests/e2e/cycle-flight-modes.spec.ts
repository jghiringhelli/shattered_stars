/**
 * cycle-flight-modes.spec.ts — every battle mode flies the X-Wing cycle
 * engine: ships ride template arcs, holding a steering key banks, Z queues a
 * Snap turn (and costs stress), and AI ships move on their own.
 */

import { test, expect, type Page } from "@playwright/test";
import { holdGameKey } from "./helpers/game";
import { DOGFIGHT } from "./helpers/battleEntry";

interface ShipSnapshot {
  readonly owner: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly currentManeuver: string | null;
  readonly nextManeuver: string | null;
  readonly stress: number;
}

async function readShips(
  page: Page,
  sceneKey: string,
): Promise<ShipSnapshot[]> {
  return page.evaluate((key) => {
    const scene = (window as unknown as { game: any }).game.scene.getScene(key);
    return [...scene.ships.values()].map((ship: any) => ({
      owner: ship.owner,
      x: ship.x,
      y: ship.y,
      angle: ship.angle,
      currentManeuver: ship.flight.motion.control.currentManeuver,
      nextManeuver: ship.flight.motion.control.nextManeuver,
      stress: ship.flight.stress.level,
    }));
  }, sceneKey);
}

const player = (ships: ShipSnapshot[]): ShipSnapshot =>
  ships.find((s) => s.owner === "player")!;

/** Signed heading change a→b in degrees, in (-180, 180]. */
const headingChange = (a: number, b: number): number =>
  ((((b - a + 180) % 360) + 360) % 360) - 180;

test.describe("DogfightScene — cycle-engine flight", () => {
  test("every ship is flying a cycle maneuver and moves on its own", async ({
    page,
  }) => {
    await DOGFIGHT.enter(page, { peaceful: true });
    const before = await readShips(page, "DogfightScene");
    expect(before.every((s) => s.currentManeuver !== null)).toBe(true);
    await page.waitForTimeout(1200);
    const after = await readShips(page, "DogfightScene");
    for (const [i, ship] of after.entries()) {
      const start = before[i]!;
      expect(Math.hypot(ship.x - start.x, ship.y - start.y)).toBeGreaterThan(
        20,
      );
    }
  });

  test("holding LEFT banks the player at least 40° to the left", async ({
    page,
  }) => {
    await DOGFIGHT.enter(page, { peaceful: true });
    const start = player(await readShips(page, "DogfightScene"));
    await holdGameKey(page, "ArrowLeft", 1200);
    await page.waitForTimeout(600);
    const end = player(await readShips(page, "DogfightScene"));
    expect(headingChange(start.angle, end.angle)).toBeLessThanOrEqual(-40);
  });

  test("Z queues a Snap turn and costs stress", async ({ page }) => {
    await DOGFIGHT.enter(page, { peaceful: true });
    await holdGameKey(page, "Z", 150);
    const ship = player(await readShips(page, "DogfightScene"));
    expect([ship.currentManeuver, ship.nextManeuver]).toContain("kturn");
    expect(ship.stress).toBeGreaterThan(0);
  });
});
