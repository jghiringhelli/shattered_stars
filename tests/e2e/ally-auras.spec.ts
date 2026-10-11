/**
 * ally-auras.spec.ts — support repair auras outside Skirmish: in Continuous
 * Tactical an Ascendant support ship repairs a damaged Ascendant wingman
 * through the scene's ShipRepairFeedback (aura-sourced repair events, drones
 * launched from the support ship).
 */

import { test, expect } from "@playwright/test";
import {
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./helpers/game";

const SCENE = "ContinuousTacticalScene";

test("Continuous: an Ascendant support ship repairs its wingman", async ({
  page,
}) => {
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  const ids = await page.evaluate(async () => {
    const { SHIP_DEFINITIONS } = await import("/src/data/ShipDefinitions.ts");
    const defs = Object.values(SHIP_DEFINITIONS) as any[];
    const asc = defs.filter((d) => d.faction === "ascendant_empire");
    return {
      support: asc.find((d) => d.role === "support").id as string,
      fighter: asc.find(
        (d) => d.role === "heavy_fighter" || d.role === "light_fighter",
      ).id as string,
    };
  });
  await page.evaluate(({ support, fighter }) => {
    const g = (window as any).game;
    g.scene
      .getScenes(true)
      .forEach((s: any) => g.scene.stop(s.sys.settings.key));
    g.registry.set("battleConfig", {
      factions: [
        {
          factionId: "ascendant_empire",
          controller: "player",
          ships: [fighter, support],
        },
        {
          factionId: "terran_hegemony",
          controller: "ai",
          ships: ["terran_viper"],
        },
      ],
    });
    setTimeout(() => g.scene.start("ContinuousTacticalScene"), 100);
  }, ids);
  await waitForScene(page, SCENE, 30_000);
  await page.waitForFunction(
    (k) => ((window as any).game.scene.getScene(k)?.ships?.size ?? 0) >= 3,
    SCENE,
    { timeout: 15_000 },
  );
  const source = await page.evaluate(
    ({ k, support, fighter }) => {
      const scene = (window as any).game.scene.getScene(k);
      const ships = [...scene.ships.values()];
      for (const ship of ships) ship.weaponCooldown = Number.POSITIVE_INFINITY;
      const medic = ships.find((s: any) => s.definitionId === support);
      const wing = ships.find(
        (s: any) => s.definitionId === fighter && s.owner === medic.owner,
      );
      wing.hull = Math.ceil(wing.maxHull / 2);
      wing.shields = 0;
      (window as any).__auraEvents = [];
      const feedback = scene.repairFeedback;
      const deliver = feedback.deliver.bind(feedback);
      feedback.deliver = (event: any) => {
        (window as any).__auraEvents.push(event);
        deliver(event);
      };
      // Keep the wingman inside the medic's field for the whole test.
      scene.events.on("update", () => {
        scene.setFlight(wing, {
          ...wing.flight,
          motion: { ...wing.flight.motion, x: medic.x + 30, y: medic.y },
        });
      });
      return { medic: medic.id, wing: wing.id };
    },
    { k: SCENE, ...ids },
  );
  await expect
    .poll(
      () =>
        page.evaluate(
          (wingId) =>
            (window as any).__auraEvents.some(
              (e: any) => e.shipId === wingId && e.sourceKind === "aura",
            ),
          source.wing,
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
  const event = await page.evaluate(
    (wingId) =>
      (window as any).__auraEvents.find(
        (e: any) => e.shipId === wingId && e.sourceKind === "aura",
      ),
    source.wing,
  );
  expect(event.sourceShipId).toBe(source.medic);
});
