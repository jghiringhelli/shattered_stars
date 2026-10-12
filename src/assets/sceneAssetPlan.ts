/**
 * Scene asset plan — which textures each scene needs before its `create()`.
 * Pure: given a scene key and the data it was started with, returns the
 * manifest entries to preload. The preload gate (scenePreloadGate.ts) queues
 * the ones not already in the texture cache and shows a progress bar.
 *
 * Ship sprites are found by scanning the start data for ship definition ids
 * (squads, rosters, debrief pilots...). Ships spawned later (waves,
 * reinforcements) are covered by the on-demand loader in ShipVisual.
 */

import { SHIP_DEFINITIONS } from "../data/ShipDefinitions";
import {
  COMMAND_PORTRAIT,
  PORTRAIT_ASSETS,
  backgroundAsset,
  factionPortraitAssets,
  isPortraitFaction,
  shipSpriteAsset,
  type AssetEntry,
  type BackgroundId,
} from "./assetManifest";

/** What one scene preloads. */
export interface SceneAssetPlan {
  /** Painted backdrops the scene draws. */
  readonly backgrounds: readonly BackgroundId[];
  /** Campaign pilot portraits (the data's faction, else all). */
  readonly portraits?: true;
  /** Also scan the registry's `battleConfig` (squad-builder battles). */
  readonly battleConfig?: true;
}

/** Plans keyed by scene key (= scene file name). */
export const SCENE_ASSET_PLANS: Readonly<Record<string, SceneAssetPlan>> = {
  MainMenuScene: { backgrounds: ["nebula_purple"] },
  SquadBuilderScene: { backgrounds: ["nebula_crimson"] },
  SettingsScene: { backgrounds: ["nebula_blue"] },
  CreditsScene: { backgrounds: ["galaxy_spiral"] },
  LobbyScene: { backgrounds: ["nebula_teal"] },
  ControlsScene: { backgrounds: ["starfield_deep"] },
  EncyclopediaScene: { backgrounds: ["starfield_deep"] },
  ShipPickerScene: { backgrounds: [] },
  ArcadeBattleScene: { backgrounds: ["galaxy_spiral"], battleConfig: true },
  EpicBattleScene: { backgrounds: ["galaxy_spiral"] },
  DogfightScene: { backgrounds: ["nebula_purple"] },
  AceDuelScene: { backgrounds: ["nebula_crimson"] },
  ContinuousTacticalScene: { backgrounds: ["nebula_blue"], battleConfig: true },
  FlightSchoolScene: { backgrounds: ["nebula_blue"] },
  SurvivalScene: { backgrounds: ["starfield_deep"] },
  SurvivalSetupScene: { backgrounds: ["starfield_deep"] },
  SurvivalMapScene: { backgrounds: ["starfield_deep"] },
  SurvivalSummaryScene: { backgrounds: ["starfield_deep"] },
  CampaignScene: { backgrounds: ["planet_rocky"], portraits: true },
  CampaignBattleScene: { backgrounds: ["planet_gas_giant"], portraits: true },
  DebriefScene: { backgrounds: ["starfield_deep"], portraits: true },
  CampaignCompleteScene: { backgrounds: ["starfield_deep"], portraits: true },
};

/** Scan limits: scene data can be large; ids sit near the top. */
const SCAN_MAX_DEPTH = 6;
const SCAN_MAX_NODES = 5000;

/** @returns True for arrays and plain (literal / null-prototype) objects. */
function isPlainContainer(value: unknown): value is object {
  if (Array.isArray(value)) return true;
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * Collect every string in `data` (nested arrays / plain objects) that
 * matches `accept`. Class instances (Phaser objects, services) are skipped;
 * cycles and huge payloads are bounded.
 *
 * @param data - Scene start data (anything).
 * @param accept - Which strings to keep.
 * @returns The matching strings.
 */
export function collectDataIds(
  data: unknown,
  accept: (value: string) => boolean,
): Set<string> {
  const found = new Set<string>();
  const seen = new Set<object>();
  const stack: Array<{ value: unknown; depth: number }> = [
    { value: data, depth: 0 },
  ];
  let visited = 0;
  while (stack.length > 0 && visited < SCAN_MAX_NODES) {
    const { value, depth } = stack.pop()!;
    visited++;
    if (typeof value === "string") {
      if (accept(value)) found.add(value);
      continue;
    }
    if (!isPlainContainer(value) || seen.has(value) || depth >= SCAN_MAX_DEPTH)
      continue;
    seen.add(value);
    for (const child of Object.values(value))
      stack.push({ value: child, depth: depth + 1 });
  }
  return found;
}

/** @returns Portrait entries for the factions named in `data` (all if none). */
function portraitsFor(data: unknown): AssetEntry[] {
  const factions = [...collectDataIds(data, isPortraitFaction)].filter(
    isPortraitFaction,
  );
  if (factions.length === 0) return [...PORTRAIT_ASSETS];
  return [COMMAND_PORTRAIT, ...factions.flatMap(factionPortraitAssets)];
}

/**
 * @param sceneKey - The scene being started.
 * @param data - The data it was started with.
 * @returns Textures to preload before its `create()` (may contain entries
 *   that are already cached — the gate skips those).
 */
export function resolveSceneAssets(
  sceneKey: string,
  data: unknown,
): AssetEntry[] {
  const plan = SCENE_ASSET_PLANS[sceneKey];
  if (!plan) return [];
  const shipIds = collectDataIds(data, (s) =>
    Object.prototype.hasOwnProperty.call(SHIP_DEFINITIONS, s),
  );
  const ships = [...shipIds].map((id) =>
    shipSpriteAsset(SHIP_DEFINITIONS[id]!),
  );
  return [
    ...plan.backgrounds.map(backgroundAsset),
    ...(plan.portraits ? portraitsFor(data) : []),
    ...ships,
  ];
}
