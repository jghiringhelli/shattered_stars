/**
 * scenarios.spec.ts — X-Wing 2.0 Scenario mode in the Skirmish scene:
 * each scenario starts with its objectives, a ship holding a satellite
 * scores every round, a salvage carrier drops its crate on a barrel roll,
 * reaching the threshold ends the match on the scenario result screen, and
 * the Squad Builder's SCENARIO picker launches the chosen scenario.
 *
 * Ships are "parked" with a debug hook: every frame (before the logic
 * ticks) the ship is put at a point and its maneuver path pinned there, so
 * the cycle engine keeps it in place.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

const SCENE = "ArcadeBattleScene";
const ROUND_MS = 6000;

/** Starts a scenario Skirmish: three confederation ships against three corsairs. */
async function startScenario(page: Page, scenario: string): Promise<void> {
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await page.evaluate((id) => {
    const g = (window as any).game;
    g.scene
      .getScenes(true)
      .forEach((s: any) => g.scene.stop(s.sys.settings.key));
    g.registry.set("battleConfig", {
      factions: [
        {
          factionId: "free_confederation",
          controller: "player",
          ships: ["confed_kestrel", "confed_kestrel", "confed_kestrel"],
        },
        {
          factionId: "void_corsairs",
          controller: "ai",
          ships: ["corsair_venom", "corsair_venom", "corsair_venom"],
        },
      ],
      aiDifficulty: "normal",
      seed: 42,
      scenario: id,
    });
    setTimeout(() => g.scene.start("ArcadeBattleScene"), 100);
  }, scenario);
  await waitForScene(page, SCENE, 30_000);
  await page.waitForFunction(
    (key) => (window as any).game.scene.getScene(key)?.scenarioReadout !== null,
    SCENE,
  );
}

/** Pins ships at points every frame (debug hook); returns nothing. */
async function park(
  page: Page,
  spots: Record<string, { x: number; y: number }>,
): Promise<void> {
  await page.evaluate(
    ({ key, spots }) => {
      const scene = (window as any).game.scene.getScene(key);
      const pinAll = (): void => {
        for (const [id, at] of Object.entries(spots)) {
          const ship = scene.ships.get(id);
          if (!ship || ship.hull <= 0) continue;
          const pin = { x: at.x, y: at.y, angle: ship.angle };
          ship.x = at.x;
          ship.y = at.y;
          ship.control = {
            ...ship.control,
            maneuverPath: ship.control.maneuverPath.map(() => pin),
            maneuverTarget: pin,
          };
        }
      };
      (window as any).__unpark?.();
      scene.events.on("preupdate", pinAll);
      (window as any).__unpark = () => scene.events.off("preupdate", pinAll);
    },
    { key: SCENE, spots },
  );
}

async function readout(page: Page): Promise<any> {
  return page.evaluate(
    (key) => (window as any).game.scene.getScene(key).scenarioReadout,
    SCENE,
  );
}

/** Enemies parked out of everyone's way (far corner of the torus). */
const ENEMIES_AWAY = {
  enemy_0: { x: 500, y: 500 },
  enemy_1: { x: 700, y: 500 },
  enemy_2: { x: 900, y: 500 },
};

test.describe("Scenario mode", () => {
  const expected: ReadonlyArray<[string, string, number]> = [
    ["satellite_array", "satellite", 3],
    ["chance_engagement", "satellite", 1],
    ["salvage_mission", "crate", 3],
    ["scramble_transmissions", "node", 3],
  ];
  for (const [scenario, kind, count] of expected) {
    test(`${scenario} starts with ${count} ${kind} objective(s), nobody holding them`, async ({
      page,
    }) => {
      await startScenario(page, scenario);
      const r = await readout(page);
      expect(r.id).toBe(scenario);
      expect(r.objectives).toHaveLength(count);
      expect(
        r.objectives.every((o: any) => o.kind === kind && o.owner === "none"),
      ).toBe(true);
      expect(r.totals).toEqual({ player: 0, enemy: 0 });
      expect(r.board.goal).toBe("FIRST TO 20");
    });
  }

  test("a ship parked on a satellite scores it every round", async ({
    page,
  }) => {
    await startScenario(page, "satellite_array");
    const b = (await readout(page)).objectives[1];
    await park(page, { player_0: { x: b.x, y: b.y }, ...ENEMIES_AWAY });
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).scenarioReadout.round >= 1,
      SCENE,
      { timeout: ROUND_MS * 3 },
    );
    const first = await readout(page);
    expect(first.objectives[1].owner).toBe("player");
    expect(first.points.player.objective).toBeGreaterThanOrEqual(1);
    expect(first.points.enemy.objective).toBe(0);
    await page.waitForFunction(
      ({ key, round }) =>
        (window as any).game.scene.getScene(key).scenarioReadout.round >=
        round + 1,
      { key: SCENE, round: first.round },
      { timeout: ROUND_MS * 3 },
    );
    const second = await readout(page);
    expect(second.points.player.objective).toBeGreaterThan(
      first.points.player.objective,
    );
    expect(second.board.playerScore).toBe(`YOU ${second.totals.player}`);
  });

  test("a salvage carrier drops its crate on a barrel roll", async ({
    page,
  }) => {
    await startScenario(page, "salvage_mission");
    const crate = (await readout(page)).objectives[1];
    await park(page, { player_0: { x: crate.x, y: crate.y }, ...ENEMIES_AWAY });
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).scenarioReadout.objectives[1]
          .carrierId === "player_0",
      SCENE,
    );
    expect((await readout(page)).board.alert).toContain("CARRYING SALVAGE");
    await park(page, ENEMIES_AWAY);
    // Barrel roll = double-tap of the same arrow (docs/specs/flight-controls.md).
    await page.keyboard.press("ArrowLeft", { delay: 50 });
    await page.waitForTimeout(40);
    await page.keyboard.press("ArrowLeft", { delay: 50 });
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).scenarioReadout.objectives[1]
          .carrierId === null,
      SCENE,
      { timeout: 3_000 },
    );
    const after = await readout(page);
    expect(after.objectives[1].owner).toBe("none");
    expect(after.board.alert).toBe("");
    const rolled = await page.evaluate(
      (key) =>
        (window as any).game.scene.getScene(key).ships.get("player_0").control
          .barrelRollCooldown,
      SCENE,
    );
    expect(rolled).toBeGreaterThan(0);
    const dropDistance = Math.hypot(
      after.objectives[1].x - crate.x,
      after.objectives[1].y - crate.y,
    );
    expect(dropDistance).toBeLessThan(300);
  });

  test("reaching the threshold ends the match on the scenario result screen", async ({
    page,
  }) => {
    await startScenario(page, "satellite_array");
    await page.evaluate((key) => {
      (window as any).game.scene
        .getScene(key)
        .scenario.debugAddPoints("player", 20);
    }, SCENE);
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).scenarioReadout.result !==
        null,
      SCENE,
    );
    const r = await readout(page);
    expect(r.result).toMatchObject({ winner: "player", reason: "threshold" });
    const texts: string[] = await page.evaluate(
      (key) =>
        (window as any).game.scene
          .getScene(key)
          .children.list.flatMap((o: any) =>
            o.type === "Container" ? o.getAll() : [o],
          )
          .flatMap((o: any) => (o.type === "Container" ? o.getAll() : [o]))
          .filter((o: any) => o.type === "Text" && o.visible)
          .map((o: any) => o.text),
      SCENE,
    );
    expect(texts).toContain("VICTORY");
    expect(texts).toContain("ASSAULT AT THE SATELLITE ARRAY");
    expect(texts).toContain("First to 20 points");
    expect(texts).toContain("OBJECTIVES");
  });

  test("the Squad Builder's SCENARIO picker launches the chosen scenario", async ({
    page,
  }) => {
    await page.goto("/?debug=1");
    suppressWebGLNoise(page);
    await waitForMenuReady(page);
    await page.evaluate(() => {
      const g = (window as any).game;
      g.registry.set("scenarioChoice", null);
      g.scene
        .getScenes(true)
        .forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.scene.start("SquadBuilderScene", { initialMode: "arcade" });
    });
    await waitForScene(page, "SquadBuilderScene");
    await page.waitForFunction(
      () =>
        (window as any).game.scene.getScene("SquadBuilderScene")
          .scenarioPicker !== null,
    );
    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("SquadBuilderScene");
      scene.scenarioPicker.button.activate();
      scene.scenarioPicker.button.activate();
      scene.simpleMode = false;
      scene.renderBuilderMode();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() =>
      (window as any).game.scene.getScene("SquadBuilderScene").startBattle(),
    );
    await waitForScene(page, SCENE, 30_000);
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key)?.scenarioReadout?.id ===
        "chance_engagement",
      SCENE,
    );
  });
});
