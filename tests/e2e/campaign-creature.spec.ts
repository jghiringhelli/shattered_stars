/**
 * Campaign creature E2E — a mission spawns a Void Tide creature as an
 * assassination target: the Pruning Herald appears with its body, boss bar
 * and telegraphs, wraps across the map like every ship, answers to the
 * mission's boss tag, takes hero-power damage, and dies like any target.
 */

import { test, expect } from "@playwright/test";
import { BATTLE, launchCampaignMission } from "./helpers/campaignEntry";

test("a campaign mission spawns the Pruning Herald: boss bar, telegraph, hero power, kill", async ({
  page,
}) => {
  await launchCampaignMission(page, {
    factionId: "terran_hegemony",
    missionId: "heg_1_3",
    noCombat: true,
    noScript: true,
    noObjectives: true,
  });
  const spawned = await page.evaluate((key) => {
    const s = (window as any).game.scene.getScene(key);
    for (const id of [...s.enemyShipIds]) s.destroyShip(id, false, true);
    const flagship = s.ships.get(s.playerShipIds[0]);
    s.spawnFromRequest({
      id: "herald_test",
      definitionId: "pruning_herald",
      faction: "terran_hegemony",
      owner: "ai",
      pose: { x: flagship.x, y: flagship.y - 420, angle: 180 },
      tags: ["boss", "assassination"],
      hullScale: 1,
      scripted: false,
      piloted: false,
      isAce: false,
      isBoss: true,
      lifetimeMs: null,
    });
    const herald = s.ships.get("herald_test");
    return {
      exists: !!herald,
      creature: herald?.creature?.definition.id,
      tagged: herald?.tags.includes("boss"),
      noBot: herald?.bot === null,
      hasBar: s.creatures.hasBoss,
      isEnemy: s.enemyShipIds.includes("herald_test"),
    };
  }, BATTLE);
  expect(spawned).toEqual({
    exists: true,
    creature: "pruning_herald",
    tagged: true,
    noBot: true,
    hasBar: true,
    isEnemy: true,
  });

  // It announces a power (wind-up) the pilot can read on the boss bar.
  await page.waitForFunction(
    (key) => {
      const s = (window as any).game.scene.getScene(key);
      const stage = s.ships.get("herald_test")?.creature.telegraph.stage;
      return stage === "windup" || stage === "active";
    },
    BATTLE,
    { timeout: 20_000 },
  );
  const barText: string = await page.evaluate(
    (key) =>
      (window as any).game.scene.getScene(key).creatures.bar.telegraphText.text,
    BATTLE,
  );
  expect(barText).toMatch(/\[(FAN|BLINK|SCREAM)\]/);

  // A hero power (V) hits it: the mark picks it as the focus target.
  const before = await page.evaluate((key) => {
    const s = (window as any).game.scene.getScene(key);
    s.squadAi.markTarget("herald_test", s.time.now);
    const herald = s.ships.get("herald_test");
    // Freeze it (not phase-shifted) so the delayed strike lands where it aimed.
    herald.creature.runner.cancel();
    herald.creature.body.x = s.ships.get(s.playerShipIds[0]).x;
    herald.creature.body.y = s.ships.get(s.playerShipIds[0]).y - 300;
    s.creatures.update = () => undefined;
    return herald.hull + herald.shields;
  }, BATTLE);
  await page.keyboard.down("v");
  await page.waitForTimeout(150);
  await page.keyboard.up("v");
  await page.waitForTimeout(3000);
  const after = await page.evaluate((key) => {
    const herald = (window as any).game.scene
      .getScene(key)
      .ships.get("herald_test");
    return herald ? herald.hull + herald.shields : 0;
  }, BATTLE);
  expect(after).toBeLessThan(before);

  // It dies like any target and its visuals are cleaned up.
  const gone = await page.evaluate((key) => {
    const s = (window as any).game.scene.getScene(key);
    const herald = s.ships.get("herald_test");
    if (herald) {
      herald.shields = 0;
      herald.hull = 1;
      s.landHit(s.ships.get(s.playerShipIds[0]), herald, {
        damage: 50,
        stress: 0,
      });
    }
    return {
      removed: !s.ships.has("herald_test"),
      bar: s.creatures.hasBoss,
    };
  }, BATTLE);
  expect(gone).toEqual({ removed: true, bar: false });
});
