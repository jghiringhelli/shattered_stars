/**
 * Pure colour helpers for the holographic UI theme.
 *
 * Colours are 24-bit RGB integers (0xRRGGBB), the format Phaser Graphics
 * consume. No Phaser import, so these are unit-testable in node.
 */

const CHANNEL_MAX = 0xff;
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
const HEX_DIGITS = 6;
const HEX_RADIX = 16;
const WHITE = 0xffffff;

/** Clamp `value` into [0, 1]; NaN becomes 0. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function channel(color: number, shift: number): number {
  return (color >> shift) & CHANNEL_MAX;
}

/**
 * Linearly interpolate between two RGB colours.
 *
 * @param from - Colour returned at t = 0.
 * @param to - Colour returned at t = 1.
 * @param t - Blend factor, clamped to [0, 1].
 * @returns The blended 0xRRGGBB colour.
 */
export function mixColor(from: number, to: number, t: number): number {
  const k = clamp01(t);
  const blend = (shift: number): number => {
    const a = channel(from, shift);
    const b = channel(to, shift);
    return Math.round(a + (b - a) * k) << shift;
  };
  return blend(RED_SHIFT) | blend(GREEN_SHIFT) | blend(0);
}

/**
 * Blend across evenly spaced colour stops (e.g. calm → warning → danger).
 *
 * @param stops - Colours at t = 0, ..., t = 1; must not be empty.
 * @param t - Position along the ramp, clamped to [0, 1].
 * @returns The blended colour; a single stop is returned as-is.
 */
export function mixColorStops(stops: ReadonlyArray<number>, t: number): number {
  const last = stops.length - 1;
  if (last < 0)
    throw new RangeError("mixColorStops requires at least one colour stop");
  if (last === 0) return stops[0] as number;
  const scaled = clamp01(t) * last;
  const index = Math.min(Math.floor(scaled), last - 1);
  return mixColor(
    stops[index] as number,
    stops[index + 1] as number,
    scaled - index,
  );
}

/**
 * Blend a colour toward white — used to make dark faction colours legible
 * as thin borders on dark translucent panels.
 *
 * @param color - Base colour.
 * @param amount - 0 keeps the colour, 1 yields white.
 * @returns The lifted colour.
 */
export function liftColor(color: number, amount: number): number {
  return mixColor(color, WHITE, amount);
}

/**
 * Convert a 0xRRGGBB integer to a CSS hex string for Phaser Text styles.
 *
 * @param color - 24-bit colour.
 * @returns A string such as "#4fd8ff".
 */
export function toCssColor(color: number): string {
  const masked = color & WHITE;
  return `#${masked.toString(HEX_RADIX).padStart(HEX_DIGITS, "0")}`;
}
