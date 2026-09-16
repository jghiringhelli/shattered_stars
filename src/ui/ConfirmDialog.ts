/**
 * ConfirmDialog — small reusable Yes/No modal overlay for destructive
 * actions (quitting mid-battle, etc.), so a single misclick can't instantly
 * lose progress. Depth sits above pause menus/HUD; caller is responsible for
 * having already reset camera zoom to 1.0 (see repo notes on the
 * scrollFactor(0)+zoom hit-test bug).
 */

import Phaser from "phaser";
import { createHoverButton } from "./ButtonFactory";

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

  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(3000);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.6);
  dim.fillRect(0, 0, width, height);
  dim.setScrollFactor(0);
  root.add(dim);

  const panel = scene.add.container(width / 2, height / 2).setScrollFactor(0);
  root.add(panel);

  const panelBg = scene.add.graphics();
  panelBg.fillStyle(0x1a1a2a, 0.98);
  panelBg.fillRoundedRect(-220, -90, 440, 180, 14);
  panelBg.lineStyle(2, 0xff6644, 1);
  panelBg.strokeRoundedRect(-220, -90, 440, 180, 14);
  panel.add(panelBg);

  const messageText = scene.add
    .text(0, -35, config.message, {
      font: "20px Arial",
      color: "#ffffff",
      align: "center",
      wordWrap: { width: 380 },
    })
    .setOrigin(0.5);
  panel.add(messageText);

  const close = (): void => root.destroy();

  const confirmBtn = createHoverButton(
    scene,
    -110,
    45,
    {
      width: 180,
      height: 46,
      color: 0x662222,
      label: config.confirmLabel ?? "YES, QUIT",
      font: "bold 18px Arial",
    },
    () => {
      close();
      config.onConfirm();
    },
  ).setScrollFactor(0);
  panel.add(confirmBtn);

  const cancelBtn = createHoverButton(
    scene,
    110,
    45,
    {
      width: 180,
      height: 46,
      color: 0x2a3a4a,
      label: config.cancelLabel ?? "CANCEL",
      font: "bold 18px Arial",
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
