/**
 * roomView — the room as its members see it (RoomView of the protocol). Pure.
 */

import {
  MODE_RULES,
  type MatchMode,
  type RoomOptions,
  type RoomPhase,
  type RoomView,
} from "../../src/net/protocol";
import type { Member } from "./roomTypes";

/** Everything the view reads from a room. */
export interface RoomViewSource {
  readonly code: string;
  readonly mode: MatchMode;
  readonly quickMatch: boolean;
  readonly options: RoomOptions;
  readonly hostId: string;
  readonly phase: RoomPhase;
  readonly readyDeadline: number | null;
  readonly startsAt: number | null;
  /** When the open rematch window closes; null when no rematch is open. */
  readonly rematchClosesAt: number | null;
  /** Members ordered by seat. */
  readonly members: readonly Member[];
}

/** @param source - The room's state. @returns The view sent to every member. */
export function buildRoomView(source: RoomViewSource): RoomView {
  const rules = MODE_RULES[source.mode];
  return {
    code: source.code,
    mode: source.mode,
    options: source.options,
    hostId: source.hostId,
    phase: source.phase,
    maxPlayers: rules.maxPlayers,
    readyDeadline: source.readyDeadline,
    startsAt: source.startsAt,
    quickMatch: source.quickMatch,
    pointLimit: rules.pointLimit,
    rematch:
      source.rematchClosesAt !== null
        ? { closesAt: source.rematchClosesAt }
        : null,
    players: source.members.map((m) => ({
      id: m.id,
      name: m.name,
      seat: m.seat,
      team: m.team,
      loadout: m.loadout,
      ready: m.ready,
      pingMs: m.pingMs,
      connected: m.connected,
      isHost: m.id === source.hostId,
    })),
  };
}
