/**
 * RoomRoster — who sits in a room: seats, default teams, the host (the lowest
 * seat inherits the role) and per-member connection / ping state.
 */

import type { MatchMode } from "../../src/net/protocol";
import { defaultTeam, freeSeat } from "./roomSeats";
import type { Member } from "./roomTypes";

/** Ping change (ms) worth re-broadcasting the room view for. */
const PING_BROADCAST_DELTA_MS = 10;

export class RoomRoster {
  hostId = "";
  private readonly members = new Map<string, Member>();

  /** @param mode - The room's mode (decides default teams). */
  constructor(private readonly mode: MatchMode) {}

  /** @returns Seats taken. */
  get size(): number {
    return this.members.size;
  }

  /** @returns Members ordered by seat. */
  list(): Member[] {
    return [...this.members.values()].sort((a, b) => a.seat - b.seat);
  }

  /** @param id - Player id. @returns The member, if seated. */
  get(id: string): Member | undefined {
    return this.members.get(id);
  }

  /** @returns Player ids of everyone seated. */
  ids(): string[] {
    return [...this.members.keys()];
  }

  /**
   * @param id - Player id.
   * @param name - Display name.
   * @param pingMs - Last known round trip.
   * @returns The new member (the first one becomes host).
   */
  seat(id: string, name: string, pingMs: number): Member {
    const seat = freeSeat(this.members.values());
    const member: Member = {
      id,
      name,
      seat,
      team: defaultTeam(this.mode, seat, this.members.values()),
      loadout: null,
      ready: false,
      connected: true,
      pingMs,
    };
    this.members.set(id, member);
    if (!this.hostId) this.hostId = id;
    return member;
  }

  /** @param id - Player id leaving (host passes to the lowest seat). */
  remove(id: string): void {
    this.members.delete(id);
    if (this.hostId === id) this.hostId = this.list()[0]?.id ?? "";
  }

  /** Withdraw every ready flag. */
  unreadyAll(): void {
    for (const member of this.members.values()) member.ready = false;
  }

  /**
   * @param id - Player id.
   * @param pingMs - Reported round trip.
   * @returns Whether the change is worth a broadcast.
   */
  setPing(id: string, pingMs: number): boolean {
    const member = this.members.get(id);
    if (!member) return false;
    const changed = Math.abs(member.pingMs - pingMs) >= PING_BROADCAST_DELTA_MS;
    member.pingMs = Math.round(pingMs);
    return changed;
  }
}
