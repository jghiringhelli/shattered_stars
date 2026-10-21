/**
 * MatchHost — the matches running in rooms: starting one from a room, routing
 * a seat's in-match messages to its MatchRelay, ending it (result broadcast,
 * back to the lobby, rematch window) and remembering the `match_end` a
 * disconnected player missed. Rooms themselves stay with RoomService.
 */

import type { ClientMessage, ServerMessage } from "../../src/net/protocol";
import { buildMatchStart } from "./matchDefinition";
import { MatchRelay } from "./MatchRelay";
import type { Room } from "./Room";
import type { RelayDeps, Session } from "./types";

/** Range of battle seeds (unsigned 32-bit). */
const SEED_RANGE = 0x1_0000_0000;

/** Messages a seated player sends to its running match (leaving is the room's business). */
export type SeatMessage = Extract<
  ClientMessage,
  { t: "loaded" | "in" | "hash" | "snapshot" | "match_over" }
>;

export class MatchHost {
  private readonly matches = new Map<string, MatchRelay>();
  private matchCounter = 0;
  /** `match_end` a disconnected player missed (delivered when they resume). */
  private readonly missedEnds = new Map<string, ServerMessage>();

  /**
   * @param deps - Scheduler, randomness, logger, config.
   * @param sessionOf - Looks a player's session up by id.
   * @param onRoomEmpty - A match ended in a room nobody is left in.
   */
  constructor(
    private readonly deps: RelayDeps,
    private readonly sessionOf: (playerId: string) => Session | undefined,
    private readonly onRoomEmpty: (room: Room) => void,
  ) {}

  /** @returns Hash mismatches across all running matches. */
  desyncs(): number {
    let total = 0;
    for (const match of this.matches.values()) total += match.desyncCount;
    return total;
  }

  /** @returns Matches running now. */
  matchCount(): number {
    return this.matches.size;
  }

  /** @param room - A room whose countdown elapsed. */
  start(room: Room): void {
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
      onEnded: (reason, winnerTeam) => this.end(room, reason, winnerTeam),
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

  /** @param room - A room. @param playerId - A player. @returns Their seat in the room's running match, or null. */
  seatOf(room: Room, playerId: string): number | null {
    const match = this.matches.get(room.setup.code);
    return match?.start.seats.find((s) => s.playerId === playerId)?.seat ?? null;
  }

  /** @param room - A room. @param message - An in-match message from a seated player. @param playerId - Sender. */
  route(room: Room, playerId: string, message: SeatMessage): void {
    const match = this.matches.get(room.setup.code);
    const seat = this.seatOf(room, playerId);
    if (!match || seat === null) return;
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
    }
  }

  /** @param room - A room. @param playerId - A player leaving for good: the AI keeps flying the seat. */
  leaveSeat(room: Room, playerId: string): void {
    const seat = this.seatOf(room, playerId);
    if (seat !== null) this.matches.get(room.setup.code)?.leave(seat);
  }

  /** @param room - A room. @param playerId - A player whose socket dropped. */
  disconnectSeat(room: Room, playerId: string): void {
    const seat = this.seatOf(room, playerId);
    if (seat !== null) this.matches.get(room.setup.code)?.disconnect(seat);
  }

  /** @param session - A player back within the window: hand them the result they missed, if any. */
  deliverMissedEnd(session: Session): void {
    const missed = this.missedEnds.get(session.id);
    this.missedEnds.delete(session.id);
    if (missed) session.connection?.send(missed);
  }

  /** @param room - Their room. @param session - A returning player: re-seat them in the running match, if any. */
  rejoin(room: Room, session: Session): void {
    const match = this.matches.get(room.setup.code);
    const seat = this.seatOf(room, session.id);
    if (!match || seat === null) return;
    match.reconnect(seat);
    session.connection?.send({
      t: "match_start",
      match: match.start,
      resume: true,
    });
  }

  /** @param playerId - A player who left: drop the result they would have been given. */
  forgetMissedEnd(playerId: string): void {
    this.missedEnds.delete(playerId);
  }

  /** @param room - A room closing: stop its match. */
  dispose(room: Room): void {
    this.matches.get(room.setup.code)?.dispose();
    this.matches.delete(room.setup.code);
  }

  private end(
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
    if (room.isEmpty()) this.onRoomEmpty(room);
    else room.broadcastView();
    this.deps.logger.info("match ended", {
      room: room.setup.code,
      reason,
      desyncs: relay?.desyncCount ?? 0,
    });
  }

  private sendTo(playerId: string, message: ServerMessage): void {
    this.sessionOf(playerId)?.connection?.send(message);
  }
}
