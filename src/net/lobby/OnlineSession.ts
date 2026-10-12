/**
 * OnlineSession — the online lobby's controller, outliving any one scene
 * (it sits in the game registry): it owns the NetClient, reduces relay
 * messages into a LobbyState for the lobby UI, exposes the lobby actions,
 * and hands a started match to a LockstepSession for the battle scenes.
 */

import type { NetClient } from "../client/NetClient";
import { LockstepSession } from "../lockstep/LockstepSession";
import type { LockstepEvents } from "../lockstep/types";
import type { ServerUrlSource } from "../onlineConfig";
import {
  normalizeRoomCode,
  type Loadout,
  type MatchMode,
  type ServerMessage,
  type ServerMessageType,
  type TeamId,
} from "../protocol";
import type { Clock } from "../time";
import {
  initialLobbyState,
  reduceLobby,
  type LobbyEvent,
  type LobbyState,
} from "./LobbyModel";
import { localSeatOf } from "./matchSetup";

/** Relay messages the lobby reduces. */
const LOBBY_MESSAGES: readonly ServerMessageType[] = [
  "welcome",
  "room",
  "room_left",
  "queue",
  "chat",
  "error",
  "match_start",
  "match_end",
  "peer",
  "shutdown",
];
/** Relay messages a running match's lockstep session consumes. */
const MATCH_MESSAGES: readonly ServerMessageType[] = [
  "go",
  "in",
  "resync",
  "snapshot_request",
  "snapshot",
  "authority",
  "peer",
  "match_end",
];

/** A lockstep session bound to the relay connection. */
export interface BoundLockstep {
  readonly session: LockstepSession;
  readonly localSeat: number;
  /** Stop forwarding relay messages to the session (scene shutdown). */
  dispose(): void;
}

export class OnlineSession {
  private lobby: LobbyState;
  private readonly listeners = new Set<(state: LobbyState) => void>();

  /**
   * @param client - The relay connection.
   * @param server - Resolved relay URL and its source.
   * @param clock - Time source for the lockstep session.
   */
  constructor(
    readonly client: NetClient,
    server: { url: string | null; source: ServerUrlSource },
    private readonly clock: Clock,
  ) {
    this.lobby = initialLobbyState(server);
    client.onState((state) =>
      this.dispatch({ kind: "connection", state, refusal: client.refusal }),
    );
    for (const type of LOBBY_MESSAGES)
      client.on(type, (message: ServerMessage) =>
        this.dispatch({ kind: "server", message }),
      );
  }

  /** @returns The current lobby state. */
  get state(): LobbyState {
    return this.lobby;
  }

  /** @param listener - Receives every new state. @returns Unsubscribe function. */
  subscribe(listener: (state: LobbyState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Connect (no-op without a configured server). */
  connect(): void {
    if (this.lobby.server.url) this.client.connect();
  }

  /** @param mode - Mode for quick match / new rooms. */
  selectMode(mode: MatchMode): void {
    this.dispatch({ kind: "select_mode", mode });
  }

  /** Queue for a quick match in the selected mode. */
  quickMatch(): void {
    this.client.send({ t: "quick_match", mode: this.lobby.mode });
  }

  /** Leave the quick-match queue. */
  cancelQueue(): void {
    this.client.send({ t: "cancel_queue" });
  }

  /** Open a private room in the selected mode (friends join by its code). */
  createRoom(): void {
    this.client.send({ t: "create_room", mode: this.lobby.mode });
  }

  /** @param code - Room code as typed. @returns False when it is not a valid code. */
  joinRoom(code: string): boolean {
    const normalized = normalizeRoomCode(code);
    return this.client.send({ t: "join_room", code: normalized });
  }

  /** Leave the room (or the running match). */
  leaveRoom(): void {
    this.client.send({ t: "leave_room" });
  }

  /** @param loadout - Ship / squad for the match. */
  setLoadout(loadout: Loadout): void {
    this.client.send({ t: "set_loadout", loadout });
  }

  /** @param team - Team A (0) or B (1). */
  setTeam(team: TeamId): void {
    this.client.send({ t: "set_team", team });
  }

  /** @param ready - Ready flag. */
  setReady(ready: boolean): void {
    this.client.send({ t: "set_ready", ready });
  }

  /** @param scenarioId - Scenario (host, scenario mode). */
  setScenario(scenarioId: string): void {
    this.client.send({ t: "set_options", options: { scenarioId } });
  }

  /** @param text - Chat line. */
  chat(text: string): void {
    this.client.send({ t: "chat", text });
  }

  /** @param text - A local notice for the status line. @param tone - Colour. */
  notify(
    text: string,
    tone: "neutral" | "success" | "warning" | "danger",
  ): void {
    this.dispatch({ kind: "notice", text, tone });
  }

  /** @param url - New relay URL (null = none). @param source - Where it came from. */
  setServer(url: string | null, source: ServerUrlSource): void {
    this.dispatch({ kind: "server_url", url, source });
  }

  /**
   * Battle-scene entry point: a lockstep session for the started match,
   * wired to the relay. Call `session.markLoaded()` once the battle is built.
   *
   * @param options - Edge mask of the input codec and HUD event callbacks.
   * @returns The bound session, or null when no match is running.
   */
  startLockstep(options: {
    edgeMask: number;
    events?: LockstepEvents;
  }): BoundLockstep | null {
    const match = this.lobby.match;
    if (!match) return null;
    const localSeat = localSeatOf(match, this.lobby.localId);
    const session = new LockstepSession({
      match,
      localSeat,
      edgeMask: options.edgeMask,
      clock: this.clock,
      outbox: { send: (message) => this.client.send(message) },
      latency: () => ({
        selfRttMs: this.client.reportedRttMs(),
        peerRttMs: this.peerRtt(),
      }),
      ...(options.events ? { events: options.events } : {}),
    });
    const unsubscribers = MATCH_MESSAGES.map((type) =>
      this.client.on(type, (message: ServerMessage) =>
        session.receive(message),
      ),
    );
    return {
      session,
      localSeat,
      dispose: () => unsubscribers.forEach((off) => off()),
    };
  }

  private peerRtt(): number {
    const others =
      this.lobby.room?.players.filter((p) => p.id !== this.lobby.localId) ?? [];
    return Math.max(0, ...others.map((p) => p.pingMs));
  }

  private dispatch(event: LobbyEvent): void {
    this.lobby = reduceLobby(this.lobby, event);
    this.listeners.forEach((listener) => listener(this.lobby));
  }
}
