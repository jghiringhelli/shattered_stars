/**
 * campaignEntry — e2e helpers for the SC2-style campaign: seed a campaign
 * save and launch a mission straight into CampaignBattleScene (optionally
 * with combat / scripted spawns disabled so tests stay deterministic), and
 * open the campaign hub for a faction.
 */

import type { Page } from "@playwright/test";
import { clickMenuItem, waitForMenuReady, waitForScene } from "./game";

export const BATTLE = "CampaignBattleScene";

/** What to launch. */
export interface CampaignLaunch {
  readonly factionId: string;
  readonly missionId: string;
  /** Fields merged into a fresh save (then stored in localStorage). */
  readonly save?: Record<string, unknown>;
  /** Disable primary-weapon combat. */
  readonly noCombat?: boolean;
  /** Disable scripted beats, hazards and timed waves. */
  readonly noScript?: boolean;
  /** Disable objective checks (mission cannot end). */
  readonly noObjectives?: boolean;
}

/**
 * Seeds the save and starts the mission's battle.
 *
 * @param page - Playwright page.
 * @param launch - Faction, mission, save overrides and stubs.
 */
export async function launchCampaignMission(
  page: Page,
  launch: CampaignLaunch,
): Promise<void> {
  await page.goto("/?debug=1");
  await waitForMenuReady(page);
  await page.evaluate(async (l) => {
    const { FACTION_CAMPAIGNS } = await import("/src/data/CampaignData.ts");
    const { CampaignSaveManager } =
      await import("/src/systems/CampaignSaveManager.ts");
    const mission = (FACTION_CAMPAIGNS as any)[l.factionId].missions.find(
      (m: any) => m.id === l.missionId,
    );
    const save = {
      ...CampaignSaveManager.createNew(l.factionId as any),
      ...(l.save ?? {}),
    };
    CampaignSaveManager.save(save as any);
    const game = (window as any).game;
    const scene = game.scene.getScene("CampaignBattleScene");
    if (l.noCombat) scene.processCombat = () => undefined;
    if (l.noScript) scene.checkDelayedSpawns = () => undefined;
    if (l.noObjectives) scene.checkObjectives = () => undefined;
    game.scene.stop("MainMenuScene");
    game.scene.start("CampaignBattleScene", {
      factionId: l.factionId,
      mission,
      saveData: save,
    });
  }, launch as any);
  await waitForScene(page, BATTLE, 30_000);
  await page.waitForFunction(
    (key) => ((window as any).game.scene.getScene(key)?.ships?.size ?? 0) >= 1,
    BATTLE,
    { timeout: 15_000 },
  );
}

/**
 * Seeds a save and opens the faction's campaign hub.
 *
 * @param page - Playwright page.
 * @param factionId - Faction.

 * @param save - Fields merged into a fresh save.
 * @param freeOrder - Chronicle "Free Order" (default on: the act locks of the
 *   Rule of N are lifted so one faction\u0027s hub can be exercised alone).
 */
export async function openCampaignHub(
  page: Page,
  factionId: string,
  save: Record<string, unknown> = {},
  freeOrder = true,
): Promise<void> {
  await page.goto("/");
  await waitForMenuReady(page);
  await page.evaluate(
    async ({ f, s, free }) => {
      const { CampaignSaveManager } =
        await import("/src/systems/CampaignSaveManager.ts");
      const { ChronicleManager } =
        await import("/src/systems/ChronicleManager.ts");
      CampaignSaveManager.save({
        ...CampaignSaveManager.createNew(f as any),
        ...s,
      } as any);
      ChronicleManager.reset();
      ChronicleManager.setFreeOrder(free);
    },
    { f: factionId, s: save, free: freeOrder },
  );
  await clickMenuItem(page, "CAMPAIGN");
  await waitForScene(page, "CampaignScene");
  await page.evaluate(
    (f) =>
      (window as any).game.scene.getScene("CampaignScene").selectFaction(f),
    factionId,
  );
  await page.waitForFunction(
    () =>
      (window as any).game.scene.getScene("CampaignScene")?.currentPhase ===
      "mission_map",
    { timeout: 5_000 },
  );
}

/**
 * @param page - Playwright page.
 * @param factionId - Faction.
 * @returns The stored save, parsed.
 */
export async function storedSave(page: Page, factionId: string): Promise<any> {
  return page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "null"),
    `shattered_stars_campaign_${factionId}`,
  );
}
