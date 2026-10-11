/**
 * settingsRuntime — applies a settings document to the running game:
 * audio buses, theme tokens (colour vision / high contrast / text size),
 * the keyboard profile, camera comfort and the legacy registry view battle
 * scenes read. `bootstrapPlayerPreferences` runs once at boot (main.ts).
 */

import type Phaser from "phaser";
import { audioManager } from "../../audio/AudioManager";
import { applyKeyboardOverrides } from "../../input/activeBindings";
import {
  activeKeyOverrides,
  legacyRegistrySettings,
  loadSettings,
  saveSettings,
  type GameSettings,
} from "../../systems/SettingsStorage";
import { installTelemetry } from "../../telemetry/telemetry";
import { applyThemePreferences } from "../theme/signalPalettes";
import { installCameraComfort, setCameraComfort } from "./cameraComfort";

/** Registry key holding the full settings document. */
export const PREFERENCES_REGISTRY_KEY = "preferences";
/** Registry key of the legacy flat view (cameraShake, showDamageNumbers...). */
export const LEGACY_SETTINGS_REGISTRY_KEY = "settings";

/**
 * Apply every setting to its runtime system.
 *
 * @param settings - Settings document.
 * @param registry - Game registry to publish to (optional).
 */
export function applySettings(
  settings: GameSettings,
  registry?: Phaser.Data.DataManager,
): void {
  const { audio, accessibility } = settings;
  audioManager.setMasterVolume(audio.master);
  audioManager.setMusicVolume(audio.music);
  audioManager.setSfxVolume(audio.sfx);
  audioManager.setUiVolume(audio.ui);
  applyThemePreferences(accessibility);
  applyKeyboardOverrides(activeKeyOverrides(settings));
  setCameraComfort({
    shakeScale: accessibility.screenShake,
    reduceFlashes: accessibility.reduceFlashes,
  });
  registry?.set(PREFERENCES_REGISTRY_KEY, settings);
  registry?.set(LEGACY_SETTINGS_REGISTRY_KEY, legacyRegistrySettings(settings));
}

/**
 * Persist and apply.
 *
 * @param settings - New settings document.
 * @param registry - Game registry to publish to.
 */
export function commitSettings(
  settings: GameSettings,
  registry?: Phaser.Data.DataManager,
): void {
  saveSettings(settings);
  applySettings(settings, registry);
}

/**
 * Boot: install camera comfort and telemetry, load and apply settings.
 *
 * @param game - The game.
 */
export function bootstrapPlayerPreferences(game: Phaser.Game): void {
  installCameraComfort();
  if (typeof window !== "undefined") installTelemetry(window);
  applySettings(loadSettings(), game.registry);
}
