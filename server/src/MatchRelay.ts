/**
 * MatchRelay — the authoritative relay of one running lockstep match.
 *
 * - Inputs (InputRelay): accepts each seat's stream only in tick order, caps
 *   how far a seat may run ahead and fills absent seats (disconnected, left,
 *   never loaded) with the AI input so nobody stalls.
 * - Hashes and resync (ResyncController): a state-hash mismatch ships the
 *   authority's snapshot to the out-of-sync seats; reconnection reuses it.
 * - Result: the relay cannot simulate the battle, so it ends the match with
 *   the winner a strict majority of the connected human seats reported
 *   (matchResult.ts); without that agreement the match ends without a result.
 */

import type {
  ClientInputMessage,
  MatchStart,
  ServerMessage,
  TeamId,
} from "../../src/net/protocol";
import type { Scheduler, TimerHandle } from "../../src/net/time";
import { InputRelay } from "./InputRelay";
import { decideResult } from "./matchResult";
import {
  isPresent,
  MATCH_OVER_GRACE_MS,
  type MatchRelayHooks,
  type MatchRelayTimings,
  type SeatState,
} from "./matchRelayTypes";
import {
  ResyncController,
  RESYNC_COOLDOWN_MS,
  RESYNC_MAX_ATTEMPTS,
  RESYNC_TIMEOUT_MS,
} from "./ResyncController";
import { SeatLog } from "./SeatLog";

export {
  MATCH_OVER_GRACE_MS,
  type MatchRelayHooks,
  type MatchRelayTimings,
} from "./matchRelayTypes";
export { RESYNC_COOLDOWN_MS, RESYNC_MAX_ATTEMPTS, RESYNC_TIMEOUT_MS };

export class MatchRelay {
  phase: "loading" | "running" | "ended" = "loading";
  private readonly seats: SeatState[];
  private readonly input: InputRelay;
  private readonly resync: ResyncController;
  private loadTimer: TimerHandle | null;
  private overTimer: TimerHandle | null = null;

  /**
   * @param start - The match as clients received it.
   * @param scheduler - Timer source.
   * @param timings - Load timeout and reconnection window.
   * @param hooks - Relay-core callbacks.
   */
  constructor(
    readonly start: MatchStart,
    private readonly scheduler: Scheduler,
    private readonly timings: MatchRelayTimings,
    private readonly hooks: MatchRelayHooks,
  ) {
    this.seats = start.seats.map((s) => ({
      seat: s.seat,
      log: new SeatLog(start.inputDelay),
      connected: true,
      loaded: false,
      left: false,
      acks: start.seats.map(() => start.inputDelay),
      holdInputs: false,
      report: null,
    }));
    const running = (): boolean => this.phase === "running";
    this.input = new InputRelay(this.seats, hooks, running);
    this.resync = new ResyncController(
      {
        seats: this.seats,
        hooks,
        scheduler,
        input: this.input,
        isRunning: running,
        abandon: () => this.end("abandoned", null),
      },
      start.authoritySeat,
    );
    this.loadTimer = scheduler.setTimeout(
      () => this.go(),
      timings.loadTimeoutMs,
    );
  }

  /** @returns The seat that answers snapshot requests. */
  get authority(): number {
    return this.resync.authority;
  }

  /** @returns Hash mismatches seen so far. */
  get desyncCount(): number {
    return this.resync.desyncCount;
  }

  /** @param seat - A seat whose client finished loading the battle. */
  loaded(seat: number): void {
    const s = this.seats[seat];
    if (!s || s.left || !s.connected || this.phase === "ended") return;
    // A seat already in the match asks for nothing: only a rejoining seat re-sends `loaded`.
    if (this.phase === "running" && s.loaded) return;
    s.loaded = true;
    if (this.phase === "loading") {
      if (this.seats.every((x) => x.left || !x.connected || x.loaded))
        this.go();
      return;
    }
    this.hooks.sendToSeat(seat, { t: "go", serverTime: this.scheduler.now() });
    s.holdInputs = true;
    this.resync.request([seat], "reconnect");
  }

  /** @param seat - Sender. @param message - Its input batch. */
  inputs(seat: number, message: ClientInputMessage): void {
    this.input.accept(seat, message);
  }

  /** @param seat - Reporter. @param tick - Hashed tick. @param hash - State hash. */
  hash(seat: number, tick: number, hash: number): void {
    this.resync.hash(seat, tick, hash);
  }

  /** @param seat - Sender (must be the authority). @param tick - Snapshot tick. @param data - Serialized state. */
  snapshot(seat: number, tick: number, data: string): void {
    this.resync.snapshot(seat, tick, data);
  }

  /** @param seat - Seat whose socket dropped (their reconnection window starts). */
  disconnect(seat: number): void {
    const s = this.seats[seat];
    if (!s || s.left || !s.connected) return;
    s.connected = false;
    s.loaded = false;
    this.broadcastPeer(seat, "disconnected", this.timings.reconnectWindowMs);
    this.afterSeatLost();
  }

  /** @param seat - Seat whose player is back (they must send `loaded` again). */
  reconnect(seat: number): void {
    const s = this.seats[seat];
    if (!s || s.left || s.connected) return;
    s.connected = true;
    this.broadcastPeer(seat, "reconnected", 0);
  }

  /** @param seat - Seat leaving for good: the AI keeps flying it. */
  leave(seat: number): void {
    const s = this.seats[seat];
    if (!s || s.left) return;
    s.left = true;
    s.connected = false;
    this.broadcastPeer(seat, "left", 0);
    if (this.seats.every((x) => x.left)) {
      this.end("abandoned", null);
      return;
    }
    this.afterSeatLost();
  }

  /** @param seat - Reporter. @param winner - Team that won, or null for a draw. */
  matchOver(seat: number, winner: TeamId | null): void {
    const s = this.seats[seat];
    if (this.phase !== "running" || !s || s.report) return;
    s.report = { winner };
    if (this.everyVoterReported()) {
      this.finish();
      return;
    }
    this.overTimer ??= this.scheduler.setTimeout(
      () => this.finish(),
      MATCH_OVER_GRACE_MS,
    );
  }

  /** @returns Whether a seat is connected, loaded and still in the match. */
  isSeatPresent(seat: number): boolean {
    const s = this.seats[seat];
    return !!s && isPresent(s);
  }

  /** @returns The pending resync barrier tick, or null. */
  pendingResyncTick(): number | null {
    return this.resync.pendingTick;
  }

  /** Cancel timers (room closing). */
  dispose(): void {
    this.loadTimer?.cancel();
    this.overTimer?.cancel();
    this.loadTimer = null;
    this.overTimer = null;
    this.resync.dispose();
  }

  private go(): void {
    if (this.phase !== "loading") return;
    this.phase = "running";
    this.loadTimer?.cancel();
    this.loadTimer = null;
    const message: ServerMessage = {
      t: "go",
      serverTime: this.scheduler.now(),
    };
    for (const s of this.seats)
      if (isPresent(s)) this.hooks.sendToSeat(s.seat, message);
    this.input.fillAbsent();
  }

  private afterSeatLost(): void {
    this.resync.reassignAuthority();
    this.input.fillAbsent();
    if (this.overTimer && this.everyVoterReported()) this.finish();
  }

  private broadcastPeer(
    seat: number,
    status: "disconnected" | "reconnected" | "left",
    graceMs: number,
  ): void {
    const playerId = this.start.seats[seat]?.playerId ?? "";
    for (const s of this.seats) {
      if (s.seat !== seat && !s.left)
        this.hooks.sendToSeat(s.seat, {
          t: "peer",
          playerId,
          seat,
          status,
          graceMs,
        });
    }
  }

  /** The connected human seats whose reports decide the result (none connected: whoever reported and stayed). */
  private voters(): SeatState[] {
    const present = this.seats.filter((s) => isPresent(s));
    return present.length > 0
      ? present
      : this.seats.filter((s) => !s.left && s.report);
  }

  private everyVoterReported(): boolean {
    return this.voters().every((s) => s.report);
  }

  private finish(): void {
    if (this.phase === "ended") return;
    const verdict = decideResult(
      this.voters().map((s) => ({ seat: s.seat, winner: s.report?.winner })),
      this.authority,
      this.resync.hashes.lastAgreement() !== null,
    );
    if (verdict.kind === "no_result") this.end("abandoned", null);
    else this.end("finished", verdict.winner);
  }

  private end(reason: "finished" | "abandoned", winner: TeamId | null): void {
    if (this.phase === "ended") return;
    this.phase = "ended";
    this.dispose();
    this.hooks.onEnded(reason, winner);
  }
}
