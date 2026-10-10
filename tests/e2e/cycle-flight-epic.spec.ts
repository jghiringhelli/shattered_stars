/**
 * cycle-flight-epic.spec.ts — Boss Raid (EpicBattleScene) flies the X-Wing
 * cycle engine: every ship rides template arcs on its own, holding LEFT banks
 * the player's flagship, and Z queues a K-turn that costs stress.
 */

import { test, expect, type Page } from "@playwright/test";
import { holdGameKey } from "./helpers/game";
import { BOSS_RAID } from "./helpers/battleEntry";

const SCENE = "EpicBattleScene";

/** Minimum self-propelled travel (px) in the sampling window, per profile. */
const MIN_TRAVEL_PX = { fighter: 20, capital: 5 } as const;

interface ShipSnapshot {
  readonly id: string;
  readonly isFlagship: boolean;
  readonly profile: "fighter" | "capital";
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
      isFlagship: ship.id === scene.playerShipIds[0],
      profile: ship.flight.motion.control.movementProfile,
      x: ship.x,
      y: ship.y,
      angle: ship.angle,
      currentManeuver: ship.flight.motion.control.currentManeuver,
      nextManeuver: ship.flight.motion.control.nextManeuver,
      stress: ship.flight.stress.level,
    }));
  }, SCENE);
}

const flagship = (ships: ShipSnapshot[]): ShipSnapshot =>
  ships.find((s) => s.isFlagship)!;

/** Signed heading change a→b in degrees, in (-180, 180]. */
const headingChange = (a: number, b: number): number =>
  ((((b - a + 180) % 360) + 360) % 360) - 180;

test.describe("EpicBattleScene — cycle-engine flight", () => {
  test("every ship is flying a cycle maneuver and moves on its own", async ({
    page,
  }) => {
    await BOSS_RAID.enter(page, { peaceful: true });
    const before = await readShips(page);
    expect(before.every((s) => s.currentManeuver !== null)).toBe(true);
    await page.waitForTimeout(1200);
    const after = new Map((await readShips(page)).map((s) => [s.id, s]));
    for (const start of before) {
      const end = after.get(start.id)!;
      expect(
        Math.hypot(end.x - start.x, end.y - start.y),
        `${start.id} (${start.profile})`,
      ).toBeGreaterThan(MIN_TRAVEL_PX[start.profile]);
    }
  });

  test("holding LEFT banks the fighter flagship at least 40° to the left", async ({
    page,
  }) => {
    await BOSS_RAID.enter(page, { peaceful: true });
    const start = flagship(await readShips(page));
    expect(start.profile).toBe("fighter");
    await holdGameKey(page, "ArrowLeft", 1200);
    await page.waitForTimeout(600);
    const end = flagship(await readShips(page));
    expect(headingChange(start.angle, end.angle)).toBeLessThanOrEqual(-40);
  });

  test("Z queues a K-turn and costs stress", async ({ page }) => {
    await BOSS_RAID.enter(page, { peaceful: true });
    expect(flagship(await readShips(page)).profile).toBe("fighter");
    await holdGameKey(page, "Z", 150);
    const ship = flagship(await readShips(page));
    expect([ship.currentManeuver, ship.nextManeuver]).toContain("kturn");
    expect(ship.stress).toBeGreaterThan(0);
  });
});
