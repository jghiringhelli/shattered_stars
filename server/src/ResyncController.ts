/**
 * ResyncController — desync detection and recovery of a running match.
 *
 * Hashes: compares all present seats' state hashes per tick; a mismatch
 * starts a resync: a barrier tick past every relayed input, a snapshot from
 * the authority seat at that tick, delivered to the out-of-sync seats.
 * Reconnection reuses the resync (the returning seat jumps to the snapshot).
 * The authority seat is the snapshot source; it is handed to another seat
 * when it drops or never answers.
 */

import { RESYNC_MARGIN_TICKS } from "../../src/net/protocol";
import type { Scheduler, TimerHandle } from "../../src/net/time";
import { HashBook } from "./HashBook";
import type { InputRelay } from "./InputRelay";
import { isPresent, type MatchRelayHooks, type SeatState } from "./matchRelayTypes";
import { ResyncBarrier, type ResyncReason } from "./ResyncBarrier";

/** A desync-triggered resync is not started again within this long (ms): a bad client cannot make the authority ship snapshots in a loop. */
export const RESYNC_COOLDOWN_MS = 2_000;
/** How long the authority has to answer a snapshot request (ms). */
export const RESYNC_TIMEOUT_MS = 10_000;
/** Unanswered snapshot requests after which the match is abandoned. */
export const RESYNC_MAX_ATTEMPTS = 3;

/** What the controller works with (all shared with MatchRelay). */
export interface ResyncDeps {
  readonly seats: readonly SeatState[];
  readonly hooks: MatchRelayHooks;
  readonly scheduler: Scheduler;
  /** Catch-up after a snapshot. */
  readonly input: InputRelay;
  /** Whether the match is in its running phase. */
  readonly isRunning: () => boolean;
  /** Called when the authority can never answer. */
  readonly abandon: () => void;
}

export class ResyncController {
  authority: number;
  desyncCount = 0;
  readonly hashes = new HashBook();
  private readonly barrier: ResyncBarrier;
  private timer: TimerHandle | null = null;
  private attempts = 0;
  private lastDesyncResyncAt = Number.NEGATIVE_INFINITY;
  private readonly seats: readonly SeatState[];
  private readonly hooks: MatchRelayHooks;
  private readonly scheduler: Scheduler;
  private readonly input: InputRelay;
  private readonly isRunning: () => boolean;
  private readonly abandon: () => void;

  /**
   * @param deps - Shared seats, hooks, timers and the input relay.
   * @param authority - The initial authority seat.
   */
  constructor(deps: ResyncDeps, authority: number) {
    ({
      seats: this.seats,
      hooks: this.hooks,
      scheduler: this.scheduler,
      input: this.input,
      isRunning: this.isRunning,
      abandon: this.abandon,
    } = deps);
    this.authority = authority;
    this.barrier = new ResyncBarrier((seat, message) =>
      this.hooks.sendToSeat(seat, message),
    );
  }

  /** @returns The pending resync barrier tick, or null. */
  get pendingTick(): number | null {
    return this.barrier.tick;
  }

  /** @param seat - Reporter. @param tick - Hashed tick. @param hash - State hash. */
  hash(seat: number, tick: number, hash: number): void {
    const s = this.seats[seat];
    if (!this.isRunning() || !s || !isPresent(s) || this.isResyncing(seat))
      return;
    const expected = this.seats
      .filter((x) => isPresent(x) && !this.isResyncing(x.seat))
      .map((x) => x.seat);
    if (this.hashes.record(seat, tick, hash, expected) !== "mismatch") return;
    this.desyncCount++;
    const now = this.scheduler.now();
    if (now - this.lastDesyncResyncAt < RESYNC_COOLDOWN_MS) return;
    this.lastDesyncResyncAt = now;
    const targets = this.seats
      .filter((x) => isPresent(x) && x.seat !== this.authority)
      .map((x) => x.seat);
    this.request(targets, "desync");
  }

  /** @param seat - Sender (must be the authority). @param tick - Snapshot tick. @param data - Serialized state. */
  snapshot(seat: number, tick: number, data: string): void {
    const resolved = this.barrier.resolve(seat, tick, this.authority);
    if (!resolved) return;
    this.clearTimer();
    for (const target of resolved.targets) {
      const t = this.seats[target];
      if (!t || !isPresent(t)) continue;
      this.hooks.sendToSeat(target, { t: "snapshot", tick, data });
      if (!t.holdInputs) continue;
      t.holdInputs = false;
      this.input.catchUp(t, tick);
    }
  }

  /** @param targets - Seats that need the authority's snapshot. @param reason - Why. */
  request(targets: readonly number[], reason: ResyncReason): void {
    const next = Math.max(...this.seats.map((s) => s.log.next));
    const barrier = next + RESYNC_MARGIN_TICKS;
    if (!this.barrier.request(targets, reason, barrier, this.authority)) return;
    this.hashes.clearThrough(barrier);
    this.armTimer();
  }

  /** The authority dropped: hand the snapshot duty to a present seat and re-ask. */
  reassignAuthority(): void {
    const current = this.seats[this.authority];
    if (current && isPresent(current)) return;
    const next = this.seats.find((s) => isPresent(s));
    if (!next) return;
    this.setAuthority(next.seat);
    const pending = this.barrier.cancel();
    if (pending) this.request([...pending.targets], pending.reason);
  }

  /** @param seat - A seat. @returns Whether it waits for (or is held until) a snapshot. */
  isResyncing(seat: number): boolean {
    return this.barrier.isTarget(seat) || (this.seats[seat]?.holdInputs ?? false);
  }

  /** Cancel the timer (match ending). */
  dispose(): void {
    this.clearTimer();
  }

  private armTimer(): void {
    this.timer?.cancel();
    this.timer = this.scheduler.setTimeout(
      () => this.stalled(),
      RESYNC_TIMEOUT_MS,
    );
  }

  private clearTimer(): void {
    this.timer?.cancel();
    this.timer = null;
    this.attempts = 0;
  }

  /** The authority never sent its snapshot (a background tab, a stalled client): try another seat, then give up. */
  private stalled(): void {
    this.timer = null;
    const pending = this.barrier.cancel();
    if (!pending || !this.isRunning()) return;
    if (++this.attempts >= RESYNC_MAX_ATTEMPTS) {
      this.abandon();
      return;
    }
    const others = this.seats.filter(
      (s) => s.seat !== this.authority && isPresent(s),
    );
    // A target may take over only while another target still needs the snapshot.
    const next =
      others.find((s) => !pending.targets.has(s.seat)) ??
      (pending.targets.size > 1 ? others[0] : undefined);
    if (next) this.setAuthority(next.seat);
    const targets = [...pending.targets].filter((t) => t !== next?.seat);
    this.request(targets, pending.reason);
    this.armTimer();
  }

  private setAuthority(seat: number): void {
    this.authority = seat;
    for (const s of this.seats)
      if (!s.left) this.hooks.sendToSeat(s.seat, { t: "authority", seat });
  }
}
