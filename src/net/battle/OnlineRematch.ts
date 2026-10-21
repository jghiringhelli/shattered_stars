/**
 * OnlineRematch — the REMATCH button of an online results screen. It casts
 * the relay's rematch vote (the same message the lobby's REMATCH sends),
 * tells the screen who is still deciding, and reports when the relay started
 * the new match, so the scene can enter it exactly like the lobby does.
 * Phaser-free.
 */

import { localPlayer, type LobbyState } from "../lobby/LobbyModel";
import type { OnlineSession } from "../lobby/OnlineSession";

/** Where the rematch vote stands, as the results button shows it. */
export type RematchPhase =
  /** The relay has not ended the match yet: a click is kept until it does. */
  | "waiting_result"
  /** The vote is open and this player has not voted. */
  | "open"
  /** This player voted yes. */
  | "voted"
  /** No rematch can happen (window closed, room gone): the button returns to the room. */
  | "unavailable";

/** What the REMATCH button reads. */
export interface RematchStatus {
  readonly phase: RematchPhase;
  readonly label: string;
  /** Other players who have not voted yes. */
  readonly waitingFor: number;
}

/** What the owning scene does with the vote's outcome. */
export interface RematchCallbacks {
  /** The relay started another match: enter it. */
  readonly onNewMatch: () => void;
  /** No rematch is possible: go back to the room instead. */
  readonly onFallback: () => void;
}

/**
 * @param state - The lobby state (the session keeps it current during battles).
 * @param requested - Whether this player asked for a rematch already.
 * @returns The vote's phase and the button label.
 */
export function rematchStatus(
  state: LobbyState,
  requested: boolean,
): RematchStatus {
  const room = state.room;
  if (!room) return status("unavailable", "Back to room");
  if (!room.rematch) {
    if (state.match)
      return status("waiting_result", requested ? "Rematch queued" : "Rematch");
    return status("unavailable", "Back to room");
  }
  const me = localPlayer(state);
  if (!me?.ready) return status("open", "Rematch");
  const waitingFor = room.players.filter(
    (p) => p.id !== state.localId && !p.ready,
  ).length;
  if (waitingFor === 0) return status("voted", "Starting…");
  // Short enough for the results button (the number is how many players are still deciding).
  return status("voted", `Waiting for ${waitingFor}`, waitingFor);
}

function status(
  phase: RematchPhase,
  label: string,
  waitingFor = 0,
): RematchStatus {
  return { phase, label, waitingFor };
}

export class OnlineRematch {
  private requested = false;
  /** A click made before the relay opened the vote, cast as soon as it opens. */
  private deferred = false;
  private started = false;
  private disposed = false;
  private readonly watchers = new Set<(status: RematchStatus) => void>();
  private readonly unsubscribe: () => void;

  /**
   * @param session - The game's OnlineSession (its lobby state outlives the battle scene).
   * @param playedMatchId - The match whose results are on screen.
   * @param callbacks - New match / fallback to the room.
   */
  constructor(
    private readonly session: OnlineSession,
    private readonly playedMatchId: string,
    private readonly callbacks: RematchCallbacks,
  ) {
    this.unsubscribe = session.subscribe((state) => this.onState(state));
  }

  /** @returns The button's current phase and label. */
  get status(): RematchStatus {
    return rematchStatus(this.session.state, this.requested);
  }

  /**
   * @param apply - Called now and on every change with the status.
   * @returns Stops watching.
   */
  watch(apply: (status: RematchStatus) => void): () => void {
    this.watchers.add(apply);
    apply(this.status);
    return () => this.watchers.delete(apply);
  }

  /** The player pressed REMATCH: vote yes, withdraw, or (no vote possible) return to the room. */
  click(): void {
    if (this.disposed) return;
    const { phase } = this.status;
    if (phase === "unavailable") {
      this.callbacks.onFallback();
      return;
    }
    this.requested = !this.requested;
    if (phase === "waiting_result") this.deferred = this.requested;
    else this.session.rematch(this.requested);
    this.notify();
  }

  /** Stop listening (scene shutdown). */
  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    this.watchers.clear();
  }

  private onState(state: LobbyState): void {
    if (this.disposed) return;
    const next = state.match;
    if (next && next.matchId !== this.playedMatchId && !this.started) {
      this.started = true;
      this.callbacks.onNewMatch();
      return;
    }
    if (this.deferred && this.status.phase === "open") {
      this.deferred = false;
      this.session.rematch(true);
    }
    this.notify();
  }

  private notify(): void {
    const current = this.status;
    for (const apply of this.watchers) apply(current);
  }
}
