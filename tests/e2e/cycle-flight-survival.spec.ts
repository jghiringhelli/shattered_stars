/**
 * cycle-flight-survival.spec.ts — Survival flies the X-Wing cycle engine:
 * every ship (flagship, wave enemies) rides template arcs on its own,
 * holding a steering key banks the flagship, and Z queues a Snap turn (and
 * costs stress). Weapons and belt damage are neutralised so no ship dies
 * mid-test (dead ships don't fly).
 *
 * The AI ships are BotPilots (wave 1: novices, elites a tier up; escorts
 * average) and R marks the flagship's HUD target: the HUD brackets it and
 * the escorts focus and shoot it with the mark bonus.
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

  test("Z queues a Snap turn and costs stress", async ({ page }) => {
    await SURVIVAL.enter(page, { peaceful: true });
    await holdGameKey(page, "Z", 150);
    const ship = await flagship(page);
    expect([ship.currentManeuver, ship.nextManeuver]).toContain("kturn");
    expect(ship.stress).toBeGreaterThan(0);
  });
});

/** Escorts spawned beside the flagship for the squad specs. */
const ESCORT_COUNT = 2;
/** Time the escorts get to bring the marked enemy into their sights (ms). */
const ESCORT_ENGAGE_TIMEOUT_MS = 30_000;
/** How often the test refreshes the mark on the same target (ms). */
const MARK_REFRESH_MS = 2_000;

/** Joins escorts to the flagship's wing (as the escort track does). */
async function spawnEscorts(page: Page): Promise<void> {
  await page.evaluate(
    ({ key, count }) => {
      const scene = (window as any).game.scene.getScene(key);
      const anchor = scene.ships.get(scene.playerShipIds[0]);
      for (let i = 1; i <= count; i++) {
        scene.spawnPlayerShip(
          {
            definitionId: anchor.definitionId,
            x: anchor.x + i * 80,
            y: anchor.y + 50,
            loadoutId: null,
          },
          true,
        );
      }
    },
    { key: SCENE, count: ESCORT_COUNT },
  );
}

/**
 * Records every shot (attacker, target, whether its side had it marked)
 * without dealing damage, and the HUD's last snapshot.
 */
async function recordShotsAndHud(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const w = window as any;
    const scene = w.game.scene.getScene(key);
    w.__shots = [];
    scene.fireAt = (attacker: any, target: any) => {
      w.__shots.push({
        attacker: attacker.id,
        target: target.id,
        marked: scene.squadAi.isMarkedBy(
          attacker.owner,
          target.id,
          scene.time.now,
        ),
      });
    };
    scene.applyBeltDamage = () => undefined;
    const hud = scene.battleHud;
    const update = hud.update.bind(hud);
    hud.update = (snapshot: any) => {
      w.__hudSnapshot = snapshot;
      update(snapshot);
    };
  }, SCENE);
}

test.describe("SurvivalScene — bot pilots and the squad mark", () => {
  test("wave enemies and escorts are flown by BotPilots at their tiers", async ({
    page,
  }) => {
    await SURVIVAL.enter(page, { peaceful: true });
    await spawnEscorts(page);
    await page.waitForTimeout(1500);
    const pilots = await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      return [...scene.ships.values()].map((ship: any) => ({
        id: ship.id as string,
        owner: ship.owner as string,
        tier: (ship.bot?.tier ?? null) as string | null,
        targetId: (ship.bot?.targetId ?? null) as string | null,
        isFlagship: ship.id === scene.playerShipIds[0],
      }));
    }, SCENE);
    const tierOf = (id: string): string =>
      id.startsWith("elite_") ? "average" : "novice";
    for (const pilot of pilots) {
      if (pilot.isFlagship) expect(pilot.tier).toBeNull();
      else if (pilot.owner === "player") expect(pilot.tier).toBe("average");
      else expect(pilot.tier).toBe(tierOf(pilot.id));
    }
    const enemies = pilots.filter((p) => p.owner === "ai");
    expect(enemies.some((p) => p.targetId !== null)).toBe(true);
  });

  test("R marks the HUD target, brackets it, and the escorts shoot it", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await SURVIVAL.enter(page);
    await spawnEscorts(page);
    await recordShotsAndHud(page);
    await holdGameKey(page, "R", 120);
    const markedId = await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      return scene.squadAi.playerMarkOf(scene.time.now) as string | null;
    }, SCENE);
    expect(markedId).not.toBeNull();
    await page.waitForTimeout(100);
    const bracketed = await page.evaluate(() =>
      (window as any).__hudSnapshot.contacts
        .filter((c: any) => c.isMarked)
        .map((c: any) => c.id),
    );
    expect(bracketed).toEqual([markedId]);

    const refresh = setInterval(() => {
      void page
        .evaluate(
          ({ key, id }) => {
            const scene = (window as any).game.scene.getScene(key);
            scene.squadAi.markTarget(id, scene.time.now);
          },
          { key: SCENE, id: markedId },
        )
        .catch(() => undefined);
    }, MARK_REFRESH_MS);
    try {
      await page.waitForFunction(
        (id) =>
          ((window as any).__shots ?? []).some(
            (shot: any) =>
              shot.target === id &&
              shot.marked === true &&
              shot.attacker !== "player_0" &&
              String(shot.attacker).startsWith("player_"),
          ),
        markedId,
        { timeout: ESCORT_ENGAGE_TIMEOUT_MS },
      );
    } finally {
      clearInterval(refresh);
    }
  });
});
