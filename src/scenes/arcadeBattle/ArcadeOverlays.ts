/**
 * ArcadeOverlays — the Skirmish scene's modal screens in the holographic
 * style: the pause menu (resume / settings / quit + controls reference) and
 * the victory / defeat screen (score, points, retry / menu).
 *
 * Both are screen-space containers above the HUD. Callers must keep the
 * camera at zoom 1 while they are shown: Phaser mis-hit-tests scrollFactor 0
 * buttons under zoom.
 */

import Phaser from "phaser";
import { createHoloButton } from "../../ui/hud/HoloButton";
import { HoloPanel } from "../../ui/hud/HoloPanel";
import { addPinned, createHoloText } from "../../ui/hud/holoPrimitives";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
} from "../../ui/theme/HoloTheme";

/** Dimming behind a modal overlay. */
const DIM_ALPHA = 0.7;
const PAUSE_PANEL = { width: 620, height: 392 } as const;
const END_PANEL = { width: 440, height: 280 } as const;
const BUTTON = { width: 200, height: 44 } as const;
/** Vertical pitch of the pause menu buttons. */
const BUTTON_PITCH = 60;
/** Vertical pitch of the end screen's detail lines. */
const DETAIL_LINE_PITCH = 18;
/** Vertical pitch of the controls reference lines. */
const CONTROL_LINE_PITCH = 19;
/** Width of the key column in the controls reference. */
const CONTROL_KEY_WIDTH = 104;

/** Key → action reference shown on the pause screen. */
export const ARCADE_CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ["↑ / ↓", "Speed up / down"],
  ["← / → tap", "Drift 30°"],
  ["← / → hold", "Bank 45°, then drift"],
  ["Q / E", "Hard turn 90°"],
  ["Shift+Q / E", "Segnor loop"],
  ["T / Shift+T", "Tallon roll L / R"],
  ["↑↑", "Boost dash"],
  ["Z  or  ↓↓", "K-Turn"],
  ["← + →", "Barrel roll"],
  ["C", "Cloak"],
  ["(auto)", "Weapons autofire"],
  ["Shift+Space", "Drop a bomb behind"],
  ["Tab", "Cycle weapon"],
  ["G", "Cycle crew role"],
  ["1 – 4", "Commander orders"],
  ["Esc", "Pause / resume"],
];

/** Pause menu actions. */
export interface PauseOverlayActions {
  readonly onResume: () => void;
  readonly onSettings: () => void;
  readonly onQuit: () => void;
}

/** End-of-battle summary and actions. */
export interface EndOverlayContent {
  readonly victory: boolean;
  readonly score: number;
  /** Squad points of enemy ships destroyed. */
  readonly pointsDestroyed: number;
  /** Squad points of the player's ships lost. */
  readonly pointsLost: number;
  /** Headline override ("DRAW"); default VICTORY / DEFEATED. */
  readonly outcomeLabel?: string;
  /** Extra summary lines under the points (reinforcement battles). */
  readonly details?: readonly string[];
  readonly onRetry: () => void;
  readonly onMenu: () => void;
}

function modalRoot(
  scene: Phaser.Scene,
  depth: number,
): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth);
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, DIM_ALPHA);
  dim.fillRect(0, 0, scene.scale.width, scene.scale.height);
  addPinned(root, dim);
  return root;
}

function pinnedPanel(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  config: ConstructorParameters<typeof HoloPanel>[3],
): HoloPanel {
  const panel = new HoloPanel(
    scene,
    scene.scale.width / 2,
    scene.scale.height / 2,
    config,
  );
  panel.setScrollFactor(0, 0, true);
  root.add(panel);
  return panel;
}

/**
 * Show the pause menu.
 *
 * @param scene - The battle scene (camera at zoom 1).
 * @param actions - Button callbacks.
 * @returns The overlay; destroy it to close.
 */
export function createPauseOverlay(
  scene: Phaser.Scene,
  actions: PauseOverlayActions,
): Phaser.GameObjects.Container {
  const root = modalRoot(scene, HOLO_DEPTH.modal);
  const panel = pinnedPanel(scene, root, { ...PAUSE_PANEL, title: "Paused" });
  const columnX = -PAUSE_PANEL.width / 4 - HOLO_SPACING.sm;
  const buttons = [
    { label: "Resume", variant: "primary", onClick: actions.onResume },
    { label: "Settings", variant: "secondary", onClick: actions.onSettings },
    { label: "Quit to menu", variant: "danger", onClick: actions.onQuit },
  ] as const;
  buttons.forEach((spec, i) => {
    const button = createHoloButton(
      scene,
      columnX,
      (i - 1) * BUTTON_PITCH,
      { ...BUTTON, label: spec.label, variant: spec.variant },
      spec.onClick,
    );
    button.setScrollFactor(0, 0, true);
    panel.add(button);
  });
  addControlsReference(scene, panel);
  return root;
}

function addControlsReference(scene: Phaser.Scene, panel: HoloPanel): void {
  const left = HOLO_SPACING.sm;
  let y = panel.contentTop;
  const heading = createHoloText(
    scene,
    left,
    y,
    "CONTROLS",
    "caption",
    HOLO_PALETTE.textSecondary,
  ).setOrigin(0, 0);
  addPinned(panel, heading);
  y += CONTROL_LINE_PITCH + HOLO_SPACING.xs;
  for (const [key, action] of ARCADE_CONTROLS) {
    const keyText = createHoloText(
      scene,
      left,
      y,
      key,
      "caption",
      HOLO_PALETTE.accent,
    ).setOrigin(0, 0);
    const actionText = createHoloText(
      scene,
      left + CONTROL_KEY_WIDTH,
      y,
      action,
      "caption",
      HOLO_PALETTE.textPrimary,
    ).setOrigin(0, 0);
    addPinned(panel, keyText, actionText);
    y += CONTROL_LINE_PITCH;
  }
}

/**
 * Show the victory / defeat screen.
 *
 * @param scene - The battle scene (camera at zoom 1).
 * @param content - Outcome, score and button callbacks.
 * @returns The overlay.
 */
export function createEndOverlay(
  scene: Phaser.Scene,
  content: EndOverlayContent,
): Phaser.GameObjects.Container {
  const root = modalRoot(scene, HOLO_DEPTH.menuPanel);
  const details = content.details ?? [];
  const height = END_PANEL.height + details.length * DETAIL_LINE_PITCH;
  const accent = content.victory ? HOLO_PALETTE.success : HOLO_PALETTE.danger;
  const panel = pinnedPanel(scene, root, {
    width: END_PANEL.width,
    height,
    accentColor: accent,
    title: content.victory ? "Battle won" : "Battle lost",
  });
  addEndTexts(scene, panel, -height / 2 + END_PANEL.height / 2, content);
  addEndButtons(scene, panel, height / 2, content);
  return root;
}

function addEndTexts(
  scene: Phaser.Scene,
  panel: HoloPanel,
  top: number,
  content: EndOverlayContent,
): void {
  const accent = content.victory ? HOLO_PALETTE.success : HOLO_PALETTE.danger;
  const headline = createHoloText(
    scene,
    0,
    top - HOLO_SPACING.xxl - HOLO_SPACING.sm,
    content.outcomeLabel ?? (content.victory ? "VICTORY" : "DEFEATED"),
    "title",
    accent,
  );
  headline.setFontSize(44);
  const score = createHoloText(
    scene,
    0,
    top + HOLO_SPACING.md,
    `SCORE  ${content.score}`,
    "heading",
  );
  const pointsY = top + HOLO_SPACING.xxl + HOLO_SPACING.sm;
  const points = createHoloText(
    scene,
    0,
    pointsY,
    `DESTROYED ${content.pointsDestroyed} PTS  ·  LOST ${content.pointsLost} PTS`,
    "caption",
    HOLO_PALETTE.textSecondary,
  );
  addPinned(panel, headline, score, points);
  (content.details ?? []).forEach((line, i) => {
    const text = createHoloText(
      scene,
      0,
      pointsY + (i + 1) * DETAIL_LINE_PITCH,
      line,
      "caption",
      HOLO_PALETTE.textSecondary,
    );
    addPinned(panel, text);
  });
}

function addEndButtons(
  scene: Phaser.Scene,
  panel: HoloPanel,
  bottom: number,
  content: EndOverlayContent,
): void {
  const buttonY = bottom - HOLO_SPACING.lg - BUTTON.height / 2;
  const half = BUTTON.width / 2 + HOLO_SPACING.sm;
  const retry = createHoloButton(
    scene,
    -half,
    buttonY,
    { ...BUTTON, label: "Retry", variant: "primary" },
    content.onRetry,
  );
  const menu = createHoloButton(
    scene,
    half,
    buttonY,
    { ...BUTTON, label: "Menu", variant: "secondary" },
    content.onMenu,
  );
  for (const button of [retry, menu]) {
    button.setScrollFactor(0, 0, true);
    panel.add(button);
  }
}
