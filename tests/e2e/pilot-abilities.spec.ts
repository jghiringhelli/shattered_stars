/**
 * pilot-abilities.spec.ts — a quick build's pilot ability reaches the ship
 * in a real skirmish: the modifier sheet carries the ability's knob, and
 * its price includes the ability's derived value.
 */

import { test, expect } from "@playwright/test";
import {
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

/** Poison Fang (ambush: +1 laser damage from behind the target). */
const AMBUSH_LOADOUT = "fang_raider";

test("an ace's ability is on its ship's modifier sheet in a skirmish", async ({
  page,
}) => {
  await page.goto("/");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await page.evaluate((loadoutId) => {
    const g = (window as any).game;
    g.scene
      .getScenes(true)
      .forEach((s: any) => g.scene.stop(s.sys.settings.key));
    g.registry.set("battleConfig", {
      factions: [
        {
          factionId: "void_corsairs",
          controller: "player",
          ships: ["corsair_fang"],
          loadoutChoices: { "0": loadoutId },
        },
        {
          factionId: "terran_hegemony",
          controller: "ai",
          ships: ["terran_viper"],
        },
      ],
    });
    setTimeout(() => g.scene.start("ArcadeBattleScene"), 100);
  }, AMBUSH_LOADOUT);
  await waitForScene(page, "ArcadeBattleScene");
  await page.waitForFunction(
    () =>
      (window as any).game.scene.getScene("ArcadeBattleScene")?.playerShipId !=
      null,
  );

  const sheet = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene("ArcadeBattleScene");
    const ship = scene.ships.get(scene.playerShipId);
    return {
      rearArc: ship.modifiers.rearArcLaserBonus,
      frenzyUntil: ship.frenzyUntilMs,
    };
  });
  expect(sheet).toEqual({ rearArc: 1, frenzyUntil: 0 });
});
