/**
 * AdaptiveDelay — tunes this client's input delay during the match.
 *
 * In this lockstep each client's delay is a local choice: inputs are
 * addressed to absolute ticks and the relay only needs a contiguous stream,
 * so a client may schedule further ahead (the gap is filled with its held
 * input) or pause scheduling to shrink its lead, without telling anyone.
 *
 * A delay shorter than the real path shows up as many short stall episodes
 * (every few frames an input is just late); a TCP retransmit shows up as one
 * long stall that no reasonable delay would hide. So the delay rises on
 * repeated episodes only, and steps back down after a calm spell — never
 * below the delay the match started with. Pure.
 */

import { MAX_INPUT_DELAY } from "../protocol";

/** Short stall episodes within the window that mean the delay is too short. */
export const RAISE_EPISODES = 4;
/** Episode-counting window (ms). */
export const EPISODE_WINDOW_MS = 1_000;
/** Longest stall that still reads as "input slightly late" (ms); longer ones are loss spikes. */
export const SHORT_STALL_MS = 50;
/** Calm time (no stall at all) before stepping the delay back down (ms). */
export const LOWER_AFTER_CALM_MS = 5_000;

export class AdaptiveDelay {
  private elapsedMs = 0;
  private episodes: number[] = [];
  private calmMs = 0;
  private stallRunMs = 0;

  /** @param delay - Current delay (ticks). @param baseline - Floor: the match's negotiated delay. */
  constructor(
    public delay: number,
    private readonly baseline: number,
  ) {}

  /**
   * @param frameMs - Frame length (ms).
   * @param stalled - Whether the frame waited for a missing input.
   * @returns The delay to use from now on.
   */
  observe(frameMs: number, stalled: boolean): number {
    this.elapsedMs += frameMs;
    if (stalled) {
      this.stallRunMs += frameMs;
    } else if (this.stallRunMs > 0) {
      if (this.stallRunMs <= SHORT_STALL_MS) this.episodes.push(this.elapsedMs);
      this.stallRunMs = 0;
    }
    this.episodes = this.episodes.filter(
      (at) => this.elapsedMs - at <= EPISODE_WINDOW_MS,
    );
    this.calmMs = stalled ? 0 : this.calmMs + frameMs;
    if (
      this.episodes.length >= RAISE_EPISODES &&
      this.delay < MAX_INPUT_DELAY
    ) {
      this.change(this.delay + 1);
    } else if (
      this.calmMs >= LOWER_AFTER_CALM_MS &&
      this.delay > this.baseline
    ) {
      this.change(this.delay - 1);
    }
    return this.delay;
  }

  private change(delay: number): void {
    this.delay = delay;
    this.episodes = [];
    this.calmMs = 0;
  }
}
