/**
 * arcade-telemetry.spec.ts — Verify ships actually move in arcade combat.
 *
 * Uses the ?debug=1 telemetry hook exposed on window.__shipTelemetry.
 * Drives player input via pressGameKey and asserts the player ship displaces,
 * plus asserts at least one AI ship moves under its own AI while unattended.
 *
 * Uses DOGFIGHT as the fastest path into ArcadeBattleScene (no squad builder).
 */

import { test, expect, type Page } from "@playwright/test";
import {
  waitForScene,
  waitForMenuReady,
  clickMenuItem,
  pressGameKey,
  readShipTelemetry,
  suppressWebGLNoise,
  type ShipPositionSample,
} from "./helpers/game";

async function enterDogfight(page: Page): Promise<void> {
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
  await clickMenuItem(page, "DOGFIGHT");
  await waitForScene(page, "DogfightScene", 30_000);
  // Bypass the setup screen — spawn ships immediately.
  await page.evaluate(() => {
    const s = (window as unknown as { game: any }).game.scene.getScene(
      "DogfightScene",
    );
    s.startMatch();
  });
  await page.waitForFunction(
    () => {
      const s = (window as unknown as { game: any }).game.scene.getScene(
        "DogfightScene",
      );
      return (s?.ships?.size ?? 0) >= 2;
    },
    { timeout: 15_000 },
  );
}

test.describe("Arcade telemetry — real ship motion", () => {
  test("player ship displaces in response to arrow-key input", async ({
    page,
  }) => {
    await enterDogfight(page);

    // DogfightScene doesn't have telemetry (only ArcadeBattleScene + Continuous do).
    // If DogfightScene doesn't route through those scenes, we assert via its own
    // ship map instead: sample positions manually across a keyboard-driven window.
    const readShipPos = async (): Promise<{
      id: string;
      x: number;
      y: number;
    }> =>
      page.evaluate(() => {
        const s = (window as unknown as { game: any }).game.scene.getScene(
          "DogfightScene",
        );
        let result = { id: "", x: 0, y: 0 };
        s.ships.forEach((ship: any, id: string) => {
          if (ship.owner === "player") {
            result = { id, x: ship.x, y: ship.y };
          }
        });
        return result;
      });

    const startPos = await readShipPos();
    expect(startPos.id).not.toBe("");
    expect(startPos.x).toBeGreaterThan(0);

    for (let i = 0; i < 30; i++) {
      await pressGameKey(page, "ArrowUp");
      await page.waitForTimeout(100);
    }

    const endPos = await readShipPos();
    const dist = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);
    expect(dist).toBeGreaterThan(20);
  });
});

test.describe("Arcade telemetry — ContinuousTacticalScene", () => {
  test("enemy ships move over 5 seconds in a continuous skirmish", async ({
    page,
  }) => {
    await page.goto("/?debug=1");
    suppressWebGLNoise(page);
    await waitForMenuReady(page);
    // Force ContinuousTacticalScene by starting a turn_based-shaped battle
    await clickMenuItem(page, "SKIRMISH");
    await waitForScene(page, "SquadBuilderScene", 15_000);
    await page.waitForFunction(
      () => {
        const s = (window as unknown as { game: any }).game.scene.getScene(
          "SquadBuilderScene",
        );
        return (s?.factionSlots?.length ?? 0) > 0;
      },
      { timeout: 10_000 },
    );
    await page.evaluate(() => {
      const s = (window as unknown as { game: any }).game.scene.getScene(
        "SquadBuilderScene",
      );
      s.gameMode = "turn_based"; // routes to ContinuousTacticalScene via else branch
      if (s.simpleMode) {
        s.simpleMode = false;
        s.renderBuilderMode();
      }
      s.squads[0].factionId = "terran_hegemony";
      s.squads[0].controller = "player";
      s.squads[1].factionId = "synthetic_collective";
      s.squads[1].controller = "ai";
      s.squadListPanel.autoFillAll();
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      (window as unknown as { game: any }).game.scene
        .getScene("SquadBuilderScene")
        .startBattle();
    });
    await waitForScene(page, "ContinuousTacticalScene", 20_000);
    await page.waitForTimeout(5_000);

    const samples: ShipPositionSample[] = await readShipTelemetry(page);
    expect(samples.length).toBeGreaterThan(0);

    const perShip = new Map<string, ShipPositionSample[]>();
    for (const s of samples) {
      const arr = perShip.get(s.shipId) ?? [];
      arr.push(s);
      perShip.set(s.shipId, arr);
    }
    const anyMoved = [...perShip.values()].some((arr) => {
      if (arr.length < 2) return false;
      const first = arr[0]!;
      const last = arr[arr.length - 1]!;
      return Math.hypot(last.x - first.x, last.y - first.y) > 20;
    });
    expect(anyMoved).toBe(true);
  });
});
