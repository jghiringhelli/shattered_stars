/**
 * Protocol limits and match-mode rules — the numbers both the relay's input
 * validation and the lobby UI enforce. Pure data.
 */

/** Online match modes. */
export type MatchMode = "dogfight" | "skirmish" | "scenario" | "reinforcements";

/** Every mode, in lobby display order. */
export const MATCH_MODES: readonly MatchMode[] = [
  "dogfight",
  "skirmish",
  "scenario",
  "reinforcements",
];

/** How many humans a mode seats and what a loadout may hold. */
export interface ModeRules {
  readonly minPlayers: number;
  readonly maxPlayers: number;
  /** Ships a player's loadout must hold (min..max). */
  readonly minShips: number;
  readonly maxShips: number;
  /** Players pick team A/B (otherwise seat order decides: seat 0 vs seat 1). */
  readonly teams: boolean;
}

/**
 * Dogfight is a 1v1 duel (one ship each). Skirmish seats up to 2v2: each
 * human flies the flagship of their squad, the rest are AI wingmen.
 * Scenario and Reinforcements are 1v1 squad battles: their objectives and
 * reinforcement pools are defined per side, and a side is one faction.
 */
export const MODE_RULES: Readonly<Record<MatchMode, ModeRules>> = {
  dogfight: {
    minPlayers: 2,
    maxPlayers: 2,
    minShips: 1,
    maxShips: 1,
    teams: false,
  },
  skirmish: {
    minPlayers: 2,
    maxPlayers: 4,
    minShips: 1,
    maxShips: 8,
    teams: true,
  },
  scenario: {
    minPlayers: 2,
    maxPlayers: 2,
    minShips: 1,
    maxShips: 8,
    teams: false,
  },
  reinforcements: {
    minPlayers: 2,
    maxPlayers: 2,
    minShips: 1,
    maxShips: 8,
    teams: false,
  },
};

/** Size and count caps on everything a client may send. */
export const NET_LIMITS = {
  nameMaxLength: 20,
  buildMaxLength: 40,
  /** Room codes: 5 characters from ROOM_CODE_ALPHABET (~33.5 M codes). */
  roomCodeLength: 5,
  /** Ship / faction / scenario ids: lowercase snake_case. */
  idMaxLength: 48,
  chatMaxLength: 120,
  /** Ships one loadout may list. */
  maxShipsPerLoadout: 8,
  tokenMaxLength: 64,
  /** Ticks one input message may carry (redundant resend window). */
  maxInputFramesPerMessage: 120,
  /** 32-bit words in one tick's input (buttons, aim, command, argument). */
  maxWordsPerInput: 4,
  /** Snapshot payload (serialized JSON text). */
  maxSnapshotChars: 512 * 1024,
  /** Raw WebSocket frame size (snapshot + envelope). */
  maxMessageBytes: 600 * 1024,
} as const;

/** Room-code alphabet: no 0/O, 1/I/L, so codes survive being read aloud. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Bit 30 of a tick's first input word: "the AI flies this seat this tick".
 * The relay fills a disconnected seat with it, so every client hands the
 * same ship to the same deterministic AI on the same tick.
 */
export const INPUT_AI_CONTROL = 0x40000000;

/** The neutral input: nothing held, nothing pressed. */
export const NEUTRAL_INPUT = 0;

/** Team ids in team modes. */
export type TeamId = 0 | 1;

/** Lowercase ids for factions, ships and scenarios. */
export const ID_PATTERN = /^[a-z0-9_]{1,48}$/;

/**
 * @param value - Anything.
 * @returns Whether it is a known match mode.
 */
export function isMatchMode(value: unknown): value is MatchMode {
  return MATCH_MODES.includes(value as MatchMode);
}

/**
 * @param code - Raw user input.
 * @returns The code upper-cased with whitespace removed (it may still be invalid).
 */
export function normalizeRoomCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

/**
 * @param code - A normalized room code.
 * @returns Whether it has the right length and alphabet.
 */
export function isRoomCode(code: string): boolean {
  if (code.length !== NET_LIMITS.roomCodeLength) return false;
  return [...code].every((c) => ROOM_CODE_ALPHABET.includes(c));
}
