/**
 * Asset manifest — the single list of every runtime image the game loads
 * from `public/`, as Phaser texture keys + URLs. Pure data (no Phaser), so
 * tests can check every URL ships and the boot bundle stays small.
 *
 * Boot loads only {@link BOOT_ASSETS} (what the main menu draws). Everything
 * else is loaded per scene (see sceneAssetPlan.ts) or on demand
 * (see textureLoading.ts) the first time it is shown.
 */

import type { FactionId } from "../config";
import {
  ALL_CREATURES,
  creatureTextureKeys,
} from "../data/creatures/creatureCatalog";
import { SHIP_DEFINITIONS } from "../data/ShipDefinitions";

/** One loadable texture. */
export type AssetEntry =
  | { readonly kind: "image"; readonly key: string; readonly url: string }
  | {
      readonly kind: "atlas";
      readonly key: string;
      readonly url: string;
      readonly atlasUrl: string;
    };

/** The slice of a ship definition the manifest needs. */
export interface ShipAssetRef {
  readonly id: string;
  readonly faction: FactionId;
}

/** Painted space backdrops (`bg_<id>`) that scenes actually use. */
export const BACKGROUND_IDS = [
  "nebula_blue",
  "nebula_purple",
  "nebula_teal",
  "nebula_crimson",
  "planet_rocky",
  "planet_gas_giant",
  "starfield_deep",
  "galaxy_spiral",
] as const;

/** A painted backdrop id. */
export type BackgroundId = (typeof BACKGROUND_IDS)[number];

/** Backdrop the main menu paints (the only one loaded at boot). */
export const MENU_BACKGROUND: BackgroundId = "nebula_purple";

/**
 * @param id - Backdrop id.
 * @returns Its texture entry.
 */
export function backgroundAsset(id: BackgroundId): AssetEntry {
  return {
    kind: "image",
    key: `bg_${id}`,
    url: `assets/backgrounds/${id}.png`,
  };
}

/**
 * @param id - Any string.
 * @returns True for a known backdrop id.
 */
export function isBackgroundId(id: string): id is BackgroundId {
  return (BACKGROUND_IDS as readonly string[]).includes(id);
}

/**
 * @param ship - Ship definition.
 * @returns Its in-battle / card sprite (`ship_<id>`, equal to `spriteKey`).
 */
export function shipSpriteAsset(ship: ShipAssetRef): AssetEntry {
  return {
    kind: "image",
    key: `ship_${ship.id}`,
    url: `assets/ships/${ship.faction}/${ship.id}.png`,
  };
}

/**
 * @param ship - Ship definition.
 * @returns Its wide encyclopedia art (`ship_art_<id>`).
 */
export function shipArtAsset(ship: ShipAssetRef): AssetEntry {
  return {
    kind: "image",
    key: `ship_art_${ship.id}`,
    url: `assets/ships/encyclopedia/${ship.faction}/${ship.id}_art.png`,
  };
}

/**
 * @param shipId - A ship definition id.
 * @returns Its sprite entry, or null for an unknown id.
 */
export function shipSpriteAssetById(shipId: string): AssetEntry | null {
  const def = SHIP_DEFINITIONS[shipId];
  return def ? shipSpriteAsset(def) : null;
}

/**
 * @param shipId - A ship definition id.
 * @returns Its encyclopedia art entry, or null for an unknown id.
 */
export function shipArtAssetById(shipId: string): AssetEntry | null {
  const def = SHIP_DEFINITIONS[shipId];
  return def ? shipArtAsset(def) : null;
}

/** Portrait sheet (base + talk frames) of a named campaign pilot. */
function portraitSheet(faction: FactionId, name: string): AssetEntry {
  const base = `assets/portraits/${faction}/${name}_sheet`;
  return {
    kind: "atlas",
    key: `portrait_${name}`,
    url: `${base}.png`,
    atlasUrl: `${base}.json`,
  };
}

/** COMMAND speaker portrait (single image; generated if the file 404s). */
export const COMMAND_PORTRAIT: AssetEntry = {
  kind: "image",
  key: "portrait_command",
  url: "assets/portraits/portrait_command.png",
};

/** Campaign pilot portrait names per faction. */
const PORTRAIT_NAMES: Readonly<Record<FactionId, readonly string[]>> = {
  terran_hegemony: ["admiral_chen", "striker", "whisper"],
  free_confederation: ["commander_santos", "phoenix_one", "doc_vasquez", "kronos"],
  synthetic_collective: ["omega_7", "prime_collective", "unit_zero"],
  void_corsairs: ["captain_kira", "the_admiral", "bloodfang", "blackmaw", "vosk"],
  ascendant_empire: ["the_dreamer", "archon_zaelthar", "herald", "ilsandre"],
};

/** Factions that have campaign portraits. */
export const PORTRAIT_FACTIONS = Object.keys(PORTRAIT_NAMES) as FactionId[];

/**
 * @param id - Any string.
 * @returns True for a faction with campaign portraits.
 */
export function isPortraitFaction(id: string): id is FactionId {
  return Object.prototype.hasOwnProperty.call(PORTRAIT_NAMES, id);
}

/**
 * @param faction - A faction.
 * @returns Its campaign pilot portrait sheets.
 */
export function factionPortraitAssets(faction: FactionId): AssetEntry[] {
  return (PORTRAIT_NAMES[faction] ?? []).map((name) =>
    portraitSheet(faction, name),
  );
}

/** Every portrait (command + all factions). */
export const PORTRAIT_ASSETS: readonly AssetEntry[] = [
  COMMAND_PORTRAIT,
  ...PORTRAIT_FACTIONS.flatMap(factionPortraitAssets),
];

/** UI chrome textures painted by menus (`TexturedPanel`, setup screens). */
const UI_ASSETS: readonly AssetEntry[] = [
  { kind: "image", key: "tex_menu_bg", url: "assets/ui/ui_menu_bg.png" },
  {
    kind: "image",
    key: "tex_title_frame",
    url: "assets/ui/ui_title_frame.png",
  },
];

/**
 * @param key - A creature texture key (`creature_<stem>_body` / `_segment` / `_pod`).
 * @returns Its sprite entry (loaded on demand by the battle scene that fights it).
 */
export function creatureSpriteAsset(key: string): AssetEntry {
  return { kind: "image", key, url: `assets/creatures/${key}.png` };
}

/** @returns Every creature texture entry (body, segments, pods). */
export function creatureAssets(): AssetEntry[] {
  return ALL_CREATURES.flatMap((creature) => {
    const keys = creatureTextureKeys(creature);
    return [keys.body, keys.segment, keys.pod]
      .filter((key): key is string => key !== null)
      .map(creatureSpriteAsset);
  });
}

/** What BootScene loads before the main menu — keep this small. */
export const BOOT_ASSETS: readonly AssetEntry[] = [
  ...UI_ASSETS,
  backgroundAsset(MENU_BACKGROUND),
];

/** @returns Every entry the game can load (tests and the asset audit). */
export function allManifestAssets(): AssetEntry[] {
  const ships = Object.values(SHIP_DEFINITIONS);
  return [
    ...UI_ASSETS,
    ...BACKGROUND_IDS.map(backgroundAsset),
    ...PORTRAIT_ASSETS,
    ...ships.map(shipSpriteAsset),
    ...ships.map(shipArtAsset),
    ...creatureAssets(),
  ];
}
