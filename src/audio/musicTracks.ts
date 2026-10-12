/**
 * Music track catalog: track ids, which ones ship as recorded files, and how a
 * game context (menu, faction hub, battle mode) resolves to a track.
 *
 * Sources: the author's Suno library (scripts/music/suno_tracks.json) plus
 * ACE-Step renders for the Synthetic / Ascendant gaps
 * (scripts/music/alpha_tracks.json). Pure data + functions — no Web Audio, no
 * Phaser — so the mapping is unit tested directly.
 */

import type { FactionId } from "../config";

/** Every id playMusic() accepts (recorded, aliases and procedural-only). */
export type MusicTrack =
  | "menu_theme"
  | "menu_main"
  | "menu_ambient"
  | "combat_low"
  | "combat_medium"
  | "combat_high"
  | "victory_sting"
  | "defeat_sting"
  | "skirmish_combat_a"
  | "skirmish_combat_b"
  | "dogfight_combat"
  | "boss_dreadnought"
  | "long_haul"
  | "asteroid_belt"
  | "tension_alert"
  | "survival_shop"
  | "heg_tactical"
  | "heg_combat"
  | "heg_boss"
  | "heg_victory"
  | "heg_defeat"
  | "conf_tactical"
  | "conf_combat"
  | "conf_boss"
  | "conf_victory"
  | "conf_defeat"
  | "syn_tactical"
  | "syn_combat"
  | "syn_boss"
  | "syn_awakening"
  | "cors_tactical"
  | "cors_combat"
  | "cors_boss"
  | "cors_heist"
  | "asc_tactical"
  | "asc_combat"
  | "asc_boss"
  | "asc_prophecy"
  | "void_encounter"
  | "void_nexus_discovery"
  | "void_campaign_credits"
  | "victory_common"
  | "defeat_common"
  | "arcade_action"
  | "tactical_planning"
  | "survival_ramp"
  | "campaign_briefing";

/** Legacy phase API: faction theme, faction battle, boss. */
export type BattleMusicPhase = "tactical" | "combat" | "boss";

/** What kind of fight is on — picks the battle track. */
export type BattleMusicMode = "skirmish" | "dogfight" | "boss" | "hazard";

/** Encoded container shipped for every recorded track. */
export type MusicFormat = "ogg" | "mp3";

/** Main menu / title. */
export const MENU_MUSIC_TRACK: MusicTrack = "menu_main";

/** Setup screens and submenus. */
export const SUBMENU_MUSIC_TRACK: MusicTrack = "menu_ambient";

/** Survival sector map and campaign travel for factions without a theme. */
export const TRAVEL_MUSIC_TRACK: MusicTrack = "long_haul";

/** Low hull / boss final phase layer. */
export const TENSION_MUSIC_TRACK: MusicTrack = "tension_alert";

/** Relative to the page (Vite `base: './'`), i.e. public/assets/audio/music/. */
export const MUSIC_URL_PREFIX = "assets/audio/music/";

/** Length of the equal-time fade between two recorded tracks. */
export const MUSIC_CROSSFADE_SECONDS = 1.5;

/**
 * Tracks that ship as files (both .ogg and .mp3), fetched lazily the first
 * time their context plays. Anything not listed plays the procedural fallback
 * without a network request, so missing music never 404s. A unit test checks
 * every entry exists on disk.
 */
export const RECORDED_MUSIC_TRACKS: ReadonlySet<MusicTrack> =
  new Set<MusicTrack>([
    "menu_main",
    "menu_ambient",
    "skirmish_combat_a",
    "skirmish_combat_b",
    "dogfight_combat",
    "boss_dreadnought",
    "heg_tactical",
    "cors_tactical",
    "long_haul",
    "asteroid_belt",
    "tension_alert",
    "victory_common",
    "defeat_common",
    "syn_tactical",
    "syn_combat",
    "asc_tactical",
    "asc_combat",
  ]);

/** Stingers: played once, not looped. */
const ONE_SHOT_TRACKS: ReadonlySet<MusicTrack> = new Set<MusicTrack>([
  "victory_common",
  "defeat_common",
]);

/** Ids that share a recorded file with another context. */
export const TRACK_ALIASES: Readonly<Partial<Record<MusicTrack, MusicTrack>>> =
  {
    menu_theme: "menu_main",
    conf_tactical: "long_haul",
    survival_shop: "cors_tactical",
    heg_combat: "skirmish_combat_a",
    conf_combat: "skirmish_combat_a",
    cors_combat: "skirmish_combat_a",
    heg_boss: "boss_dreadnought",
    conf_boss: "boss_dreadnought",
    syn_boss: "boss_dreadnought",
    cors_boss: "boss_dreadnought",
    asc_boss: "boss_dreadnought",
    victory_sting: "victory_common",
    heg_victory: "victory_common",
    conf_victory: "victory_common",
    defeat_sting: "defeat_common",
    heg_defeat: "defeat_common",
    conf_defeat: "defeat_common",
  };

/** Track-id prefix per faction (`<prefix>_tactical`, `<prefix>_combat`). */
export const FACTION_MUSIC_PREFIX: Partial<Record<FactionId, string>> = {
  terran_hegemony: "heg",
  free_confederation: "conf",
  synthetic_collective: "syn",
  void_corsairs: "cors",
  ascendant_empire: "asc",
};

/** The Combat Skirmish takes, alternated battle to battle. */
const SKIRMISH_ROTATION: readonly MusicTrack[] = [
  "skirmish_combat_a",
  "skirmish_combat_b",
];

const MODE_TRACK: Readonly<
  Record<Exclude<BattleMusicMode, "skirmish">, MusicTrack>
> = {
  dogfight: "dogfight_combat",
  boss: "boss_dreadnought",
  hazard: "asteroid_belt",
};

/**
 * Apply aliases.
 *
 * @param track - Requested id.
 * @returns The id whose file (or procedural voice) actually plays.
 */
export function resolveMusicTrack(track: MusicTrack): MusicTrack {
  return TRACK_ALIASES[track] ?? track;
}

/**
 * @param track - Track id (after alias resolution).
 * @param recorded - Catalog to consult (defaults to the shipped set).
 * @returns Whether a file ships for this track.
 */
export function isRecordedTrack(
  track: MusicTrack,
  recorded: ReadonlySet<MusicTrack> = RECORDED_MUSIC_TRACKS,
): boolean {
  return recorded.has(track);
}

/**
 * @param track - Track id (after alias resolution).
 * @returns True for stingers that play once instead of looping.
 */
export function isOneShotTrack(track: MusicTrack): boolean {
  return ONE_SHOT_TRACKS.has(track);
}

/**
 * Battle track for a fight: Dogfight Vector for dogfights/duels, Dreadnought
 * for bosses, Threading the Belt for hazards; skirmishes carry the faction's
 * own recorded combat track (Synthetic, Ascendant) or rotate the Combat
 * Skirmish takes.
 *
 * @param mode - Kind of fight.
 * @param factionId - The player's faction.
 * @param rotation - Skirmish counter (alternates the takes).
 * @param recorded - Catalog to consult (defaults to the shipped set).
 * @returns Track id to play.
 */
export function battleMusicTrack(
  mode: BattleMusicMode,
  factionId: FactionId,
  rotation: number,
  recorded: ReadonlySet<MusicTrack> = RECORDED_MUSIC_TRACKS,
): MusicTrack {
  if (mode !== "skirmish") return MODE_TRACK[mode];
  const prefix = FACTION_MUSIC_PREFIX[factionId];
  const own = `${prefix}_combat` as MusicTrack;
  if (prefix && recorded.has(own)) return own;
  return SKIRMISH_ROTATION[Math.abs(rotation) % SKIRMISH_ROTATION.length]!;
}

/**
 * Legacy phase API: tactical → the faction's theme (campaign hub, faction
 * screens; Long Haul when it has none), combat → skirmish, boss → boss.
 *
 * @param factionId - Faction whose identity the music carries.
 * @param phase - Game context.
 * @returns Track id to play (may be an alias).
 */
export function factionMusicTrack(
  factionId: FactionId,
  phase: BattleMusicPhase,
): MusicTrack {
  if (phase === "combat") return battleMusicTrack("skirmish", factionId, 0);
  if (phase === "boss") return battleMusicTrack("boss", factionId, 0);
  const prefix = FACTION_MUSIC_PREFIX[factionId];
  return prefix ? (`${prefix}_tactical` as MusicTrack) : TRAVEL_MUSIC_TRACK;
}

/**
 * Choose the encoded format for this browser: Ogg Vorbis when decodable
 * (smaller, gapless loops), otherwise mp3.
 *
 * @param canPlayType - `HTMLMediaElement.canPlayType`-style probe.
 * @returns Format to request.
 */
export function pickMusicFormat(
  canPlayType: (mime: string) => string,
): MusicFormat {
  return canPlayType('audio/ogg; codecs="vorbis"') !== "" ? "ogg" : "mp3";
}

/**
 * @param track - Recorded track id.
 * @param format - Encoded format.
 * @returns Page-relative URL of the file.
 */
export function musicFileUrl(track: MusicTrack, format: MusicFormat): string {
  return `${MUSIC_URL_PREFIX}${track}.${format}`;
}
