/**
 * reinforcements.spec.ts — the reinforcement-pool battle in the Skirmish
 * scene: a destroyed AI ship is replaced at once within the field cap and
 * its pool pays; losing the player's ship opens the picker, whose default
 * auto-deploys (or another allowed row is picked with its number key, while
 * quota-violating rows are disabled); a side whose pool is exhausted loses;
 * at 3:00 destroyed points decide (debug clock fast-forward). Ships are
 * destroyed through the controller's debug hook.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

const SCENE = "ArcadeBattleScene";
const P = "free_confederation";
const E = "void_corsairs";

interface StartOptions {
  readonly playerShips?: readonly string[];
  readonly reserve?: ReadonlyArray<{
    definitionId: string;
    loadoutId: string | null;
  }>;
  readonly poolPoints?: number;
  readonly scenario?: string;
}

/** Starts a reinforced Skirmish with a fixed reserve against two venoms. */
async function startReinforced(
  page: Page,
  options: StartOptions = {},
): Promise<void> {
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await page.evaluate(
    ({ options, P, E }) => {
      const g = (window as any).game;
      g.scene
        .getScenes(true)
        .forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.registry.set("battleConfig", {
        factions: [
          {
            factionId: P,
            controller: "player",
            ships: options.playerShips ?? ["confed_kestrel", "confed_wasp"],
          },
          {
            factionId: E,
            controller: "ai",
            ships: ["corsair_venom", "corsair_venom"],
          },
        ],
        aiDifficulty: "easy",
        seed: 42,
        battle: "reinforcements",
        ...(options.scenario ? { scenario: options.scenario } : {}),
        reinforcements: {
          ...(options.poolPoints ? { poolPoints: options.poolPoints } : {}),
          sides: {
            [P]: {
              strategy: "balanced",
              reserve: options.reserve ?? [
                { definitionId: "confed_kestrel", loadoutId: null },
                { definitionId: "confed_wasp", loadoutId: null },
              ],
            },
            [E]: { strategy: "swarm" },
          },
        },
      });
      setTimeout(() => g.scene.start("ArcadeBattleScene"), 100);
    },
    { options, P, E },
  );
  await waitForScene(page, SCENE, 30_000);
  await page.waitForFunction(
    (key) =>
      (window as any).game.scene.getScene(key)?.reinforcementReadout
        ?.elapsedMs > 0,
    SCENE,
  );
}

async function readout(page: Page): Promise<any> {
  return page.evaluate(
    (key) => (window as any).game.scene.getScene(key).reinforcementReadout,
    SCENE,
  );
}

async function destroy(page: Page, ids: readonly string[]): Promise<void> {
  await page.evaluate(
    ({ key, ids }) => {
      const scene = (window as any).game.scene.getScene(key);
      for (const id of ids) scene.reinforcements.debugDestroy(id);
    },
    { key: SCENE, ids },
  );
}

async function aliveIds(page: Page, faction: string): Promise<string[]> {
  return page.evaluate(
    ({ key, faction }) =>
      [...(window as any).game.scene.getScene(key).ships.values()]
        .filter((s: any) => s.faction === faction && s.hull > 0)
        .map((s: any) => s.id),
    { key: SCENE, faction },
  );
}

const sideOf = (r: any, faction: string) =>
  r.sides.find((s: any) => s.faction === faction);

/** Visible text objects (end screens). */
async function visibleTexts(page: Page): Promise<string[]> {
  return page.evaluate((key) => {
    const flatten = (o: any): any[] =>
      o.type === "Container" ? o.getAll().flatMap(flatten) : [o];
    return (window as any).game.scene
      .getScene(key)
      .children.list.flatMap(flatten)
      .filter((o: any) => o.type === "Text" && o.visible)
      .map((o: any) => o.text);
  }, SCENE);
}

test.describe("Squad Builder — battle type and reserve", () => {
  async function openBuilder(page: Page): Promise<void> {
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
          .reinforcementSetup !== null,
    );
  }

  test("defaults to Reinforcements; the edited reserve goes into the battle", async ({
    page,
  }) => {
    await openBuilder(page);
    const planned = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("SquadBuilderScene");
      const setup = scene.reinforcementSetup;
      const label = setup.current.battle;
      scene.simpleFlow.selectedFaction = "free_confederation";
      scene.simpleFlow.render();
      setup.openEditor();
      const editor = setup.openEditorView;
      editor.applyStrategy("swarm");
      const picked = editor.listView.pickedOption;
      return {
        label,
        picked: {
          definitionId: picked.definitionId,
          loadoutId: picked.loadoutId,
        },
      };
    });
    expect(planned.label).toBe("reinforcements");
    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("SquadBuilderScene");
      const editor = scene.reinforcementSetup.openEditorView;
      const full = editor.reserve.length;
      editor.remove(0);
      editor.listView.addPicked();
      if (editor.reserve.length !== full)
        throw new Error("add after remove failed");
      editor.close();
      scene.simpleFlow.emit("start", {
        factionId: "free_confederation",
        shipId: "confed_kestrel",
        loadoutId: null,
      });
    });
    await waitForScene(page, SCENE, 30_000);
    const config = await page.evaluate(() =>
      (window as any).game.registry.get("battleConfig"),
    );
    expect(config.battle).toBe("reinforcements");
    expect(config.aiDifficulty).toBe("normal");
    const side = config.reinforcements.squads[0];
    expect(side.strategy).toBe("swarm");
    expect(side.reserve.at(-1)).toEqual(planned.picked);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("ss_reinforcements_v1")!),
    );
    expect(stored).toMatchObject({
      version: 1,
      battle: "reinforcements",
      strategy: "swarm",
      factionId: P,
    });
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key)?.reinforcementReadout !== null,
      SCENE,
    );
  });

  test("the AI difficulty comes from Settings › Gameplay › Default difficulty", async ({
    page,
  }) => {
    await openBuilder(page);
    await page.evaluate(async () => {
      const { loadSettings, saveSettings } =
        await import("/src/systems/SettingsStorage.ts");
      const settings = loadSettings();
      saveSettings({
        ...settings,
        gameplay: { ...settings.gameplay, defaultDifficulty: "hard" },
      });
      const g = (window as any).game;
      g.scene.stop("SquadBuilderScene");
      g.scene.start("SquadBuilderScene", { initialMode: "arcade" });
    });
    await page.waitForFunction(
      () =>
        (window as any).game.scene.getScene("SquadBuilderScene")
          .aiDifficulty === "hard",
    );
    await page.evaluate(() =>
      (window as any).game.scene
        .getScene("SquadBuilderScene")
        .simpleFlow.emit("start", {
          factionId: "free_confederation",
          shipId: "confed_kestrel",
          loadoutId: null,
        }),
    );
    await waitForScene(page, SCENE, 30_000);
    expect(
      await page.evaluate(
        () => (window as any).game.registry.get("battleConfig").aiDifficulty,
      ),
    ).toBe("hard");
    await page.waitForFunction(
      (key) =>
        Object.keys(
          (window as any).game.scene.getScene(key)?.aiPilotTiers ?? {},
        ).length > 0,
      SCENE,
    );
    const tiers = await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).aiPilotTiers,
      SCENE,
    );
    const enemyTiers = Object.entries(tiers)
      .filter(([id]) => id.startsWith("enemy_"))
      .map(([, t]) => t);
    expect(enemyTiers.length).toBeGreaterThan(0);
    expect(enemyTiers.every((t) => t === "expert")).toBe(true);
  });

  test("Classic stays one toggle away and is remembered", async ({ page }) => {
    await openBuilder(page);
    await page.evaluate(() =>
      (window as any).game.scene
        .getScene("SquadBuilderScene")
        .reinforcementSetup.controls.battleButton.activate(),
    );
    await openBuilder(page);
    const battle = await page.evaluate(
      () =>
        (window as any).game.scene.getScene("SquadBuilderScene")
          .reinforcementSetup.current.battle,
    );
    expect(battle).toBe("classic");
    await page.evaluate(() =>
      (window as any).game.scene
        .getScene("SquadBuilderScene")
        .simpleFlow.emit("start", {
          factionId: "terran_hegemony",
          shipId: "terran_viper",
          loadoutId: null,
        }),
    );
    await waitForScene(page, SCENE, 30_000);
    await page.waitForFunction(
      (key) => ((window as any).game.scene.getScene(key)?.ships?.size ?? 0) > 1,
      SCENE,
    );
    expect(
      await page.evaluate(
        () => (window as any).game.registry.get("battleConfig").battle,
      ),
    ).toBe("classic");
    expect(await readout(page)).toBeNull();
  });
});

test.describe("Reinforcement battle", () => {
  test("opens with the pool rules on the HUD: pool, field vs cap, next ships", async ({
    page,
  }) => {
    await startReinforced(page);
    const r = await readout(page);
    expect(r).toMatchObject({
      format: "skirmish",
      poolPoints: 1000,
      fieldCapPoints: 250,
      choice: "open",
    });
    expect(r.remainingMs).toBeLessThanOrEqual(180_000);
    expect(r.hud.rows[0]).toMatch(/^YOU {2}POOL \d+ {2}FIELD \d+\/250$/);
    expect(r.hud.rows[1]).toMatch(/^FOE {2}POOL \d+ {2}FIELD \d+\/250$/);
    expect(r.hud.next).toMatch(/^NEXT ▸ /);
    for (const side of r.sides) {
      expect(side.fieldPoints).toBeLessThanOrEqual(250);
      expect(side.remainingPoints + side.lostPoints + side.fieldPoints).toBe(
        1000,
      );
    }
  });

  test("a destroyed AI ship is replaced at once within the cap, shielded, and enlisted", async ({
    page,
  }) => {
    await startReinforced(page);
    const before = sideOf(await readout(page), E);
    const enemies = await aliveIds(page, E);
    await destroy(page, [enemies[0]!]);
    const arrival = await page.waitForFunction(
      ({ key, known, E }) => {
        const scene = (window as any).game.scene.getScene(key);
        const fresh = [...scene.ships.values()].find(
          (s: any) => s.faction === E && s.hull > 0 && !known.includes(s.id),
        );
        if (!fresh) return null;
        return {
          id: fresh.id,
          shielded: scene.reinforcements.isShielded(
            fresh.id,
            scene.battleClockMs,
          ),
          tier: scene.aiPilotTiers[fresh.id] ?? null,
        };
      },
      { key: SCENE, known: enemies, E },
      { timeout: 5_000 },
    );
    const fresh = (await arrival.jsonValue())!;
    expect(fresh.shielded).toBe(true);
    // Easy crews its squad slot by slot (BotDifficulty.squadSkillPlan,
    // reinforced: an average leader with novice wingmen); an arrival is
    // enlisted on the next slot.
    const easyTiers = await page.evaluate(async () => {
      const { squadSkillPlan } =
        await import("/src/arcade/ai/BotDifficulty.ts");
      return squadSkillPlan("easy", "reinforced").slots.map(
        (s: { tier: string }) => s.tier,
      );
    });
    expect(easyTiers).toContain(fresh.tier);
    const after = sideOf(await readout(page), E);
    expect(after.remainingPoints).toBeLessThan(before.remainingPoints);
    expect(after.fieldPoints).toBeLessThanOrEqual(250);
    expect(after.deployedCount).toBeGreaterThan(before.deployedCount);
    expect((await readout(page)).hud.toasts.join("\n")).toMatch(/▼ FOE  /);
  });

  test("losing the player's ship opens the picker; the default auto-deploys", async ({
    page,
  }) => {
    await startReinforced(page);
    await destroy(page, ["player_0"]);
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).reinforcementReadout.picker !==
        null,
      SCENE,
    );
    const r = await readout(page);
    expect(r.playerShipId).toBeNull();
    expect(r.picker.rows[0].isDefault).toBe(true);
    expect(r.picker.shown.countdown).toMatch(/AUTO-DEPLOY NEXT IN \d S/);
    const defaultShip = r.picker.rows[0].definitionId;
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).reinforcementReadout
          .playerShipId !== null,
      SCENE,
      { timeout: 9_000 },
    );
    const now = await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      const ship = scene.ships.get(scene.playerShipIds[0]);
      return {
        id: ship.id,
        owner: ship.owner,
        def: ship.definitionId,
        picker: scene.reinforcementReadout.picker,
      };
    }, SCENE);
    expect(now.id).not.toBe("player_0");
    expect(now.owner).toBe("player");
    expect(now.def).toBe(defaultShip);
    expect(now.picker).toBeNull();
  });

  test("another allowed ship can be picked by number; quota-violating rows are disabled", async ({
    page,
  }) => {
    await startReinforced(page, {
      playerShips: ["confed_kestrel", "confed_pelican", "confed_pelican"],
      reserve: [
        { definitionId: "confed_pelican", loadoutId: null },
        { definitionId: "confed_kestrel", loadoutId: null },
        { definitionId: "confed_wasp", loadoutId: null },
      ],
    });
    await destroy(page, ["player_0"]);
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).reinforcementReadout.picker !==
        null,
      SCENE,
    );
    const { rows, shown } = (await readout(page)).picker;
    const bomber = rows.findIndex(
      (row: any) => row.definitionId === "confed_pelican",
    );
    expect(rows[bomber].allowed).toBe(false);
    expect(rows[bomber].reason).toBe("MAX 2 BOMBERS ON FIELD");
    expect(shown.enabled[bomber]).toBe(false);
    expect(shown.rows[bomber]).toContain("MAX 2 BOMBERS ON FIELD");
    expect(rows[0]).toMatchObject({
      definitionId: "confed_kestrel",
      isDefault: true,
      allowed: true,
    });
    const wasp = rows.findIndex(
      (row: any) => row.definitionId === "confed_wasp" && row.allowed,
    );
    expect(wasp).toBeGreaterThan(0);
    await page.keyboard.press(String(bomber + 1));
    expect((await readout(page)).playerShipId).toBeNull();
    await page.keyboard.press(String(wasp + 1));
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).reinforcementReadout
          .playerShipId !== null,
      SCENE,
      { timeout: 2_000 },
    );
    const def = await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      return scene.ships.get(scene.playerShipIds[0]).definitionId;
    }, SCENE);
    expect(def).toBe("confed_wasp");
  });

  test("a side whose pool is exhausted loses: the player wins", async ({
    page,
  }) => {
    await startReinforced(page, { poolPoints: 120 });
    for (let i = 0; i < 20 && !(await readout(page)).result; i++) {
      await destroy(page, await aliveIds(page, E));
      await page.waitForTimeout(100);
    }
    const r = await readout(page);
    expect(r.result).toMatchObject({ winner: "player", reason: "exhaustion" });
    expect(sideOf(r, E).exhausted).toBe(true);
    const texts = await visibleTexts(page);
    expect(texts).toContain("VICTORY");
    expect(texts).toContain("ENEMY POOL EXHAUSTED");
    expect(texts.some((t) => t.startsWith("SHIPS DEPLOYED  YOU"))).toBe(true);
  });

  test("at 3:00 the side that destroyed more points wins", async ({ page }) => {
    await startReinforced(page);
    await destroy(page, [(await aliveIds(page, E))[0]!]);
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).reinforcementReadout.stats
          .player.destroyedPoints > 0,
      SCENE,
    );
    await page.evaluate(
      (key) =>
        (window as any).game.scene
          .getScene(key)
          .reinforcements.debugAdvanceClock(180_000),
      SCENE,
    );
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).reinforcementReadout.result !==
        null,
      SCENE,
    );
    const r = await readout(page);
    expect(r.result).toMatchObject({ winner: "player", reason: "time" });
    const texts = await visibleTexts(page);
    expect(texts).toContain("VICTORY");
    expect(texts).toContain("TIME — DESTROYED POINTS DECIDE");
  });

  test("equal destroyed points at 3:00 is a draw", async ({ page }) => {
    await startReinforced(page);
    await page.evaluate(
      (key) =>
        (window as any).game.scene
          .getScene(key)
          .reinforcements.debugAdvanceClock(180_000),
      SCENE,
    );
    await page.waitForFunction(
      (key) =>
        (window as any).game.scene.getScene(key).reinforcementReadout.result !==
        null,
      SCENE,
    );
    const r = await readout(page);
    expect(r.result.winner).toBe("draw");
    expect(await visibleTexts(page)).toContain("DRAW");
  });

  test("a reinforced scenario plays to its higher threshold in 3:00 and keeps deploying", async ({
    page,
  }) => {
    await startReinforced(page, { scenario: "satellite_array" });
    const board = await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).scenarioReadout.board,
      SCENE,
    );
    expect(board.goal).toBe("FIRST TO 70");
    const r = await readout(page);
    expect(r.format).toBe("scenario");
    expect(r.choice).toBe("planned");
    const enemies = await aliveIds(page, E);
    await destroy(page, enemies);
    await page.waitForFunction(
      ({ key, E }) =>
        [...(window as any).game.scene.getScene(key).ships.values()].some(
          (s: any) => s.faction === E && s.hull > 0,
        ),
      { key: SCENE, E },
    );
    const scenario = await page.evaluate(
      (key) => (window as any).game.scene.getScene(key).scenarioReadout,
      SCENE,
    );
    expect(scenario.result).toBeNull();
  });
});
