/**
 * DuelEndScreen — the duel scenes' end-of-match screen in the holo style: a
 * dimmed battlefield, a HoloPanel with the result, final score and notes
 * (sweep, achievements), and REMATCH / MENU HoloButtons.
 *
 * Buttons stay direct scene children (never reparented into the panel) and
 * carry scrollFactor 0 down to their children: reparenting interactive
 * containers and inherited scroll factors both broke real clicks on these
 * screens. The scene must reset camera zoom to 1 first (hit-testing).
 */

import Phaser from "phaser";
import { createHoloButton } from "../../ui/hud/HoloButton";
import { createHoloPanel } from "../../ui/hud/HoloPanel";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import { HOLO_DEPTH, HOLO_PALETTE } from "../../ui/theme/HoloTheme";

/** Panel and button geometry (px). */
const PANEL = { width: 480, height: 280 } as const;
const BUTTON = { width: 170, height: 44, gap: 24, offsetY: 92 } as const;
/** Vertical positions inside the panel, relative to its centre (px). */
const LAYOUT = { titleY: -62, scoreY: -14, notesY: 22, noteStep: 22 } as const;
/** Result title size (px). */
const TITLE_SIZE_PX = 40;
/** Battlefield dim behind the panel. */
const DIM_ALPHA = 0.7;

/** What the end screen shows and does. */
export interface DuelEndScreenConfig {
  /** Panel header, e.g. "Dogfight — match result". */
  readonly header: string;
  /** Big result line, e.g. "MATCH WON". */
  readonly title: string;
  readonly won: boolean;
  /** e.g. "Final score 2 – 1". */
  readonly scoreLine: string;
  /** Highlighted extra lines (sweep, achievement). */
  readonly notes: readonly string[];
  /** Panel accent (the player's faction). */
  readonly accent: number;
  readonly onRematch: () => void;
  readonly onMenu: () => void;
}

/**
 * Build the end-of-match screen.
 *
 * @param scene - The duel scene (camera zoom already 1).
 * @param config - Texts, accent and button actions.
 * @returns Every object created (the scene may destroy them on restart).
 */
export function showDuelEndScreen(
  scene: Phaser.Scene,
  config: DuelEndScreenConfig,
): Phaser.GameObjects.GameObject[] {
  const { width, height } = scene.scale;
  const centerX = width / 2;
  const centerY = height / 2;
  const dim = scene.add
    .rectangle(
      centerX,
      centerY,
      width,
      height,
      HOLO_PALETTE.panelFill,
      DIM_ALPHA,
    )
    .setScrollFactor(0)
    .setDepth(HOLO_DEPTH.menuPanel);
  const panel = createHoloPanel(scene, centerX, centerY, {
    width: PANEL.width,
    height: PANEL.height,
    accentColor: config.accent,
    title: config.header,
  });
  panel.add(panelTexts(scene, config));
  panel.setScrollFactor(0, 0, true).setDepth(HOLO_DEPTH.menuPanel);
  const buttons = endButtons(scene, centerX, centerY + BUTTON.offsetY, config);
  return [dim, panel, ...buttons];
}

function panelTexts(
  scene: Phaser.Scene,
  config: DuelEndScreenConfig,
): Phaser.GameObjects.Text[] {
  const resultColor = config.won ? HOLO_PALETTE.success : HOLO_PALETTE.danger;
  const title = createHoloText(
    scene,
    0,
    LAYOUT.titleY,
    config.title,
    "title",
    resultColor,
  ).setFontSize(TITLE_SIZE_PX);
  const score = createHoloText(
    scene,
    0,
    LAYOUT.scoreY,
    config.scoreLine,
    "heading",
  );
  const notes = config.notes.map((note, index) =>
    createHoloText(
      scene,
      0,
      LAYOUT.notesY + index * LAYOUT.noteStep,
      note.toUpperCase(),
      "caption",
      HOLO_PALETTE.warning,
    ),
  );
  return [title, score, ...notes];
}

function endButtons(
  scene: Phaser.Scene,
  centerX: number,
  y: number,
  config: DuelEndScreenConfig,
): Phaser.GameObjects.Container[] {
  const offset = (BUTTON.width + BUTTON.gap) / 2;
  const size = { width: BUTTON.width, height: BUTTON.height };
  const rematch = createHoloButton(
    scene,
    centerX - offset,
    y,
    { ...size, label: "Rematch", variant: "primary" },
    config.onRematch,
  );
  const menu = createHoloButton(
    scene,
    centerX + offset,
    y,
    { ...size, label: "Menu" },
    config.onMenu,
  );
  for (const button of [rematch, menu]) {
    button.setScrollFactor(0, 0, true).setDepth(HOLO_DEPTH.menuControl);
  }
  return [rematch, menu];
}
