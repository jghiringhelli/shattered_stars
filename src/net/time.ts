/**
 * Time abstractions for the net layer and the relay, so every timer-driven
 * rule (heartbeats, reconnection windows, countdowns, simulated latency) is
 * testable with a virtual clock.
 */

/** A source of the current time (ms). */
export interface Clock {
  now(): number;
}

/** A scheduled callback that can be cancelled. */
export interface TimerHandle {
  cancel(): void;
}

/** Clock plus one-shot timers. */
export interface Scheduler extends Clock {
  setTimeout(callback: () => void, delayMs: number): TimerHandle;
}

/**
 * @returns A scheduler backed by the real clock and `setTimeout`.
 */
export function createSystemScheduler(): Scheduler {
  return {
    now: () => Date.now(),
    setTimeout(callback, delayMs) {
      const id = globalThis.setTimeout(callback, delayMs);
      return { cancel: () => globalThis.clearTimeout(id) };
    },
  };
}

/**
 * Repeats a callback on a scheduler until cancelled.
 *
 * @param scheduler - Timer source.
 * @param callback - Runs every period.
 * @param periodMs - Period (ms).
 * @returns Handle that stops the repetition.
 */
export function repeatEvery(
  scheduler: Scheduler,
  callback: () => void,
  periodMs: number,
): TimerHandle {
  let handle: TimerHandle | null = null;
  let stopped = false;
  const run = (): void => {
    if (stopped) return;
    callback();
    if (!stopped) handle = scheduler.setTimeout(run, periodMs);
  };
  handle = scheduler.setTimeout(run, periodMs);
  return {
    cancel: () => {
      stopped = true;
      handle?.cancel();
    },
  };
}
