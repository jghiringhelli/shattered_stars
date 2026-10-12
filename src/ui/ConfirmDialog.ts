/**
 * ConfirmDialog — small reusable Yes/No modal overlay for destructive
 * actions (quitting mid-battle, etc.), so a single misclick can't instantly
 * lose progress. Depth sits above pause menus/HUD; caller is responsible for
 * having already reset camera zoom to 1.0 (see repo notes on the
 * scrollFactor(0)+zoom hit-test bug).
 *
 * Fully modal for every device: the dim layer swallows clicks, the dialog
 * takes keyboard/gamepad focus from menus beneath it (focus starts on
 * CANCEL; ←/→ move, ENTER / pad A activate, ESC / pad B cancel), and the
 * PAUSE intent is held back so ESC can't toggle the paused battle underneath.
 */

import Phaser from "phaser";
import { createHoverButton } from "./ButtonFactory";
import { HoloPanel } from "./hud/HoloPanel";
import type { HoloPressButton } from "./menu/HoloPressButton";
import { MENU_CLEAR_COLOR } from "./menu/MenuScaffold";
import { MenuFocus } from "./menu/MenuFocus";
import { GAMEPAD_BACK_BUTTON } from "./menu/menuTransitions";
import { holoFont } from "./theme/holoFont";
import { HOLO_DEPTH, HOLO_PALETTE } from "./theme/HoloTheme";
import { toCssColor } from "./theme/colorMath";
import { InputManager } from "../input/InputManager";

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

/**
 * PAUSE stays held back this long after the dialog closes, so the ESC that
 * closed it is consumed by the battle's next input poll instead of
 * un-pausing the battle.
 */
const PAUSE_RELEASE_DELAY_MS = 150;

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
  const root = scene.add
    .container(0, 0)
    .setScrollFactor(0)
    .setDepth(HOLO_DEPTH.modal);
  root.add(createClickBlocker(scene));
  const panel = createPanel(scene, config.message);
  root.add(panel);

  const releasePause = InputManager.suppress("PAUSE");
  const close = (): void => root.destroy();
  const confirm = (): void => {
    close();
    config.onConfirm();
  };
  const cancel = (): void => {
    close();
    config.onCancel?.();
  };
  const buttons = createButtons(scene, panel, config, { confirm, cancel });
  const focus = new MenuFocus(scene, buttons, { columns: 2, modal: true });
  focus.focus(1);
  const unbindCancel = bindCancelKeys(scene, cancel);
  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    focus.destroy();
    unbindCancel();
    setTimeout(releasePause, PAUSE_RELEASE_DELAY_MS);
  });

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

/** Full-screen dim that also swallows pointer input to the menu beneath. */
function createClickBlocker(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(0, 0, scene.scale.width, scene.scale.height, MENU_CLEAR_COLOR)
    .setAlpha(DIALOG.dimAlpha)
    .setOrigin(0)
    .setScrollFactor(0)
    .setInteractive();
}

/** Danger-accented panel with the wrapped message. */
function createPanel(scene: Phaser.Scene, message: string): HoloPanel {
  const panel = new HoloPanel(
    scene,
    scene.scale.width / 2,
    scene.scale.height / 2,
    {
      width: DIALOG.width,
      height: DIALOG.height,
      accentColor: HOLO_PALETTE.danger,
      title: "Confirm",
      fillAlpha: 0.94,
    },
  ).setScrollFactor(0);
  const messageText = scene.add
    .text(0, DIALOG.messageY, message, {
      ...holoFont(DIALOG.messageSize, "400"),
      color: toCssColor(HOLO_PALETTE.textPrimary),
      align: "center",
      wordWrap: { width: DIALOG.messageWrap },
    })
    .setOrigin(0.5);
  panel.add(messageText);
  return panel;
}

/** Confirm (left) and cancel (right) buttons, in focus order. */
function createButtons(
  scene: Phaser.Scene,
  panel: HoloPanel,
  config: ConfirmDialogConfig,
  actions: { readonly confirm: () => void; readonly cancel: () => void },
): HoloPressButton[] {
  const size = { width: DIALOG.buttonWidth, height: DIALOG.buttonHeight };
  const confirmBtn = createHoverButton(
    scene,
    -DIALOG.buttonOffsetX,
    DIALOG.buttonY,
    {
      ...size,
      color: HOLO_PALETTE.danger,
      variant: "danger",
      label: config.confirmLabel ?? "YES, QUIT",
      font: "600 16px",
    },
    actions.confirm,
  ).setScrollFactor(0);
  const cancelBtn = createHoverButton(
    scene,
    DIALOG.buttonOffsetX,
    DIALOG.buttonY,
    {
      ...size,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary",
      label: config.cancelLabel ?? "CANCEL",
      font: "600 16px",
    },
    actions.cancel,
  ).setScrollFactor(0);
  panel.add([confirmBtn, cancelBtn]);
  return [confirmBtn, cancelBtn];
}

/**
 * ESC and gamepad B cancel the dialog.
 *
 * @returns Unbind function.
 */
function bindCancelKeys(scene: Phaser.Scene, cancel: () => void): () => void {
  const keyboard = scene.input.keyboard;
  const gamepad = scene.input.gamepad;
  const onPad = (_pad: unknown, button: { readonly index: number }): void => {
    if (button.index === GAMEPAD_BACK_BUTTON) cancel();
  };
  keyboard?.once("keydown-ESC", cancel);
  gamepad?.on("down", onPad);
  return () => {
    keyboard?.off("keydown-ESC", cancel);
    gamepad?.off("down", onPad);
  };
}
