/**
 * lobbyModal — shared frame for lobby dialogs: a full-screen click-blocking
 * scrim and a centred HoloPanel, all inside one container at modal depth.
 */

import Phaser from "phaser";
import { createHoloPanel, type HoloPanel } from "../hud/HoloPanel";
import { MENU_CLEAR_COLOR } from "../menu/MenuScaffold";
import { HOLO_DEPTH, HOLO_SPACING } from "../theme/HoloTheme";

/** Scrim opacity behind dialogs. */
const SCRIM_ALPHA = 0.78;
/** Dialog panel opacity — near-opaque so the screen behind does not bleed through. */
const PANEL_FILL_ALPHA = 0.94;
/** HoloPanel header strip height. */
const PANEL_HEADER = 28;

/** Dialog frame options. */
export interface ModalFrameOptions {
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly accent: number;
}

/** A created dialog frame. */
export interface ModalFrame {
  /** Root container (destroy to close the dialog). */
  readonly container: Phaser.GameObjects.Container;
  readonly panel: HoloPanel;
  /** Panel bounds in screen coordinates. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** First free y below the header, padded. */
  readonly contentTop: number;
}

/**
 * Create a dialog frame centred on screen.
 *
 * @param scene - Owning scene.
 * @param options - Panel size, header title and accent.
 * @returns The container, panel and panel bounds.
 */
export function createModalFrame(
  scene: Phaser.Scene,
  options: ModalFrameOptions,
): ModalFrame {
  const { width: screenW, height: screenH } = scene.scale;
  const container = scene.add.container(0, 0).setDepth(HOLO_DEPTH.modal);
  const scrim = scene.add
    .rectangle(
      screenW / 2,
      screenH / 2,
      screenW,
      screenH,
      MENU_CLEAR_COLOR,
      SCRIM_ALPHA,
    )
    .setInteractive();
  const panel = createHoloPanel(scene, screenW / 2, screenH / 2, {
    width: options.width,
    height: options.height,
    title: options.title,
    accentColor: options.accent,
    fillAlpha: PANEL_FILL_ALPHA,
  });
  container.add([scrim, panel]);
  const left = screenW / 2 - options.width / 2;
  const top = screenH / 2 - options.height / 2;
  return {
    container,
    panel,
    left,
    top,
    width: options.width,
    height: options.height,
    contentTop: top + PANEL_HEADER + HOLO_SPACING.lg,
  };
}
