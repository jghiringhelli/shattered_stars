/**
 * UnlockedToggle — the picker's "Show only unlocked ships" checkbox: a
 * small holo box (accent check when on) plus a label, one hit zone.
 */

import type Phaser from "phaser";
import { drawHoloFrame } from "../menu/holoChrome";
import { HOLO_BORDER, HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { addPickerText } from "./pickerStyle";

/** Checkbox geometry. */
const BOX = {
  size: 16,
  labelGap: 8,
  /** Extra hit-zone height around the box. */
  hitPadY: 8,
  checkFillAlpha: 0.2,
  /** Check-mark points as fractions of the box size. */
  check: [
    [0.22, 0.52],
    [0.42, 0.72],
    [0.78, 0.3],
  ],
} as const;

/**
 * Create the toggle with its left edge at x, vertically centred on y.
 *
 * @param scene - Owning scene.
 * @param position - Left edge / vertical centre.
 * @param accent - Accent for the checked state.
 * @param onChange - Called with the new state after each press.
 * @returns The created objects.
 */
export function createUnlockedToggle(
  scene: Phaser.Scene,
  position: { readonly x: number; readonly y: number },
  accent: number,
  onChange: (showOnlyUnlocked: boolean) => void,
): Phaser.GameObjects.GameObject[] {
  let checked = false;
  const box = scene.add.graphics();
  const rect = {
    x: position.x,
    y: position.y - BOX.size / 2,
    width: BOX.size,
    height: BOX.size,
  };
  const label = addPickerText(
    scene,
    { x: position.x + BOX.size + BOX.labelGap, y: position.y },
    "Show only unlocked ships",
    "body",
    HOLO_PALETTE.textSecondary,
  ).setOrigin(0, 0.5);
  const paint = (hover: boolean): void => {
    box.clear();
    drawHoloFrame(box, rect, {
      radius: HOLO_RADIUS.sm,
      accent: checked || hover ? accent : HOLO_PALETTE.border,
      fill: checked ? accent : HOLO_PALETTE.panelFill,
      fillAlpha: checked ? BOX.checkFillAlpha : HOLO_PALETTE.panelAlpha,
      borderWidth: checked ? HOLO_BORDER.regular : HOLO_BORDER.hairline,
    });
    const active = hover || checked;
    label.setColor(
      toCssColor(
        active ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textSecondary,
      ),
    );
    if (!checked) return;
    box.lineStyle(HOLO_BORDER.focus, HOLO_PALETTE.textPrimary, 1);
    box.strokePoints(
      BOX.check.map(([fx, fy]) => ({
        x: rect.x + fx * BOX.size,
        y: rect.y + fy * BOX.size,
      })),
      false,
    );
  };
  paint(false);
  const totalW = label.x + label.width - position.x;
  const hit = scene.add
    .rectangle(
      position.x + totalW / 2,
      position.y,
      totalW,
      BOX.size + BOX.hitPadY * 2,
      0,
      0,
    )
    .setInteractive({ useHandCursor: true });
  hit.on("pointerover", () => paint(true));
  hit.on("pointerout", () => paint(false));
  hit.on("pointerdown", () => {
    checked = !checked;
    paint(true);
    onChange(checked);
  });
  return [box, label, hit];
}
