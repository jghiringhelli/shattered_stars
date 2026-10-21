/**
 * roomLifecycle — what happens to the players of a room when one of its
 * clocks runs out or a quick-match opponent leaves: the ready check expires,
 * the rematch window closes unused, an orphaned quick-match room re-queues.
 */

import type { MatchMode } from "../../src/net/protocol";
import type { Room } from "./Room";
import type { Session } from "./types";

/** The room-level actions the lifecycle rules use (RoomService provides them). */
export interface LifecycleActions {
  sessionOf(playerId: string): Session | undefined;
  leave(
    session: Session,
    reason: "ready_timeout" | "closed" | "rematch_expired",
  ): void;
  quickMatch(session: Session, mode: MatchMode): void;
}

/**
 * A quick-match ready check expired: players who never readied leave, the
 * rest search for a new opponent.
 *
 * @param actions - Room-level actions.
 * @param room - The room.
 * @param unready - Players who never readied.
 */
export function expireReadyCheck(
  actions: LifecycleActions,
  room: Room,
  unready: readonly string[],
): void {
  const requeue = room
    .list()
    .filter((m) => !unready.includes(m.id))
    .map((m) => m.id);
  for (const id of unready) {
    const session = actions.sessionOf(id);
    if (session) actions.leave(session, "ready_timeout");
  }
  for (const id of requeue) {
    const session = actions.sessionOf(id);
    if (session) actions.quickMatch(session, room.setup.mode);
  }
}

/**
 * The rematch window closed unused: a quick-match room is ephemeral and
 * dissolves, a private room just drops the vote.
 *
 * @param actions - Room-level actions.
 * @param room - The room.
 */
export function expireRematch(actions: LifecycleActions, room: Room): void {
  if (!room.setup.quickMatch) return room.broadcastView();
  for (const member of room.list()) {
    const session = actions.sessionOf(member.id);
    if (session) actions.leave(session, "rematch_expired");
  }
}

/**
 * A quick-match opponent left before the match: the rest search for a new one.
 *
 * @param actions - Room-level actions.
 * @param room - The room.
 */
export function requeueOrphans(actions: LifecycleActions, room: Room): void {
  if (!room.setup.quickMatch || room.hasPlayed || room.phase === "playing")
    return;
  for (const member of room.list()) {
    const session = actions.sessionOf(member.id);
    if (!session) continue;
    actions.leave(session, "closed");
    actions.quickMatch(session, room.setup.mode);
  }
}
