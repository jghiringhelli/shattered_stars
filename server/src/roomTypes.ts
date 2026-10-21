/**
 * Contracts of a Room: refusals, seated members, relay-core hooks and the
 * settings fixed at creation.
 */

import type {
  ErrorCode,
  Loadout,
  MatchMode,
  ServerMessage,
  TeamId,
} from "../../src/net/protocol";

/** A refused request: the code the client reacts to and the sentence its lobby shows. */
export interface Refusal {
  readonly code: ErrorCode;
  readonly message: string;
}

/** Why a newcomer was not seated. */
export type JoinRefusal = "room_full" | "room_started";

/**
 * @param code - Error code the client reacts to.
 * @param message - Sentence the lobby shows.
 * @returns A refusal.
 */
export const refuse = (code: ErrorCode, message: string): Refusal => ({
  code,
  message,
});

/** A player seated in a room. */
export interface Member {
  readonly id: string;
  name: string;
  readonly seat: number;
  team: TeamId;
  loadout: Loadout | null;
  ready: boolean;
  connected: boolean;
  pingMs: number;
}

/** What a room (type `R`) asks of the relay core. */
export interface RoomHooksFor<R> {
  send(playerId: string, message: ServerMessage): void;
  /** The countdown elapsed with everyone still ready. */
  onCountdownDone(room: R): void;
  /** A quick-match ready check expired: these members never readied. */
  onReadyTimeout(room: R, unreadyIds: readonly string[]): void;
  /** The rematch window closed without a replay. */
  onRematchExpired(room: R): void;
}

/** Room settings fixed at creation. */
export interface RoomSetup {
  readonly code: string;
  readonly mode: MatchMode;
  readonly build: string;
  readonly quickMatch: boolean;
  readonly countdownMs: number;
  /** Quick match: ready-check window (ms); 0 for none. */
  readonly readyWindowMs: number;
  /** How long a finished match's rematch stays open (ms). */
  readonly rematchWindowMs: number;
}
