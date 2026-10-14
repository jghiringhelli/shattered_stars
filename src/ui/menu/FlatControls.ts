/**
 * FlatControls — light selectable controls for the setup screens: a chip or
 * row (accent tint + border when selected, hairline otherwise), a ◀ label ▶
 * cycler and a plain hover zone. Every control sits in a parent container,
 * takes a tooltip subject and never draws more than one frame.
 */

import Phaser from "phaser";
import { drawHoloFrame } from "./holoChrome";
import { attachHintTooltip } from "./HintTooltip";
import { topLeftHitArea } from "./hitArea";
import { createMenuIcon } from "./MenuIcons";
import { contentOf, type TipSubject } from "./tooltipTargets";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING } from "../theme/HoloTheme";
import { addPickerText, type PickerTextRole } from "../picker/pickerStyle";

/** Fill opacity of a selected control. */
const SELECTED_FILL_ALPHA = 0.28;
/** Fill opacity of an idle control. */
const IDLE_FILL_ALPHA = 0.4;
/** Size of the cycler's arrow icons (px). */
const ARROW_ICON_SIZE = 14;

/** Where and how to draw a chip or row. */
export interface SelectableSpec {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  /** Right-aligned detail (rows); the label is then left-aligned. */
  readonly detail?: string;
  /** Type step of the detail (default "numeric"). */
  readonly detailRole?: PickerTextRole;
  readonly selected: boolean;
  readonly accent: number;
  readonly role?: PickerTextRole;
  readonly tip?: TipSubject;
  readonly onPress: () => void;
}

/**
 * Makes a top-left-anchored container clickable with a pointer cursor.
 *
 * @param box - The container (sized here).
 * @param width - Hit width.
 * @param height - Hit height.
 */
export function makeClickable(
  box: Phaser.GameObjects.Container,
  width: number,
  height: number,
): void {
  box.setSize(width, height).setInteractive(
    topLeftHitArea(width, height),
    Phaser.Geom.Rectangle.Contains,
  );
  if (box.input) box.input.cursor = "pointer";
}

/**
 * Draws a selectable chip (centred label) or row (label left, detail right).
 *
 * @param scene - Owning scene.
 * @param parent - Container the control joins.
 * @param spec - Box, texts, selection and callbacks.
 * @returns The control's container.
 */
export function addSelectable(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  spec: SelectableSpec,
): Phaser.GameObjects.Container {
  const box = scene.add.container(spec.x, spec.y);
  const bg = scene.add.graphics();
  const paint = (lit: boolean): void => {
    bg.clear();
    drawHoloFrame(
      bg,
      { x: 0, y: 0, width: spec.width, height: spec.height },
      {
        radius: HOLO_RADIUS.sm,
        accent: spec.selected || lit ? spec.accent : HOLO_PALETTE.border,
        fill: spec.selected ? spec.accent : HOLO_PALETTE.panelFill,
        fillAlpha: spec.selected ? SELECTED_FILL_ALPHA : IDLE_FILL_ALPHA,
      },
    );
  };
  paint(false);
  const color = spec.selected
    ? HOLO_PALETTE.textPrimary
    : HOLO_PALETTE.textSecondary;
  const label = addPickerText(
    scene,
    { x: 0, y: spec.height / 2 },
    spec.label,
    spec.role ?? "name",
    color,
  ).setOrigin(spec.detail === undefined ? 0.5 : 0, 0.5);
  label.setX(spec.detail === undefined ? spec.width / 2 : HOLO_SPACING.md);
  box.add([bg, label]);
  if (spec.detail !== undefined) {
    box.add(
      addPickerText(
        scene,
        { x: spec.width - HOLO_SPACING.md, y: spec.height / 2 },
        spec.detail,
        spec.detailRole ?? "numeric",
        spec.selected ? HOLO_PALETTE.accent : HOLO_PALETTE.textSecondary,
      ).setOrigin(1, 0.5),
    );
  }
  makeClickable(box, spec.width, spec.height);
  box.on("pointerover", () => paint(true));
  box.on("pointerout", () => paint(false));
  box.on("pointerdown", spec.onPress);
  if (spec.tip) attachHintTooltip(scene, box, contentOf(spec.tip));
  parent.add(box);
  return box;
}

/** Where and how to draw a cycler. */
export interface CyclerSpec {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly accent: number;
  readonly tip?: TipSubject;
  readonly onStep: (direction: 1 | -1) => void;
}

/**
 * Draws a ◀ label ▶ cycler (the label itself also steps forward on click).
 *
 * @param scene - Owning scene.
 * @param parent - Container the control joins.
 * @param spec - Box, label and step callback.
 */
export function addCycler(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  spec: CyclerSpec,
): void {
  const arrow = (side: "back" | "next", at: number, step: 1 | -1): void => {
    const box = scene.add.container(spec.x + at, spec.y);
    const bg = scene.add.graphics();
    drawHoloFrame(
      bg,
      { x: 0, y: 0, width: spec.height, height: spec.height },
      { radius: HOLO_RADIUS.sm, accent: spec.accent, fillAlpha: IDLE_FILL_ALPHA },
    );
    const icon = createMenuIcon(
      scene,
      side,
      { x: spec.height / 2, y: spec.height / 2 },
      ARROW_ICON_SIZE,
      HOLO_PALETTE.textPrimary,
    );
    box.add([bg, icon]);
    makeClickable(box, spec.height, spec.height);
    box.on("pointerdown", () => spec.onStep(step));
    parent.add(box);
  };
  arrow("back", 0, -1);
  arrow("next", spec.width - spec.height, 1);
  addSelectable(scene, parent, {
    x: spec.x + spec.height + HOLO_SPACING.xs,
    y: spec.y,
    width: spec.width - 2 * (spec.height + HOLO_SPACING.xs),
    height: spec.height,
    label: spec.label,
    selected: false,
    accent: spec.accent,
    onPress: () => spec.onStep(1),
    ...(spec.tip === undefined ? {} : { tip: spec.tip }),
  });
}
