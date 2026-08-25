/**
 * DEV-only hooks that let the phase-collapse verify loop drive scenes whose entry
 * needs configuration assembled from game modules (data not reachable from inside a
 * Playwright page.evaluate). Installed on `window` only in DEV builds — see main.ts.
 */

import type Phaser from "phaser";
import type { FactionId } from "../config";
import { FACTION_CAMPAIGNS } from "../data/CampaignData";
import { CampaignSaveManager } from "../systems/CampaignSaveManager";

declare global {
  interface Window {
    __verifyStartCampaign?: (factionId: FactionId) => boolean;
  }
}

/**
 * Install verify-loop entry hooks on the window.
 * @param game - the running Phaser game instance
 */
export function installVerifyHooks(game: Phaser.Game): void {
  window.__verifyStartCampaign = (factionId: FactionId): boolean => {
    const mission = FACTION_CAMPAIGNS[factionId]?.missions[0];
    if (!mission) return false;
    const saveData = CampaignSaveManager.createNew(factionId);
    game.scene.start("CampaignBattleScene", { factionId, mission, saveData });
    return true;
  };
}
