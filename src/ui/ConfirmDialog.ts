/**
 * ConfirmDialog — small reusable Yes/No modal overlay for destructive
 * actions (quitting mid-battle, etc.), so a single misclick can't instantly
 * lose progress. Depth sits above pause menus/HUD; caller is responsible for
 * having already reset camera zoom to 1.0 (see repo notes on the
 * scrollFactor(0)+zoom hit-test bug).
 */

import Phaser from "phaser";
import { createHoverButton } from "./ButtonFactory";
import { HoloPanel } from "./hud/HoloPanel";
import { MENU_CLEAR_COLOR } from "./menu/MenuScaffold";
import { holoFont } from "./theme/holoFont";
import { HOLO_DEPTH, HOLO_PALETTE } from "./theme/HoloTheme";
import { toCssColor } from "./theme/colorMath";

/** Dialog geometry (relative to the dialog centre). */
const DIALOG = {
  width: 440,
  height: 184,
  messageY: -30,
  messageWrap: 380,
  messageSize: 17,
  buttonY: 48,
  buttonOffsetX: 104,
  buttonWidth: 184,
  buttonHeight: 42,
  dimAlpha: 0.6,
} as const;

export interface ConfirmDialogConfig {
  readonly scene: Phaser.Scene;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel?: () => void;
}

/** Shows a centered Yes/No confirmation overlay and returns the container it was built in. */
export function showConfirmDialog(
  config: ConfirmDialogConfig,
): Phaser.GameObjects.Container {
  const { scene } = config;
  const width = scene.scale.width;
  const height = scene.scale.height;

  const root = scene.add
    .container(0, 0)
    .setScrollFactor(0)
    .setDepth(HOLO_DEPTH.modal);

  const dim = scene.add.graphics();
  dim.fillStyle(MENU_CLEAR_COLOR, DIALOG.dimAlpha);
  dim.fillRect(0, 0, width, height);
  dim.setScrollFactor(0);
  root.add(dim);

  const panel = new HoloPanel(scene, width / 2, height / 2, {
    width: DIALOG.width,
    height: DIALOG.height,
    accentColor: HOLO_PALETTE.danger,
    title: "Confirm",
    fillAlpha: 0.94,
  }).setScrollFactor(0);
  root.add(panel);

  const messageText = scene.add
    .text(0, DIALOG.messageY, config.message, {
      ...holoFont(DIALOG.messageSize, "400"),
      color: toCssColor(HOLO_PALETTE.textPrimary),
      align: "center",
      wordWrap: { width: DIALOG.messageWrap },
    })
    .setOrigin(0.5);
  panel.add(messageText);

  const close = (): void => root.destroy();

  const confirmBtn = createHoverButton(
    scene,
    -DIALOG.buttonOffsetX,
    DIALOG.buttonY,
    {
      width: DIALOG.buttonWidth,
      height: DIALOG.buttonHeight,
      color: HOLO_PALETTE.danger,
      variant: "danger",
      label: config.confirmLabel ?? "YES, QUIT",
      font: "600 16px",
    },
    () => {
      close();
      config.onConfirm();
    },
  ).setScrollFactor(0);
  panel.add(confirmBtn);

  const cancelBtn = createHoverButton(
    scene,
    DIALOG.buttonOffsetX,
    DIALOG.buttonY,
    {
      width: DIALOG.buttonWidth,
      height: DIALOG.buttonHeight,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary",
      label: config.cancelLabel ?? "CANCEL",
      font: "600 16px",
    },
    () => {
      close();
      config.onCancel?.();
    },
  ).setScrollFactor(0);
  panel.add(cancelBtn);

  panel.setScale(0.85);
  panel.setAlpha(0);
  scene.tweens.add({
    targets: panel,
    scale: 1,
    alpha: 1,
    duration: 200,
    ease: "Back.Out",
  });

  return root;
}
