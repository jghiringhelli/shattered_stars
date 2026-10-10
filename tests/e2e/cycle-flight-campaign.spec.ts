/**
 * cycle-flight-campaign.spec.ts — CampaignBattleScene flies the X-Wing cycle
 * engine: every ship rides template arcs on its own, holding LEFT banks the
 * flagship, and Z queues a K-turn that costs stress. Runs mission heg_1_3
 * (flagship + escort vs 3 enemies) with combat, reinforcements and
 * objectives disabled so nothing dies and the mission cannot end mid-test.
 */

import { test, expect, type Page } from "@playwright/test";
import { holdGameKey } from "./helpers/game";
import { CAMPAIGN } from "./helpers/battleEntry";

const SCENE_KEY = CAMPAIGN.sceneKey;

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
    const scene = (window as any).game.scene.getScene(key);
    return [...scene.ships.values()].map((ship: any) => ({
      id: ship.id,
      owner: ship.owner,
      x: ship.x,
      y: ship.y,
      angle: ship.angle,
      currentManeuver: ship.flight.motion.control.currentManeuver,
      nextManeuver: ship.flight.motion.control.nextManeuver,
      stress: ship.flight.stress.level,
    }));
  }, SCENE_KEY);
}

async function readFlagship(page: Page): Promise<ShipSnapshot> {
  const flagshipId = await page.evaluate(
    (key) => (window as any).game.scene.getScene(key).playerShipIds[0],
    SCENE_KEY,
  );
  return (await readShips(page)).find((s) => s.id === flagshipId)!;
}

/** Signed heading change a→b in degrees, in (-180, 180]. */
const headingChange = (a: number, b: number): number =>
  ((((b - a + 180) % 360) + 360) % 360) - 180;

test.describe("CampaignBattleScene — cycle-engine flight", () => {
  test("every ship is flying a cycle maneuver and moves on its own", async ({
    page,
  }) => {
    await CAMPAIGN.enter(page, { peaceful: true });
    const before = await readShips(page);
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
    await CAMPAIGN.enter(page, { peaceful: true });
    const start = await readFlagship(page);
    await holdGameKey(page, "ArrowLeft", 1200);
    await page.waitForTimeout(600);
    const end = await readFlagship(page);
    expect(headingChange(start.angle, end.angle)).toBeLessThanOrEqual(-40);
  });

  test("Z queues a K-turn and costs stress", async ({ page }) => {
    await CAMPAIGN.enter(page, { peaceful: true });
    await holdGameKey(page, "Z", 150);
    const ship = await readFlagship(page);
    expect([ship.currentManeuver, ship.nextManeuver]).toContain("kturn");
    expect(ship.stress).toBeGreaterThan(0);
  });
});
