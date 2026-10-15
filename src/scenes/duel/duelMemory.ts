/**
 * duelMemory — the difficulty (and format / boss) a setup screen reopens
 * with: what the player flew last in that mode, kept through the versioned
 * setup memory. Unknown or corrupt values read as "nothing remembered".
 */

import {
  loadModeSettings,
  saveModeSettings,
  type SettingValue,
} from "../../systems/setup/setupMemory";

/** Modes with a remembered setup. */
export type RememberedMode = "dogfight" | "ace_duel" | "boss_raid";

/**
 * @param mode - The mode.
 * @param key - Setting name.
 * @param allowed - The values the screen accepts.
 * @returns The remembered value when it is one of `allowed`, else null.
 */
export function remembered<T extends string>(
  mode: RememberedMode,
  key: string,
  allowed: readonly T[],
): T | null {
  const value = loadModeSettings(mode)[key];
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * @param mode - The mode.
 * @param settings - Settings to remember (merged with earlier ones).
 */
export function remember(
  mode: RememberedMode,
  settings: Readonly<Record<string, SettingValue>>,
): void {
  saveModeSettings(mode, settings);
}
