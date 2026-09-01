/**
 * Mode + role-drill scenario definitions, and the shared collapse/boot logic
 * (mirrors verify_loop.ts's collapse(), extended to keep the page alive for a
 * full session instead of a single snapshot).
 */

import type { Page } from "playwright";
import { waitForScene } from "../vqa_helpers";
import { STRESS_DRILL } from "./drills";
import type { ArchetypeRole, ModeScenario, StartSpec } from "./types";

const TWO_V_TWO: Record<string, unknown> = {
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
};

const EPIC_4V4: Record<string, unknown> = {
  factions: [
    {
      factionId: "terran_hegemony",
      controller: "player",
      ships: [
        "terran_imperator",
        "terran_gladius",
        "terran_viper",
        "terran_hammer",
      ],
    },
    {
      factionId: "synthetic_collective",
      controller: "ai",
      ships: ["synth_drone", "synth_drone", "synth_drone", "synth_drone"],
    },
  ],
};

/** One representative ship id per role, all terran_hegemony, for role-drill scenarios. */
export const ROLE_DRILL_SHIPS: Record<ArchetypeRole, string> = {
  light_fighter: "terran_stiletto",
  interceptor: "terran_viper",
  heavy_fighter: "terran_gladius",
  bomber: "terran_hammer",
  gunship: "terran_bastion",
  support: "terran_sentinel",
  capital: "terran_imperator",
};

function roleDrillRegistry(shipId: string): Record<string, unknown> {
  return {
    factions: [
      { factionId: "terran_hegemony", controller: "player", ships: [shipId] },
      {
        factionId: "synthetic_collective",
        controller: "ai",
        ships: ["synth_drone", "synth_drone"],
      },
    ],
  };
}

/** One scenario per ship archetype, all applying the identical STRESS_DRILL. */
export const ROLE_DRILL_SCENARIOS: readonly ModeScenario[] = (
  Object.entries(ROLE_DRILL_SHIPS) as Array<[ArchetypeRole, string]>
).map(([role, shipId]) => ({
  mode: `role-drill-${role}`,
  sceneKey: "ArcadeBattleScene",
  start: { via: "registry", battleConfig: roleDrillRegistry(shipId) },
  durationMs: 8_000,
  playerShipRole: role,
  drill: STRESS_DRILL,
}));

export const MODE_SCENARIOS: readonly ModeScenario[] = [
  {
    mode: "arcade",
    sceneKey: "ArcadeBattleScene",
    start: { via: "registry", battleConfig: TWO_V_TWO },
    durationMs: 15_000,
  },
  {
    mode: "continuous",
    sceneKey: "ContinuousTacticalScene",
    start: { via: "registry", battleConfig: TWO_V_TWO },
    durationMs: 15_000,
  },
  {
    mode: "survival",
    sceneKey: "SurvivalScene",
    start: { via: "init", data: { factionId: "free_confederation" } },
    durationMs: 15_000,
  },
  {
    mode: "campaign",
    sceneKey: "CampaignBattleScene",
    start: {
      via: "hook",
      hook: "__verifyStartCampaign",
      arg: "free_confederation",
    },
    durationMs: 12_000,
    shipsVia: "battleManager",
  },
  {
    mode: "epic",
    sceneKey: "ArcadeBattleScene",
    start: { via: "registry", battleConfig: EPIC_4V4 },
    durationMs: 15_000,
  },
  {
    mode: "online",
    sceneKey: "LobbyScene",
    start: { via: "init", data: {} },
    durationMs: 3_000,
  },
];

/** COLLAPSE: stop active scenes and boot the target scene by its start strategy. */
export async function collapse(
  page: Page,
  sceneKey: string,
  start: StartSpec,
): Promise<boolean> {
  await page.evaluate(
    (spec: { sceneKey: string; start: StartSpec }) => {
      const g = (window as any).game;
      const active: any[] = g.scene.getScenes(true) ?? [];
      for (const sc of active) g.scene.stop(sc.sys.settings.key);
      const s = spec.start;
      setTimeout(() => {
        if (s.via === "registry") {
          g.registry.set("battleConfig", s.battleConfig);
          g.scene.start(spec.sceneKey);
        } else if (s.via === "init") {
          g.scene.start(spec.sceneKey, s.data);
        } else {
          const fn = (window as any)[s.hook];
          if (typeof fn === "function") fn(s.arg);
        }
      }, 120);
    },
    { sceneKey, start },
  );
  try {
    await waitForScene(page, sceneKey, 15_000);
    return true;
  } catch {
    return false;
  }
}
