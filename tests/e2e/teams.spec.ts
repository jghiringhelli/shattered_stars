/**
 * teams.spec.ts — Skirmish sides are TEAMS, not factions: a mirror match
 * (Hegemony vs Hegemony) is a real fight that plays to a result; a 2v2 of
 * mixed-faction teams keeps every ship's targets on the other team and
 * shows teammates of another faction as allies; a reinforced mirror match
 * keeps one pool per team and replaces each team's ships with its own;
 * the Squad Builder's team chips put two same-faction squads on two teams.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

const SCENE = "ArcadeBattleScene";
const HEG = "terran_hegemony";
/** Battle time sped up while the AI flies every ship (autopilot). */
const FAST_TIME_SCALE = 8;
/** Real time a sped-up 3:00 battle may take to reach its result. */
const RESULT_TIMEOUT_MS = 90_000;

interface Squad {
  readonly factionId: string;
  readonly controller: "player" | "ai";
  readonly ships: readonly string[];
  readonly teamId: string;
}

/** Starts a Skirmish from a battle config (extra fields merged in). */
async function startBattle(
  page: Page,
  squads: readonly Squad[],
  extra: Record<string, unknown> = {},
): Promise<void> {
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await page.evaluate(
    ({ squads, extra }) => {
      const g = (window as any).game;
      g.scene
        .getScenes(true)
        .forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.registry.set("battleConfig", {
        factions: squads,
        aiDifficulty: "easy",
        seed: 11,
        battle: "classic",
        ...extra,
      });
      setTimeout(() => g.scene.start("ArcadeBattleScene"), 100);
    },
    { squads, extra },
  );
  await waitForScene(page, SCENE, 30_000);
  const total = squads.reduce((sum, s) => sum + s.ships.length, 0);
  await page.waitForFunction(
    ({ key, n }) => (window as any).game.scene.getScene(key)?.ships?.size >= n,
    { key: SCENE, n: total },
  );
}

/** Every ship's id, faction, team and hull. */
async function shipsOf(
  page: Page,
): Promise<{ id: string; faction: string; team: number; hull: number }[]> {
  return page.evaluate(
    (key) =>
      [...(window as any).game.scene.getScene(key).ships.values()].map(
        (s: any) => ({
          id: s.id,
          faction: s.faction,
          team: s.team,
          hull: s.hull,
        }),
      ),
    SCENE,
  );
}

/** The AI flies every ship and battle time runs fast until the battle ends. */
async function playToResult(page: Page): Promise<void> {
  await page.evaluate(
    ({ key, scale }) => {
      const scene = (window as any).game.scene.getScene(key);
      scene.debugAutopilot = true;
      scene.debugTimeScale = scale;
    },
    { key: SCENE, scale: FAST_TIME_SCALE },
  );
  await page.waitForFunction(
    (key) => (window as any).game.scene.getScene(key).gameEnded === true,
    SCENE,
    { timeout: RESULT_TIMEOUT_MS, polling: 500 },
  );
}

/** Ids of every AI ship's current target, by ship. */
async function aiTargets(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    const out: Record<string, string | null> = {};
    for (const id of Object.keys(scene.aiPilotTiers))
      out[id] = scene.aiTargetOf(id);
    return out;
  }, SCENE);
}

/** Every AI target belongs to another team than its hunter. */
async function expectTargetsAcrossTeams(page: Page): Promise<number> {
  const ships = new Map((await shipsOf(page)).map((s) => [s.id, s]));
  const targets = await aiTargets(page);
  let checked = 0;
  for (const [hunter, target] of Object.entries(targets)) {
    if (!target) continue;
    expect(ships.get(target)!.team).not.toBe(ships.get(hunter)!.team);
    checked++;
  }
  return checked;
}

test.describe("Skirmish teams", () => {
  test.setTimeout(150_000);

  test("a mirror match (Hegemony vs Hegemony) is a real fight that plays to a result", async ({
    page,
  }) => {
    await startBattle(page, [
      {
        factionId: HEG,
        controller: "player",
        ships: ["terran_viper", "terran_viper", "terran_gladius"],
        teamId: "team_1",
      },
      {
        factionId: HEG,
        controller: "ai",
        ships: ["terran_viper", "terran_viper", "terran_gladius"],
        teamId: "team_2",
      },
    ]);
    const ships = await shipsOf(page);
    expect(new Set(ships.map((s) => s.faction))).toEqual(new Set([HEG]));
    expect(ships.filter((s) => s.team === 1)).toHaveLength(3);
    expect(ships.filter((s) => s.team === 2)).toHaveLength(3);
    // The old faction-as-side bug ended a mirror match at tick 3.
    await page.waitForTimeout(3_000);
    const early = await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      return {
        ended: scene.gameEnded,
        enemies: scene.enemyShipIds.length,
        roster: scene.hudReadout.rosterLabels,
        allies: scene.hudReadout.allyContactCount,
      };
    }, SCENE);
    expect(early.ended).toBe(false);
    expect(early.enemies).toBe(3);
    expect(early.roster).toEqual([`▲ TERRAN HEGEMONY`, `▼ TERRAN HEGEMONY`]);
    expect(early.allies).toBe(2);
    await page.waitForFunction(
      (key) =>
        Object.keys(
          (window as any).game.scene.getScene(key).aiPilotTiers,
        ).every(
          (id) =>
            (window as any).game.scene.getScene(key).aiTargetOf(id) !== null,
        ),
      SCENE,
      { timeout: 15_000 },
    );
    expect(await expectTargetsAcrossTeams(page)).toBeGreaterThan(0);
    await playToResult(page);
    const after = await shipsOf(page);
    const hurt = after.filter(
      (s) => s.hull < ships.find((o) => o.id === s.id)!.hull,
    );
    expect(hurt.length).toBeGreaterThan(0);
    const destroyed = after.filter((s) => s.hull <= 0);
    expect(destroyed.length).toBeGreaterThan(0);
  });

  test("2v2 with mixed-faction teams: teammates of another faction are allies, foes of the player's faction are enemies", async ({
    page,
  }) => {
    await startBattle(page, [
      {
        factionId: HEG,
        controller: "player",
        ships: ["terran_viper", "terran_viper"],
        teamId: "team_1",
      },
      {
        factionId: "void_corsairs",
        controller: "ai",
        ships: ["corsair_raider", "corsair_raider"],
        teamId: "team_1",
      },
      {
        factionId: HEG,
        controller: "ai",
        ships: ["terran_viper", "terran_viper"],
        teamId: "team_2",
      },
      {
        factionId: "free_confederation",
        controller: "ai",
        ships: ["confed_sparrow", "confed_sparrow"],
        teamId: "team_2",
      },
    ]);
    const ships = await shipsOf(page);
    const mine = ships.filter((s) => s.team === 1);
    expect(new Set(mine.map((s) => s.faction))).toEqual(
      new Set([HEG, "void_corsairs"]),
    );
    expect(mine.map((s) => s.id).sort()).toEqual(
      ["ally_0", "ally_1", "ally_2", "player_0"].sort(),
    );
    const roster = await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).hudReadout.rosterLabels,
      SCENE,
    );
    expect(roster).toEqual([
      "▲ HEGEMONY + CORSAIRS",
      "▼ HEGEMONY + CONFEDERATION",
    ]);
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).hudReadout.allyContactCount ===
        3,
      SCENE,
    );
    await page.waitForFunction(
      (key) =>
        ["ally_1", "enemy_0", "enemy_2"].every(
          (id) =>
            (window as any).game.scene.getScene(key).aiTargetOf(id) !== null,
        ),
      SCENE,
      { timeout: 15_000 },
    );
    for (let i = 0; i < 4; i++) {
      expect(await expectTargetsAcrossTeams(page)).toBeGreaterThan(0);
      await page.waitForTimeout(500);
    }
    await playToResult(page);
    const after = await shipsOf(page);
    const teamDown = [1, 2].some((team) =>
      after.filter((s) => s.team === team).every((s) => s.hull <= 0),
    );
    const anyDestroyed = after.some((s) => s.hull <= 0);
    expect(anyDestroyed || teamDown).toBe(true);
  });

  test("a reinforced mirror match keeps one pool per team and replaces each team's ships with its own", async ({
    page,
  }) => {
    await startBattle(
      page,
      [
        {
          factionId: HEG,
          controller: "player",
          ships: ["terran_viper", "terran_viper"],
          teamId: "team_1",
        },
        {
          factionId: HEG,
          controller: "ai",
          ships: ["terran_viper", "terran_viper"],
          teamId: "team_2",
        },
      ],
      {
        battle: "reinforcements",
        reinforcements: {
          squads: [
            {
              strategy: "balanced",
              reserve: [{ definitionId: "terran_viper", loadoutId: null }],
            },
            { strategy: "swarm" },
          ],
        },
      },
    );
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key)?.reinforcementReadout
          ?.elapsedMs > 0,
      SCENE,
    );
    const readout = () =>
      page.evaluate(
        (key) => (window as any).game.scene.getScene(key).reinforcementReadout,
        SCENE,
      );
    const start = await readout();
    expect(start.sides.map((s: any) => s.key)).toEqual(["team_1", "team_2"]);
    expect(start.sides.map((s: any) => s.faction)).toEqual([HEG, HEG]);
    expect(start.localMember).toBe("squad_0");
    expect(start.hud.rows[0]).toMatch(/^YOU/);
    expect(start.hud.rows[1]).toMatch(/^FOE/);

    const before = new Set((await shipsOf(page)).map((s) => s.id));
    await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      scene.reinforcements.debugDestroy("enemy_0");
    }, SCENE);
    await page.waitForFunction(
      ({ key, known }) =>
        [...(window as any).game.scene.getScene(key).ships.values()].some(
          (s: any) => s.team === 2 && s.hull > 0 && !known.includes(s.id),
        ),
      { key: SCENE, known: [...before] },
      { timeout: 10_000 },
    );
    const arrived = (await shipsOf(page)).filter(
      (s) => !before.has(s.id) && s.team === 2,
    );
    expect(arrived.every((s) => s.faction === HEG)).toBe(true);
    const toasts = (await readout()).hud.toasts as string[];
    expect(toasts.some((t) => t.startsWith("▼ FOE"))).toBe(true);
    expect((await readout()).sides[1].lostCount).toBe(1);
    expect((await readout()).sides[0].lostCount).toBe(0);

    await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      scene.reinforcements.debugDestroy("player_0");
    }, SCENE);
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).reinforcementReadout.picker !==
        null,
      SCENE,
    );
    const chose = await page.evaluate(
      (key) =>
        (window as any).game.scene.getScene(key).reinforcements.choose(0),
      SCENE,
    );
    expect(chose).toBe(true);
    const flown = await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      const ship = scene.ships.get(scene.playerShipIds[0]);
      return { id: ship.id, team: ship.team, owner: ship.owner };
    }, SCENE);
    expect(flown.id).not.toBe("player_0");
    expect(flown).toMatchObject({ team: 1, owner: "player" });
  });
  test("the Squad Builder starts a mirror match: same faction, team chips decide the sides", async ({
    page,
  }) => {
    await page.goto("/?debug=1");
    suppressWebGLNoise(page);
    await waitForMenuReady(page);
    await clickMenuItem(page, "SKIRMISH");
    await waitForScene(page, "SquadBuilderScene");
    await page.evaluate((heg) => {
      const s = (window as any).game.scene.getScene("SquadBuilderScene");
      if (s.simpleMode) {
        s.simpleMode = false;
        s.renderBuilderMode();
      }
      s.squads[0].factionId = heg;
      s.squads[0].controller = "player";
      s.squads[0].teamId = 1;
      s.squads[1].factionId = heg;
      s.squads[1].controller = "ai";
      s.squads[1].teamId = 2;
      s.squadListPanel.autoFillAll();
      s.startBattle();
    }, HEG);
    await waitForScene(page, SCENE, 30_000);
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key)?.playerShipIds?.length > 0,
      SCENE,
    );
    const config = await page.evaluate(() =>
      (window as any).game.registry.get("battleConfig"),
    );
    expect(config.factions.map((f: any) => f.teamId)).toEqual([
      "team_1",
      "team_2",
    ]);
    const ships = await shipsOf(page);
    expect(new Set(ships.map((s) => s.faction))).toEqual(new Set([HEG]));
    expect(new Set(ships.map((s) => s.team))).toEqual(new Set([1, 2]));
    await page.waitForTimeout(2_000);
    expect(
      await page.evaluate(
        (key) => (window as any).game.scene.getScene(key).gameEnded,
        SCENE,
      ),
    ).toBe(false);
  });
});
