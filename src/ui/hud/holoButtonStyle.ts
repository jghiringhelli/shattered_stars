/**
 * Visual state table for HoloButton — pure data derived from HoloTheme.
 */

import { HOLO_BORDER, HOLO_PALETTE } from "../theme/HoloTheme";
import { liftColor } from "../theme/colorMath";

/** Button visual variants. */
export type HoloButtonVariant = "primary" | "secondary" | "danger";

/** Pointer interaction state (disabled is handled separately). */
export type ButtonInteraction = "idle" | "hover" | "pressed";

/** Resolved colours for one variant in one state. */
export interface ButtonVisual {
  readonly fill: number;
  readonly fillAlpha: number;
  readonly border: number;
  readonly borderWidth: number;
  readonly text: number;
}

/** How much hover/pressed lift border and text toward white. */
const HOVER_LIFT = 0.25;
const PRESSED_LIFT = 0.45;
/** Accent-tinted fill opacity per state for tinted variants. */
const TINT_ALPHA = { idle: 0.16, hover: 0.3, pressed: 0.46 } as const;

function tinted(
  color: number,
  textColor: number,
): Readonly<Record<ButtonInteraction, ButtonVisual>> {
  return {
    idle: {
      fill: color,
      fillAlpha: TINT_ALPHA.idle,
      border: color,
      borderWidth: HOLO_BORDER.hairline,
      text: textColor,
    },
    hover: {
      fill: color,
      fillAlpha: TINT_ALPHA.hover,
      border: liftColor(color, HOVER_LIFT),
      borderWidth: HOLO_BORDER.regular,
      text: liftColor(textColor, HOVER_LIFT),
    },
    pressed: {
      fill: color,
      fillAlpha: TINT_ALPHA.pressed,
      border: liftColor(color, PRESSED_LIFT),
      borderWidth: HOLO_BORDER.regular,
      text: liftColor(textColor, PRESSED_LIFT),
    },
  };
}

const SECONDARY: Readonly<Record<ButtonInteraction, ButtonVisual>> = {
  idle: {
    fill: HOLO_PALETTE.panelFill,
    fillAlpha: HOLO_PALETTE.panelAlpha,
    border: HOLO_PALETTE.border,
    borderWidth: HOLO_BORDER.hairline,
    text: HOLO_PALETTE.textSecondary,
  },
  hover: {
    fill: HOLO_PALETTE.panelFillRaised,
    fillAlpha: HOLO_PALETTE.panelAlpha,
    border: HOLO_PALETTE.accent,
    borderWidth: HOLO_BORDER.regular,
    text: HOLO_PALETTE.textPrimary,
  },
  pressed: {
    fill: HOLO_PALETTE.accent,
    fillAlpha: TINT_ALPHA.idle,
    border: HOLO_PALETTE.accent,
    borderWidth: HOLO_BORDER.regular,
    text: HOLO_PALETTE.textPrimary,
  },
};

/** Visuals per variant and interaction state. */
export const BUTTON_VARIANTS: Readonly<
  Record<HoloButtonVariant, Readonly<Record<ButtonInteraction, ButtonVisual>>>
> = {
  primary: tinted(HOLO_PALETTE.accent, HOLO_PALETTE.textPrimary),
  secondary: SECONDARY,
  danger: tinted(
    HOLO_PALETTE.danger,
    liftColor(HOLO_PALETTE.danger, HOVER_LIFT),
  ),
};
