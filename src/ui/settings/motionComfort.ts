/**
 * motionComfort — "reduce motion": the Settings switch OR the OS-level
 * `prefers-reduced-motion` media query. When on, screen shake is off, flashes
 * are dimmed, and the backdrop's drifting decor and spin stand still. Pure
 * rules plus one process-wide flag the renderers read.
 */

import type { AccessibilityPrefs } from "../../systems/settingsSchema";

/** The comfort levels derived from the accessibility prefs. */
export interface EffectiveComfort {
  readonly shakeScale: number;
  readonly reduceFlashes: boolean;
  readonly reduceMotion: boolean;
}

/** Minimal `matchMedia` host (the browser window, or a test double). */
export interface MediaHost {
  matchMedia?: (query: string) => { readonly matches: boolean };
}

/** The media query browsers expose the OS setting through. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * @param host - Where to ask (default: the global window).
 * @returns Whether the OS asks for reduced motion.
 */
export function osPrefersReducedMotion(
  host: MediaHost = globalThis as MediaHost,
): boolean {
  try {
    return host.matchMedia?.(REDUCED_MOTION_QUERY).matches === true;
  } catch {
    return false;
  }
}

/**
 * @param prefs - Accessibility settings.
 * @param osReduced - The OS asks for reduced motion.
 * @returns What shake, flashes and drift should do.
 */
export function effectiveComfort(
  prefs: AccessibilityPrefs,
  osReduced: boolean,
): EffectiveComfort {
  const reduceMotion = prefs.reduceMotion || osReduced;
  return {
    shakeScale: reduceMotion ? 0 : prefs.screenShake,
    reduceFlashes: reduceMotion || prefs.reduceFlashes,
    reduceMotion,
  };
}

let motionReduced = false;

/** @param reduced - New process-wide state (set when settings apply). */
export function setMotionReduced(reduced: boolean): void {
  motionReduced = reduced;
}

/** @returns Whether decorative motion (drift, spin) should stand still. */
export function isMotionReduced(): boolean {
  return motionReduced;
}
