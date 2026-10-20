/**
 * guarded — one bad message or timer must never take the relay (and every
 * room and match on it) down. The socket layer runs relay logic through
 * these wrappers: an exception is logged with its context and swallowed.
 */

import type { Scheduler } from "../../src/net/time";
import type { Logger } from "./logger";

/**
 * @param logger - Where failures are reported.
 * @param what - What was running (logged).
 * @param action - The relay logic.
 * @returns Whether it completed without throwing.
 */
export function runGuarded(
  logger: Logger,
  what: string,
  action: () => void,
): boolean {
  try {
    action();
    return true;
  } catch (error) {
    logger.error("relay logic failed", {
      what,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
    return false;
  }
}

/**
 * @param inner - The real scheduler.
 * @param logger - Where timer failures are reported.
 * @returns A scheduler whose callbacks cannot throw into the event loop.
 */
export function guardScheduler(inner: Scheduler, logger: Logger): Scheduler {
  return {
    now: () => inner.now(),
    setTimeout: (callback, delayMs) =>
      inner.setTimeout(() => runGuarded(logger, "timer", callback), delayMs),
  };
}
