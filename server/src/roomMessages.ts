/**
 * roomMessages — the client messages RoomService routes to a room or its
 * match, and how a lobby edit is applied to a room.
 */

import type { ClientMessage } from "../../src/net/protocol";
import type { SeatMessage } from "./MatchHost";
import type { Room } from "./Room";
import type { Refusal } from "./roomTypes";

/** Messages handled while the sender sits in a running match. */
export type MatchMessage =
  | SeatMessage
  | Extract<ClientMessage, { t: "leave_match" }>;

/** Lobby edits a member can send. */
export type LobbyEdit = Extract<
  ClientMessage,
  { t: "set_loadout" | "set_team" | "set_options" | "set_ready" }
>;

/**
 * @param room - The room.
 * @param id - The editing player.
 * @param message - The edit.
 * @returns A refusal, or null when applied.
 */
export function applyLobbyEdit(
  room: Room,
  id: string,
  message: LobbyEdit,
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
