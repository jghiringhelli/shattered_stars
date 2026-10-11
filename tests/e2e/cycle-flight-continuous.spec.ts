/**
 * cycle-flight-continuous.spec.ts — ContinuousTacticalScene flies the X-Wing
 * cycle engine: every ship rides template arcs on its own, and the player's
 * dial order latches into the selected ship's queue (nextManeuver + speed),
 * flies at the next cycle boundary and turns the ship accordingly. Its AI
 * ships fly the skill-gate bots at the match difficulty's tier, and R marks
 * the selected ship's target for the player's side.
 */

import { test, expect, type Page } from "@playwright/test";
import { holdGameKey } from "./helpers/game";
import { CONTINUOUS } from "./helpers/battleEntry";

const SCENE = "ContinuousTacticalScene";

interface ShipSnapshot {
  readonly id: string;
  readonly owner: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly currentManeuver: string | null;
  readonly nextManeuver: string | null;
  readonly speed: number;
  readonly orderDirection: string;
  readonly orderSpeed: number;
  readonly cycleEndAngle: number | null;
}

async function readShips(page: Page): Promise<ShipSnapshot[]> {
  return page.evaluate((key) => {
    const scene = (window as unknown as { game: any }).game.scene.getScene(key);
    return [...scene.ships.values()].map((ship: any) => {
      const control = ship.flight.motion.control;
      return {
        id: ship.id,
        owner: ship.owner,
        x: ship.x,
        y: ship.y,
        angle: ship.angle,
        currentManeuver: control.currentManeuver,
        nextManeuver: control.nextManeuver,
        speed: control.speed,
        orderDirection: ship.order.direction,
        orderSpeed: ship.order.speed,
        cycleEndAngle: control.maneuverTarget?.angle ?? null,
      };
    });
  }, SCENE);
}

async function readSelected(page: Page): Promise<ShipSnapshot> {
  const selectedId = await page.evaluate(
    (key) =>
      (window as unknown as { game: any }).game.scene.getScene(key)
        .selectedShipId as string,
    SCENE,
  );
  return (await readShips(page)).find((s) => s.id === selectedId)!;
}

/** Waits until the selected ship's engine state satisfies `field === value`. */
async function waitForSelectedControl(
  page: Page,
  field: "currentManeuver" | "nextManeuver",
  value: string,
): Promise<void> {
  await page.waitForFunction(
    ([key, f, v]) => {
      const scene = (window as unknown as { game: any }).game.scene.getScene(
        key,
      );
      const ship = scene.ships.get(scene.selectedShipId);
      return ship?.flight.motion.control[f as string] === v;
    },
    [SCENE, field, value] as const,
    { timeout: 3_000 },
  );
}

/** Signed heading change a→b in degrees, in (-180, 180]. */
const headingChange = (a: number, b: number): number =>
  ((((b - a + 180) % 360) + 360) % 360) - 180;

test.describe("ContinuousTacticalScene — cycle-engine flight", () => {
  test("every ship is flying a cycle maneuver and moves on its own", async ({
    page,
  }) => {
    await CONTINUOUS.enter(page, { peaceful: true });
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

  test("a dialed bank order is queued, flies next cycle and turns the ship right", async ({
    page,
  }) => {
    await CONTINUOUS.enter(page, { peaceful: true });
    const start = await readSelected(page);
    expect(start.orderDirection).toBe("straight");

    await holdGameKey(page, "ArrowRight", 150);
    await waitForSelectedControl(page, "nextManeuver", "bank_right");
    expect((await readSelected(page)).orderDirection).toBe("bank_right");

    await waitForSelectedControl(page, "currentManeuver", "bank_right");
    const banking = await readSelected(page);
    await holdGameKey(page, "ArrowLeft", 150);
    await page.waitForTimeout(1200);
    const end = await readSelected(page);

    const cycleTurn = headingChange(start.angle, banking.cycleEndAngle!);
    expect(cycleTurn).toBeGreaterThanOrEqual(40);
    expect(cycleTurn).toBeLessThanOrEqual(50);
    expect(end.orderDirection).toBe("straight");
    expect(
      Math.abs(headingChange(banking.cycleEndAngle!, end.angle)),
    ).toBeLessThan(1);
  });

  test("DOWN lowers the ordered speed and latches it as the engine speed", async ({
    page,
  }) => {
    await CONTINUOUS.enter(page, { peaceful: true });
    const start = await readSelected(page);
    await holdGameKey(page, "ArrowDown", 150);
    await page.waitForTimeout(100);
    const slowed = await readSelected(page);
    expect(slowed.orderSpeed).toBeLessThan(start.orderSpeed);
    expect(slowed.speed).toBe(slowed.orderSpeed);
  });
});

test.describe("ContinuousTacticalScene — the AI is the skill-gate bots", () => {
  test("AI ships fly bot pilots at the match difficulty's tier; player ships keep their dial", async ({
    page,
  }) => {
    await CONTINUOUS.enter(page, { peaceful: true });
    await page.waitForTimeout(1500);
    const crew = await page.evaluate(async (key) => {
      const { difficultyToTier } = await import("/src/arcade/ai/index.ts");
      const scene = (window as any).game.scene.getScene(key);
      return {
        expected: difficultyToTier(scene.aiDifficulty).tier,
        ai: scene.enemyShipIds.map((id: string) => ({
          tier: scene.bots.tierOf(id),
          squad: scene.bots.squadKeyOf(id),
          target: scene.bots.pilotTargetOf(id),
          faction: scene.ships.get(id).faction,
        })),
        player: scene.playerShipIds.map((id: string) => scene.bots.tierOf(id)),
        playerIds: scene.playerShipIds,
      };
    }, SCENE);
    expect(crew.ai.length).toBeGreaterThan(0);
    for (const ship of crew.ai) {
      expect(ship.tier).toBe(crew.expected);
      expect(ship.squad).toBe(ship.faction);
      expect(crew.playerIds).toContain(ship.target);
    }
    expect(crew.player.every((tier: string | null) => tier === null)).toBe(
      true,
    );
  });

  test("R marks the selected ship's target for the player's side and the HUD shows it", async ({
    page,
  }) => {
    await CONTINUOUS.enter(page, { peaceful: true });
    await holdGameKey(page, "R", 100);
    await page.waitForFunction(
      (key) => {
        const scene = (window as any).game.scene.getScene(key);
        return scene.bots.markedTarget(scene.playerFaction, scene.time.now);
      },
      SCENE,
      { timeout: 3_000 },
    );
    await page.waitForTimeout(100);
    const marked = await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      const id = scene.bots.markedTarget(scene.playerFaction, scene.time.now);
      return {
        isEnemy: scene.enemyShipIds.includes(id),
        reticles: scene.hud.markReticleCount,
      };
    }, SCENE);
    expect(marked.isEnemy).toBe(true);
    expect(marked.reticles).toBeGreaterThanOrEqual(1);
  });
});
