/**
 * pickerStyle — holo styling shared by the ship picker panels: the type
 * steps they use, text factories, card frames by interaction state, the
 * stat colour map, fit-to-width text and a small padlock glyph.
 */

import type Phaser from "phaser";
import { drawHoloFrame, type HoloRect } from "../menu/holoChrome";
import { holoFont } from "../theme/holoFont";
import { HOLO_BORDER, HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

/** Type steps used by the picker (one family; sizes on the holo scale). */
export const PICKER_TYPE = {
  /** Panel headings (uppercase). */
  heading: { size: 16, weight: "600", letterSpacing: 2 },
  /** Ship name in the detail panel. */
  title: { size: 18, weight: "600", letterSpacing: 0.5 },
  /** Card / row names. */
  name: { size: 13, weight: "600", letterSpacing: 0.3 },
  /** Body copy. */
  body: { size: 13, weight: "400", letterSpacing: 0 },
  /** Secondary copy (descriptions, lore). */
  small: { size: 12, weight: "400", letterSpacing: 0 },
  /** Uppercase section captions. */
  caption: { size: 12, weight: "600", letterSpacing: 1 },
  /** Chips, tags and fine print (never below 12 px at 1280x720). */
  micro: { size: 12, weight: "600", letterSpacing: 0.5 },
  /** Numbers (points, stat values). */
  numeric: { size: 14, weight: "600", letterSpacing: 0.5 },
} as const;

/** Name of a picker type step. */
export type PickerTextRole = keyof typeof PICKER_TYPE;

/** Smallest font size any fitted text may shrink to. */
export const MIN_FONT_SIZE = 12;
/** Smallest size a ship name may shrink to before it is truncated. */
export const MIN_NAME_SIZE = 12;
/** Letter spacing HoloPressButton applies to its label. */
const BUTTON_LABEL_SPACING = 1;

/**
 * Phaser text style for a picker type step.
 *
 * @param role - Type step.
 * @param color - Text colour (0xRRGGBB, from HOLO_PALETTE).
 * @param extra - Extra style fields (wordWrap, align, fontStyle…).
 * @returns The style.
 */
export function pickerTextStyle(
  role: PickerTextRole,
  color: number,
  extra: TextStyle = {},
): TextStyle {
  const step = PICKER_TYPE[role];
  return {
    ...holoFont(step.size, step.weight),
    color: toCssColor(color),
    ...extra,
  };
}

/**
 * Create a text object on a picker type step (letter spacing applied).
 *
 * @param scene - Owning scene.
 * @param position - Top-left (or origin-relative) position.
 * @param content - Text content (kept verbatim).
 * @param role - Type step.
 * @param color - Text colour.
 * @returns The text object.
 */
export function addPickerText(
  scene: Phaser.Scene,
  position: { readonly x: number; readonly y: number },
  content: string,
  role: PickerTextRole,
  color: number,
): Phaser.GameObjects.Text {
  return scene.add
    .text(position.x, position.y, content, pickerTextStyle(role, color))
    .setLetterSpacing(PICKER_TYPE[role].letterSpacing);
}

/**
 * Shrink a text's font size (1 px at a time, never below `minSize`) until
 * it fits a width. The text content is untouched.
 *
 * @param text - Text object.
 * @param maxWidth - Available width in pixels.
 * @param minSize - Smallest allowed size. Default MIN_FONT_SIZE.
 */
export function fitTextWidth(
  text: Phaser.GameObjects.Text,
  maxWidth: number,
  minSize: number = MIN_FONT_SIZE,
): void {
  let size = parseFloat(String(text.style.fontSize));
  while (text.width > maxWidth && size > minSize) {
    size -= 1;
    text.setFontSize(size);
  }
}

/**
 * Shrink (not below `minSize`), then truncate with an ellipsis until the
 * text fits a width. Only for display strings no caller reads back.
 *
 * @param text - Text object.
 * @param maxWidth - Available width in pixels.
 * @param minSize - Smallest font size before truncating. Default MIN_FONT_SIZE.
 */
export function fitOrEllipsize(
  text: Phaser.GameObjects.Text,
  maxWidth: number,
  minSize: number = MIN_FONT_SIZE,
): void {
  fitTextWidth(text, maxWidth, minSize);
  let content = text.text;
  while (text.width > maxWidth && content.length > 1) {
    content = content.slice(0, -1).trimEnd();
    text.setText(`${content}\u2026`);
  }
}

/**
 * Largest font size (from `startSize` down to MIN_FONT_SIZE) at which a
 * button label fits a width — for controls that take a size up front.
 *
 * @param scene - Owning scene (a hidden probe text is created and destroyed).
 * @param label - Label text.
 * @param maxWidth - Available width.
 * @param font - Starting size and weight.
 * @returns The fitted size in pixels.
 */
export function fittedFontSize(
  scene: Phaser.Scene,
  label: string,
  maxWidth: number,
  font: { readonly size: number; readonly weight: string },
): number {
  const probe = scene.add
    .text(0, 0, label, holoFont(font.size, font.weight))
    .setLetterSpacing(BUTTON_LABEL_SPACING)
    .setVisible(false);
  fitTextWidth(probe, maxWidth);
  const size = parseFloat(String(probe.style.fontSize));
  probe.destroy();
  return size;
}

/** Interaction state of a selectable card (catalog row, roster row). */
export type CardState = "idle" | "hover" | "selected" | "locked";

/** Card frame tuning. */
const CARD_STYLE = {
  idleFillAlpha: 0.55,
  idleBorderAlpha: 0.6,
  hoverFillAlpha: 0.1,
  selectedFillAlpha: 0.16,
  lockedFillAlpha: 0.35,
  lockedBorderAlpha: 0.3,
} as const;

/**
 * Draw a holo card frame for a state: neutral hairline (idle), accent
 * border + faint tint (hover), accent border + tint + corner ticks
 * (selected), dim muted outline (locked).
 *
 * @param g - Target graphics (caller clears).
 * @param rect - Card bounds.
 * @param state - Interaction state.
 * @param accent - Accent colour (faction accent in context).
 */
export function drawPickerCard(
  g: Phaser.GameObjects.Graphics,
  rect: HoloRect,
  state: CardState,
  accent: number,
): void {
  const radius = HOLO_RADIUS.md;
  if (state === "selected") {
    drawHoloFrame(g, rect, {
      radius,
      accent,
      fill: accent,
      fillAlpha: CARD_STYLE.selectedFillAlpha,
      borderWidth: HOLO_BORDER.regular,
      borderAlpha: 1,
      cornerTicks: true,
    });
    return;
  }
  if (state === "hover") {
    drawHoloFrame(g, rect, {
      radius,
      accent,
      fill: accent,
      fillAlpha: CARD_STYLE.hoverFillAlpha,
    });
    return;
  }
  const locked = state === "locked";
  drawHoloFrame(g, rect, {
    radius,
    accent: locked ? HOLO_PALETTE.textMuted : HOLO_PALETTE.border,
    fillAlpha: locked ? CARD_STYLE.lockedFillAlpha : CARD_STYLE.idleFillAlpha,
    borderAlpha: locked
      ? CARD_STYLE.lockedBorderAlpha
      : CARD_STYLE.idleBorderAlpha,
  });
}

/** Ship stat gauge colours, harmonised with the holo palette. */
export const STAT_COLORS = {
  attack: HOLO_PALETTE.danger,
  agility: HOLO_PALETTE.success,
  hull: HOLO_PALETTE.warning,
  shields: HOLO_PALETTE.shield,
  speed: HOLO_PALETTE.accent,
} as const;

/** Stat value that fills a gauge completely. */
export const STAT_GAUGE_MAX = 8;
