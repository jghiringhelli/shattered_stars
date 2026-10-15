/**
 * holoFont — the one menu typeface as Phaser text-style fragments.
 *
 * Phaser's `font` shorthand splits on spaces, so a multi-word family stack
 * ("Segoe UI", Roboto, …) cannot go through it. Menus spread `holoFont(...)`
 * into their style objects instead, and legacy `"bold 18px Arial"` strings
 * are converted with `holoFontFromCss` so callers keep their sizes.
 */

import { HOLO_FONT_FAMILY } from "./HoloTheme";

/** Font fields a Phaser TextStyle needs for the holo family. */
export interface HoloFontStyle {
  readonly fontFamily: string;
  readonly fontSize: string;
  readonly fontStyle: string;
}

/** Size and weight extracted from a CSS font shorthand. */
export interface ParsedCssFont {
  readonly size: number;
  readonly weight: string;
}

/** Size used when a shorthand carries no `NNpx` token. */
const DEFAULT_FONT_SIZE = 16;
/** Smallest text size anywhere in the game (CSS px at 1280×720). */
export const MIN_TEXT_PX = 12;
/** Weight keywords / numeric weights accepted before the size token. */
const WEIGHT_TOKEN = /^(bold|bolder|lighter|normal|italic|oblique|\d{3})$/i;
const SIZE_TOKEN = /^(\d+(?:\.\d+)?)px$/i;

/**
 * Style fragment for the holo font family.
 *
 * @param size - Font size in CSS pixels (raised to {@link MIN_TEXT_PX}).
 * @param weight - CSS weight / style keywords (e.g. "600", "bold", "italic").
 * @returns Fields to spread into a Phaser TextStyle.
 */
export function holoFont(size: number, weight = "400"): HoloFontStyle {
  return {
    fontFamily: HOLO_FONT_FAMILY,
    fontSize: `${Math.max(MIN_TEXT_PX, size)}px`,
    fontStyle: weight,
  };
}

/**
 * Extract size and weight from a CSS font shorthand such as
 * `"bold 18px Arial"`; the family is ignored.
 *
 * @param font - CSS font shorthand.
 * @returns Size (default 16) and weight keywords (default "400").
 */
export function parseCssFont(font: string): ParsedCssFont {
  const tokens = font.trim().split(/\s+/);
  const weights: string[] = [];
  let size = DEFAULT_FONT_SIZE;
  for (const token of tokens) {
    const sizeMatch = SIZE_TOKEN.exec(token);
    if (sizeMatch) {
      size = Number(sizeMatch[1]);
      break;
    }
    if (WEIGHT_TOKEN.test(token)) weights.push(token.toLowerCase());
  }
  return { size, weight: weights.length > 0 ? weights.join(" ") : "400" };
}

/**
 * Convert a legacy CSS font shorthand to the holo family, keeping its size
 * and weight.
 *
 * @param font - CSS font shorthand, e.g. "bold 18px Arial".
 * @returns Fields to spread into a Phaser TextStyle.
 */
export function holoFontFromCss(font: string): HoloFontStyle {
  const { size, weight } = parseCssFont(font);
  return holoFont(size, weight);
}
