/**
 * HashBook — collects every seat's state hash per tick and reports a desync
 * as soon as all expected seats have reported a tick and disagree. Pure.
 */

/** Verdict on one recorded hash. */
export type HashVerdict = "pending" | "match" | "mismatch";

/** Ticks with incomplete reports kept before the oldest are dropped. */
const MAX_PENDING_TICKS = 64;

export class HashBook {
  private readonly reports = new Map<number, Map<number, number>>();
  private floor = -1;
  private agreed: { tick: number; hash: number } | null = null;

  /** @returns The latest tick every expected seat reported the same hash for, unless a mismatch or resync came since. */
  lastAgreement(): { readonly tick: number; readonly hash: number } | null {
    return this.agreed;
  }

  /**
   * @param seat - Reporting seat.
   * @param tick - Hashed tick.
   * @param hash - The seat's state hash.
   * @param expectedSeats - Seats whose hash must be in before judging.
   * @returns Whether the tick is still pending, agreed or disagreed.
   */
  record(
    seat: number,
    tick: number,
    hash: number,
    expectedSeats: readonly number[],
  ): HashVerdict {
    if (tick <= this.floor) return "pending";
    const byseat = this.reports.get(tick) ?? new Map<number, number>();
    byseat.set(seat, hash);
    this.reports.set(tick, byseat);
    this.prune();
    if (!expectedSeats.every((s) => byseat.has(s))) return "pending";
    const values = expectedSeats.map((s) => byseat.get(s));
    this.reports.delete(tick);
    const agree = values.every((v) => v === values[0]);
    this.agreed = agree && expectedSeats.length > 0 ? { tick, hash } : null;
    return agree ? "match" : "mismatch";
  }

  /** @param tick - Forget every report up to and including this tick (after a resync). */
  clearThrough(tick: number): void {
    this.floor = Math.max(this.floor, tick);
    this.agreed = null;
    for (const key of [...this.reports.keys()])
      if (key <= tick) this.reports.delete(key);
  }

  private prune(): void {
    if (this.reports.size <= MAX_PENDING_TICKS) return;
    const oldest = Math.min(...this.reports.keys());
    this.reports.delete(oldest);
  }
}
