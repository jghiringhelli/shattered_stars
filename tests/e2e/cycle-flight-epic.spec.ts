/**
 * cycle-flight-epic.spec.ts — Boss Raid (EpicBattleScene) flies the X-Wing
 * cycle engine: every ship rides template arcs on its own, holding LEFT banks
 * the player's flagship, and Z queues a Snap turn that costs stress. Its AI is
 * the skill-gate bots: escorts at the raid difficulty's tier, average
 * wingmen who clear the escorts until the player marks the boss (R).
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

  test("Z queues a Snap turn and costs stress", async ({ page }) => {
    await BOSS_RAID.enter(page, { peaceful: true });
    expect(flagship(await readShips(page)).profile).toBe("fighter");
    await holdGameKey(page, "Z", 150);
    // The maneuver key waits out its double-tap window before it queues the Snap turn.
    await expect
      .poll(async () => {
        const s = flagship(await readShips(page));
        return [s.currentManeuver, s.nextManeuver].includes("kturn");
      })
      .toBe(true);
    const ship = flagship(await readShips(page));
    expect(ship.stress).toBeGreaterThan(0);
  });
});

/** Every AI ship's bot: tier, expected tier, and whom it is after. */
async function readCrew(page: Page): Promise<
  {
    id: string;
    side: "escort" | "wingman";
    tier: string | null;
    expected: string;
    pilotTarget: string | null;
  }[]
> {
  return page.evaluate(async (key) => {
    const { raidBotSkill } =
      await import("/src/arcade/systems/EpicAiFlight.ts");
    const scene = (window as any).game.scene.getScene(key);
    const crew = (ids: string[], side: "escort" | "wingman") =>
      ids.map((id, slot) => ({
        id,
        side,
        tier: scene.bots.tierOf(id),
        expected: raidBotSkill(side, scene.difficulty, slot).tier,
        pilotTarget: scene.bots.pilotTargetOf(id),
      }));
    return [
      ...crew(scene.escortShipIds, "escort"),
      ...crew(scene.playerShipIds.slice(1), "wingman"),
    ];
  }, SCENE);
}

/** Squad focus of every wingman (the flagship is the player's). */
async function wingmanFocus(page: Page): Promise<(string | null)[]> {
  return page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    return scene.playerShipIds
      .slice(1)
      .map((id: string) => scene.bots.orderFor(id)?.focusTargetId ?? null);
  }, SCENE);
}

test.describe("EpicBattleScene — the AI is the skill-gate bots", () => {
  test("escorts and wingmen fly bot pilots at their raid tiers", async ({
    page,
  }) => {
    await BOSS_RAID.enter(page, { peaceful: true });
    await page.waitForTimeout(1500);
    const crew = await readCrew(page);
    expect(crew.some((c) => c.side === "escort")).toBe(true);
    expect(crew.some((c) => c.side === "wingman")).toBe(true);
    for (const ship of crew) {
      expect(ship.tier, `${ship.side} ${ship.id}`).toBe(ship.expected);
    }
    const playerIds = await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).playerShipIds,
      SCENE,
    );
    for (const escort of crew.filter((c) => c.side === "escort")) {
      expect(playerIds, `${escort.id} hunts a player ship`).toContain(
        escort.pilotTarget,
      );
    }
  });

  test("wingmen engage the escorts until R marks the boss, then turn on it", async ({
    page,
  }) => {
    await BOSS_RAID.enter(page, { peaceful: true });
    await page.waitForFunction(
      (key) => {
        const scene = (window as any).game.scene.getScene(key);
        const wingman = scene.playerShipIds[1];
        return scene.bots.orderFor(wingman)?.focusTargetId != null;
      },
      SCENE,
      { timeout: 5_000 },
    );
    const before = await wingmanFocus(page);
    expect(before).not.toContain("boss");
    expect(before.every((id) => id?.startsWith("escort_"))).toBe(true);

    await holdGameKey(page, "R", 100);
    await page.waitForFunction(
      (key) => {
        const scene = (window as any).game.scene.getScene(key);
        return scene.playerShipIds
          .slice(1)
          .every(
            (id: string) => scene.bots.orderFor(id)?.focusTargetId === "boss",
          );
      },
      SCENE,
      { timeout: 5_000 },
    );
    const hud = await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      return {
        mark: scene.bots.markedTarget("player", scene.time.now),
        reticles: scene.raidHud.markReticleCount,
      };
    }, SCENE);
    expect(hud.mark).toBe("boss");
    expect(hud.reticles).toBeGreaterThanOrEqual(1);
  });
});
