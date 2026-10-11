/**
 * sortieBriefing — the short, terse briefing card shown before a Dogfight,
 * Ace Duel or Boss Raid sortie (House of the Dying Sun style: show urgency,
 * don't narrate it). A codename, one objective line, up to three intel
 * lines, and a mood that picks the procedural music stinger.
 *
 * Pure: no Phaser. The card itself is SortieBriefingCard.ts.
 */

import type { SoundEffectType } from "../../audio/SoundDesign";

/** Longest a briefing may hold the player before it launches (ms). */
export const MAX_SORTIE_BRIEFING_MS = 3000;
/** Default time on screen before the sortie launches by itself (ms). */
export const SORTIE_BRIEFING_MS = 2600;

/** Mood of a sortie — picks the stinger and the card's tone. */
export type BriefingMood = "tense" | "rivalry" | "dread";

/** One note of a stinger: a procedural voice at an offset. */
export interface StingerNote {
  readonly sound: SoundEffectType;
  readonly atMs: number;
  readonly volume: number;
}

/** Procedural stingers per mood (UI voices, so the UI volume bus applies). */
export const BRIEFING_STINGERS: Readonly<
  Record<BriefingMood, readonly StingerNote[]>
> = {
  tense: [
    { sound: "ui_select", atMs: 0, volume: 0.6 },
    { sound: "ui_select", atMs: 160, volume: 0.6 },
    { sound: "alert", atMs: 380, volume: 0.45 },
  ],
  rivalry: [
    { sound: "ui_click", atMs: 0, volume: 0.6 },
    { sound: "ui_select", atMs: 220, volume: 0.6 },
    { sound: "powerup", atMs: 460, volume: 0.5 },
  ],
  dread: [
    { sound: "alert", atMs: 0, volume: 0.35 },
    { sound: "explosion_large", atMs: 320, volume: 0.2 },
    { sound: "alert", atMs: 900, volume: 0.3 },
  ],
};

/** What the card shows. */
export interface SortieBriefing {
  /** Mode tag in the card header ("DOGFIGHT"). */
  readonly mode: string;
  readonly codename: string;
  /** One line, ≤ 60 characters. */
  readonly objective: string;
  /** Up to three short intel lines. */
  readonly intel: readonly string[];
  readonly mood: BriefingMood;
}

/** Every difficulty a briefing can name (settings scale + raid tiers). */
export type BriefingDifficulty =
  "easy" | "normal" | "medium" | "hard" | "brutal" | "mythic";

const THREAT: Readonly<Record<BriefingDifficulty, string>> = {
  easy: "ROOKIE",
  normal: "VETERAN",
  medium: "VETERAN",
  hard: "ACE",
  brutal: "LEGEND",
  mythic: "MYTHIC",
};

/**
 * @param difficulty - Setup-screen difficulty.
 * @returns The one-word threat rating.
 */
export function threatLabel(difficulty: BriefingDifficulty): string {
  return THREAT[difficulty];
}

const CODE_ADJECTIVES = [
  "IRON",
  "SILENT",
  "RED",
  "BROKEN",
  "GHOST",
  "COLD",
  "BLACK",
  "HOLLOW",
  "SHATTERED",
  "BURNING",
  "PALE",
  "LAST",
  "GLASS",
  "VOID",
  "ASHEN",
  "SWIFT",
] as const;
const CODE_NOUNS = [
  "VIGIL",
  "LANCE",
  "TALON",
  "EMBER",
  "HALO",
  "TIDE",
  "SPEAR",
  "WAKE",
  "CROWN",
  "MERIDIAN",
  "COMET",
  "SHARD",
  "AEGIS",
  "HORIZON",
  "FANG",
  "REQUIEM",
] as const;

/** FNV-1a offset basis and prime (32-bit). */
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
/** Bits taken from the hash for the noun pick (the adjective uses the rest). */
const NOUN_SHIFT = 8;

function hashText(text: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
}

/**
 * A deterministic codename: the same sortie always gets the same name.
 *
 * @param seed - Any text identifying the sortie (mode + matchup).
 * @returns e.g. "OPERATION IRON VIGIL".
 */
export function codenameFor(seed: string): string {
  const hash = hashText(seed);
  const adjective = CODE_ADJECTIVES[hash % CODE_ADJECTIVES.length];
  const noun = CODE_NOUNS[(hash >>> NOUN_SHIFT) % CODE_NOUNS.length];
  return `OPERATION ${adjective} ${noun}`;
}

const upper = (text: string): string => text.toUpperCase();

/** Inputs of a Dogfight briefing. */
export interface DogfightBriefingInput {
  readonly playerShip: string;
  readonly enemyShip: string;
  readonly enemyFaction: string;
  readonly difficulty: BriefingDifficulty;
  readonly roundsToWin: number;
}

/**
 * @param input - Ships, faction, difficulty and format.
 * @returns The Dogfight briefing.
 */
export function dogfightBriefing(input: DogfightBriefingInput): SortieBriefing {
  return {
    mode: "DOGFIGHT",
    codename: codenameFor(`dogfight:${input.playerShip}:${input.enemyShip}`),
    objective: `Take ${input.roundsToWin} rounds. Nothing else counts.`,
    intel: [
      `CONTACT · ${upper(input.enemyShip)} · ${upper(input.enemyFaction)}`,
      `THREAT · ${threatLabel(input.difficulty)}`,
      `YOU FLY · ${upper(input.playerShip)}`,
    ],
    mood: "tense",
  };
}

/** Inputs of an Ace Duel briefing. */
export interface AceDuelBriefingInput {
  readonly matchupName: string;
  readonly playerAce: string;
  readonly rivalAce: string;
  readonly rivalShips: readonly string[];
  readonly difficulty: BriefingDifficulty;
}

/**
 * @param input - Matchup, aces, rival ships and difficulty.
 * @returns The Ace Duel briefing.
 */
export function aceDuelBriefing(input: AceDuelBriefingInput): SortieBriefing {
  return {
    mode: "ACE DUEL",
    codename: codenameFor(`ace:${input.matchupName}:${input.rivalAce}`),
    objective: `Ground ${upper(input.rivalAce)}. Settle it.`,
    intel: [
      `RIVAL WING · ${input.rivalShips.map(upper).join(" + ")}`,
      `THREAT · ${threatLabel(input.difficulty)}`,
      `CALLSIGN · ${upper(input.playerAce)}`,
    ],
    mood: "rivalry",
  };
}

/** Inputs of a Boss Raid briefing. */
export interface RaidBriefingInput {
  readonly bossName: string;
  readonly bossFaction: string;
  readonly difficulty: BriefingDifficulty;
  readonly clockMs: number;
  readonly escorts: number;
}

const MS_PER_MINUTE = 60_000;

/**
 * @param input - Boss, faction, difficulty, raid clock and escort count.
 * @returns The Boss Raid briefing.
 */
export function raidBriefing(input: RaidBriefingInput): SortieBriefing {
  const minutes = Math.round(input.clockMs / MS_PER_MINUTE);
  return {
    mode: "BOSS RAID",
    codename: codenameFor(`raid:${input.bossName}`),
    objective: `Break the ${upper(input.bossName)}.`,
    intel: [
      `TARGET · ${upper(input.bossFaction)} CAPITAL`,
      `${minutes} MIN ON THE CLOCK · ${input.escorts} ESCORTS`,
      `THREAT · ${threatLabel(input.difficulty)}`,
    ],
    mood: "dread",
  };
}
