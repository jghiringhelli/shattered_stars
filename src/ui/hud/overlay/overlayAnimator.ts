/**
 * overlayAnimator — the per-channel (shield row / hull bar) animation state
 * machine of the ship overlay. Pure and Phaser-free; the view steps it each
 * frame and draws from it.
 *
 * Cues (each pairs colour with motion/shape, never colour alone):
 * - Damage: a short white flash (done within 200 ms) plus a "ghost" trail
 *   that holds the old value, then drains down to the new one.
 * - Repair: a bright band that sweeps along the bar edge up to the fill
 *   edge, repeating while repair continues, plus a "+" glyph.
 *
 * States are mutated in place: the overlay steps every ship every frame,
 * so the hot path allocates nothing.
 */

/** Damage flash length — the hit reads within 200 ms. */
export const DAMAGE_FLASH_MS = 160;

/** The ghost trail holds the pre-hit value this long before draining. */
export const GHOST_HOLD_MS = 350;

/** Ghost drain speed, in bar fractions per second. */
export const GHOST_DRAIN_PER_SECOND = 0.8;

/** A repair keeps the shimmer alive this long after its last pulse. */
export const SHIMMER_DURATION_MS = 800;

/** One shimmer sweep from the bar start to the fill edge. */
export const SHIMMER_SWEEP_MS = 400;

/** Value changes smaller than this are float noise. */
const VALUE_EPSILON = 1e-6;

/** Milliseconds per second. */
const MS_PER_SECOND = 1000;

/** How a new value differs from the last one. */
export type ChannelChange = "damage" | "repair" | "none";

/** Animation state of one overlay channel (values are bar fractions 0–1). */
export interface ChannelAnimation {
  /** Current fill fraction. */
  value: number;
  /** Ghost-trail fraction (≥ value while draining). */
  ghost: number;
  /** Remaining ghost hold time. */
  ghostHoldMs: number;
  /** Remaining damage flash time. */
  flashMs: number;
  /** Remaining shimmer time. */
  shimmerMs: number;
  /** Time since the current shimmer started (drives the sweep). */
  shimmerElapsedMs: number;
}

/**
 * A channel at rest.
 * @param fraction - Initial fill fraction.
 * @returns A new idle channel.
 */
export function createChannel(fraction: number): ChannelAnimation {
  return {
    value: fraction,
    ghost: fraction,
    ghostHoldMs: 0,
    flashMs: 0,
    shimmerMs: 0,
    shimmerElapsedMs: 0,
  };
}

/**
 * Start (or extend) the repair shimmer. An active shimmer keeps its sweep
 * phase so continuous regeneration reads as one steady sweep.
 * @param channel - The channel (mutated).
 */
export function triggerShimmer(channel: ChannelAnimation): void {
  if (channel.shimmerMs <= 0) channel.shimmerElapsedMs = 0;
  channel.shimmerMs = SHIMMER_DURATION_MS;
}

/**
 * Feed a new fill fraction; losses start the damage cues, gains the repair
 * shimmer.
 * @param channel - The channel (mutated).
 * @param fraction - New fill fraction.
 * @returns What kind of change it was.
 */
export function setChannelValue(
  channel: ChannelAnimation,
  fraction: number,
): ChannelChange {
  const delta = fraction - channel.value;
  if (Math.abs(delta) < VALUE_EPSILON) return "none";
  if (delta < 0) {
    channel.ghost = Math.max(channel.ghost, channel.value);
    channel.ghostHoldMs = GHOST_HOLD_MS;
    channel.flashMs = DAMAGE_FLASH_MS;
    channel.value = fraction;
    return "damage";
  }
  channel.value = fraction;
  channel.ghost = Math.max(channel.ghost, fraction);
  triggerShimmer(channel);
  return "repair";
}

/**
 * Advance a channel's timers by one frame.
 * @param channel - The channel (mutated).
 * @param deltaMs - Frame length (ms).
 */
export function stepChannel(channel: ChannelAnimation, deltaMs: number): void {
  channel.flashMs = Math.max(0, channel.flashMs - deltaMs);
  if (channel.shimmerMs > 0) {
    channel.shimmerMs = Math.max(0, channel.shimmerMs - deltaMs);
    channel.shimmerElapsedMs += deltaMs;
  }
  if (channel.ghost <= channel.value) {
    channel.ghost = channel.value;
    return;
  }
  const holdLeft = channel.ghostHoldMs - deltaMs;
  channel.ghostHoldMs = Math.max(0, holdLeft);
  if (holdLeft >= 0) return;
  const drain = (GHOST_DRAIN_PER_SECOND * -holdLeft) / MS_PER_SECOND;
  channel.ghost = Math.max(channel.value, channel.ghost - drain);
}

/**
 * Damage flash intensity.
 * @param channel - The channel.
 * @returns 1 at the hit, fading to 0.
 */
export function flashStrength(channel: ChannelAnimation): number {
  return channel.flashMs / DAMAGE_FLASH_MS;
}

/**
 * Repair shimmer intensity ("+" glyph alpha).
 * @param channel - The channel.
 * @returns 1 right after a repair pulse, fading to 0.
 */
export function shimmerStrength(channel: ChannelAnimation): number {
  return channel.shimmerMs / SHIMMER_DURATION_MS;
}

/**
 * Where the shimmer band is along the restored span.
 * @param channel - The channel.
 * @returns 0 (bar start) → 1 (fill edge), or null when not shimmering.
 */
export function shimmerSweep(channel: ChannelAnimation): number | null {
  if (channel.shimmerMs <= 0) return null;
  return (channel.shimmerElapsedMs % SHIMMER_SWEEP_MS) / SHIMMER_SWEEP_MS;
}

/**
 * Whether any cue is still playing on the channel.
 * @param channel - The channel.
 * @returns True while flashing, shimmering or draining a ghost.
 */
export function isChannelAnimating(channel: ChannelAnimation): boolean {
  return (
    channel.flashMs > 0 ||
    channel.shimmerMs > 0 ||
    channel.ghost > channel.value
  );
}
