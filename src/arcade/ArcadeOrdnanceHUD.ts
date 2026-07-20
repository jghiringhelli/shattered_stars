/**
 * ArcadeOrdnanceHUD — Pure helpers for ordnance cooldown display.
 */

import type { ArcadeOrdnanceSlot } from "./ArcadeOrdnance";

/**
 * Returns 0..1 fill fraction for a cooldown bar (0 = recharging, 1 = ready).
 *
 * @param slot - Ordnance slot to check.
 */
export function getCooldownFraction(slot: ArcadeOrdnanceSlot): number {
  if (slot.cooldownMax <= 0) return 1;
  return 1 - slot.cooldownRemaining / slot.cooldownMax;
}

/**
 * Returns a hex color tint based on readiness.
 *
 * @param fraction - 0..1 cooldown fill fraction.
 */
export function getCooldownColor(fraction: number): number {
  if (fraction >= 1) return 0x00ff88;
  if (fraction >= 0.5) return 0xffcc00;
  return 0x666666;
}
