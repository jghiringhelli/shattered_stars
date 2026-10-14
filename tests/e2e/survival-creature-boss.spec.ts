/**
 * Survival creature boss E2E — the sector 1 boss row fights the Cinder Wyrm:
 * its body, boss bar (phase pips, parts, telegraph with a text tag), a
 * telegraphed power that lands after its wind-up, weak-point damage that
 * destroys a part (disabling its power), an enrage phase that calls no
 * reinforcements, and a victory when it falls.
 */

import { test, expect, type Page } from "@playwright/test";
import { waitForScene, waitForMenuReady } from "./helpers/game";

const SCENE = "SurvivalScene";

/** Starts a boss node and fast-forwards the patrols to the boss wave. */
async function launchBossNode(page: Page): Promise<void> {
  await page.goto("/");
  await waitForMenuReady(page);
  await page.evaluate(async () => {
    const game = (window as any).game;
    const { runServiceOf } =
      await import("/src/systems/survival/RoguelikeRunService.ts");
    const svc = runServiceOf(game.registry) as any;
    const run = svc.startRun({
      faction: "free_confederation",
      flagshipId: "confed_wasp",
      loadoutId: null,
      ascension: 0,
      seed: 99,
    });
    const first = run.map.rows[0][0].id;
    svc.apply((r: any) => ({
      ...r,
      map: {
        ...r.map,
        rows: r.map.rows.map((row: any[]) =>
          row.map((n: any) => (n.id === first ? { ...n, type: "boss" } : n)),
        ),
      },
      activeNodeId: first,
      activeKind: "boss",
      path: [first],
    }));
    game.scene.start("SurvivalScene", {
      factionId: "free_confederation",
      fromRun: true,
    });
  });
  await waitForScene(page, SCENE);
  const waves: number = await page.evaluate(
    (key) => (window as any).game.scene.getScene(key).rules.plan.waves,
    SCENE,
  );
  for (let wave = 1; wave < waves; wave++) {
    await page.waitForFunction(
      (key) => {
        const s = (window as any).game.scene.getScene(key);
        return s?.isWaveActive === true && s.enemyShipIds.length > 0;
      },
      SCENE,
      { timeout: 15_000 },
    );
    await page.evaluate((key) => {
      const s = (window as any).game.scene.getScene(key);
      for (const id of [...s.enemyShipIds]) s.destroyShip(id, true);
      s.checkWaveComplete();
    }, SCENE);
  }
  await page.waitForFunction(
    (key) => {
      const s = (window as any).game.scene.getScene(key);
      return [...s.ships.values()].some(
        (sh: any) => sh.creature && sh.isBossCreature,
      );
    },
    SCENE,
    { timeout: 20_000 },
  );
}

test.describe("SurvivalScene — creature boss row", () => {
  test("the boss row fights the sector creature: bar, telegraph, weak point, enrage, victory", async ({
    page,
  }, testInfo) => {
    await launchBossNode(page);

    const opening = await page.evaluate((key) => {
      const s = (window as any).game.scene.getScene(key);
      const boss = [...s.ships.values()].find((sh: any) => sh.isBossCreature);
      return {
        creatureId: boss.creature.definition.id,
        capital: boss.capitalSystems ?? null,
        hasBar: s.creatures.hasBoss,
        phases: boss.creature.phaseCount,
        tracked: s.bossPhases.get(boss.id),
        noBot: boss.bot === null,
        planPhases: s.rules.plan.bossPhases,
      };
    }, SCENE);
    expect(opening.creatureId).toBe("cinder_wyrm");
    expect(opening.capital).toBeNull();
    expect(opening.hasBar).toBe(true);
    expect(opening.noBot).toBe(true);
    expect(opening.tracked).toBe(1);
    expect(opening.phases).toBe(opening.planPhases + 1);

    // A power is announced, shown on the boss bar as "[TAG] NAME 0.0s", then lands.
    await page.evaluate((key) => {
      const s = (window as any).game.scene.getScene(key);
      s.autopilot = true;
      const boss = [...s.ships.values()].find((sh: any) => sh.isBossCreature);
      const flagship = s.ships.get(s.playerShipIds[0]);
      boss.creature.body.x = flagship.x;
      boss.creature.body.y = flagship.y - 260;
    }, SCENE);
    await page.waitForFunction(
      (key) => {
        const s = (window as any).game.scene.getScene(key);
        const boss = [...s.ships.values()].find((sh: any) => sh.isBossCreature);
        return boss?.creature?.telegraph.stage === "windup";
      },
      SCENE,
      { timeout: 20_000 },
    );
    const barText: string = await page.evaluate(
      (key) =>
        (window as any).game.scene.getScene(key).creatures.bar.telegraphText
          .text,
      SCENE,
    );
    expect(barText).toMatch(/\[(FAN|LUNGE|RING)\]/);
    await page.screenshot({ path: testInfo.outputPath("boss-telegraph.png") });

    // Strip the shields, then hit the tail from astern: the ember gland breaks.
    const part = await page.evaluate((key) => {
      const s = (window as any).game.scene.getScene(key);
      const boss = [...s.ships.values()].find((sh: any) => sh.isBossCreature);
      const flagship = s.ships.get(s.playerShipIds[0]);
      boss.shields = 0;
      const behind = {
        ...flagship,
        x: boss.x - Math.sin((boss.angle * Math.PI) / 180) * 300,
        y: boss.y + Math.cos((boss.angle * Math.PI) / 180) * 300,
      };
      for (let i = 0; i < 40 && boss.creature.isPartAlive("ember_gland"); i++)
        s.dealDamage(boss, 5, behind);
      return {
        gland: boss.creature.isPartAlive("ember_gland"),
        text: s.creatures.bar.partsText.text,
      };
    }, SCENE);
    expect(part.gland).toBe(false);

    // The enrage phase (plan has one boss phase, the creature adds one) calls
    // no reinforcements and restores no shields.
    const enrage = await page.evaluate((key) => {
      const s = (window as any).game.scene.getScene(key);
      const boss = [...s.ships.values()].find((sh: any) => sh.isBossCreature);
      const enemiesBefore = s.enemyShipIds.length;
      boss.hull = boss.maxHull * 0.4;
      s.checkBossPhase(boss);
      return {
        tracked: s.bossPhases.get(boss.id),
        shields: boss.shields,
        reinforced: s.enemyShipIds.length > enemiesBefore,
      };
    }, SCENE);
    expect(enrage.tracked).toBe(2);
    expect(enrage.shields).toBe(0);
    expect(enrage.reinforced).toBe(false);

    // Killing the creature clears the node.
    await page.evaluate((key) => {
      const s = (window as any).game.scene.getScene(key);
      const boss = [...s.ships.values()].find((sh: any) => sh.isBossCreature);
      const flagship = s.ships.get(s.playerShipIds[0]);
      boss.hull = 1;
      s.landHit(flagship, boss, { damage: 50, stress: 0 });
      for (const id of [...s.enemyShipIds]) s.destroyShip(id, true);
      s.checkWaveComplete();
    }, SCENE);
    await page.waitForFunction(
      (key) => (window as any).game.scene.getScene(key).battleEnded === true,
      SCENE,
      { timeout: 10_000 },
    );
  });
});
