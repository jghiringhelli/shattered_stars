/**
 * reinforcementErrors — the reinforcement module's error type: carries the
 * operation that failed so logs say where it happened.
 */

/** A reinforcement rule was broken by the caller (bad id, bad config). */
export class ReinforcementError extends Error {
  /**
   * @param operation - What was being done ("deploy", "config"...).
   * @param message - What went wrong.
   */
  constructor(
    readonly operation: string,
    message: string,
  ) {
    super(`[reinforcements:${operation}] ${message}`);
    this.name = "ReinforcementError";
  }
}
