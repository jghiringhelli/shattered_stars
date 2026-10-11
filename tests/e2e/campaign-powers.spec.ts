/**
 * campaign-powers.spec.ts — hero powers in battle: V casts the hero's first
 * power (Hegemony: Orbital Strike), which lands on the focus target and
 * starts a cooldown shown on the HUD power bar; the second power stays
 * locked early in the campaign.
 */

import { test, expect, type Page } from "@playwright/test";
import { BATTLE, launchCampaignMission } from "./helpers/campaignEntry";

test("V casts the hero's power: strike lands, HUD shows the cooldown", async ({
  page,
}) => {
  await launchCampaignMission(page, {
    factionId: "terran_hegemony",
    missionId: "heg_1_3",
    noCombat: true,
    noScript: true,
    noObjectives: true,
  });
  // Freeze the enemies so the delayed strike's aim point stays on them.
  const before = await page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    const flagship = scene.ships.get(scene.playerShipIds[0]);
    let i = 0;
    for (const id of scene.enemyShipIds) {
      const enemy = scene.ships.get(id);
      enemy.scripted = true;
      scene.director.bridge.setPose(
        id,
        flagship.x + (i++ % 2) * 30,
        flagship.y - 300,
        180,
      );
    }
    return scene.enemyShipIds.reduce((sum: number, id: string) => {
      const s = scene.ships.get(id);
      return sum + s.hull + s.shields;
    }, 0);
  }, BATTLE);
  const readout0 = await page.evaluate(
    (key) => (window as any).game.scene.getScene(key).director.powerReadout,
    BATTLE,
  );
  expect(readout0[0]).toMatchObject({
    id: "orbital_strike",
    ready: true,
    locked: false,
  });
  expect(readout0[1]).toMatchObject({ id: "shield_overcharge", locked: true });

  await holdKey(page, "v");
  const readout1 = await page.evaluate(
    (key) => (window as any).game.scene.getScene(key).director.powerReadout,
    BATTLE,
  );
  expect(readout1[0].ready).toBe(false);
  expect(readout1[0].cooldownSeconds).toBeGreaterThan(20);

  await page.waitForTimeout(1800);
  const after = await page.evaluate((key) => {
    const scene = (window as any).game.scene.getScene(key);
    return scene.enemyShipIds.reduce((sum: number, id: string) => {
      const s = scene.ships.get(id);
      return sum + s.hull + s.shields;
    }, 0);
  }, BATTLE);
  expect(after).toBeLessThan(before);
});

test("B does nothing while the second power is still locked", async ({
  page,
}) => {
  await launchCampaignMission(page, {
    factionId: "terran_hegemony",
    missionId: "heg_1_3",
    noCombat: true,
    noScript: true,
    noObjectives: true,
  });
  await holdKey(page, "b");
  const readout = await page.evaluate(
    (key) => (window as any).game.scene.getScene(key).director.powerReadout,
    BATTLE,
  );
  expect(readout[1]).toMatchObject({ locked: true, cooldownSeconds: 0 });
});

/** Real key press held long enough for a frame to poll it (V/B are not in the synthetic key table). */
async function holdKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(150);
  await page.keyboard.up(key);
}
