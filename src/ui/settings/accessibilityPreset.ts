/**
 * accessibilityPreset — the one-click ACCESSIBILITY PRESET of Settings ›
 * Accessibility: colour-blind-safe palette, high-contrast HUD, reduced
 * flashes and motion, 115 % text, low screen shake. Pure.
 */

import type {
  AccessibilityPrefs,
  GameSettings,
} from "../../systems/settingsSchema";

/** Screen-shake level of the preset ("low"). */
export const PRESET_SCREEN_SHAKE = 0.25;
/** HUD text scale of the preset. */
export const PRESET_TEXT_SCALE = 1.15;

/** The preset's accessibility values. */
export const ACCESSIBILITY_PRESET: AccessibilityPrefs = {
  colorVision: "deuteranopia",
  highContrastHud: true,
  screenShake: PRESET_SCREEN_SHAKE,
  reduceFlashes: true,
  reduceMotion: true,
  sharpScaling: true,
  textScale: PRESET_TEXT_SCALE,
};

/**
 * @param settings - Current settings.
 * @returns The settings with the accessibility preset applied (everything
 *   outside Accessibility is untouched).
 */
export function applyAccessibilityPreset(settings: GameSettings): GameSettings {
  return { ...settings, accessibility: { ...ACCESSIBILITY_PRESET } };
}

/**
 * @param prefs - Accessibility settings.
 * @returns Whether they already equal the preset.
 */
export function isAccessibilityPreset(prefs: AccessibilityPrefs): boolean {
  return (Object.keys(ACCESSIBILITY_PRESET) as Array<keyof AccessibilityPrefs>)
    .every((key) => prefs[key] === ACCESSIBILITY_PRESET[key]);
}
