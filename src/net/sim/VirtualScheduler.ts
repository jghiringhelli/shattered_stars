/**
 * VirtualScheduler — a deterministic clock for the latency simulator, the
 * net-layer tests and the relay tests: time only moves when `advance` is
 * called, and due timers fire in (time, creation) order.
 */

import type { Scheduler, TimerHandle } from "../time";

interface PendingTimer {
  readonly id: number;
  readonly at: number;
  readonly callback: () => void;
  cancelled: boolean;
}

export class VirtualScheduler implements Scheduler {
  private currentMs: number;
  private nextId = 0;
  private timers: PendingTimer[] = [];

  /** @param startMs - Initial time (ms). */
  constructor(startMs = 0) {
    this.currentMs = startMs;
  }

  /** @returns The virtual time (ms). */
  now(): number {
    return this.currentMs;
  }

  /**
   * @param callback - Runs once the virtual time reaches now + delay.
   * @param delayMs - Delay (ms, negative counts as 0).
   * @returns Cancellable handle.
   */
  setTimeout(callback: () => void, delayMs: number): TimerHandle {
    const timer: PendingTimer = {
      id: this.nextId++,
      at: this.currentMs + Math.max(0, delayMs),
      callback,
      cancelled: false,
    };
    this.timers.push(timer);
    return {
      cancel: () => {
        timer.cancelled = true;
      },
    };
  }

  /**
   * Moves time forward, firing every timer that falls due on the way
   * (including timers those timers schedule).
   *
   * @param ms - How far to advance (ms).
   */
  advance(ms: number): void {
    const target = this.currentMs + ms;
    for (;;) {
      const next = this.nextDue(target);
      if (!next) break;
      this.currentMs = next.at;
      this.timers = this.timers.filter((t) => t !== next);
      next.callback();
    }
    this.currentMs = target;
  }

  /** @returns How many live timers are waiting. */
  pendingCount(): number {
    return this.timers.filter((t) => !t.cancelled).length;
  }

  private nextDue(limit: number): PendingTimer | undefined {
    this.timers = this.timers.filter((t) => !t.cancelled);
    let best: PendingTimer | undefined;
    for (const timer of this.timers) {
      if (timer.at > limit) continue;
      if (
        !best ||
        timer.at < best.at ||
        (timer.at === best.at && timer.id < best.id)
      )
        best = timer;
    }
    return best;
  }
}
