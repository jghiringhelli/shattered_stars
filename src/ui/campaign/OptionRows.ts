/**
 * OptionRows — the list rows of the Armory / Research effects and cost
 * tabs: one line of text per row, no box, a soft highlight on hover or
 * focus, a tooltip on every row and a press handler where the row acts.
 */

import type Phaser from "phaser";
import { drawHoloFrame } from "../menu/holoChrome";
import type { FocusTarget } from "../menu/MenuFocus";
import { addTipZone, focusTipTarget } from "../menu/tooltipTargets";
import { addPickerText } from "../picker/pickerStyle";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING } from "../theme/HoloTheme";
import type { OptionRow, Tone } from "./optionPanelTypes";

/** Row height (px, 8 px grid). */
export const OPTION_ROW_HEIGHT = 40;
/** Fill opacity of a hovered / focused row. */
const ROW_LIT_ALPHA = 0.14;

/**
 * @param tone - Colour role.
 * @param accent - Faction accent.
 * @returns The palette colour.
 */
export function toneColor(tone: Tone, accent: number): number {
  switch (tone) {
    case "good":
      return HOLO_PALETTE.success;
    case "warn":
      return HOLO_PALETTE.warning;
    case "muted":
      return HOLO_PALETTE.textMuted;
    case "accent":
      return accent;
    default:
      return HOLO_PALETTE.textPrimary;
  }
}

/** Where and how to draw the rows (container coordinates, top-left). */
export interface RowListSpec {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly accent: number;
  readonly onAction: (key: string) => void;
}

/**
 * Draws one row per entry.
 *
 * @param scene - Owning scene.
 * @param container - Container the rows join.
 * @param rows - The rows.
 * @param spec - Box, accent and action callback.
 * @returns y below the last row and one focus target per row.
 */
export function addOptionRows(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  rows: readonly OptionRow[],
  spec: RowListSpec,
): { bottom: number; targets: FocusTarget[] } {
  const targets = rows.map((row, i) =>
    addRow(scene, container, row, spec, spec.y + i * OPTION_ROW_HEIGHT),
  );
  return { bottom: spec.y + rows.length * OPTION_ROW_HEIGHT, targets };
}

function addRow(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  row: OptionRow,
  spec: RowListSpec,
  y: number,
): FocusTarget {
  const rect = { x: spec.x, y, width: spec.width, height: OPTION_ROW_HEIGHT };
  const glow = scene.add.graphics();
  const paint = (lit: boolean): void => {
    glow.clear();
    if (!lit) return;
    drawHoloFrame(glow, rect, {
      radius: HOLO_RADIUS.sm,
      accent: spec.accent,
      fill: spec.accent,
      fillAlpha: ROW_LIT_ALPHA,
      borderAlpha: 0,
    });
  };
  const text = addPickerText(
    scene,
    { x: spec.x + HOLO_SPACING.md, y: y + HOLO_SPACING.md },
    row.text,
    "body",
    toneColor(row.tone, spec.accent),
  );
  text.setWordWrapWidth(spec.width - HOLO_SPACING.md * 2);
  container.add([glow, text]);
  const press =
    row.actionKey === null ? undefined : () => spec.onAction(row.actionKey!);
  const zone = addTipZone(scene, container, rect, row.tip, press);
  zone.on("pointerover", () => paint(true));
  zone.on("pointerout", () => paint(false));
  zone.on("focuschanged", (focused: boolean) => paint(focused));
  return focusTipTarget(zone, press ?? (() => undefined));
}
