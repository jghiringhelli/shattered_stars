/**
 * HoloTheme — design tokens for the holographic in-battle HUD and menus.
 *
 * Look: dark translucent panels, thin faction-coloured borders, a single
 * system sans-serif stack, icon-first readouts. Every HUD/menu component reads
 * its colours, type, spacing and depths from here so the look is changed in
 * one place.
 */

import type Phaser from "phaser";
import { FACTION_COLORS, type FactionId } from "../../config";
import { liftColor, toCssColor } from "./colorMath";

/** System sans-serif stack — no web-font download. */
export const HOLO_FONT_FAMILY =
  '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Colour/opacity tokens of the holographic palette. */
export interface HoloPaletteTokens {
  readonly panelFill: number;
  readonly panelAlpha: number;
  readonly panelFillRaised: number;
  readonly border: number;
  readonly borderAlpha: number;
  readonly textPrimary: number;
  readonly textSecondary: number;
  readonly textMuted: number;
  readonly accent: number;
  readonly success: number;
  readonly warning: number;
  readonly danger: number;
  readonly shield: number;
  readonly target: number;
  readonly mark: number;
  readonly track: number;
  readonly trackAlpha: number;
}

/**
 * Neutral palette shared by every holographic surface.
 *
 * LIVE tokens: Settings › Accessibility (colour-vision palette, high-contrast
 * HUD) rewrites these values in place via `applyThemePreferences`
 * (signalPalettes.ts), so read them when drawing — don't copy them into
 * module-level constants.
 */
export const HOLO_PALETTE: HoloPaletteTokens = {
  /** Panel interior fill (used with `panelAlpha`). */
  panelFill: 0x06111b,
  /** Panel fill opacity — translucent so the battlefield shows through. */
  panelAlpha: 0.72,
  /** Raised panel / hovered control fill. */
  panelFillRaised: 0x0e2233,
  /** Default thin border. */
  border: 0x3d7393,
  /** Border opacity. */
  borderAlpha: 0.85,
  /** Primary text (values, titles). */
  textPrimary: 0xe6f6ff,
  /** Secondary text (labels). */
  textSecondary: 0x9cc3d6,
  /** Muted text (hints, disabled). */
  textMuted: 0x5a7a8c,
  /** Interactive / highlight accent. */
  accent: 0x4fd8ff,
  /** Positive state (healthy hull, ready weapon). */
  success: 0x4dffa0,
  /** Caution state (damaged, stress building). */
  warning: 0xffc94a,
  /** Danger state (critical hull, stressed, destructive action). */
  danger: 0xff4d5e,
  /** Shield arcs and pips. */
  shield: 0x5cc8ff,
  /** Locked-target marker colour. */
  target: 0xffb347,
  /** Squad-mark brackets (red by default — a mark is a hostile, never the amber lock). */
  mark: 0xff4d5e,
  /** Background track drawn under gauges (used with `trackAlpha`). */
  track: 0xbfe6ff,
  /** Gauge track opacity. */
  trackAlpha: 0.14,
};

/** Allegiance of a ship relative to the local player. */
export type HoloSide = "player" | "ally" | "enemy" | "neutral";

/** Side colours: blips, edge arrows, contact markers. LIVE (see HOLO_PALETTE). */
export const SIDE_COLORS: Readonly<Record<HoloSide, number>> = {
  player: 0x7fe8ff,
  ally: 0x3f9dff,
  enemy: 0xff4d4d,
  neutral: 0xc9ced6,
};

/** How far dark faction colours are lifted toward white to read as borders. */
const FACTION_ACCENT_LIFT = 0.35;

/** Faction accents — FACTION_COLORS lifted for legibility on dark panels. */
export const FACTION_ACCENTS: Readonly<Record<FactionId, number>> = {
  terran_hegemony: liftColor(
    FACTION_COLORS.terran_hegemony,
    FACTION_ACCENT_LIFT,
  ),
  free_confederation: liftColor(
    FACTION_COLORS.free_confederation,
    FACTION_ACCENT_LIFT,
  ),
  synthetic_collective: liftColor(
    FACTION_COLORS.synthetic_collective,
    FACTION_ACCENT_LIFT,
  ),
  void_corsairs: liftColor(FACTION_COLORS.void_corsairs, FACTION_ACCENT_LIFT),
  ascendant_empire: liftColor(
    FACTION_COLORS.ascendant_empire,
    FACTION_ACCENT_LIFT,
  ),
};

/** A step in the type scale. */
export interface HoloTypeStep {
  /** Font size in CSS pixels. */
  readonly size: number;
  /** CSS font weight / style keyword passed to Phaser's `fontStyle`. */
  readonly weight: string;
  /** Extra letter spacing in pixels. */
  readonly letterSpacing: number;
}

/** Name of a type-scale step. */
export type HoloTypeRole = "title" | "heading" | "body" | "caption" | "numeric";

/** Type scale — one family, five roles. */
export const HOLO_TYPE_SCALE: Readonly<Record<HoloTypeRole, HoloTypeStep>> = {
  title: { size: 28, weight: "300", letterSpacing: 4 },
  heading: { size: 18, weight: "600", letterSpacing: 2 },
  body: { size: 14, weight: "400", letterSpacing: 0.5 },
  caption: { size: 11, weight: "600", letterSpacing: 1.5 },
  numeric: { size: 16, weight: "600", letterSpacing: 0.5 },
};

/** Spacing scale in pixels (4-px rhythm). */
export const HOLO_SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Corner radii in pixels. */
export const HOLO_RADIUS = { sm: 3, md: 6, lg: 10 } as const;

/** Border widths in pixels. */
export const HOLO_BORDER = {
  /** Default panel / gauge outline. */
  hairline: 1,
  /** Emphasised outline (selected slot, header underline). */
  regular: 1.5,
  /** Keyboard focus ring. */
  focus: 2,
} as const;

/** Opacity tokens. */
export const HOLO_ALPHA = {
  /** Disabled control content. */
  disabled: 0.38,
  /** Radar contacts beyond range (clamped to rim). */
  outOfRange: 0.4,
  /** Subtle structural lines (range rings, ticks). */
  structure: 0.28,
} as const;

/**
 * Depth layers. Battle scenes put ships around 10–20, legacy HUD at 1000,
 * overlays at 2000+, so the holo layers slot in without reordering scenes.
 */
export const HOLO_DEPTH = {
  /** World-space overlays that follow ships (status ring). */
  worldOverlay: 40,
  /** Screen-space HUD root (radar, weapons, readouts). */
  hud: 1000,
  /** Screen-edge arrows — above the HUD so they are never hidden. */
  hudIndicators: 1010,
  /** Menu panels. */
  menuPanel: 2000,
  /** Menu controls (buttons) above their panels. */
  menuControl: 2001,
  /** Modal dialogs. */
  modal: 3000,
} as const;

/** HUD text scale (Settings › Accessibility › Text size); 1 = design size. */
let hudTextScale = 1;

/**
 * Scale every type-scale role built by {@link holoTextStyle} (applies to
 * text created afterwards).
 *
 * @param scale - Multiplier, e.g. 1.15.
 */
export function setHudTextScale(scale: number): void {
  hudTextScale = scale > 0 ? scale : 1;
}

/**
 * Build a Phaser text style for a type-scale role.
 *
 * @param role - Type-scale step.
 * @param color - Text colour (0xRRGGBB). Defaults to primary text.
 * @returns A Phaser TextStyle using the holo font stack.
 */
export function holoTextStyle(
  role: HoloTypeRole,
  color: number = HOLO_PALETTE.textPrimary,
): Phaser.Types.GameObjects.Text.TextStyle {
  const step = HOLO_TYPE_SCALE[role];
  return {
    fontFamily: HOLO_FONT_FAMILY,
    fontSize: `${Math.round(step.size * hudTextScale)}px`,
    fontStyle: step.weight,
    color: toCssColor(color),
  };
}

/**
 * Accent colour for a faction, or the neutral accent when none is given.
 *
 * @param faction - Faction id, or undefined for the neutral accent.
 * @returns A border/header colour legible on dark panels.
 */
export function factionAccent(faction: FactionId | undefined): number {
  return faction === undefined ? HOLO_PALETTE.accent : FACTION_ACCENTS[faction];
}
