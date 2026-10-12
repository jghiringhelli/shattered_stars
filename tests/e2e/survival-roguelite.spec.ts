/**
 * Survival roguelite E2E (ADR-0004): a fixed-seed run end to end —
 * setup → sector map → combat node → cleared (debug kills) → back on the
 * map with persisted hull damage → power draft → shop purchase consumes
 * salvage → save & resume after a reload restores the run → death opens
 * the run summary and the history.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  waitForMenuReady,
  waitForScene,
  suppressWebGLNoise,
} from "./helpers/game";

const SEED_CODE = "ROGUE1";
const SEED = parseInt(SEED_CODE.toLowerCase(), 36);

type Game = any;

/** Opens the setup screen, types the seed and launches a new run. */
async function launchSeededRun(page: Page): Promise<void> {
  await page.goto("/");
  await waitForMenuReady(page);
  await page.evaluate(() => {
    const game = (window as any).game as Game;
    game.scene.stop("MainMenuScene");
    game.scene.start("SurvivalSetupScene");
  });
  await waitForScene(page, "SurvivalSetupScene");
  await page.evaluate((code) => {
    const setup = (window as any).game.scene.getScene("SurvivalSetupScene");
    setup.controls.setSeedCode(code);
    setup.launchRun();
  }, SEED_CODE);
  await waitForScene(page, "SurvivalMapScene");
}

/** The map scene's run (plain JSON). */
function mapRun(page: Page): Promise<any> {
  return page.evaluate(() =>
    JSON.parse(
      JSON.stringify(
        (window as any).game.scene.getScene("SurvivalMapScene").run,
      ),
    ),
  );
}

/** Forces the given next node to a type, then travels there. */
async function travelAs(page: Page, type: string): Promise<string> {
  return page.evaluate((nodeType) => {
    const map = (window as any).game.scene.getScene("SurvivalMapScene");
    const service = map.service;
    const run = service.run;
    const rows = run.map.rows;
    const current = run.currentNodeId
      ? rows.flat().find((n: any) => n.id === run.currentNodeId)
      : null;
    const nextId = current ? current.next[0] : rows[0][0].id;
    service.apply((r: any) => ({
      ...r,
      map: {
        ...r.map,
        rows: r.map.rows.map((row: any[]) =>
          row.map((n: any) => (n.id === nextId ? { ...n, type: nodeType } : n)),
        ),
      },
    }));
    if (!map.travelTo(nextId)) throw new Error(`cannot travel to ${nextId}`);
    return nextId;
  }, type);
}

/** Clicks the choice card at `index` on a scene's open choice panel. */
async function pickCard(
  page: Page,
  sceneKey: string,
  index: number,
): Promise<void> {
  await page.waitForFunction(
    (key) =>
      (window as any).game.scene.getScene(key)?.choicePanel?.isOpen === true ||
      (window as any).game.scene.getScene(key)?.panel?.isOpen === true,
    sceneKey,
    { timeout: 8_000 },
  );
  await page.evaluate(
    ({ key, i }) => {
      const scene = (window as any).game.scene.getScene(key);
      const panel = scene.choicePanel ?? scene.panel;
      const groups = panel.container.list.filter(
        (o: any) => o.type === "Container",
      );
      const group = groups[i];
      group.list[group.list.length - 1].emit("pointerdown");
    },
    { key: sceneKey, i: index },
  );
}

/** Kills every enemy of the current wave (debug hook) and runs the check. */
async function killWave(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const s = (window as any).game.scene.getScene("SurvivalScene");
      return s?.isWaveActive === true && s.enemyShipIds.length > 0;
    },
    undefined,
    { timeout: 15_000 },
  );
  await page.evaluate(() => {
    const s = (window as any).game.scene.getScene("SurvivalScene");
    for (const id of [...s.enemyShipIds]) s.destroyShip(id, true);
    s.checkWaveComplete();
  });
}

test.describe("Survival roguelite — a seeded run", () => {
  test("map → battle → damage persists → shop → resume → death summary", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    suppressWebGLNoise(page);
    await launchSeededRun(page);

    // The map shows the seeded sector 1 with reachable typed nodes.
    const run0 = await mapRun(page);
    expect(run0.seed).toBe(SEED);
    expect(run0.sector).toBe(1);
    const expected = await page.evaluate(async (seed) => {
      const { generateSectorMap } =
        await import("/src/systems/survival/SectorMapGenerator.ts");
      return JSON.parse(JSON.stringify(generateSectorMap(seed, 1)));
    }, SEED);
    expect(run0.map).toEqual(expected);
    const nodeCount = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("SurvivalMapScene");
      return scene.children.list.filter((o: any) =>
        String(o.name).startsWith("node:"),
      ).length;
    });
    expect(nodeCount).toBe(run0.map.rows.flat().length);

    // Enter a combat node; take damage; clear its wave.
    await travelAs(page, "combat");
    await waitForScene(page, "SurvivalScene", 30_000);
    await page.waitForFunction(
      () =>
        (window as any).game.scene.getScene("SurvivalScene")?.isWaveActive ===
        true,
      undefined,
      { timeout: 15_000 },
    );
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene");
      const flagship = s.ships.get(s.playerShipIds[0]);
      flagship.hull = Math.round(flagship.maxHull * 0.5);
    });
    await killWave(page);
    await waitForScene(page, "SurvivalMapScene", 15_000);

    // Back on the map: hull damage persisted, a power draft is waiting.
    const afterBattle = await mapRun(page);
    expect(afterBattle.flagship.hull).toBeCloseTo(0.5, 1);
    expect(afterBattle.stats.nodesCleared).toBe(1);
    expect(afterBattle.stats.kills).toBeGreaterThan(0);
    expect(afterBattle.pendingRewards[0].kind).toBe("power");
    await pickCard(page, "SurvivalMapScene", 0);
    const drafted = await mapRun(page);
    expect(drafted.pendingRewards).toEqual([]);

    // Shop: a hull repair consumes salvage and restores hull.
    await travelAs(page, "shop");
    const beforeShop = await mapRun(page);
    expect(beforeShop.activeKind).toBe("shop");
    await pickCard(page, "SurvivalMapScene", 0);
    const bought = await mapRun(page);
    expect(bought.salvage).toBeLessThan(beforeShop.salvage);
    expect(bought.flagship.hull).toBeGreaterThan(beforeShop.flagship.hull);
    expect(bought.shopBought).toContain("repair");
    await page.evaluate(() => {
      const map = (window as any).game.scene.getScene("SurvivalMapScene");
      map.choicePanel.hide();
      map.service.finishActiveNode();
      map.refresh();
    });
    const saved = await mapRun(page);

    // Save & resume: a reload brings the very same run back.
    await page.reload();
    await waitForMenuReady(page);
    await page.evaluate(() => {
      const game = (window as any).game;
      game.scene.stop("MainMenuScene");
      game.scene.start("SurvivalSetupScene");
    });
    await waitForScene(page, "SurvivalSetupScene");
    const hasContinue = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("SurvivalSetupScene");
      const find = (list: any[]): boolean =>
        list.some(
          (o) =>
            String(o.text ?? "").startsWith("CONTINUE") || find(o.list ?? []),
        );
      return find(scene.children.list);
    });
    expect(hasContinue).toBe(true);
    await page.evaluate(() =>
      (window as any).game.scene.start("SurvivalMapScene"),
    );
    await waitForScene(page, "SurvivalMapScene");
    const resumed = await mapRun(page);
    expect({ ...resumed, stats: { ...resumed.stats, elapsedMs: 0 } }).toEqual({
      ...saved,
      stats: { ...saved.stats, elapsedMs: 0 },
    });

    // Death: the next battle destroys the fleet → run summary + history.
    await travelAs(page, "combat");
    await waitForScene(page, "SurvivalScene", 30_000);
    await page.waitForFunction(
      () =>
        (window as any).game.scene.getScene("SurvivalScene")?.isWaveActive ===
        true,
      undefined,
      { timeout: 15_000 },
    );
    await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene");
      for (const id of [...s.playerShipIds]) s.destroyShip(id, false);
      s.checkWaveComplete();
    });
    await waitForScene(page, "SurvivalSummaryScene", 15_000);
    const summary = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("SurvivalSummaryScene");
      const find = (name: string) =>
        scene.children.list.find((o: any) => o.name === name)?.text ?? "";
      const service = scene.registry.get("survivalRunService");
      return {
        title: find("summaryTitle"),
        history: find("historyList"),
        meta: service.meta,
        saved: service.hasSavedRun(),
      };
    });
    expect(summary.title).toContain("DEFEAT");
    expect(summary.history).toContain("DEFEAT");
    expect(summary.meta.history[0].seedCode).toBe(SEED_CODE);
    expect(summary.meta.history[0].nodesCleared).toBe(2);
    expect(summary.meta.charts).toBeGreaterThan(0);
    expect(summary.saved).toBe(false);
  });
});

test.describe("Survival roguelite — nodes", () => {
  test("an event node shows its story and resolves a choice", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await launchSeededRun(page);
    await travelAs(page, "event");
    const active = await mapRun(page);
    expect(active.activeEventId).not.toBeNull();
    const before = active.seenEvents.length;
    // The last choice of every event is always open ("leave"/safe option or a fight).
    await page.evaluate(async () => {
      const map = (window as any).game.scene.getScene("SurvivalMapScene");
      const { getEvent } = await import("/src/data/survival/events.ts");
      const { choiceAvailability } =
        await import("/src/systems/survival/EventResolver.ts");
      const event = getEvent(map.run.activeEventId);
      (window as any).__openChoice = event!.choices.findIndex(
        (c: any) =>
          choiceAvailability(map.run, c).enabled &&
          !(c.outcomes ?? []).some((o: any) => o.kind === "combat"),
      );
    });
    const index = await page.evaluate(() => (window as any).__openChoice);
    await pickCard(page, "SurvivalMapScene", index);
    await pickCard(page, "SurvivalMapScene", 0);
    const after = await mapRun(page);
    expect(after.activeNodeId).toBeNull();
    expect(after.currentNodeId).toBe(active.activeNodeId);
    expect(after.seenEvents.length).toBe(before);
  });

  test("elite battles show affixes above the elites", async ({ page }) => {
    suppressWebGLNoise(page);
    await launchSeededRun(page);
    await travelAs(page, "elite");
    await waitForScene(page, "SurvivalScene", 30_000);
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene")?.affixLabels
          ?.size ?? 0) > 0,
      undefined,
      { timeout: 15_000 },
    );
    const labels = await page.evaluate(() =>
      [
        ...(window as any).game.scene
          .getScene("SurvivalScene")
          .affixLabels.values(),
      ].map((l: any) => l.text),
    );
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0]).toMatch(/\w/);
  });

  test("abandoning a saved run from the setup screen ends it into the history", async ({
    page,
  }) => {
    suppressWebGLNoise(page);
    await launchSeededRun(page);
    await page.evaluate(() => {
      const game = (window as any).game;
      game.scene.stop("SurvivalMapScene");
      game.scene.start("SurvivalSetupScene");
    });
    await waitForScene(page, "SurvivalSetupScene");
    const result = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene("SurvivalSetupScene");
      const service = scene.registry.get("survivalRunService");
      const had = service.hasSavedRun();
      service.abandon();
      return {
        had,
        has: service.hasSavedRun(),
        outcome: service.meta.history[0]?.outcome,
      };
    });
    expect(result).toEqual({ had: true, has: false, outcome: "abandoned" });
  });
});
