/**
 * RoomService — every room-level request: create / join by code, quick
 * match, loadouts, teams, options, the ready check, chat and routing a
 * seated player's in-game messages to MatchHost. Sessions come from RelayCore.
 */

import type {
  ErrorCode,
  MatchMode,
  ServerMessage,
} from "../../src/net/protocol";
import { MatchHost } from "./MatchHost";
import { Matchmaker } from "./Matchmaker";
import { Room } from "./Room";
import { generateRoomCode } from "./roomCodes";
import {
  expireReadyCheck,
  expireRematch,
  requeueOrphans,
  type LifecycleActions,
} from "./roomLifecycle";
import {
  applyLobbyEdit,
  type LobbyEdit,
  type MatchMessage,
} from "./roomMessages";
import type { JoinRefusal } from "./roomTypes";
import type { RelayDeps, Session } from "./types";

/** What a refused seat request tells the player. */
const JOIN_REFUSALS: Readonly<Record<JoinRefusal, string>> = {
  room_full: "That room is full.",
  room_started: "That match already started.",
};


export class RoomService {
  private readonly rooms = new Map<string, Room>();
  private readonly matchmaker = new Matchmaker();
  private readonly host: MatchHost;
  private readonly lifecycle: LifecycleActions = {
    sessionOf: (id) => this.sessionOf(id),
    leave: (session, reason) => this.leave(session, reason),
    quickMatch: (session, mode) => this.quickMatch(session, mode),
  };

  /**
   * @param deps - Scheduler, randomness, logger, config.
   * @param sessionOf - Looks a player's session up by id.
   */
  constructor(
    private readonly deps: RelayDeps,
    private readonly sessionOf: (playerId: string) => Session | undefined,
  ) {
    this.host = new MatchHost(deps, sessionOf, (room) => this.closeRoom(room));
  }

  /** @param session - Requester. @param mode - Room mode. */
  create(session: Session, mode: MatchMode): void {
    if (this.roomsFull(session)) return this.busy(session);
    this.leave(session);
    const room = this.openRoom(mode, session.build, false);
    this.seat(session, room);
  }

  /** @param session - Requester. @param code - Normalized room code. */
  join(session: Session, code: string): void {
    const room = this.rooms.get(code);
    if (!room)
      return this.error(
        session,
        "room_not_found",
        `No room with code ${code}.`,
      );
    if (room.setup.build !== session.build)
      return this.error(
        session,
        "build_mismatch",
        "That room runs a different game version.",
      );
    if (session.roomCode === code)
      return this.send(session, { t: "room", room: room.view() });
    // Refuse before leaving: a failed join must not cost the player their current room.
    const refusal = room.joinRefusal();
    if (refusal) return this.error(session, refusal, JOIN_REFUSALS[refusal]);
    this.leave(session);
    this.seat(session, room);
  }

  /** @param session - Requester. @param mode - Mode to queue for. */
  quickMatch(session: Session, mode: MatchMode): void {
    if (this.roomsFull(session)) return this.busy(session);
    this.leave(session);
    const group = this.matchmaker.enqueue(
      session.id,
      { mode, build: session.build },
      this.deps.scheduler.now(),
    );
    if (!group)
      return this.send(session, {
        t: "queue",
        mode,
        queued: true,
        since: this.deps.scheduler.now(),
      });
    const room = this.openRoom(mode, session.build, true);
    for (const id of group) {
      const member = this.sessionOf(id);
      if (member) this.seat(member, room);
    }
  }

  /** @param session - Requester leaving the quick-match queue. */
  cancelQueue(session: Session): void {
    const mode = this.matchmaker.remove(session.id);
    if (mode) this.send(session, { t: "queue", mode, queued: false, since: 0 });
  }

  /** @param session - Player leaving their room / queue (no-op when in neither). */
  leave(
    session: Session,
    reason: "left" | "ready_timeout" | "closed" | "rematch_expired" = "left",
  ): void {
    this.matchmaker.remove(session.id);
    this.host.forgetMissedEnd(session.id);
    const room = this.roomOf(session);
    session.roomCode = null;
    if (!room) return;
    this.host.leaveSeat(room, session.id);
    room.remove(session.id);
    this.send(session, { t: "room_left", reason });
    if (room.isEmpty()) {
      this.closeRoom(room);
      return;
    }
    room.broadcastView();
    if (reason === "left") requeueOrphans(this.lifecycle, room);
  }

  /** @param session - Sender. @param message - A lobby edit (loadout, team, options, ready). */
  edit(session: Session, message: LobbyEdit): void {
    const room = this.roomOf(session);
    if (!room)
      return this.error(session, "not_in_room", "You are not in a room.");
    const refusal = applyLobbyEdit(room, session.id, message);
    if (refusal) return this.error(session, refusal.code, refusal.message);
    room.broadcastView();
  }

  /** @param session - Sender. @param vote - Replay the match that just ended (yes / no). */
  rematch(session: Session, vote: boolean): void {
    const room = this.roomOf(session);
    if (!room)
      return this.error(session, "not_in_room", "You are not in a room.");
    const refusal = room.voteRematch(session.id, vote);
    if (refusal) return this.error(session, refusal.code, refusal.message);
    room.broadcastView();
  }

  /** @param session - Sender. @param text - Validated chat text. */
  chat(session: Session, text: string): void {
    this.roomOf(session)?.broadcast({
      t: "chat",
      from: session.id,
      name: session.name,
      text,
    });
  }

  /** @param session - Sender. @param message - An in-match message. */
  matchMessage(session: Session, message: MatchMessage): void {
    const room = this.roomOf(session);
    if (!room || this.host.seatOf(room, session.id) === null) return;
    if (message.t === "leave_match") return this.leave(session);
    this.host.route(room, session.id, message);
  }

  /** @param session - Player whose socket dropped. */
  disconnected(session: Session): void {
    this.matchmaker.remove(session.id);
    const room = this.roomOf(session);
    if (!room) return;
    room.setConnected(session.id, false);
    this.host.disconnectSeat(room, session.id);
    room.broadcastView();
  }

  /** @param session - Player back within the window: re-send the room and, mid-match, the match. */
  reconnected(session: Session): void {
    const room = this.roomOf(session);
    if (!room) return;
    room.setConnected(session.id, true);
    this.host.deliverMissedEnd(session);
    room.broadcastView();
    this.host.rejoin(room, session);
  }

  /** @param session - Reporter. @param rttMs - Its round trip. */
  ping(session: Session, rttMs: number): void {
    session.rttMs = rttMs;
    const room = this.roomOf(session);
    if (room?.setPing(session.id, rttMs)) room.broadcastView();
  }

  /** @returns Counts for the health endpoint. */
  stats(): { rooms: number; matches: number; queued: number; desyncs: number } {
    return {
      rooms: this.rooms.size,
      matches: this.host.matchCount(),
      queued: this.matchmaker.size(),
      desyncs: this.host.desyncs(),
    };
  }


  private openRoom(mode: MatchMode, build: string, quickMatch: boolean): Room {
    const { config, scheduler, random } = this.deps;
    const code = generateRoomCode(
      (n) => random.int(n),
      (c) => this.rooms.has(c),
    );
    const room = new Room(
      {
        code,
        mode,
        build,
        quickMatch,
        countdownMs: config.startCountdownMs,
        readyWindowMs: config.quickMatchReadyMs,
        rematchWindowMs: config.rematchWindowMs,
      },
      scheduler,
      {
        send: (id, message) => this.sendTo(id, message),
        onCountdownDone: (r) => this.host.start(r),
        onReadyTimeout: (r, unready) =>
          expireReadyCheck(this.lifecycle, r, unready),
        onRematchExpired: (r) => expireRematch(this.lifecycle, r),
      },
    );
    this.rooms.set(code, room);
    return room;
  }

  private seat(session: Session, room: Room): void {
    const error = room.add(session.id, session.name, session.rttMs);
    if (error) return this.error(session, error, JOIN_REFUSALS[error]);
    session.roomCode = room.setup.code;
    room.broadcastView();
  }


  private roomsFull(session: Session): boolean {
    if (this.rooms.size < this.deps.config.maxRooms) return false;
    // Leaving the only seat of a room frees that room for the new one.
    return this.roomOf(session)?.list().length !== 1;
  }

  private closeRoom(room: Room): void {
    room.dispose();
    this.host.dispose(room);
    this.rooms.delete(room.setup.code);
  }

  private roomOf(session: Session): Room | undefined {
    return session.roomCode ? this.rooms.get(session.roomCode) : undefined;
  }

  private sendTo(playerId: string, message: ServerMessage): void {
    this.sessionOf(playerId)?.connection?.send(message);
  }

  private send(session: Session, message: ServerMessage): void {
    session.connection?.send(message);
  }

  private busy(session: Session): void {
    this.error(session, "server_busy", "Too many rooms open; try again shortly.");
  }

  private error(session: Session, code: ErrorCode, message: string): void {
    this.send(session, { t: "error", code, message });
  }
}
