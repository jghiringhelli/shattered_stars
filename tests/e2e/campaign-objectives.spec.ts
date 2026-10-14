/**
 * campaign-objectives.spec.ts — real objective entities in battle: the
 * convoy of an escort mission flies its path with its hull on the tracker
 * and the mission fails when too many transports die; a capture zone scores
 * while the player controls it (marker, radar contact, tracker progress).
 */

import { test, expect, type Page } from "@playwright/test";
import { BATTLE, launchCampaignMission } from "./helpers/campaignEntry";

/** Reads a value from the battle scene. */
function read<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(
    ({ key, body }) =>
      new Function("scene", body)((window as any).game.scene.getScene(key)),
    { key: BATTLE, body: fn },
  ) as Promise<T>;
}

test.describe("Campaign objectives", () => {
  test("escort: transports fly the convoy path, show hull, and losing them fails the mission", async ({
    page,
  }) => {
    await launchCampaignMission(page, {
      factionId: "terran_hegemony",
      missionId: "heg_2_1",
      noCombat: true,
      noScript: true,
    });
    const before = await read<
      { id: string; x: number; scripted: boolean; tags: string[] }[]
    >(
      page,
      "return [...scene.ships.values()].filter(s => s.tags.includes('transport')).map(s => ({ id: s.id, x: s.x, scripted: s.scripted, tags: s.tags }));",
    );
    expect(before).toHaveLength(3);
    expect(before.every((t) => t.scripted)).toBe(true);
    await page.waitForTimeout(1500);
    const afterX = await read<number>(
      page,
      `return scene.ships.get('${before[0]!.id}').x;`,
    );
    expect(afterX).not.toBeCloseTo(before[0]!.x, 0);
    const tracker = await read<string[]>(
      page,
      "return scene.modeHud.objectiveLines;",
    );
    expect(tracker.some((line) => line.includes("100%"))).toBe(true);

    await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      scene.destroyShip("escort_t0", false);
      scene.destroyShip("escort_t1", false);
    }, BATTLE);
    await page.waitForFunction(
      (key) => (window as any).game.scene.getScene(key)?.missionFailed === true,
      BATTLE,
      { timeout: 10_000 },
    );
    expect(await read<boolean>(page, "return scene.missionComplete;")).toBe(
      false,
    );
  });

  test("capture: holding the gate zone scores control time and shows on radar", async ({
    page,
  }) => {
    await launchCampaignMission(page, {
      factionId: "terran_hegemony",
      missionId: "heg_3_5",
      noCombat: true,
      noScript: true,
    });
    await page.evaluate((key) => {
      const scene = (window as any).game.scene.getScene(key);
      for (const id of [...scene.enemyShipIds]) scene.destroyShip(id, true);
    }, BATTLE);
    const gate = { x: 3000, y: 3000 - 900 };
    for (let i = 0; i < 25; i++) {
      await page.evaluate(
        ({ key, at }) => {
          const scene = (window as any).game.scene.getScene(key);
          const flagship = scene.playerShipIds[0];
          scene.director.bridge.setPose(flagship, at.x, at.y, 0);
        },
        { key: BATTLE, at: gate },
      );
      await page.waitForTimeout(100);
    }
    const state = await read<{
      playerMs: number;
      controller: string;
      contacts: string[];
      lines: string[];
    }>(
      page,
      `
      const gate = scene.director.runtime.objectives.find(o => o.def.id === 'gate');
      return { playerMs: gate.playerMs, controller: gate.controller,
        contacts: scene.director.contacts().map(c => c.id), lines: scene.modeHud.objectiveLines };`,
    );
    expect(state.playerMs).toBeGreaterThan(1500);
    expect(state.controller).toBe("player");
    expect(state.contacts).toContain("objective:gate");
    expect(state.lines.some((l) => /\(\d+\/\d+s\)/.test(l))).toBe(true);
  });
});
