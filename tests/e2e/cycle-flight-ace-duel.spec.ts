/**
 * cycle-flight-ace-duel.spec.ts — Ace Duel flies the X-Wing cycle engine:
 * every ship rides template arcs on its own, holding a steering key banks
 * the player's flagship, and Z queues a Snap turn (and costs stress).
 *
 * Weapons are neutralised so no ship dies mid-test (dead ships don't fly).
 */

import { test, expect, type Page } from "@playwright/test";
import { holdGameKey } from "./helpers/game";
import { ACE_DUEL } from "./helpers/battleEntry";

const SCENE_KEY = "AceDuelScene";
/** The flagship the human flies on the default side (side 1). */
const FLAGSHIP_ID = "side1_0";

interface ShipSnapshot {
  readonly id: string;
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
    return [...scene.ships.values()].map((ship: any) => ({
      id: ship.id,
      x: ship.x,
      y: ship.y,
      angle: ship.angle,
      currentManeuver: ship.flight.motion.control.currentManeuver,
      nextManeuver: ship.flight.motion.control.nextManeuver,
      stress: ship.flight.stress.level,
    }));
  }, SCENE_KEY);
}

const flagship = (ships: ShipSnapshot[]): ShipSnapshot =>
  ships.find((s) => s.id === FLAGSHIP_ID)!;

/** Signed heading change a→b in degrees, in (-180, 180]. */
const headingChange = (a: number, b: number): number =>
  ((((b - a + 180) % 360) + 360) % 360) - 180;

test.describe("AceDuelScene — cycle-engine flight", () => {
  test("every ship is flying a cycle maneuver and moves on its own", async ({
    page,
  }) => {
    await ACE_DUEL.enter(page, { peaceful: true });
    const before = await readShips(page);
    expect(before.every((s) => s.currentManeuver !== null)).toBe(true);
    await page.waitForTimeout(1200);
    const after = await readShips(page);
    for (const ship of after) {
      const start = before.find((s) => s.id === ship.id)!;
      expect(Math.hypot(ship.x - start.x, ship.y - start.y)).toBeGreaterThan(
        20,
      );
    }
  });

  test("holding LEFT banks the flagship at least 40° to the left", async ({
    page,
  }) => {
    await ACE_DUEL.enter(page, { peaceful: true });
    const start = flagship(await readShips(page));
    await holdGameKey(page, "ArrowLeft", 1200);
    await page.waitForTimeout(600);
    const end = flagship(await readShips(page));
    expect(headingChange(start.angle, end.angle)).toBeLessThanOrEqual(-40);
  });

  test("Z queues a Snap turn and costs stress", async ({ page }) => {
    await ACE_DUEL.enter(page, { peaceful: true });
    await holdGameKey(page, "Z", 150);
    const ship = flagship(await readShips(page));
    expect([ship.currentManeuver, ship.nextManeuver]).toContain("kturn");
    expect(ship.stress).toBeGreaterThan(0);
  });
});
