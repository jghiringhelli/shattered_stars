/**
 * DeadlineTimer — a one-shot timer that remembers when it fires, so a room can
 * show the deadline (start countdown, ready check, rematch window).
 */

import type { Scheduler, TimerHandle } from "../../src/net/time";

export class DeadlineTimer {
  private handle: TimerHandle | null = null;
  private firesAt: number | null = null;

  /** @param scheduler - Timer source. */
  constructor(private readonly scheduler: Scheduler) {}

  /** @returns When the timer fires (scheduler time), or null when not armed. */
  get deadline(): number | null {
    return this.firesAt;
  }

  /** @returns Whether the timer is armed. */
  get armed(): boolean {
    return this.handle !== null;
  }

  /**
   * @param delayMs - Time until it fires.
   * @param onFire - Runs once, after the timer cleared itself.
   */
  arm(delayMs: number, onFire: () => void): void {
    this.clear();
    this.firesAt = this.scheduler.now() + delayMs;
    this.handle = this.scheduler.setTimeout(() => {
      this.handle = null;
      this.firesAt = null;
      onFire();
    }, delayMs);
  }

  /** Cancel the timer if armed. */
  clear(): void {
    this.handle?.cancel();
    this.handle = null;
    this.firesAt = null;
  }
}
