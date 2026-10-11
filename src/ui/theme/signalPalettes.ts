/**
 * signalPalettes — colour-vision palettes for HUD signals and the
 * high-contrast chrome, applied to the LIVE theme tokens (HOLO_PALETTE,
 * SIDE_COLORS) so radar blips, edge arrows, status ring, mark brackets and
 * overlays all switch together.
 *
 * Red/green modes move hostiles onto the blue↔amber axis (Okabe–Ito);
 * tritanopia uses the cyan↔red axis. Every palette is verified in
 * tests/unit/ui/theme/signalPalettes.test.ts by simulating the deficiency
 * and measuring ΔE between signals that must never be confused.
 */

import type { ColorVisionMode } from "../../systems/settingsSchema";
import {
  HOLO_PALETTE,
  SIDE_COLORS,
  setHudTextScale,
  type HoloPaletteTokens,
  type HoloSide,
} from "./HoloTheme";

/** Every colour that carries meaning on the HUD. */
export interface SignalPalette {
  readonly player: number;
  readonly ally: number;
  readonly enemy: number;
  readonly neutral: number;
  readonly mark: number;
  readonly target: number;
  readonly success: number;
  readonly warning: number;
  readonly danger: number;
  readonly shield: number;
}

const NEUTRAL_GREY = 0xc9ced6;
const SHIELD_BLUE = 0x5cc8ff;

/** Red/green-safe base shared by protanopia and deuteranopia. */
const RED_GREEN_SAFE = {
  player: 0x9ad8ff,
  ally: 0x2f8cff,
  enemy: 0xffb000,
  neutral: NEUTRAL_GREY,
  mark: 0xd55e00,
  success: 0x3fb4ff,
  shield: SHIELD_BLUE,
} as const;

/** Palettes per colour-vision mode. `normal` is the established HUD look. */
export const SIGNAL_PALETTES: Readonly<Record<ColorVisionMode, SignalPalette>> =
  {
    normal: {
      player: 0x7fe8ff,
      ally: 0x3f9dff,
      enemy: 0xff4d4d,
      neutral: NEUTRAL_GREY,
      mark: 0xff4d5e,
      target: 0xffb347,
      success: 0x4dffa0,
      warning: 0xffc94a,
      danger: 0xff4d5e,
      shield: SHIELD_BLUE,
    },
    protanopia: {
      ...RED_GREEN_SAFE,
      target: 0xff5fd2,
      warning: 0xf0e442,
      danger: 0xff3d00,
    },
    deuteranopia: {
      ...RED_GREEN_SAFE,
      target: 0xffffff,
      warning: 0xffe14d,
      danger: 0xff6680,
    },
    tritanopia: {
      player: 0xa0fff0,
      ally: 0x00c2b8,
      enemy: 0xff3a5c,
      neutral: NEUTRAL_GREY,
      mark: 0xff40ff,
      target: 0xffffff,
      success: 0x00d6c4,
      warning: 0xff9de0,
      danger: 0xff2a4a,
      shield: SHIELD_BLUE,
    },
  };

type ChromeTokens = Pick<
  HoloPaletteTokens,
  | "panelAlpha"
  | "border"
  | "borderAlpha"
  | "textSecondary"
  | "textMuted"
  | "trackAlpha"
>;

/** Default chrome, captured before any preference is applied. */
const STANDARD_CHROME: ChromeTokens = {
  panelAlpha: HOLO_PALETTE.panelAlpha,
  border: HOLO_PALETTE.border,
  borderAlpha: HOLO_PALETTE.borderAlpha,
  textSecondary: HOLO_PALETTE.textSecondary,
  textMuted: HOLO_PALETTE.textMuted,
  trackAlpha: HOLO_PALETTE.trackAlpha,
};

/** High-contrast HUD: near-opaque panels, brighter borders and text. */
const HIGH_CONTRAST_CHROME: ChromeTokens = {
  panelAlpha: 0.92,
  border: 0x7cc4ea,
  borderAlpha: 1,
  textSecondary: 0xcfe8f5,
  textMuted: 0xa3c0cf,
  trackAlpha: 0.3,
};

/** Theme-related preferences (a subset of Settings › Accessibility). */
export interface ThemePreferences {
  readonly colorVision: ColorVisionMode;
  readonly highContrastHud: boolean;
  readonly textScale: number;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * Rewrite the live theme tokens for the given preferences. HUD widgets read
 * the tokens every redraw, so the change shows on their next update.
 *
 * @param prefs - Colour vision, high contrast, text scale.
 */
export function applyThemePreferences(prefs: ThemePreferences): void {
  const signals = SIGNAL_PALETTES[prefs.colorVision];
  const palette = HOLO_PALETTE as Mutable<HoloPaletteTokens>;
  Object.assign(
    palette,
    prefs.highContrastHud ? HIGH_CONTRAST_CHROME : STANDARD_CHROME,
  );
  palette.success = signals.success;
  palette.warning = signals.warning;
  palette.danger = signals.danger;
  palette.shield = signals.shield;
  palette.target = signals.target;
  palette.mark = signals.mark;
  const sides = SIDE_COLORS as Mutable<Record<HoloSide, number>>;
  sides.player = signals.player;
  sides.ally = signals.ally;
  sides.enemy = signals.enemy;
  sides.neutral = signals.neutral;
  setHudTextScale(prefs.textScale);
}
