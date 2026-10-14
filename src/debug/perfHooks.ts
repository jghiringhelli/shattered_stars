/**
 * DEV-only entry hooks for scripts/perf_probe.ts: they start the battles whose
 * setup needs game modules (campaign data, the Survival run service), so the
 * probe can drive a minified build, where `import("/src/...")` does not exist.
 * Installed on `window` only in DEV builds — see main.ts.
 */

import type Phaser from "phaser";
import type { FactionId } from "../config";
import { FACTION_CAMPAIGNS } from "../data/CampaignData";
import { CampaignSaveManager } from "../systems/CampaignSaveManager";
import { runServiceOf } from "../systems/survival/RoguelikeRunService";

/** Seed of the boss node (any fixed value: same node every run). */
const BOSS_NODE_SEED = 99;

declare global {
  interface Window {
    __perfHooks?: {
      startCampaignMission: (factionId: FactionId, missionId: string) => boolean;
      startCreatureBossNode: () => void;
    };
  }
}

/**
 * Install the perf-probe entry hooks on the window.
 * @param game - the running Phaser game instance
 */
export function installPerfHooks(game: Phaser.Game): void {
  window.__perfHooks = {
    startCampaignMission: (factionId, missionId) => {
      const mission = FACTION_CAMPAIGNS[factionId].missions.find(
        (m) => m.id === missionId,
      );
      if (!mission) return false;
      game.scene.stop("MainMenuScene");
      game.scene.start("CampaignBattleScene", {
        factionId,
        mission,
        saveData: CampaignSaveManager.createNew(factionId),
      });
      return true;
    },
    startCreatureBossNode: () => {
      const service = runServiceOf(game.registry);
      const run = service.startRun({
        faction: "free_confederation",
        flagshipId: "confed_wasp",
        loadoutId: null,
        ascension: 0,
        seed: BOSS_NODE_SEED,
      });
      const first = run.map.rows[0]?.[0]?.id;
      service.apply((r) => ({
        ...r,
        map: {
          ...r.map,
          rows: r.map.rows.map((row) =>
            row.map((n) => (n.id === first ? { ...n, type: "boss" as const } : n)),
          ),
        },
        activeNodeId: first ?? null,
        activeKind: "boss",
        path: first ? [first] : [],
      }));
      game.scene.stop("MainMenuScene");
      game.scene.start("SurvivalScene", { factionId: "free_confederation", fromRun: true });
    },
  };
}
