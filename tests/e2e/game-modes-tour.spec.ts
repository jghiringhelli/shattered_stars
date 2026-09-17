/**
 * game-modes-tour.spec.ts — End-to-end navigation across every game mode.
 *
 * For each mode that goes through the squad builder, this tour:
 *   MainMenu → mode → SquadBuilder → auto-fill both squads → START BATTLE
 * and asserts the correct target battle scene became active with ships spawned.
 *
 * For modes that bypass the squad builder (DOGFIGHT, ACE DUEL), it clicks the
 * menu item and waits for the target scene directly.
 *
 * Online mode is intentionally skipped — it requires a live P2P server.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  waitForScene,
  waitForMenuReady,
  clickMenuItem,
  readSceneState,
  suppressWebGLNoise,
} from "./helpers/game";

interface ModeSpec {
  label:
    | "SKIRMISH"
    | "SURVIVAL"
    | "EPIC FORMAT"
    | "DOGFIGHT"
    | "ACE DUEL"
    | "CAMPAIGN";
  targetScene: string;
  minShips: number;
  needsSquadBuilder: boolean;
  /** SURVIVAL routes through its own setup screen (ship/faction pick), not SquadBuilderScene. */
  needsSurvivalSetup?: boolean;
}

const MODES: readonly ModeSpec[] = [
  {
    label: "SKIRMISH",
    targetScene: "ArcadeBattleScene",
    minShips: 2,
    needsSquadBuilder: true,
  },
  {
    label: "SURVIVAL",
    targetScene: "SurvivalScene",
    minShips: 1,
    needsSquadBuilder: false,
    needsSurvivalSetup: true,
  },
  {
    label: "EPIC FORMAT",
    targetScene: "ArcadeBattleScene",
    minShips: 4,
    needsSquadBuilder: true,
  },
  {
    label: "DOGFIGHT",
    targetScene: "DogfightScene",
    minShips: 2,
    needsSquadBuilder: false,
  },
  {
    label: "ACE DUEL",
    targetScene: "AceDuelScene",
    minShips: 2,
    needsSquadBuilder: false,
  },
];

/** SurvivalSetupScene's LAUNCH button — defaults are pre-selected, no clicks needed first. */
async function launchSurvivalWithDefaults(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { game: any }).game.scene.isActive(
        "SurvivalSetupScene",
      ),
    { timeout: 10_000 },
  );
  const box = (await page.locator("canvas").boundingBox())!;
  const { gw, gh } = await page.evaluate(() => {
    const g = (window as unknown as { game: any }).game;
    return { gw: g.scale.gameSize.width, gh: g.scale.gameSize.height };
  });
  await page.mouse.click(
    box.x + 640 * (box.width / gw),
    box.y + (gh - 60) * (box.height / gh),
  );
}

async function autoFillAndStartBattle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const s = (window as unknown as { game: any }).game.scene.getScene(
        "SquadBuilderScene",
      );
      return (s?.factionSlots?.length ?? 0) > 0;
    },
    { timeout: 10_000 },
  );
  // This helper drives the advanced multi-squad auto-fill flow \u2014 arcade mode
  // now defaults to the simple single-ship flow, so switch out of it first.
  await page.evaluate(() => {
    const s = (window as unknown as { game: any }).game.scene.getScene(
      "SquadBuilderScene",
    );
    if (s?.simpleMode) {
      s.simpleMode = false;
      s.renderBuilderMode();
    }
  });
  await page.evaluate(() => {
    const s = (window as unknown as { game: any }).game.scene.getScene(
      "SquadBuilderScene",
    );
    s.squads[0].factionId = "terran_hegemony";
    s.squads[0].controller = "player";
    s.squads[1].factionId = "synthetic_collective";
    s.squads[1].controller = "ai";
    s.squadListPanel.autoFillAll();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const s = (window as unknown as { game: any }).game.scene.getScene(
      "SquadBuilderScene",
    );
    s.startBattle();
  });
}

test.describe("Game modes tour — every mode launches a real battle", () => {
  for (const mode of MODES) {
    test(`${mode.label} → ${mode.targetScene} with ≥${mode.minShips} ships`, async ({
      page,
    }) => {
      suppressWebGLNoise(page);
      await page.goto("/");
      await waitForMenuReady(page);
      await clickMenuItem(page, mode.label);

      if (mode.needsSquadBuilder) {
        await waitForScene(page, "SquadBuilderScene");
        await autoFillAndStartBattle(page);
      } else if (mode.needsSurvivalSetup) {
        await launchSurvivalWithDefaults(page);
      }

      await waitForScene(page, mode.targetScene, 30_000);

      // DOGFIGHT + ACE DUEL show a setup screen before spawning ships.
      // Call their start methods directly to bypass the click-through.
      if (mode.label === "DOGFIGHT") {
        await page.evaluate(() => {
          const s = (window as unknown as { game: any }).game.scene.getScene(
            "DogfightScene",
          );
          s.startMatch();
        });
      } else if (mode.label === "ACE DUEL") {
        await page.evaluate(() => {
          const s = (window as unknown as { game: any }).game.scene.getScene(
            "AceDuelScene",
          );
          s.startDuel();
        });
      }

      await page.waitForFunction(
        ({ scene, min }: { scene: string; min: number }) => {
          const s = (window as unknown as { game: any }).game.scene.getScene(
            scene,
          );
          return (s?.ships?.size ?? 0) >= min;
        },
        { scene: mode.targetScene, min: mode.minShips },
        { timeout: 15_000 },
      );

      const shipCount = await readSceneState<number>(
        page,
        mode.targetScene,
        "ships.size",
      );
      expect(shipCount).toBeGreaterThanOrEqual(mode.minShips);
    });
  }
});
