/**
 * LoadoutToggle — the payload (quick build) toggle buttons of the ship
 * picker's detail panel, plus the page arrow that cycles through builds.
 * Selected = faction accent border + tint; idle = neutral hairline.
 * Buttons fire on pointer press (specs real-click them by label text).
 */

import Phaser from "phaser";
import { drawHoloFrame } from "../menu/holoChrome";
import { drawMenuIcon } from "../menu/MenuIcons";
import { punch } from "../UIJuice";
import { HOLO_BORDER, HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { addPickerText, fitTextWidth } from "./pickerStyle";

/** Toggle face tuning. */
const TOGGLE = {
  selectedFillAlpha: 0.22,
  hoverFillAlpha: 0.1,
  /** Horizontal padding kept free around the label. */
  labelPadX: 6,
  /** Label centre as a share of the button height. */
  labelCentre: 0.38,
  /** Points line centre as a share of the button height. */
  pointsCentre: 0.8,
  arrowIconSize: 12,
  punch: { scale: 1.08, durationMs: 160 },
} as const;

/** One payload button. */
export interface LoadoutToggleSpec {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Label — kept verbatim (specs click it by exact text). */
  readonly label: string;
  readonly pointCost: number;
  readonly active: boolean;
  /** Faction accent for the selected state. */
  readonly accent: number;
}

/**
 * Paint a toggle face (top-left origin).
 *
 * @param g - Target graphics.
 * @param spec - Size, state, accent.
 * @param hover - Pointer over the button.
 */
function paintToggle(
  g: Phaser.GameObjects.Graphics,
  spec: LoadoutToggleSpec,
  hover: boolean,
): void {
  g.clear();
  const rect = { x: 0, y: 0, width: spec.width, height: spec.height };
  if (spec.active || hover) {
    drawHoloFrame(g, rect, {
      radius: HOLO_RADIUS.md,
      accent: spec.accent,
      fill: spec.accent,
      fillAlpha: spec.active ? TOGGLE.selectedFillAlpha : TOGGLE.hoverFillAlpha,
      borderWidth: spec.active ? HOLO_BORDER.regular : HOLO_BORDER.hairline,
      borderAlpha: 1,
    });
    return;
  }
  drawHoloFrame(g, rect, { radius: HOLO_RADIUS.md });
}

/**
 * Build the label: shrunk to fit one line, wrapped onto two only when the
 * smallest size still overflows (wrapping keeps `text` verbatim).
 *
 * @param scene - Owning scene.
 * @param spec - Button spec.
 * @returns The label text.
 */
function buildLabel(
  scene: Phaser.Scene,
  spec: LoadoutToggleSpec,
): Phaser.GameObjects.Text {
  const maxWidth = spec.width - TOGGLE.labelPadX * 2;
  const label = addPickerText(
    scene,
    { x: spec.width / 2, y: spec.height * TOGGLE.labelCentre },
    spec.label,
    "name",
    spec.active ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textSecondary,
  ).setOrigin(0.5);
  fitTextWidth(label, maxWidth);
  if (label.width > maxWidth) {
    label.setWordWrapWidth(maxWidth).setAlign("center").setLineSpacing(-2);
  }
  return label;
}

/**
 * Create a payload toggle button.
 *
 * @param scene - Owning scene.
 * @param spec - Position, size, label, cost and state.
 * @param onClick - Invoked on press.
 * @returns The button container (top-left at spec.x/spec.y).
 */
export function createLoadoutToggle(
  scene: Phaser.Scene,
  spec: LoadoutToggleSpec,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const c = scene.add.container(spec.x, spec.y);
  const bg = scene.add.graphics();
  paintToggle(bg, spec, false);
  const points = addPickerText(
    scene,
    { x: spec.width / 2, y: spec.height * TOGGLE.pointsCentre },
    `${spec.pointCost}pt`,
    "micro",
    spec.active ? spec.accent : HOLO_PALETTE.textMuted,
  ).setOrigin(0.5);
  c.add([bg, buildLabel(scene, spec), points]);
  c.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, spec.width, spec.height),
    Phaser.Geom.Rectangle.Contains,
  );
  if (c.input) c.input.cursor = "pointer";
  c.on("pointerover", () => paintToggle(bg, spec, true));
  c.on("pointerout", () => paintToggle(bg, spec, false));
  c.on("pointerdown", onClick);
  // Punch feedback on the button that just became active (including right
  // after a fresh render caused by clicking it) — a destroyed-and-rebuilt
  // container can't tween itself mid-click, so this fires on (re)creation.
  if (spec.active) punch(scene, c, TOGGLE.punch);
  return c;
}

/**
 * Small "next page" button with a chevron glyph.
 *
 * @param scene - Owning scene.
 * @param rect - Bounds (top-left origin).
 * @param onClick - Invoked on press.
 * @returns The button container.
 */
export function createPageArrow(
  scene: Phaser.Scene,
  rect: { x: number; y: number; width: number; height: number },
  onClick: () => void,
): Phaser.GameObjects.Container {
  const c = scene.add.container(rect.x, rect.y);
  const bg = scene.add.graphics();
  const paint = (hover: boolean): void => {
    bg.clear();
    drawHoloFrame(
      bg,
      { x: 0, y: 0, width: rect.width, height: rect.height },
      {
        radius: HOLO_RADIUS.sm,
        accent: hover ? HOLO_PALETTE.accent : HOLO_PALETTE.border,
      },
    );
    drawMenuIcon(
      bg,
      "next",
      { x: rect.width / 2, y: rect.height / 2 },
      TOGGLE.arrowIconSize,
      hover ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textSecondary,
    );
  };
  paint(false);
  c.add(bg);
  c.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, rect.width, rect.height),
    Phaser.Geom.Rectangle.Contains,
  );
  if (c.input) c.input.cursor = "pointer";
  c.on("pointerover", () => paint(true));
  c.on("pointerout", () => paint(false));
  c.on("pointerdown", onClick);
  return c;
}
