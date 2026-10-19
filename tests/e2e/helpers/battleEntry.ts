/**
 * battleEntry — gets each battle scene into a running fight, for e2e specs.
 *
 * `peaceful: true` disables damage before ships spawn, so flight specs can
 * measure motion without a ship dying mid-measurement.
 */

import type { Page } from "@playwright/test";
import {
  clickMenuItem,
  suppressWebGLNoise,
  waitForMenuReady,
  waitForScene,
} from "./game";

/** Options for every entry helper. */
export interface BattleEntryOptions {
  /** Disable damage before spawning (flight specs). */
  readonly peaceful?: boolean;
}

/** A battle scene and how to get into a running fight in it. */
export interface BattleEntry {
  readonly sceneKey: string;
  readonly enter: (page: Page, options?: BattleEntryOptions) => Promise<void>;
}

async function openMenu(page: Page): Promise<void> {
  await page.goto("/?debug=1");
  suppressWebGLNoise(page);
  await waitForMenuReady(page);
}

async function waitForShips(
  page: Page,
  sceneKey: string,
  count: number,
): Promise<void> {
  await page.waitForFunction(
    ({ key, min }) =>
      ((window as any).game.scene.getScene(key)?.ships?.size ?? 0) >= min,
    { key: sceneKey, min: count },
    { timeout: 15_000 },
  );
}

/** Starts a scene from the menu after configuring a two-faction battle. */
async function startConfigured(page: Page, sceneKey: string): Promise<void> {
  await page.evaluate((key) => {
    const g = (window as any).game;
    g.scene
      .getScenes(true)
      .forEach((s: any) => g.scene.stop(s.sys.settings.key));
    g.registry.set("battleConfig", {
      factions: [
        {
          factionId: "free_confederation",
          controller: "player",
          ships: ["confed_sparrow", "confed_wasp"],
        },
        {
          factionId: "terran_hegemony",
          controller: "ai",
          ships: ["terran_viper", "terran_gladius"],
        },
      ],
    });
    setTimeout(() => g.scene.start(key), 100);
  }, sceneKey);
  await waitForScene(page, sceneKey, 30_000);
}

/** Calls a setup-screen start method, optionally with combat disabled. */
async function startFromSetup(
  page: Page,
  sceneKey: string,
  startMethod: string,
  peaceful: boolean,
): Promise<void> {
  await page.evaluate(
    ({ key, method, calm }) => {
      const scene = (window as any).game.scene.getScene(key);
      if (calm) scene.processCombat = () => undefined;
      scene[method]();
    },
    { key: sceneKey, method: startMethod, calm: peaceful },
  );
}

export const DOGFIGHT: BattleEntry = {
  sceneKey: "DogfightScene",
  enter: async (page, options = {}) => {
    await openMenu(page);
    await clickMenuItem(page, "DOGFIGHT");
    await waitForScene(page, "DogfightScene", 30_000);
    await startFromSetup(
      page,
      "DogfightScene",
      "startMatch",
      options.peaceful ?? false,
    );
    await waitForShips(page, "DogfightScene", 2);
  },
};

export const ACE_DUEL: BattleEntry = {
  sceneKey: "AceDuelScene",
  enter: async (page, options = {}) => {
    await openMenu(page);
    await clickMenuItem(page, "ACE DUEL");
    await waitForScene(page, "AceDuelScene", 30_000);
    await startFromSetup(
      page,
      "AceDuelScene",
      "startDuel",
      options.peaceful ?? false,
    );
    await waitForShips(page, "AceDuelScene", 2);
  },
};

export const BOSS_RAID: BattleEntry = {
  sceneKey: "EpicBattleScene",
  enter: async (page, options = {}) => {
    await openMenu(page);
    await clickMenuItem(page, "BOSS RAID");
    await waitForScene(page, "EpicBattleScene", 30_000);
    await page.waitForFunction(
      () =>
        (window as any).game.scene.getScene("EpicBattleScene")?.isSetupPhase ===
        true,
    );
    if (options.peaceful) {
      await page.evaluate(() => {
        (window as any).game.scene.getScene(
          "EpicBattleScene",
        ).processBossAbilities = () => undefined;
      });
    }
    await startFromSetup(
      page,
      "EpicBattleScene",
      "startBattle",
      options.peaceful ?? false,
    );
    await waitForShips(page, "EpicBattleScene", 2);
  },
};

export const SURVIVAL: BattleEntry = {
  sceneKey: "SurvivalScene",
  enter: async (page, options = {}) => {
    await openMenu(page);
    await page.evaluate(() => {
      const g = (window as any).game;
      // Like the real menu flow: the menu stops when a mode starts (a menu left
      // running behind would also react to the pause menu's arrow keys).
      g.scene
        .getScenes(true)
        .forEach((s: any) => g.scene.stop(s.sys.settings.key));
      g.scene.start("SurvivalScene", { factionId: "free_confederation" });
    });
    await waitForScene(page, "SurvivalScene", 30_000);
    await page.waitForFunction(
      () =>
        ((window as any).game.scene.getScene("SurvivalScene")?.enemyShipIds
          ?.length ?? 0) > 0,
      undefined,
      { timeout: 15_000 },
    );
    if (options.peaceful) {
      await page.evaluate(() => {
        const scene = (window as any).game.scene.getScene("SurvivalScene");
        scene.fireAt = () => undefined;
        scene.applyBeltDamage = () => undefined;
      });
    }
  },
};

export const CAMPAIGN: BattleEntry = {
  sceneKey: "CampaignBattleScene",
  enter: async (page, options = {}) => {
    await openMenu(page);
    await page.evaluate(async (calm) => {
      const { FACTION_CAMPAIGNS } = await import("/src/data/CampaignData.ts");
      const { CampaignSaveManager } =
        await import("/src/systems/CampaignSaveManager.ts");
      const factionId = "terran_hegemony";
      const mission = FACTION_CAMPAIGNS[factionId].missions.find(
        (m: any) => m.id === "heg_1_3",
      );
      const game = (window as any).game;
      const scene = game.scene.getScene("CampaignBattleScene");
      if (calm) {
        scene.processCombat = () => undefined;
        scene.checkDelayedSpawns = () => undefined;
        scene.checkObjectives = () => undefined;
      }
      game.scene.stop("MainMenuScene");
      game.scene.start("CampaignBattleScene", {
        factionId,
        mission,
        saveData: CampaignSaveManager.createNew(factionId),
      });
    }, options.peaceful ?? false);
    await waitForScene(page, "CampaignBattleScene", 30_000);
    await waitForShips(page, "CampaignBattleScene", 2);
  },
};

export const CONTINUOUS: BattleEntry = {
  sceneKey: "ContinuousTacticalScene",
  enter: async (page, options = {}) => {
    await openMenu(page);
    await startConfigured(page, "ContinuousTacticalScene");
    await waitForShips(page, "ContinuousTacticalScene", 4);
    if (options.peaceful) {
      await page.evaluate(() => {
        const scene = (window as any).game.scene.getScene(
          "ContinuousTacticalScene",
        );
        for (const ship of scene.ships.values())
          ship.weaponCooldown = Number.POSITIVE_INFINITY;
      });
    }
  },
};

export const SKIRMISH: BattleEntry = {
  sceneKey: "ArcadeBattleScene",
  enter: async (page, options = {}) => {
    await openMenu(page);
    await startConfigured(page, "ArcadeBattleScene");
    await waitForShips(page, "ArcadeBattleScene", 2);
    if (options.peaceful)
      await page.evaluate(() => {
        const scene = (window as any).game.scene.getScene("ArcadeBattleScene");
        scene.processCombat = () => undefined;
        scene.events.on("preupdate", () => {
          scene.ships.forEach((s: any) => {
            s.hull = s.maxHull;
            s.shields = s.maxShields;
          });
        });
      });
  },
};

/** Every battle scene, for specs that must hold in all of them. */
export const ALL_BATTLES: readonly BattleEntry[] = [
  DOGFIGHT,
  ACE_DUEL,
  BOSS_RAID,
  SURVIVAL,
  CAMPAIGN,
  CONTINUOUS,
  SKIRMISH,
];
