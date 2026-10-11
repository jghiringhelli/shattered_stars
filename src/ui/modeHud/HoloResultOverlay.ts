/**
 * HoloResultOverlay — end-of-battle screen in the holographic style: a dim
 * backdrop, a titled HoloPanel with result lines, and HoloButtons below.
 *
 * Buttons are added straight to the scene, not into the panel container
 * (Phaser mis-hit-tests an interactive container re-parented after
 * setInteractive), and the caller must hold camera zoom at 1.0 while the
 * overlay is up (scrollFactor-0 hit-testing breaks under zoom).
 */

import Phaser from "phaser";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
  holoTextStyle,
  type HoloTypeRole,
} from "../theme/HoloTheme";
import { createHoloText } from "../hud/holoPrimitives";
import { HoloPanel } from "../hud/HoloPanel";
import {
  createHoloButton,
  type HoloButton,
  type HoloButtonVariant,
} from "../hud/HoloButton";
import { pinTree } from "./screenSpace";

/** Panel width (px). */
const PANEL_WIDTH = 460;
/** Space reserved above the lines for the big result title (px). */
const TITLE_BLOCK = 56;
/** Line pitch for result lines (px). */
const LINE_PITCH = 28;
/** Button size and spacing (px). */
const BUTTON_WIDTH = 160;
const BUTTON_HEIGHT = 44;
const BUTTON_GAP = HOLO_SPACING.lg;
/** Backdrop opacity. */
const DIM_ALPHA = 0.72;

/** One result line. */
export interface ResultLine {
  readonly text: string;
  readonly color?: number;
  readonly role?: HoloTypeRole;
}

/** One action button. */
export interface ResultAction {
  readonly label: string;
  readonly variant: HoloButtonVariant;
  readonly onClick: () => void;
}

/** What the overlay shows. */
export interface ResultOverlayConfig {
  /** Header strip caption, e.g. the mission or mode name. */
  readonly header: string;
  /** Big result title, e.g. "MISSION FAILED". */
  readonly title: string;
  /** Title and border colour. */
  readonly accent: number;
  readonly lines: readonly ResultLine[];
  readonly actions: readonly ResultAction[];
}

/** Handle to a shown overlay. */
export interface ResultOverlay {
  readonly panel: HoloPanel;
  readonly buttons: readonly HoloButton[];
  destroy(): void;
}

/**
 * Show the result overlay centred on screen.
 *
 * @param scene - Owning scene (camera zoom must be 1.0).
 * @param config - Title, lines and actions.
 * @returns The overlay handle.
 */
export function showResultOverlay(
  scene: Phaser.Scene,
  config: ResultOverlayConfig,
): ResultOverlay {
  const { width, height } = scene.scale;
  const dim = scene.add
    .rectangle(0, 0, width, height, HOLO_PALETTE.panelFill, DIM_ALPHA)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(HOLO_DEPTH.menuPanel);
  const panelHeight =
    TITLE_BLOCK + config.lines.length * LINE_PITCH + HOLO_SPACING.xxl * 2;
  const panel = buildPanel(scene, config, panelHeight);
  const buttonY = height / 2 + panelHeight / 2 + BUTTON_GAP + BUTTON_HEIGHT / 2;
  const buttons = buildButtons(scene, config.actions, buttonY);
  return {
    panel,
    buttons,
    destroy: () => {
      dim.destroy();
      panel.destroy();
      buttons.forEach((button) => button.destroy());
    },
  };
}

function buildPanel(
  scene: Phaser.Scene,
  config: ResultOverlayConfig,
  panelHeight: number,
): HoloPanel {
  const panel = new HoloPanel(
    scene,
    scene.scale.width / 2,
    scene.scale.height / 2,
    {
      width: PANEL_WIDTH,
      height: panelHeight,
      accentColor: config.accent,
      title: config.header,
    },
  );
  scene.add.existing(panel);
  const top = panel.contentTop + HOLO_SPACING.sm;
  const title = createHoloText(
    scene,
    0,
    top,
    config.title,
    "title",
    config.accent,
  ).setOrigin(0.5, 0);
  panel.add(title);
  config.lines.forEach((line, index) => {
    const y = top + TITLE_BLOCK + index * LINE_PITCH;
    const text = scene.add
      .text(0, y, line.text, holoTextStyle(line.role ?? "body", line.color))
      .setOrigin(0.5, 0);
    panel.add(text);
  });
  panel.setDepth(HOLO_DEPTH.menuPanel);
  pinTree(panel);
  return panel;
}

function buildButtons(
  scene: Phaser.Scene,
  actions: readonly ResultAction[],
  y: number,
): HoloButton[] {
  const pitch = BUTTON_WIDTH + BUTTON_GAP;
  const firstX = scene.scale.width / 2 - ((actions.length - 1) * pitch) / 2;
  return actions.map((action, index) => {
    const button = createHoloButton(
      scene,
      firstX + index * pitch,
      y,
      {
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        label: action.label,
        variant: action.variant,
      },
      action.onClick,
    );
    pinTree(button);
    return button.setDepth(HOLO_DEPTH.menuControl);
  });
}
