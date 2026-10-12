/**
 * Wire messages between clients and the relay server. Every message is a
 * JSON object whose `t` field names its type. Field names are short on the
 * hot path (`in`, `hash`) because those flow at the 60 Hz tick rate.
 */

import type { MatchMode, TeamId } from "./limits";

/** One tick of one seat's input: a single button word or up to 4 words. */
export type TickInput = number | readonly number[];

/** A player's squad for the match. */
export interface Loadout {
  readonly faction: string;
  /** Ship definition ids; the first one is the ship the human flies. */
  readonly ships: readonly string[];
}

/** Host-chosen room options. */
export interface RoomOptions {
  /** Scenario id (scenario mode only). */
  readonly scenarioId?: string;
}

/** Lobby phase of a room. */
export type RoomPhase = "lobby" | "starting" | "playing";

/** One player as the room shows them. */
export interface RoomPlayerView {
  readonly id: string;
  readonly name: string;
  readonly seat: number;
  readonly team: TeamId;
  readonly loadout: Loadout | null;
  readonly ready: boolean;
  /** Last round-trip time the player's client reported (ms). */
  readonly pingMs: number;
  readonly connected: boolean;
  readonly isHost: boolean;
}

/** A room as every member sees it. */
export interface RoomView {
  readonly code: string;
  readonly mode: MatchMode;
  readonly options: RoomOptions;
  readonly hostId: string;
  readonly phase: RoomPhase;
  readonly players: readonly RoomPlayerView[];
  readonly maxPlayers: number;
  /** Quick-match rooms: everyone must ready before this server time (ms), else they are removed. */
  readonly readyDeadline: number | null;
  /** "starting": the match starts at this server time (ms). */
  readonly startsAt: number | null;
  readonly quickMatch: boolean;
}

/** One seat of a started match (seat order is canonical on every client). */
export interface SeatView {
  readonly seat: number;
  readonly playerId: string;
  readonly name: string;
  readonly team: TeamId;
  readonly loadout: Loadout;
}

/** Everything a client needs to build the identical battle. */
export interface MatchStart {
  readonly matchId: string;
  readonly seed: number;
  readonly mode: MatchMode;
  readonly options: RoomOptions;
  readonly seats: readonly SeatView[];
  /** Ticks between sampling an input and simulating it. */
  readonly inputDelay: number;
  /** Seat whose state wins a desync (it sends resync snapshots). */
  readonly authoritySeat: number;
}

/** Messages a client sends. */
export type ClientMessage =
  | {
      readonly t: "hello";
      readonly protocol: number;
      readonly build: string;
      readonly name: string;
      readonly token?: string;
    }
  | {
      readonly t: "ping";
      readonly id: number;
      readonly ct: number;
      readonly rtt?: number;
    }
  | { readonly t: "create_room"; readonly mode: MatchMode }
  | { readonly t: "join_room"; readonly code: string }
  | { readonly t: "quick_match"; readonly mode: MatchMode }
  | { readonly t: "cancel_queue" }
  | { readonly t: "leave_room" }
  | { readonly t: "set_loadout"; readonly loadout: Loadout }
  | { readonly t: "set_team"; readonly team: TeamId }
  | { readonly t: "set_options"; readonly options: RoomOptions }
  | { readonly t: "set_ready"; readonly ready: boolean }
  | { readonly t: "chat"; readonly text: string }
  | { readonly t: "loaded" }
  | ClientInputMessage
  | { readonly t: "hash"; readonly tick: number; readonly hash: number }
  | { readonly t: "snapshot"; readonly tick: number; readonly data: string }
  | {
      readonly t: "match_over";
      readonly tick: number;
      readonly winnerTeam: TeamId | null;
    }
  | { readonly t: "leave_match" };

/** A batch of one seat's inputs for ticks `from`, `from+1`, … */
export interface ClientInputMessage {
  readonly t: "in";
  readonly from: number;
  readonly inputs: readonly TickInput[];
  /** The sender's current simulation tick (pacing). */
  readonly at: number;
  /** Per seat: the next tick the sender still needs (redundant-resend window). */
  readonly ack: readonly number[];
}

/** Why the server refused a connection. */
export type RefusalReason =
  "version_mismatch" | "bad_hello" | "server_full" | "session_expired";

/** Error codes for a rejected request (the connection stays open). */
export type ErrorCode =
  | "invalid_message"
  | "rate_limited"
  | "room_not_found"
  | "room_full"
  | "room_started"
  | "build_mismatch"
  | "not_in_room"
  | "not_host"
  | "invalid_loadout"
  | "not_allowed"
  | "server_busy";

/** Status change of another player during a match. */
export type PeerStatus = "disconnected" | "reconnected" | "left";

/** Messages the server sends. */
export type ServerMessage =
  | {
      readonly t: "welcome";
      readonly playerId: string;
      readonly token: string;
      readonly protocol: number;
      readonly resumed: boolean;
      readonly reconnectWindowMs: number;
      readonly heartbeatMs: number;
      readonly serverTime: number;
    }
  | {
      readonly t: "refused";
      readonly reason: RefusalReason;
      readonly serverProtocol: number;
    }
  | {
      readonly t: "pong";
      readonly id: number;
      readonly ct: number;
      readonly st: number;
    }
  | { readonly t: "error"; readonly code: ErrorCode; readonly message: string }
  | { readonly t: "room"; readonly room: RoomView }
  | {
      readonly t: "room_left";
      readonly reason: "left" | "ready_timeout" | "closed";
    }
  | {
      readonly t: "queue";
      readonly mode: MatchMode;
      readonly queued: boolean;
      readonly since: number;
    }
  | {
      readonly t: "chat";
      readonly from: string;
      readonly name: string;
      readonly text: string;
    }
  | {
      readonly t: "match_start";
      readonly match: MatchStart;
      readonly resume: boolean;
    }
  | { readonly t: "go"; readonly serverTime: number }
  | ServerInputMessage
  | {
      readonly t: "resync";
      readonly tick: number;
      readonly reason: "desync" | "reconnect";
    }
  | { readonly t: "snapshot_request"; readonly tick: number }
  | { readonly t: "snapshot"; readonly tick: number; readonly data: string }
  | {
      readonly t: "peer";
      readonly playerId: string;
      readonly seat: number;
      readonly status: PeerStatus;
      readonly graceMs: number;
    }
  | { readonly t: "authority"; readonly seat: number }
  | {
      readonly t: "match_end";
      readonly reason: "finished" | "abandoned";
      readonly winnerTeam: TeamId | null;
    }
  | { readonly t: "shutdown" };

/** Inputs of one seat relayed to the other clients. */
export interface ServerInputMessage {
  readonly t: "in";
  readonly seat: number;
  readonly from: number;
  readonly inputs: readonly TickInput[];
  /** That seat's simulation tick when it sent them (-1 for server AI fill). */
  readonly at: number;
  /** The next tick the server expects from the recipient's own seat. */
  readonly ack: number;
}

/** Message type names. */
export type ClientMessageType = ClientMessage["t"];
export type ServerMessageType = ServerMessage["t"];
