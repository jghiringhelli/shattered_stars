/**
 * Map legacy ButtonFactory fill colours onto the three holo button variants,
 * so existing call sites keep their meaning (green = go, red = destructive)
 * while rendering in the shared holographic style.
 */

import type { HoloButtonVariant } from "../hud/holoButtonStyle";

const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
const CHANNEL_MASK = 0xff;
/** A channel must exceed the others by this factor to count as dominant. */
const DOMINANCE = 1.35;
/** Below this brightness a colour is treated as neutral chrome. */
const MIN_SIGNAL = 0x30;

/**
 * Classify a fill colour as a holo button variant.
 *
 * @param color - Legacy fill colour (0xRRGGBB).
 * @returns "danger" for red-dominant, "primary" for green-dominant,
 *   otherwise "secondary".
 */
export function variantForColor(color: number): HoloButtonVariant {
  const red = (color >> RED_SHIFT) & CHANNEL_MASK;
  const green = (color >> GREEN_SHIFT) & CHANNEL_MASK;
  const blue = color & CHANNEL_MASK;
  if (red >= MIN_SIGNAL && red > green * DOMINANCE && red > blue * DOMINANCE) {
    return "danger";
  }
  if (
    green >= MIN_SIGNAL &&
    green > red * DOMINANCE &&
    green > blue * DOMINANCE
  ) {
    return "primary";
  }
  return "secondary";
}
