/**
 * RoomService — every room-level request: create / join by code, quick
 * match, loadouts, teams, options, the ready check, chat, starting a match
 * and the match's in-game messages. Sessions come from RelayCore.
 */

import {
  type ClientMessage,
  type ErrorCode,
  type MatchMode,
  type ServerMessage,
} from "../../src/net/protocol";
import { buildMatchStart } from "./matchDefinition";
import { MatchRelay } from "./MatchRelay";
import { Matchmaker } from "./Matchmaker";
import { Room, type JoinRefusal, type Refusal } from "./Room";
import { generateRoomCode } from "./roomCodes";
import type { RelayDeps, Session } from "./types";

/** Range of battle seeds (unsigned 32-bit). */
const SEED_RANGE = 0x1_0000_0000;

/** What a refused seat request tells the player. */
const JOIN_REFUSALS: Readonly<Record<JoinRefusal, string>> = {
  room_full: "That room is full.",
  room_started: "That match already started.",
};

/** Messages handled while the sender sits in a running match. */
type MatchMessage = Extract<
  ClientMessage,
  { t: "loaded" | "in" | "hash" | "snapshot" | "match_over" | "leave_match" }
>;

export class RoomService {
  private readonly rooms = new Map<string, Room>();
  private readonly matches = new Map<string, MatchRelay>();
  private readonly matchmaker = new Matchmaker();
  private matchCounter = 0;
  /** `match_end` a disconnected player missed (delivered when they resume). */
  private readonly missedEnds = new Map<string, ServerMessage>();

  /**
   * @param deps - Scheduler, randomness, logger, config.
   * @param sessionOf - Looks a player's session up by id.
   */
  constructor(
    private readonly deps: RelayDeps,
    private readonly sessionOf: (playerId: string) => Session | undefined,
  ) {}

  /** @param session - Requester. @param mode - Room mode. */
  create(session: Session, mode: MatchMode): void {
    if (this.roomsFull(session))
      return this.error(
        session,
        "server_busy",
        "Too many rooms open; try again shortly.",
      );
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
    if (this.roomsFull(session))
      return this.error(
        session,
        "server_busy",
        "Too many rooms open; try again shortly.",
      );
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
    this.missedEnds.delete(session.id);
    const room = session.roomCode
      ? this.rooms.get(session.roomCode)
      : undefined;
    session.roomCode = null;
    if (!room) return;
    const seat = this.seatInMatch(room, session.id);
    if (seat !== null) this.matches.get(room.setup.code)?.leave(seat);
    room.remove(session.id);
    this.send(session, { t: "room_left", reason });
    if (room.isEmpty()) {
      this.closeRoom(room);
      return;
    }
    room.broadcastView();
    if (reason === "left") this.requeueOrphans(room);
  }

  /** @param session - Sender. @param message - A lobby edit (loadout, team, options, ready). */
  edit(
    session: Session,
    message: Extract<
      ClientMessage,
      { t: "set_loadout" | "set_team" | "set_options" | "set_ready" }
    >,
  ): void {
    const room = this.roomOf(session);
    if (!room)
      return this.error(session, "not_in_room", "You are not in a room.");
    const refusal = this.applyEdit(room, session.id, message);
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
    const match = room ? this.matches.get(room.setup.code) : undefined;
    const seat = room ? this.seatInMatch(room, session.id) : null;
    if (!room || !match || seat === null) return;
    switch (message.t) {
      case "loaded":
        return match.loaded(seat);
      case "in":
        return match.inputs(seat, message);
      case "hash":
        return match.hash(seat, message.tick, message.hash);
      case "snapshot":
        return match.snapshot(seat, message.tick, message.data);
      case "match_over":
        return match.matchOver(seat, message.winnerTeam);
      case "leave_match":
        return this.leave(session);
    }
  }

  /** @param session - Player whose socket dropped. */
  disconnected(session: Session): void {
    this.matchmaker.remove(session.id);
    const room = this.roomOf(session);
    if (!room) return;
    room.setConnected(session.id, false);
    const seat = this.seatInMatch(room, session.id);
    if (seat !== null) this.matches.get(room.setup.code)?.disconnect(seat);
    room.broadcastView();
  }

  /** @param session - Player back within the window: re-send the room and, mid-match, the match. */
  reconnected(session: Session): void {
    const room = this.roomOf(session);
    if (!room) return;
    room.setConnected(session.id, true);
    const missed = this.missedEnds.get(session.id);
    this.missedEnds.delete(session.id);
    if (missed) this.send(session, missed);
    room.broadcastView();
    const match = this.matches.get(room.setup.code);
    const seat = this.seatInMatch(room, session.id);
    if (!match || seat === null) return;
    match.reconnect(seat);
    this.send(session, { t: "match_start", match: match.start, resume: true });
  }

  /** @param session - Reporter. @param rttMs - Its round trip. */
  ping(session: Session, rttMs: number): void {
    session.rttMs = rttMs;
    const room = this.roomOf(session);
    if (room?.setPing(session.id, rttMs)) room.broadcastView();
  }

  /** @returns Counts for the health endpoint. */
  stats(): { rooms: number; matches: number; queued: number; desyncs: number } {
    let desyncs = 0;
    for (const match of this.matches.values()) desyncs += match.desyncCount;
    return {
      rooms: this.rooms.size,
      matches: this.matches.size,
      queued: this.matchmaker.size(),
      desyncs,
    };
  }

  private applyEdit(
    room: Room,
    id: string,
    message: Parameters<RoomService["edit"]>[1],
  ): Refusal | null {
    switch (message.t) {
      case "set_loadout":
        return room.setLoadout(id, message.loadout);
      case "set_team":
        return room.setTeam(id, message.team);
      case "set_options":
        return room.setOptions(id, message.options);
      case "set_ready":
        return room.setReady(id, message.ready);
    }
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
        onCountdownDone: (r) => this.startMatch(r),
        onReadyTimeout: (r, unready) => this.expireReadyCheck(r, unready),
        onRematchExpired: (r) => this.expireRematch(r),
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

  private startMatch(room: Room): void {
    const members = room.list();
    const match = buildMatchStart({
      matchId: `${room.setup.code}-${++this.matchCounter}`,
      seed: this.deps.random.int(SEED_RANGE),
      mode: room.setup.mode,
      options: room.options,
      members,
    });
    room.beginPlaying();
    const relay = new MatchRelay(match, this.deps.scheduler, this.deps.config, {
      sendToSeat: (seat, message) =>
        this.sendTo(match.seats[seat]?.playerId ?? "", message),
      onEnded: (reason, winnerTeam) => this.endMatch(room, reason, winnerTeam),
    });
    this.matches.set(room.setup.code, relay);
    room.broadcast({ t: "match_start", match, resume: false });
    room.broadcastView();
    this.deps.logger.info("match started", {
      room: room.setup.code,
      mode: match.mode,
      seats: members.length,
      delay: match.inputDelay,
    });
  }

  private endMatch(
    room: Room,
    reason: "finished" | "abandoned",
    winnerTeam: 0 | 1 | null,
  ): void {
    const relay = this.matches.get(room.setup.code);
    this.matches.delete(room.setup.code);
    const ended: ServerMessage = { t: "match_end", reason, winnerTeam };
    room.broadcast(ended);
    // Members whose socket is down get the result when they come back.
    for (const member of room.list())
      if (!this.sessionOf(member.id)?.connection)
        this.missedEnds.set(member.id, ended);
    room.endPlaying(reason === "finished");
    if (room.isEmpty()) this.closeRoom(room);
    else room.broadcastView();
    this.deps.logger.info("match ended", {
      room: room.setup.code,
      reason,
      desyncs: relay?.desyncCount ?? 0,
    });
  }

  private expireReadyCheck(room: Room, unready: readonly string[]): void {
    const requeue = room
      .list()
      .filter((m) => !unready.includes(m.id))
      .map((m) => m.id);
    for (const id of unready) {
      const session = this.sessionOf(id);
      if (session) this.leave(session, "ready_timeout");
    }
    for (const id of requeue) {
      const session = this.sessionOf(id);
      if (session) this.quickMatch(session, room.setup.mode);
    }
  }

  private expireRematch(room: Room): void {
    if (!room.setup.quickMatch) return room.broadcastView();
    // A quick-match room is ephemeral: nobody replayed, so it dissolves.
    for (const member of room.list()) {
      const session = this.sessionOf(member.id);
      if (session) this.leave(session, "rematch_expired");
    }
  }

  /** A quick-match opponent left before the match: the rest search for a new one. */
  private requeueOrphans(room: Room): void {
    if (!room.setup.quickMatch || room.hasPlayed || room.phase === "playing")
      return;
    for (const member of room.list()) {
      const session = this.sessionOf(member.id);
      if (!session) continue;
      this.leave(session, "closed");
      this.quickMatch(session, room.setup.mode);
    }
  }

  private roomsFull(session: Session): boolean {
    if (this.rooms.size < this.deps.config.maxRooms) return false;
    // Leaving the only seat of a room frees that room for the new one.
    return this.roomOf(session)?.list().length !== 1;
  }

  private closeRoom(room: Room): void {
    room.dispose();
    this.matches.get(room.setup.code)?.dispose();
    this.matches.delete(room.setup.code);
    this.rooms.delete(room.setup.code);
  }

  private seatInMatch(room: Room, playerId: string): number | null {
    const match = this.matches.get(room.setup.code);
    return (
      match?.start.seats.find((s) => s.playerId === playerId)?.seat ?? null
    );
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

  private error(session: Session, code: ErrorCode, message: string): void {
    this.send(session, { t: "error", code, message });
  }
}
