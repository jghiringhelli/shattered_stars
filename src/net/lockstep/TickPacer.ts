/**
 * TickPacer — the fixed-timestep clock of a lockstep match. It accumulates
 * real frame time and releases whole ticks, slowing itself slightly while
 * this client runs ahead of the others (so the leader eases off instead of
 * stalling in bursts), and caps catch-up after a stall. Pure.
 */

import { TICK_MS } from "../protocol";

/** Most ticks one frame may run (catch-up after a stall or a slow frame). */
export const MAX_TICKS_PER_FRAME = 8;
/** Longest frame counted (ms): a backgrounded tab must not fast-forward minutes. */
export const MAX_FRAME_MS = 250;
/** Ticks ahead of the slowest peer tolerated before slowing down. */
export const ADVANTAGE_DEADBAND_TICKS = 0.5;
/** Slowdown per tick of excess advantage. */
const SLOWDOWN_PER_TICK = 0.04;
/** Slowest the clock may run (fraction of real time). */
const MIN_RATE = 0.85;
/** Smoothing of the advantage estimate (EWMA weight of a new sample). */
const ADVANTAGE_SMOOTHING = 0.1;
/** Float tolerance when comparing accumulated time with TICK_MS (1000/60 is not exact). */
const TICK_EPSILON_MS = 1e-6;

export class TickPacer {
  private accumulatorMs = 0;
  private smoothedAdvantage = 0;

  /**
   * @param advantageTicks - How far this client is ahead of the slowest peer (ticks, may be negative).
   */
  observeAdvantage(advantageTicks: number): void {
    this.smoothedAdvantage +=
      (advantageTicks - this.smoothedAdvantage) * ADVANTAGE_SMOOTHING;
  }

  /** @returns The current clock rate (1 = real time). */
  rate(): number {
    const excess = this.smoothedAdvantage - ADVANTAGE_DEADBAND_TICKS;
    if (excess <= 0) return 1;
    return Math.max(MIN_RATE, 1 - excess * SLOWDOWN_PER_TICK);
  }

  /** @param frameMs - Real time since the previous frame (ms). */
  addFrame(frameMs: number): void {
    const counted = Math.min(Math.max(frameMs, 0), MAX_FRAME_MS) * this.rate();
    this.accumulatorMs = Math.min(
      this.accumulatorMs + counted,
      MAX_TICKS_PER_FRAME * TICK_MS,
    );
  }

  /** @returns Whether a whole tick is due (with a float tolerance on the accumulated ms). */
  hasDueTick(): boolean {
    return this.accumulatorMs >= TICK_MS - TICK_EPSILON_MS;
  }

  /** A due tick was simulated. */
  consumeTick(): void {
    this.accumulatorMs -= TICK_MS;
  }

  /** @returns Leftover fraction of a tick (render interpolation alpha, 0–1). */
  alpha(): number {
    return Math.min(1, this.accumulatorMs / TICK_MS);
  }
}
