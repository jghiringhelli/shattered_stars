/**
 * FixedStepPlan — how many fixed simulation ticks one rendered frame runs.
 *
 * A plain "while (accumulator >= step) tick()" spirals on a slow machine: the
 * more a frame costs, the more ticks the next one owes, until the game crawls
 * at a frame or two per second (measured: 40-ship Epic under 4× CPU
 * throttling fell from 60 to 1.6 fps). The plan caps the ticks per frame and
 * drops the backlog beyond the cap, so an overloaded machine plays in slow
 * motion at a steady frame rate instead. Pure.
 */

/** A frame longer than this (tab switch, breakpoint) counts as this long. */
export const MAX_FRAME_MS = 250;

/**
 * Most ticks one frame may run at real-time speed: catches up a 15 fps frame
 * (4 × 16.7 ms = 67 ms) exactly; slower than that, the simulation runs slower
 * than real time.
 */
export const MAX_TICKS_PER_FRAME = 4;

/** What one frame should do. */
export interface FixedStepPlan {
  /** Ticks to run this frame. */
  readonly ticks: number;
  /** Accumulator to keep for the next frame (below one step when the backlog was dropped). */
  readonly remainderMs: number;
}

/**
 * @param accumulatorMs - Time carried over from earlier frames.
 * @param frameMs - Real time since the last frame.
 * @param timeScale - Simulation speed factor (1 = real time; debug fast-forward > 1).
 * @param stepMs - Length of one tick.
 * @returns The ticks to run and the accumulator to keep.
 */
export function planFixedSteps(
  accumulatorMs: number,
  frameMs: number,
  timeScale: number,
  stepMs: number,
): FixedStepPlan {
  const owed = accumulatorMs + Math.min(frameMs, MAX_FRAME_MS) * timeScale;
  const dueTicks = Math.floor(owed / stepMs);
  const cap = Math.ceil(MAX_TICKS_PER_FRAME * Math.max(1, timeScale));
  if (dueTicks <= cap) return { ticks: dueTicks, remainderMs: owed - dueTicks * stepMs };
  return { ticks: cap, remainderMs: owed % stepMs };
}
