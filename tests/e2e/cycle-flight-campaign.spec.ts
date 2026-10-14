/**
 * cycle-flight-campaign.spec.ts — CampaignBattleScene flies the X-Wing cycle
 * engine: every ship rides template arcs on its own, holding LEFT banks the
 * flagship, and Z queues a Snap turn that costs stress. Runs mission heg_1_3
 * (flagship + escort vs 3 enemies) with combat, reinforcements and
 * objectives disabled so nothing dies and the mission cannot end mid-test.
 *
 * Escorts and enemies are BotPilots at the mission's tiers (tutorial
 * enemies novices), R marks a target, and the mission still completes when
 * every enemy is destroyed and fails when every player ship is lost.
 */

import { test, expect, type Page } from "@playwright/test";
import { holdGameKey, waitForMenuReady, waitForScene } from "./helpers/game";
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

  test("Z queues a Snap turn and costs stress", async ({ page }) => {
    await CAMPAIGN.enter(page, { peaceful: true });
    await holdGameKey(page, "Z", 150);
    // The maneuver key waits out its double-tap window before it queues the Snap turn.
    await expect
      .poll(async () => {
        const s = await readFlagship(page);
        return [s.currentManeuver, s.nextManeuver].includes("kturn");
      })
      .toBe(true);
    const ship = await readFlagship(page);
    expect(ship.stress).toBeGreaterThan(0);
  });
});

interface PilotSnapshot {
  readonly id: string;
  readonly owner: string;
  readonly tier: string | null;
  readonly isFlagship: boolean;
}

async function readPilots(page: Page): Promise<PilotSnapshot[]> {
  return page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    return [...scene.ships.values()].map((ship: any) => ({
      id: ship.id,
      owner: ship.owner,
      tier: ship.bot?.tier ?? null,
      isFlagship: ship.id === scene.playerShipIds[0],
    }));
  }, SCENE_KEY);
}

/** Starts a Hegemony mission with combat and reinforcements off. */
async function startCalmMission(page: Page, missionId: string): Promise<void> {
  await page.goto("/?debug=1");
  await waitForMenuReady(page);
  await page.evaluate(async (id) => {
    const { FACTION_CAMPAIGNS } = await import("/src/data/CampaignData.ts");
    const { CampaignSaveManager } =
      await import("/src/systems/CampaignSaveManager.ts");
    const factionId = "terran_hegemony";
    const mission = FACTION_CAMPAIGNS[factionId].missions.find(
      (m: any) => m.id === id,
    );
    const game = (window as any).game;
    const scene = game.scene.getScene("CampaignBattleScene");
    scene.processCombat = () => undefined;
    scene.checkDelayedSpawns = () => undefined;
    game.scene.stop("MainMenuScene");
    game.scene.start("CampaignBattleScene", {
      factionId,
      mission,
      saveData: CampaignSaveManager.createNew(factionId),
    });
  }, missionId);
  await waitForScene(page, SCENE_KEY, 30_000);
  await page.waitForFunction(
    (key) => ((window as any).game.scene.getScene(key)?.ships?.size ?? 0) >= 2,
    SCENE_KEY,
    { timeout: 15_000 },
  );
}

test.describe("CampaignBattleScene — bot pilots", () => {
  test("escorts and enemies are BotPilots at the mission's tiers", async ({
    page,
  }) => {
    await CAMPAIGN.enter(page, { peaceful: true });
    for (const pilot of await readPilots(page)) {
      // heg_1_3 (act 1 = learning act): escorts average, regular enemies novice.
      const expected = pilot.owner === "player" ? "average" : "novice";
      expect(pilot.tier).toBe(pilot.isFlagship ? null : expected);
    }
  });

  test("the enemy of a tutorial (First Blood) is a novice", async ({
    page,
  }) => {
    await startCalmMission(page, "heg_1_2");
    const enemies = (await readPilots(page)).filter((p) => p.owner === "ai");
    expect(enemies.length).toBeGreaterThan(0);
    expect(enemies.every((p) => p.tier === "novice")).toBe(true);
  });

  test("bots pick targets and the enemies of the other side are hunted", async ({
    page,
  }) => {
    await CAMPAIGN.enter(page, { peaceful: true });
    await page.waitForTimeout(1500);
    const targets = await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      return [...scene.ships.values()]
        .filter((ship: any) => ship.bot)
        .map((ship: any) => ({
          owner: ship.owner,
          targetOwner: scene.ships.get(ship.bot.targetId)?.owner ?? null,
        }));
    }, SCENE_KEY);
    const hunting = targets.filter((t) => t.targetOwner !== null);
    expect(hunting.length).toBeGreaterThan(0);
    for (const t of hunting) expect(t.targetOwner).not.toBe(t.owner);
  });
});

test.describe("CampaignBattleScene — mission outcome with bots", () => {
  test("R marks a target; destroying every enemy completes the mission", async ({
    page,
  }) => {
    await startCalmMission(page, "heg_1_3");
    await page.waitForTimeout(500);
    await holdGameKey(page, "R", 120);
    const result = await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      const marked = scene.squadAi.playerMarkOf(scene.time.now);
      const flagship = scene.ships.get(scene.playerShipIds[0]);
      for (const id of [...scene.enemyShipIds]) {
        const enemy = scene.ships.get(id);
        enemy.hull = 0;
        scene.killShip(enemy, flagship);
      }
      return {
        marked,
        markAfterKill: scene.squadAi.playerMarkOf(scene.time.now),
      };
    }, SCENE_KEY);
    expect(result.marked).not.toBeNull();
    expect(result.markAfterKill).toBeNull();
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key)?.missionComplete === true,
      SCENE_KEY,
      { timeout: 10_000 },
    );
  });

  test("losing every ship fails the mission", async ({ page }) => {
    await startCalmMission(page, "heg_1_3");
    await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      for (const id of [...scene.playerShipIds]) {
        scene.ships.get(id).hull = 0;
      }
    }, SCENE_KEY);
    await page.waitForFunction(
      (key) => (window as any).game.scene.getScene(key)?.missionFailed === true,
      SCENE_KEY,
      { timeout: 10_000 },
    );
    const missionComplete = await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).missionComplete,
      SCENE_KEY,
    );
    expect(missionComplete).toBe(false);
  });
});
