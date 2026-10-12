/**
 * LobbyModel — the online lobby as pure state: connection, chosen mode,
 * quick-match queue, room, chat, notices and the started match, reduced
 * from NetClient states and relay messages. LobbyScene only renders it.
 */

import type { NetClientState } from "../client/NetClient";
import type { ServerUrlSource } from "../onlineConfig";
import {
  MODE_RULES,
  type MatchMode,
  type MatchStart,
  type RefusalReason,
  type RoomPlayerView,
  type RoomView,
  type ServerMessage,
  type TeamId,
} from "../protocol";

/** Notice tone (maps to the status chip colours). */
export type NoticeTone = "neutral" | "success" | "warning" | "danger";

/** A chat line. */
export interface LobbyChatLine {
  readonly name: string;
  readonly text: string;
}

/** Everything the lobby shows. */
export interface LobbyState {
  readonly connection: NetClientState;
  readonly refusal: RefusalReason | null;
  readonly server: {
    readonly url: string | null;
    readonly source: ServerUrlSource;
  };
  readonly mode: MatchMode;
  readonly queue: { readonly mode: MatchMode; readonly since: number } | null;
  readonly room: RoomView | null;
  readonly localId: string;
  readonly match: MatchStart | null;
  readonly lastResult: {
    readonly reason: "finished" | "abandoned";
    readonly winnerTeam: TeamId | null;
  } | null;
  readonly notice: { readonly text: string; readonly tone: NoticeTone } | null;
  readonly chat: readonly LobbyChatLine[];
}

/** Inputs to the reducer. */
export type LobbyEvent =
  | {
      readonly kind: "connection";
      readonly state: NetClientState;
      readonly refusal: RefusalReason | null;
    }
  | { readonly kind: "server"; readonly message: ServerMessage }
  | { readonly kind: "select_mode"; readonly mode: MatchMode }
  | {
      readonly kind: "server_url";
      readonly url: string | null;
      readonly source: ServerUrlSource;
    }
  | {
      readonly kind: "notice";
      readonly text: string;
      readonly tone: NoticeTone;
    };

/** Chat lines kept. */
export const CHAT_HISTORY = 8;

/** What the lobby screen shows. */
export type LobbyScreen = "offline" | "menu" | "queue" | "room";

/** @param server - Resolved relay URL. @returns The lobby before connecting. */
export function initialLobbyState(server: LobbyState["server"]): LobbyState {
  return {
    connection: "idle",
    refusal: null,
    server,
    mode: "dogfight",
    queue: null,
    room: null,
    localId: "",
    match: null,
    lastResult: null,
    notice: null,
    chat: [],
  };
}

/** @param state - Current state. @param event - What happened. @returns The next state. */
export function reduceLobby(state: LobbyState, event: LobbyEvent): LobbyState {
  switch (event.kind) {
    case "connection":
      return { ...state, connection: event.state, refusal: event.refusal };
    case "select_mode":
      return state.room ? state : { ...state, mode: event.mode };
    case "server_url":
      return { ...state, server: { url: event.url, source: event.source } };
    case "notice":
      return { ...state, notice: { text: event.text, tone: event.tone } };
    case "server":
      return reduceMessage(state, event.message);
  }
}

function reduceMessage(state: LobbyState, message: ServerMessage): LobbyState {
  switch (message.t) {
    case "welcome":
      return { ...state, localId: message.playerId };
    case "room":
      return {
        ...state,
        room: message.room,
        queue: null,
        mode: message.room.mode,
      };
    case "room_left":
      return {
        ...state,
        room: null,
        match: null,
        chat: [],
        notice: roomLeftNotice(message.reason),
      };
    case "queue":
      return {
        ...state,
        queue: message.queued
          ? { mode: message.mode, since: message.since }
          : null,
      };
    case "chat":
      return {
        ...state,
        chat: [...state.chat, { name: message.name, text: message.text }].slice(
          -CHAT_HISTORY,
        ),
      };
    case "error":
      return { ...state, notice: { text: message.message, tone: "danger" } };
    case "match_start":
      return { ...state, match: message.match, lastResult: null };
    case "match_end":
      return {
        ...state,
        match: null,
        lastResult: { reason: message.reason, winnerTeam: message.winnerTeam },
      };
    case "peer":
      return { ...state, notice: peerNotice(state, message) };
    case "shutdown":
      return {
        ...state,
        notice: { text: "Server restarting — reconnecting…", tone: "warning" },
      };
    default:
      return state;
  }
}

function roomLeftNotice(
  reason: "left" | "ready_timeout" | "closed",
): LobbyState["notice"] {
  if (reason === "ready_timeout")
    return {
      text: "Ready check missed — you left the match.",
      tone: "warning",
    };
  if (reason === "closed")
    return { text: "The room was closed.", tone: "warning" };
  return null;
}

function peerNotice(
  state: LobbyState,
  message: Extract<ServerMessage, { t: "peer" }>,
): LobbyState["notice"] {
  const name =
    state.room?.players.find((p) => p.id === message.playerId)?.name ??
    "A pilot";
  if (message.status === "disconnected") {
    return {
      text: `${name} disconnected — the AI flies for them (${Math.round(message.graceMs / 1000)} s to return).`,
      tone: "warning",
    };
  }
  if (message.status === "reconnected")
    return { text: `${name} is back.`, tone: "success" };
  return { text: `${name} left the match.`, tone: "warning" };
}

/** @param state - Lobby state. @returns Which screen to show. */
export function lobbyScreen(state: LobbyState): LobbyScreen {
  if (state.room) return "room";
  if (state.connection !== "online") return "offline";
  return state.queue ? "queue" : "menu";
}

/** @param state - Lobby state. @returns This player's seat in the room, if seated. */
export function localPlayer(state: LobbyState): RoomPlayerView | undefined {
  return state.room?.players.find((p) => p.id === state.localId);
}

/**
 * @param state - Lobby state.
 * @param rttMs - Measured round trip.
 * @returns The status-chip text and tone for the connection.
 */
export function connectionStatus(
  state: LobbyState,
  rttMs: number,
): { text: string; tone: NoticeTone } {
  if (!state.server.url)
    return { text: "No online server configured", tone: "warning" };
  switch (state.connection) {
    case "online":
      return { text: `Online · ${Math.round(rttMs)} ms`, tone: "success" };
    case "connecting":
      return { text: "Connecting…", tone: "warning" };
    case "reconnecting":
      return { text: "Connection lost — reconnecting…", tone: "warning" };
    case "unreachable":
      return { text: "Server unreachable", tone: "danger" };
    case "expired":
      return { text: "Session expired — reconnect to play", tone: "warning" };
    case "refused":
      return state.refusal === "version_mismatch"
        ? { text: "Game version out of date — reload the page", tone: "danger" }
        : { text: "Connection refused", tone: "danger" };
    default:
      return { text: "Offline", tone: "neutral" };
  }
}

/**
 * @param state - Lobby state.
 * @returns Why this player cannot ready up yet, or null when they can.
 */
export function readyBlocker(state: LobbyState): string | null {
  const me = localPlayer(state);
  if (!state.room || !me) return "Not in a room";
  if (!me.loadout) return "Pick your ship first";
  if (!me.connected) return "Reconnecting…";
  // Any faction on any team: mirror matches and mixed-faction teams are fine.
  return null;
}

/** @param state - Lobby state. @returns Seats still open in the room. */
export function openSeats(state: LobbyState): number {
  if (!state.room) return 0;
  return MODE_RULES[state.room.mode].maxPlayers - state.room.players.length;
}

/**
 * @param state - Lobby state.
 * @param nowMs - Server-aligned time.
 * @returns Seconds left in the start countdown / quick-match ready check, or null.
 */
export function roomCountdowns(
  state: LobbyState,
  nowMs: number,
): { start: number | null; ready: number | null } {
  const left = (at: number | null): number | null =>
    at === null ? null : Math.max(0, Math.ceil((at - nowMs) / 1000));
  return {
    start: left(state.room?.startsAt ?? null),
    ready: left(state.room?.readyDeadline ?? null),
  };
}
