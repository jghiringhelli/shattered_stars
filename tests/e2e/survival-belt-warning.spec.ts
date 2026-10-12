/**
 * Survival — the asteroid-belt warning and the free starting wingman in the
 * live scene (ADR-0004 fairness pass). Flying the flagship into the belt
 * shows a text + icon warning (never colour alone) that clears once it is
 * back inside the safe zone; every run's first battle fields the flagship
 * and its free escort wingman.
 */

import { test, expect } from "@playwright/test";
import { waitForScene, waitForMenuReady, collectErrors } from "./helpers/game";

async function launchSurvival(page: any): Promise<void> {
  await page.goto("/");
  await waitForMenuReady(page);
  await page.evaluate(() => {
    (window as any).game.scene.start("SurvivalScene", {
      factionId: "free_confederation",
    });
  });
  await waitForScene(page, "SurvivalScene");
  await page.waitForFunction(
    () =>
      ((window as any).game.scene.getScene("SurvivalScene") as any)
        ?.isWaveActive === true,
    undefined,
    { timeout: 15_000 },
  );
}

/**
 * Displaces the flagship (its cycle in progress carried along, as a
 * collision push does) so it sits north of the arena centre:
 * `beyondSafeEdge` px past the belt's safe radius, or at the centre.
 */
async function placeFlagship(
  page: any,
  beyondSafeEdge: number | "center",
): Promise<void> {
  await page.evaluate(async (beyond: number | "center") => {
    const { shiftMotion } = await import("/src/arcade/systems/ShipMotion.ts");
    const s = (window as any).game.scene.getScene("SurvivalScene") as any;
    const ship = s.ships.get(s.playerShipIds[0]);
    const center = 3000;
    const distance = beyond === "center" ? 0 : s.beltConfig.safeRadius + beyond;
    const motion = shiftMotion(
      ship.flight.motion,
      center - ship.flight.motion.x,
      center - distance - ship.flight.motion.y,
      6000,
    );
    ship.flight = { ...ship.flight, motion };
    ship.x = motion.x;
    ship.y = motion.y;
  }, beyondSafeEdge);
}

test.describe("Survival — asteroid belt warning", () => {
  test("warns with text while the flagship is in the belt and clears back in the safe zone", async ({
    page,
  }) => {
    const errors = collectErrors(page as any);
    await launchSurvival(page);
    await placeFlagship(page, 60);
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.beltWarning?.level === "inside",
      undefined,
      { timeout: 5_000 },
    );
    const inside = await page.evaluate(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          .beltWarning.text,
    );
    expect(inside).toContain("TURN BACK");
    await placeFlagship(page, "center");
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene") as any)
          ?.beltWarning?.level === "clear",
      undefined,
      { timeout: 5_000 },
    );
    expect(errors.pageErrors).toHaveLength(0);
  });
});

test.describe("Survival — free starting wingman", () => {
  test("the first battle of a run fields the flagship and its escort wingman", async ({
    page,
  }) => {
    await launchSurvival(page);
    const fleet = await page.evaluate(() => {
      const s = (window as any).game.scene.getScene("SurvivalScene") as any;
      return {
        ships: s.playerShipIds.length,
        escorts: s.escortShipIds.size,
        savedEscorts: s.service.run.escorts.length,
      };
    });
    expect(fleet.ships).toBe(2);
    expect(fleet.escorts).toBe(1);
    expect(fleet.savedEscorts).toBe(1);
  });
});
