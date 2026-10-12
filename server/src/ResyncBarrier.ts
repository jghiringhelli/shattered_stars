/**
 * ResyncBarrier — the relay's pending resync: the barrier tick, why, and
 * which seats wait for the authority's snapshot there. One barrier at a
 * time; seats that fall out of sync meanwhile join the pending one.
 */

import type { ServerMessage } from "../../src/net/protocol";

/** Why seats are resynced. */
export type ResyncReason = "desync" | "reconnect";

/** A pending barrier. */
export interface PendingResync {
  readonly tick: number;
  readonly reason: ResyncReason;
  readonly targets: ReadonlySet<number>;
}

export class ResyncBarrier {
  private pending: {
    tick: number;
    reason: ResyncReason;
    targets: Set<number>;
  } | null = null;

  /** @param send - Delivers a message to a seat. */
  constructor(
    private readonly send: (seat: number, message: ServerMessage) => void,
  ) {}

  /** @returns The pending barrier tick, or null. */
  get tick(): number | null {
    return this.pending?.tick ?? null;
  }

  /** @param seat - A seat. @returns Whether it waits for the pending snapshot. */
  isTarget(seat: number): boolean {
    return this.pending?.targets.has(seat) ?? false;
  }

  /**
   * Start a barrier (or join the pending one): targets learn the barrier
   * tick, the authority is asked for a snapshot there.
   *
   * @param targets - Seats to resync (the authority is skipped).
   * @param reason - Desync or reconnect.
   * @param barrierTick - Tick for a new barrier (past every relayed input).
   * @param authority - Seat that sends the snapshot.
   * @returns Whether a new barrier was started (callers reset their hash book then).
   */
  request(
    targets: readonly number[],
    reason: ResyncReason,
    barrierTick: number,
    authority: number,
  ): boolean {
    const fresh = targets.filter((t) => t !== authority);
    if (fresh.length === 0) return false;
    const started = this.pending === null;
    this.pending ??= { tick: barrierTick, reason, targets: new Set() };
    for (const seat of fresh) this.addTarget(seat);
    if (started)
      this.send(authority, { t: "snapshot_request", tick: barrierTick });
    return started;
  }

  /**
   * @param seat - Sender of a snapshot.
   * @param tick - Its tick.
   * @param authority - Current authority seat.
   * @returns The resolved barrier when this is the awaited snapshot, else null.
   */
  resolve(seat: number, tick: number, authority: number): PendingResync | null {
    const pending = this.pending;
    if (!pending || seat !== authority || tick !== pending.tick) return null;
    this.pending = null;
    return pending;
  }

  /**
   * The authority changed: drop the barrier and hand its targets back for a new one.
   *
   * @returns The dropped barrier, or null when none was pending.
   */
  cancel(): PendingResync | null {
    const pending = this.pending;
    this.pending = null;
    return pending;
  }

  private addTarget(seat: number): void {
    const pending = this.pending;
    if (!pending || pending.targets.has(seat)) return;
    pending.targets.add(seat);
    this.send(seat, {
      t: "resync",
      tick: pending.tick,
      reason: pending.reason,
    });
  }
}
