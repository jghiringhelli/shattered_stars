/**
 * Lockstep timing shared by the relay and the clients. Changing any of these
 * changes what both ends expect, so bump PROTOCOL_VERSION with them.
 */

/** Simulation tick (ms): ArcadeBattleScene's FIXED_DT, 60 Hz. */
export const TICK_MS = 1000 / 60;

/** Fewest ticks between sampling and simulating an input (≈33 ms). */
export const MIN_INPUT_DELAY = 2;
/** Delay used when no ping is known yet (≈50 ms). */
export const DEFAULT_INPUT_DELAY = 3;
/**
 * Most input delay a match adapts to (300 ms, intercontinental through one
 * relay). Lockstep cannot run faster than delay / one-way latency, so a
 * delay below the real path slows the whole match down (measured: 37% of
 * the time stalled at 200 ms over a 180 ms path) — a long delay is better.
 */
export const MAX_INPUT_DELAY = 18;

/** Every client hashes its state every this many ticks (2 Hz). */
export const HASH_INTERVAL_TICKS = 30;

/** A resync barrier lands this many ticks past the newest relayed input. */
export const RESYNC_MARGIN_TICKS = 6;

/** A seat may not send inputs further than this past the slowest other seat (10 s). */
export const MAX_LEAD_TICKS = 600;

/** Ticks of inputs the relay keeps per seat for redundant resends (30 s). */
export const INPUT_LOG_TICKS = 1800;

/** Slack added to the one-way latency estimate, as a fraction of it (pings already include jitter). */
const LATENCY_HEADROOM = 0.1;
/**
 * Fixed allowance (ms) on top of the one-way latency: one tick for jitter
 * plus one for frame quantization (inputs are sampled and sent once per
 * rendered frame, so an input can leave up to a frame after its tick).
 */
const JITTER_ALLOWANCE_MS = 2 * TICK_MS;

/**
 * Input delay for a match: the worst client-to-client path through the
 * relay is half of each of the two largest round trips; the delay covers
 * that path plus headroom so a normal frame never waits for an input.
 *
 * @param pingsMs - Every player's round trip to the relay, jitter included
 *   (NetClient reports smoothed RTT + 2 × jitter; 0 = unknown).
 * @returns Delay in ticks, within [MIN_INPUT_DELAY, MAX_INPUT_DELAY].
 */
export function computeInputDelay(pingsMs: readonly number[]): number {
  const known = pingsMs.filter((ping) => ping > 0).sort((a, b) => b - a);
  if (known.length === 0) return DEFAULT_INPUT_DELAY;
  const oneWayMs = ((known[0] ?? 0) + (known[1] ?? known[0] ?? 0)) / 2;
  const budgetMs = oneWayMs * (1 + LATENCY_HEADROOM) + JITTER_ALLOWANCE_MS;
  const ticks = Math.ceil(budgetMs / TICK_MS);
  return Math.min(MAX_INPUT_DELAY, Math.max(MIN_INPUT_DELAY, ticks));
}
