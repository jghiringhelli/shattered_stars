/**
 * settingsSchema — the versioned settings document: types, defaults and a
 * tolerant parser that migrates older documents and validates every field
 * independently (a bad field falls back to its default; the rest survive).
 *
 * Version history:
 * - v1 (unversioned): flat { masterVolume, musicVolume, sfxVolume,
 *   cameraShake, showDamageNumbers, showMinimap }.
 * - v2: sections audio / accessibility / gameplay / controls / privacy.
 *
 * Pure: no Phaser, no storage.
 */

import type { ActionIntent } from "../input/InputTypes";
import {
  makeChord,
  validateChord,
  type KeyChord,
  type KeyOverrides,
} from "../input/KeyBindings";
import { isRebindableIntent } from "../input/RebindableIntents";
import {
  parseGamepadOverrides,
  type GamepadOverrides,
} from "../input/GamepadBindings";

/** Current schema version. */
export const SETTINGS_VERSION = 2;

/** Colour-vision palettes the HUD can switch to. */
export const COLOR_VISION_MODES = [
  "normal",
  "protanopia",
  "deuteranopia",
  "tritanopia",
] as const;
export type ColorVisionMode = (typeof COLOR_VISION_MODES)[number];

/** Bot difficulty presets (setup screens' default selection). */
export const DIFFICULTY_LEVELS = ["easy", "normal", "hard", "brutal"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

/** HUD text scale steps. */
export const TEXT_SCALES = [1, 1.15, 1.3] as const;

/** Number of saved keyboard profiles. */
export const CONTROL_PROFILE_COUNT = 3;

export interface AudioPrefs {
  readonly master: number;
  readonly music: number;
  readonly sfx: number;
  readonly ui: number;
}

export interface AccessibilityPrefs {
  readonly colorVision: ColorVisionMode;
  readonly highContrastHud: boolean;
  /** Camera-shake intensity multiplier in [0, 1]; 0 disables shake. */
  readonly screenShake: number;
  readonly reduceFlashes: boolean;
  /** HUD text scale, one of {@link TEXT_SCALES}. */
  readonly textScale: number;
}

export interface GameplayPrefs {
  readonly defaultDifficulty: DifficultyLevel;
  /** Wingmen mark their own focus while the player has no mark. */
  readonly markAssist: boolean;
  readonly showDamageNumbers: boolean;
  readonly showMinimap: boolean;
}

export interface ControlProfile {
  readonly name: string;
  readonly keyboard: KeyOverrides;
  /** Gamepad button overrides (Settings › Gamepad); {} = default layout. */
  readonly gamepad: GamepadOverrides;
}

export interface ControlsPrefs {
  readonly activeProfile: number;
  readonly profiles: readonly ControlProfile[];
}

export interface PrivacyPrefs {
  /** Local-only event log (never sent anywhere). */
  readonly telemetryEnabled: boolean;
}

/** The whole settings document. */
export interface GameSettings {
  readonly version: number;
  readonly audio: AudioPrefs;
  readonly accessibility: AccessibilityPrefs;
  readonly gameplay: GameplayPrefs;
  readonly controls: ControlsPrefs;
  readonly privacy: PrivacyPrefs;
}

const EMPTY_OVERRIDES: KeyOverrides = {};
const EMPTY_GAMEPAD_OVERRIDES: GamepadOverrides = {};

/**
 * @param index - Profile slot.
 * @returns The slot's display name.
 */
export function profileName(index: number): string {
  return `Profile ${index + 1}`;
}

const DEFAULT_PROFILES: readonly ControlProfile[] = Array.from(
  { length: CONTROL_PROFILE_COUNT },
  (_, i) => ({
    name: profileName(i),
    keyboard: EMPTY_OVERRIDES,
    gamepad: EMPTY_GAMEPAD_OVERRIDES,
  }),
);

/** Defaults for a fresh install. */
export const DEFAULT_SETTINGS: GameSettings = {
  version: SETTINGS_VERSION,
  audio: { master: 0.8, music: 0.7, sfx: 1, ui: 0.8 },
  accessibility: {
    colorVision: "normal",
    highContrastHud: false,
    screenShake: 1,
    reduceFlashes: false,
    textScale: 1,
  },
  gameplay: {
    defaultDifficulty: "normal",
    markAssist: true,
    showDamageNumbers: true,
    showMinimap: true,
  },
  controls: { activeProfile: 0, profiles: DEFAULT_PROFILES },
  privacy: { telemetryEnabled: true },
};

type Json = Readonly<Record<string, unknown>>;

function asObject(value: unknown): Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function unit(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function oneOf<T extends string | number>(
  options: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function parseAudio(raw: Json): AudioPrefs {
  const d = DEFAULT_SETTINGS.audio;
  return {
    master: unit(raw.master, d.master),
    music: unit(raw.music, d.music),
    sfx: unit(raw.sfx, d.sfx),
    ui: unit(raw.ui, d.ui),
  };
}

function parseAccessibility(raw: Json): AccessibilityPrefs {
  const d = DEFAULT_SETTINGS.accessibility;
  return {
    colorVision: oneOf(COLOR_VISION_MODES, raw.colorVision, d.colorVision),
    highContrastHud: flag(raw.highContrastHud, d.highContrastHud),
    screenShake: unit(raw.screenShake, d.screenShake),
    reduceFlashes: flag(raw.reduceFlashes, d.reduceFlashes),
    textScale: oneOf<number>(TEXT_SCALES, raw.textScale, d.textScale),
  };
}

function parseGameplay(raw: Json): GameplayPrefs {
  const d = DEFAULT_SETTINGS.gameplay;
  return {
    defaultDifficulty: oneOf(
      DIFFICULTY_LEVELS,
      raw.defaultDifficulty,
      d.defaultDifficulty,
    ),
    markAssist: flag(raw.markAssist, d.markAssist),
    showDamageNumbers: flag(raw.showDamageNumbers, d.showDamageNumbers),
    showMinimap: flag(raw.showMinimap, d.showMinimap),
  };
}

function parseChord(raw: unknown): KeyChord | null | undefined {
  if (raw === null) return null;
  const obj = asObject(raw);
  if (typeof obj.key !== "string") return undefined;
  const chord = makeChord(obj.key, {
    shift: obj.shift === true,
    ctrl: obj.ctrl === true,
    alt: obj.alt === true,
  });
  return validateChord(chord) === "ok" ? chord : undefined;
}

function parseOverrides(raw: unknown): KeyOverrides {
  const result: Partial<Record<ActionIntent, KeyChord | null>> = {};
  for (const [intent, value] of Object.entries(asObject(raw))) {
    if (!isRebindableIntent(intent)) continue;
    const chord = parseChord(value);
    if (chord !== undefined) result[intent] = chord;
  }
  return result;
}

function parseControls(raw: Json): ControlsPrefs {
  const stored = Array.isArray(raw.profiles) ? raw.profiles : [];
  const profiles = DEFAULT_PROFILES.map((fallback, i) => ({
    name: fallback.name,
    keyboard: parseOverrides(asObject(stored[i]).keyboard),
    gamepad: parseGamepadOverrides(asObject(stored[i]).gamepad),
  }));
  const active = raw.activeProfile;
  const valid =
    typeof active === "number" &&
    Number.isInteger(active) &&
    active >= 0 &&
    active < CONTROL_PROFILE_COUNT;
  return { activeProfile: valid ? active : 0, profiles };
}

/**
 * Lift an unversioned v1 document into the v2 section layout.
 *
 * @param v1 - Flat v1 fields.
 * @returns A v2-shaped raw object (validated afterwards like any other).
 */
function migrateV1(v1: Json): Json {
  return {
    version: SETTINGS_VERSION,
    audio: {
      master: v1.masterVolume,
      music: v1.musicVolume,
      sfx: v1.sfxVolume,
    },
    accessibility: {
      screenShake: v1.cameraShake === false ? 0 : 1,
    },
    gameplay: {
      showDamageNumbers: v1.showDamageNumbers,
      showMinimap: v1.showMinimap,
    },
  };
}

/**
 * Parse any stored value into a complete, valid settings document.
 *
 * @param raw - Parsed JSON (any shape, any version).
 * @returns Valid settings at {@link SETTINGS_VERSION}.
 */
export function parseSettings(raw: unknown): GameSettings {
  const input = asObject(raw);
  const doc = typeof input.version === "number" ? input : migrateV1(input);
  return {
    version: SETTINGS_VERSION,
    audio: parseAudio(asObject(doc.audio)),
    accessibility: parseAccessibility(asObject(doc.accessibility)),
    gameplay: parseGameplay(asObject(doc.gameplay)),
    controls: parseControls(asObject(doc.controls)),
    privacy: {
      telemetryEnabled: flag(
        asObject(doc.privacy).telemetryEnabled,
        DEFAULT_SETTINGS.privacy.telemetryEnabled,
      ),
    },
  };
}
