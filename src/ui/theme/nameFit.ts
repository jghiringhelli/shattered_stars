/**
 * nameFit — ship and pilot names are always shown in full: a name that is
 * too wide for its slot first shrinks (never below the smallest text size)
 * and then wraps onto a second line. Nothing here cuts a name with "…".
 *
 * {@link planNameFit} is pure (injectable measure, deterministic estimate for
 * tests); {@link fitNameText} applies a plan to a Phaser text object.
 */

import type Phaser from "phaser";
import { MIN_TEXT_PX } from "./holoFont";

/** Lines a wrapped name may take. */
export const MAX_NAME_LINES = 2;
/** Line spacing (px) of a wrapped name, so two lines fit a one-line row. */
export const WRAPPED_NAME_LINE_SPACING = -3;
/** Average glyph width in em of the holo sans stack; wide on purpose, so a fallback font still fits. */
const ESTIMATED_GLYPH_EM = 0.6;

/** Width in px of a string at a font size. */
export type TextMeasure = (content: string, fontSize: number) => number;

/** How a name is laid out. */
export interface NameFitPlan {
  /** Font size the name is drawn at. */
  readonly fontSize: number;
  /** Lines the name occupies (the whole name when it fits on one). */
  readonly lines: readonly string[];
  /** Whether every line fits the width within {@link MAX_NAME_LINES} lines. */
  readonly fits: boolean;
}

/**
 * Deterministic width estimate (no canvas), conservative for mixed-case names.
 *
 * @param content - Text.
 * @param fontSize - Font size in px.
 * @returns Estimated width in px.
 */
export const estimateTextWidth: TextMeasure = (content, fontSize) =>
  Math.ceil(content.length * fontSize * ESTIMATED_GLYPH_EM);

/**
 * Greedy word wrap with the given measure.
 *
 * @param name - Full name.
 * @param maxWidth - Line width in px.
 * @param fontSize - Font size in px.
 * @param measure - Text measure.
 * @returns The lines.
 */
function wrapWords(
  name: string,
  maxWidth: number,
  fontSize: number,
  measure: TextMeasure,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of name.split(/\s+/).filter((w) => w.length > 0)) {
    const candidate = line === "" ? word : `${line} ${word}`;
    if (line !== "" && measure(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

/**
 * Decide how to show a whole name in a slot: one line at the largest size
 * that fits, else wrapped at the smallest size.
 *
 * @param name - Full name (kept verbatim).
 * @param maxWidth - Slot width in px.
 * @param startSize - Preferred font size.
 * @param minSize - Smallest allowed size. Default {@link MIN_TEXT_PX}.
 * @param measure - Text measure. Default {@link estimateTextWidth}.
 * @returns The plan.
 */
export function planNameFit(
  name: string,
  maxWidth: number,
  startSize: number,
  minSize: number = MIN_TEXT_PX,
  measure: TextMeasure = estimateTextWidth,
): NameFitPlan {
  const floor = Math.min(startSize, minSize);
  for (let size = startSize; size >= floor; size -= 1) {
    if (measure(name, size) <= maxWidth)
      return { fontSize: size, lines: [name], fits: true };
  }
  const lines = wrapWords(name, maxWidth, floor, measure);
  const fits =
    lines.length <= MAX_NAME_LINES &&
    lines.every((line) => measure(line, floor) <= maxWidth);
  return { fontSize: floor, lines, fits };
}

/**
 * Fit a name text into a width: shrink, then wrap (two lines). Safe to call
 * again with a new width (the previous fit is undone first).
 *
 * @param text - Text object holding the full name.
 * @param maxWidth - Slot width in px.
 * @param minSize - Smallest font size. Default {@link MIN_TEXT_PX}.
 * @returns Lines the name now occupies (1 or 2).
 */
export function fitNameText(
  text: Phaser.GameObjects.Text,
  maxWidth: number,
  minSize: number = MIN_TEXT_PX,
): number {
  const name = text.text;
  text.setWordWrapWidth(null as unknown as number).setLineSpacing(0);
  const measure: TextMeasure = (content, fontSize) =>
    text.setFontSize(fontSize).setText(content).width;
  const plan = planNameFit(
    name,
    maxWidth,
    parseFloat(String(text.style.fontSize)),
    minSize,
    measure,
  );
  text.setFontSize(plan.fontSize).setText(name);
  if (plan.lines.length > 1) {
    text
      .setWordWrapWidth(maxWidth, true)
      .setLineSpacing(WRAPPED_NAME_LINE_SPACING);
  }
  return plan.lines.length;
}
