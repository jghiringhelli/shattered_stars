/**
 * RttTracker — smoothed round trip and jitter of the relay link, plus the
 * estimated offset of the relay's clock. Pure: callers pass the local time.
 */

/** Weight of a new RTT sample in the smoothed RTT / jitter. */
const RTT_SMOOTHING = 0.2;

export class RttTracker {
  rttMs = 0;
  jitterMs = 0;
  private serverOffsetMs = 0;

  /** @param serverTime - The relay's clock from its welcome. @param nowMs - Local time. */
  align(serverTime: number, nowMs: number): void {
    this.serverOffsetMs = serverTime - nowMs;
  }

  /**
   * @param sentAt - Local time the ping left.
   * @param serverAt - The relay's clock when it answered.
   * @param nowMs - Local time the pong arrived.
   */
  sample(sentAt: number, serverAt: number, nowMs: number): void {
    const sample = Math.max(0, nowMs - sentAt);
    // The server stamped the pong about half a round trip ago.
    this.serverOffsetMs = serverAt + sample / 2 - nowMs;
    if (this.rttMs === 0) {
      this.rttMs = sample;
      return;
    }
    this.jitterMs +=
      (Math.abs(sample - this.rttMs) - this.jitterMs) * RTT_SMOOTHING;
    this.rttMs += (sample - this.rttMs) * RTT_SMOOTHING;
  }

  /** @returns Round trip plus twice the jitter: what the relay sizes the input delay from. */
  reportedMs(): number {
    return Math.round(this.rttMs + 2 * this.jitterMs);
  }

  /** @param nowMs - Local time. @returns The relay's clock, estimated. */
  serverNow(nowMs: number): number {
    return nowMs + this.serverOffsetMs;
  }
}
