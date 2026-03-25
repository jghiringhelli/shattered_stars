/**
 * SettingsStorage
 *
 * Pure localStorage persistence for game settings.
 * Zero Phaser imports — safe to use from any TypeScript module or test.
 */

const STORAGE_KEY = 'shattered_stars_settings';

/** All configurable game options reflected in SettingsScene. */
export interface GameSettings {
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly cameraShake: boolean;
  readonly showDamageNumbers: boolean;
  readonly showMinimap: boolean;
}

/** Default values applied when no saved data is found in localStorage. */
export const DEFAULT_SETTINGS: Readonly<GameSettings> = {
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 1.0,
  cameraShake: true,
  showDamageNumbers: true,
  showMinimap: true,
};

/**
 * Load saved settings from localStorage, merged over defaults.
 * Never throws — returns defaults on any parse error or missing key.
 *
 * @returns A GameSettings value, always fully populated.
 */
export function loadSettings(): GameSettings {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persist current settings to localStorage.
 *
 * @param settings - The settings object to store.
 */
export function saveSettings(settings: GameSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
