/**
 * SettingsStorage — persistence of the versioned settings document
 * (schema, defaults and migration live in settingsSchema.ts) plus the
 * narrow getters gameplay code reads (mark assist, default difficulty,
 * telemetry opt-in). Zero Phaser imports; storage is injectable.
 */

import { browserStore, type KeyValueStore } from "./keyValueStore";
import {
  DEFAULT_SETTINGS,
  parseSettings,
  type DifficultyLevel,
  type GameSettings,
} from "./settingsSchema";
import type { KeyOverrides } from "../input/KeyBindings";
import type { GamepadOverrides } from "../input/GamepadBindings";

export * from "./settingsSchema";

/** localStorage key of the settings document (unchanged since v1). */
export const SETTINGS_STORAGE_KEY = "shattered_stars_settings";

/**
 * Load the settings document, migrated and validated.
 * Never throws — corrupt or missing data yields the defaults.
 *
 * @param store - Persistence (default: localStorage).
 * @returns Complete, valid settings.
 */
export function loadSettings(
  store: KeyValueStore = browserStore(),
): GameSettings {
  const raw = store.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return parseSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Persist the settings document.
 *
 * @param settings - Settings to store.
 * @param store - Persistence (default: localStorage).
 */
export function saveSettings(
  settings: GameSettings,
  store: KeyValueStore = browserStore(),
): void {
  store.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * @param settings - Settings.
 * @returns The active keyboard profile's overrides.
 */
export function activeKeyOverrides(settings: GameSettings): KeyOverrides {
  const { activeProfile, profiles } = settings.controls;
  return profiles[activeProfile]?.keyboard ?? {};
}

/**
 * @param settings - Settings.
 * @param keyboard - New overrides for the active profile.
 * @returns Settings with only the active profile changed.
 */
export function withActiveKeyOverrides(
  settings: GameSettings,
  keyboard: KeyOverrides,
): GameSettings {
  const { activeProfile, profiles } = settings.controls;
  return {
    ...settings,
    controls: {
      activeProfile,
      profiles: profiles.map((p, i) =>
        i === activeProfile ? { ...p, keyboard } : p,
      ),
    },
  };
}

/**
 * @param settings - Settings.
 * @returns The active profile's gamepad button overrides.
 */
export function activeGamepadOverrides(
  settings: GameSettings,
): GamepadOverrides {
  const { activeProfile, profiles } = settings.controls;
  return profiles[activeProfile]?.gamepad ?? {};
}

/**
 * @param settings - Settings.
 * @param gamepad - New gamepad overrides for the active profile.
 * @returns Settings with only the active profile's gamepad changed.
 */
export function withActiveGamepadOverrides(
  settings: GameSettings,
  gamepad: GamepadOverrides,
): GameSettings {
  const { activeProfile, profiles } = settings.controls;
  return {
    ...settings,
    controls: {
      activeProfile,
      profiles: profiles.map((p, i) =>
        i === activeProfile ? { ...p, gamepad } : p,
      ),
    },
  };
}

/**
 * Squad mark assist (Settings › Gameplay): whether the player's wingmen mark
 * their own focus while the player has no mark. Read by the squad AI layers.
 *
 * @param store - Persistence (default: localStorage).
 * @returns True when assist is on (default).
 */
export function isMarkAssistEnabled(
  store: KeyValueStore = browserStore(),
): boolean {
  return loadSettings(store).gameplay.markAssist;
}

/**
 * @param store - Persistence (default: localStorage).
 * @returns The difficulty setup screens preselect.
 */
export function defaultDifficulty(
  store: KeyValueStore = browserStore(),
): DifficultyLevel {
  return loadSettings(store).gameplay.defaultDifficulty;
}

/**
 * @param store - Persistence (default: localStorage).
 * @returns Whether the local event log records events.
 */
export function isTelemetryEnabled(
  store: KeyValueStore = browserStore(),
): boolean {
  return loadSettings(store).privacy.telemetryEnabled;
}

/** The flat shape battle scenes read from `registry.get("settings")`. */
export interface LegacyRegistrySettings {
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly cameraShake: boolean;
  readonly showDamageNumbers: boolean;
  readonly showMinimap: boolean;
}

/**
 * @param settings - Settings.
 * @returns The legacy flat view for scenes that read the game registry.
 */
export function legacyRegistrySettings(
  settings: GameSettings,
): LegacyRegistrySettings {
  return {
    masterVolume: settings.audio.master,
    musicVolume: settings.audio.music,
    sfxVolume: settings.audio.sfx,
    cameraShake: settings.accessibility.screenShake > 0,
    showDamageNumbers: settings.gameplay.showDamageNumbers,
    showMinimap: settings.gameplay.showMinimap,
  };
}
