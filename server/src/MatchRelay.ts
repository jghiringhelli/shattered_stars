/**
 * MatchRelay — the authoritative relay of one running lockstep match.
 *
 * - Inputs: accepts each seat's stream only in tick order (duplicates and
 *   gaps add nothing), caps how far a seat may run ahead, and forwards every
 *   other seat the part it has not acknowledged (redundant resend).
 * - Absent seats (disconnected, left, never loaded) are filled with the AI
 *   input so nobody stalls; every client hands that ship to the same AI.
 * - Hashes: compares all seats' state hashes per tick; a mismatch starts a
 *   resync: a barrier tick past every relayed input, a snapshot from the
 *   authority seat at that tick, delivered to the out-of-sync seats.
 * - Reconnection reuses the resync: the returning seat jumps to the snapshot.
 */

import {
  INPUT_AI_CONTROL,
  MAX_LEAD_TICKS,
  NET_LIMITS,
  RESYNC_MARGIN_TICKS,
  type ClientInputMessage,
  type MatchStart,
  type ServerMessage,
  type TeamId,
} from "../../src/net/protocol";
import type { Scheduler, TimerHandle } from "../../src/net/time";
import { HashBook } from "./HashBook";
import {
  MATCH_OVER_GRACE_MS,
  type MatchRelayHooks,
  type MatchRelayTimings,
  type SeatState,
} from "./matchRelayTypes";
import { ResyncBarrier, type ResyncReason } from "./ResyncBarrier";
import { SeatLog } from "./SeatLog";

export {
  MATCH_OVER_GRACE_MS,
  type MatchRelayHooks,
  type MatchRelayTimings,
} from "./matchRelayTypes";

/** A desync-triggered resync is not started again within this long (ms): a bad client cannot make the authority ship snapshots in a loop. */
export const RESYNC_COOLDOWN_MS = 2_000;
/** How long the authority has to answer a snapshot request (ms). */
export const RESYNC_TIMEOUT_MS = 10_000;
/** Unanswered snapshot requests after which the match is abandoned. */
export const RESYNC_MAX_ATTEMPTS = 3;

export class MatchRelay {
  phase: "loading" | "running" | "ended" = "loading";
  authority: number;
  desyncCount = 0;
  private readonly seats: SeatState[];
  private readonly hashes = new HashBook();
  private readonly resync: ResyncBarrier;
  private loadTimer: TimerHandle | null;
  private overTimer: TimerHandle | null = null;
  private resyncTimer: TimerHandle | null = null;
  private resyncAttempts = 0;
  private lastDesyncResyncAt = Number.NEGATIVE_INFINITY;

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
    this.authority = start.authoritySeat;
    this.resync = new ResyncBarrier((seat, message) =>
      this.hooks.sendToSeat(seat, message),
    );
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
    this.loadTimer = scheduler.setTimeout(
      () => this.go(),
      timings.loadTimeoutMs,
    );
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
    this.requestResync([seat], "reconnect");
  }

  /** @param seat - Sender. @param message - Its input batch. */
  inputs(seat: number, message: ClientInputMessage): void {
    const s = this.seats[seat];
    if (this.phase !== "running" || !s || !this.isFeeding(s)) return;
    message.ack.forEach((next, sender) => {
      const log = this.seats[sender]?.log;
      if (log)
        s.acks[sender] = Math.min(
          log.next,
          Math.max(s.acks[sender] ?? 0, next),
        );
    });
    const lastTick = message.from + message.inputs.length - 1;
    if (lastTick > this.maxOtherNext(seat) + MAX_LEAD_TICKS) return;
    if (s.log.accept(message.from, message.inputs) === 0) return;
    this.relaySeat(seat, message.at);
    this.fillAbsent();
  }

  /** @param seat - Reporter. @param tick - Hashed tick. @param hash - State hash. */
  hash(seat: number, tick: number, hash: number): void {
    const s = this.seats[seat];
    if (
      this.phase !== "running" ||
      !s ||
      !this.isPresent(s) ||
      this.isResyncing(seat)
    )
      return;
    const expected = this.seats
      .filter((x) => this.isPresent(x) && !this.isResyncing(x.seat))
      .map((x) => x.seat);
    if (this.hashes.record(seat, tick, hash, expected) !== "mismatch") return;
    this.desyncCount++;
    const now = this.scheduler.now();
    if (now - this.lastDesyncResyncAt < RESYNC_COOLDOWN_MS) return;
    this.lastDesyncResyncAt = now;
    const targets = this.seats
      .filter((x) => this.isPresent(x) && x.seat !== this.authority)
      .map((x) => x.seat);
    this.requestResync(targets, "desync");
  }

  /** @param seat - Sender (must be the authority). @param tick - Snapshot tick. @param data - Serialized state. */
  snapshot(seat: number, tick: number, data: string): void {
    const resolved = this.resync.resolve(seat, tick, this.authority);
    if (!resolved) return;
    this.clearResyncTimer();
    for (const target of resolved.targets) {
      const t = this.seats[target];
      if (!t || !this.isPresent(t)) continue;
      this.hooks.sendToSeat(target, { t: "snapshot", tick, data });
      if (!t.holdInputs) continue;
      t.holdInputs = false;
      // Catch up on every seat after the barrier, including its own seat's AI fill.
      this.seats.forEach((x) => {
        t.acks[x.seat] = tick + 1;
        this.sendRange(t, x.seat, -1);
      });
    }
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
    if (this.seats.every((x) => !this.isPresent(x) || x.report)) {
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
    return !!s && this.isPresent(s);
  }

  /** @returns The pending resync barrier tick, or null. */
  pendingResyncTick(): number | null {
    return this.resync.tick;
  }

  /** Cancel timers (room closing). */
  dispose(): void {
    this.loadTimer?.cancel();
    this.overTimer?.cancel();
    this.loadTimer = null;
    this.overTimer = null;
    this.clearResyncTimer();
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
      if (this.isPresent(s)) this.hooks.sendToSeat(s.seat, message);
    this.fillAbsent();
  }

  private isPresent(s: SeatState): boolean {
    return s.connected && s.loaded && !s.left;
  }

  /** A seat that sends its own inputs (a rejoining seat is AI-filled until its snapshot lands). */
  private isFeeding(s: SeatState): boolean {
    return this.isPresent(s) && !s.holdInputs;
  }

  private isResyncing(seat: number): boolean {
    return (
      this.resync.isTarget(seat) || (this.seats[seat]?.holdInputs ?? false)
    );
  }

  private maxOtherNext(seat: number): number {
    return Math.max(
      0,
      ...this.seats.filter((x) => x.seat !== seat).map((x) => x.log.next),
    );
  }

  private relaySeat(seat: number, at: number): void {
    for (const r of this.seats) {
      if (r.seat !== seat && this.isPresent(r) && !r.holdInputs)
        this.sendRange(r, seat, at);
    }
  }

  private sendRange(recipient: SeatState, seat: number, at: number): void {
    const log = this.seats[seat]?.log;
    if (!log) return;
    const range = log.range(
      recipient.acks[seat] ?? 0,
      NET_LIMITS.maxInputFramesPerMessage,
    );
    if (range.inputs.length === 0) return;
    this.hooks.sendToSeat(recipient.seat, {
      t: "in",
      seat,
      from: range.from,
      inputs: range.inputs,
      at,
      ack: recipient.log.next,
    });
  }

  private fillAbsent(): void {
    if (this.phase !== "running") return;
    const feeding = this.seats.filter((s) => this.isFeeding(s));
    if (feeding.length === 0) return;
    const target = Math.max(...feeding.map((s) => s.log.next));
    for (const s of this.seats) {
      if (!this.isFeeding(s) && s.log.fill(target, INPUT_AI_CONTROL) > 0)
        this.relaySeat(s.seat, -1);
    }
  }

  private requestResync(
    targets: readonly number[],
    reason: ResyncReason,
  ): void {
    const barrier =
      Math.max(...this.seats.map((s) => s.log.next)) + RESYNC_MARGIN_TICKS;
    if (!this.resync.request(targets, reason, barrier, this.authority)) return;
    this.hashes.clearThrough(barrier);
    this.armResyncTimer();
  }

  private armResyncTimer(): void {
    this.resyncTimer?.cancel();
    this.resyncTimer = this.scheduler.setTimeout(
      () => this.resyncStalled(),
      RESYNC_TIMEOUT_MS,
    );
  }

  private clearResyncTimer(): void {
    this.resyncTimer?.cancel();
    this.resyncTimer = null;
    this.resyncAttempts = 0;
  }

  /** The authority never sent its snapshot (a background tab, a stalled client): try another seat, then give up. */
  private resyncStalled(): void {
    this.resyncTimer = null;
    const pending = this.resync.cancel();
    if (!pending || this.phase !== "running") return;
    if (++this.resyncAttempts >= RESYNC_MAX_ATTEMPTS) {
      this.end("abandoned", null);
      return;
    }
    const others = this.seats.filter(
      (s) => s.seat !== this.authority && this.isPresent(s),
    );
    // A target may take over only while another target still needs the snapshot.
    const next =
      others.find((s) => !pending.targets.has(s.seat)) ??
      (pending.targets.size > 1 ? others[0] : undefined);
    if (next) this.setAuthority(next.seat);
    const targets = [...pending.targets].filter((t) => t !== next?.seat);
    this.requestResync(targets, pending.reason);
    this.armResyncTimer();
  }

  private setAuthority(seat: number): void {
    this.authority = seat;
    for (const s of this.seats)
      if (!s.left) this.hooks.sendToSeat(s.seat, { t: "authority", seat });
  }

  private afterSeatLost(): void {
    this.reassignAuthority();
    this.fillAbsent();
    if (
      this.overTimer &&
      this.seats.every((x) => !this.isPresent(x) || x.report)
    )
      this.finish();
  }

  private reassignAuthority(): void {
    const current = this.seats[this.authority];
    if (current && this.isPresent(current)) return;
    const next = this.seats.find((s) => this.isPresent(s));
    if (!next) return;
    this.setAuthority(next.seat);
    const pending = this.resync.cancel();
    if (pending) this.requestResync([...pending.targets], pending.reason);
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

  private finish(): void {
    if (this.phase === "ended") return;
    this.end("finished", this.reportedWinner());
  }

  /** The winner most seats reported; a tie goes to the authority's report. */
  private reportedWinner(): TeamId | null {
    const votes = new Map<TeamId | null, number>();
    for (const s of this.seats)
      if (s.report) votes.set(s.report.winner, (votes.get(s.report.winner) ?? 0) + 1);
    const top = Math.max(0, ...votes.values());
    const leaders = [...votes.entries()].filter(([, n]) => n === top);
    const authorityReport = this.seats[this.authority]?.report;
    if (authorityReport && votes.get(authorityReport.winner) === top)
      return authorityReport.winner;
    return leaders[0]?.[0] ?? null;
  }

  private end(reason: "finished" | "abandoned", winner: TeamId | null): void {
    if (this.phase === "ended") return;
    this.phase = "ended";
    this.dispose();
    this.hooks.onEnded(reason, winner);
  }
}
