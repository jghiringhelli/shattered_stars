/**
 * ResultsPanel — THE end-of-battle screen of every mode: result banner,
 * the match's key stats (src/ui/results/resultsModel) and the same three
 * actions everywhere — REMATCH (same setup, fresh run), CHANGE SQUAD / BACK
 * TO SETUP, MAIN MENU. R is the quick restart; ←/→/Tab + ENTER, the D-pad
 * and A navigate. Resets camera zoom to 1.0 so the buttons hit-test.
 */

import Phaser from "phaser";
import { createHoloButton, type HoloButton } from "../hud/HoloButton";
import { createHoloPanel } from "../hud/HoloPanel";
import { createHoloText } from "../hud/holoPrimitives";
import { MenuFocus } from "../menu/MenuFocus";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
} from "../theme/HoloTheme";
import { bannerFor, type ResultRow, type ResultTone } from "./resultsModel";

/** Battlefield dimming behind the panel. */
const DIM_ALPHA = 0.72;
/** Geometry (px). */
const LAYOUT = {
  width: 640,
  titleBlock: 118,
  rowPitch: 30,
  noteBlock: 24,
  buttonBlock: 96,
  buttonWidth: 184,
  buttonHeight: 46,
  columnInset: 36,
} as const;
/** Stat rows split across two columns from this count on. */
const TWO_COLUMN_FROM = 5;
/** Banner size boost over the type scale's "title" role. */
const TITLE_SCALE = 1.5;

/** What the three buttons do. */
export interface ResultsActions {
  /** Same setup, fresh run (R). */
  readonly onRematch: () => void;
  /** Back to the squad builder / the mode's setup. Omit to hide. */
  readonly onSetup?: () => void;
  readonly onMenu: () => void;
  /** Default REMATCH. */
  readonly rematchLabel?: string;
  /** Default CHANGE SQUAD. */
  readonly setupLabel?: string;
}

/** Everything the results panel shows. */
export interface ResultsPanelConfig {
  readonly scene: Phaser.Scene;
  readonly tone: ResultTone;
  /** Banner override ("MATCH WON"); default VICTORY / DEFEAT / DRAW. */
  readonly banner?: string;
  readonly subtitle?: string;
  readonly rows: readonly ResultRow[];
  /** Highlighted lines (sweep, achievement). */
  readonly notes?: readonly string[];
  readonly actions: ResultsActions;
}

const TONE_COLOR: Readonly<Record<ResultTone, number>> = {
  victory: HOLO_PALETTE.success,
  defeat: HOLO_PALETTE.danger,
  draw: HOLO_PALETTE.warning,
};

/**
 * @param count - Stat rows.
 * @returns Rows per column.
 */
export function rowsPerColumn(count: number): number {
  return count >= TWO_COLUMN_FROM ? Math.ceil(count / 2) : count;
}

/**
 * Show the results screen.
 *
 * @param config - Outcome, stats and actions.
 * @returns The screen's root container (screen space).
 */
export function showResultsPanel(
  config: ResultsPanelConfig,
): Phaser.GameObjects.Container {
  const { scene } = config;
  scene.cameras.main.setZoom(1);
  const { width, height } = scene.scale;
  const notes = config.notes ?? [];
  const perColumn = rowsPerColumn(config.rows.length);
  const panelHeight =
    LAYOUT.titleBlock +
    perColumn * LAYOUT.rowPitch +
    notes.length * LAYOUT.noteBlock +
    LAYOUT.buttonBlock;
  const top = height / 2 - panelHeight / 2;
  const color = TONE_COLOR[config.tone];
  const dim = scene.add
    .rectangle(0, 0, width, height, 0x000000, DIM_ALPHA)
    .setOrigin(0)
    .setInteractive();
  const panel = createHoloPanel(scene, width / 2, height / 2, {
    width: LAYOUT.width,
    height: panelHeight,
    accentColor: color,
  });
  const root = scene.add.container(0, 0, [dim, panel]);
  root.add(headerTexts(config, width / 2, top, color));
  root.add(statTexts(config, width / 2, top + LAYOUT.titleBlock, perColumn));
  const notesTop =
    top + LAYOUT.titleBlock + perColumn * LAYOUT.rowPitch + HOLO_SPACING.xs;
  root.add(noteTexts(config, width / 2, notesTop));
  const buttons = actionButtons(
    config,
    width / 2,
    top + panelHeight - LAYOUT.buttonBlock / 2,
  );
  root.add(buttons);
  root.setDepth(HOLO_DEPTH.menuPanel).setScrollFactor(0, 0, true);
  bindInput(scene, root, buttons, config.actions.onRematch);
  return root;
}

function headerTexts(
  config: ResultsPanelConfig,
  centerX: number,
  top: number,
  color: number,
): Phaser.GameObjects.Text[] {
  const title = createHoloText(
    config.scene,
    centerX,
    top + HOLO_SPACING.xxl + HOLO_SPACING.sm,
    config.banner ?? bannerFor(config.tone),
    "title",
    color,
  ).setScale(TITLE_SCALE);
  const texts = [title];
  if (config.subtitle) {
    texts.push(
      createHoloText(
        config.scene,
        centerX,
        top + LAYOUT.titleBlock - HOLO_SPACING.xl,
        config.subtitle,
        "body",
        HOLO_PALETTE.textSecondary,
      ),
    );
  }
  return texts;
}

function statTexts(
  config: ResultsPanelConfig,
  centerX: number,
  top: number,
  perColumn: number,
): Phaser.GameObjects.Text[] {
  const columns = config.rows.length >= TWO_COLUMN_FROM ? 2 : 1;
  const innerWidth = LAYOUT.width - LAYOUT.columnInset * 2;
  const columnWidth = innerWidth / columns;
  return config.rows.flatMap((row, index) => {
    const column = Math.floor(index / perColumn);
    const left =
      centerX - LAYOUT.width / 2 + LAYOUT.columnInset + column * columnWidth;
    const right = left + columnWidth - (columns > 1 ? HOLO_SPACING.lg : 0);
    const y = top + (index % perColumn) * LAYOUT.rowPitch + LAYOUT.rowPitch / 2;
    return [
      createHoloText(
        config.scene,
        left,
        y,
        row.label.toUpperCase(),
        "caption",
        HOLO_PALETTE.textSecondary,
      ).setOrigin(0, 0.5),
      createHoloText(config.scene, right, y, row.value, "numeric").setOrigin(
        1,
        0.5,
      ),
    ];
  });
}

function noteTexts(
  config: ResultsPanelConfig,
  centerX: number,
  top: number,
): Phaser.GameObjects.Text[] {
  return (config.notes ?? []).map((note, index) =>
    createHoloText(
      config.scene,
      centerX,
      top + index * LAYOUT.noteBlock + LAYOUT.noteBlock / 2,
      note.toUpperCase(),
      "caption",
      HOLO_PALETTE.warning,
    ),
  );
}

function actionButtons(
  config: ResultsPanelConfig,
  centerX: number,
  y: number,
): HoloButton[] {
  const { actions, scene } = config;
  const specs = [
    {
      label: actions.rematchLabel ?? "Rematch",
      variant: "primary" as const,
      onClick: actions.onRematch,
    },
    ...(actions.onSetup
      ? [
          {
            label: actions.setupLabel ?? "Change squad",
            variant: "secondary" as const,
            onClick: actions.onSetup,
          },
        ]
      : []),
    { label: "Main menu", variant: "secondary" as const, onClick: actions.onMenu },
  ];
  const pitch = LAYOUT.buttonWidth + HOLO_SPACING.md;
  const firstX = centerX - ((specs.length - 1) * pitch) / 2;
  return specs.map((spec, index) =>
    createHoloButton(
      scene,
      firstX + index * pitch,
      y,
      {
        width: LAYOUT.buttonWidth,
        height: LAYOUT.buttonHeight,
        label: spec.label,
        variant: spec.variant,
      },
      spec.onClick,
    ),
  );
}

/** Keyboard / gamepad: focus ring over the buttons and R = rematch. */
function bindInput(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  buttons: readonly HoloButton[],
  onRematch: () => void,
): void {
  const focus = new MenuFocus(scene, buttons, {
    columns: buttons.length,
    isActive: () => root.active,
  });
  const keyboard = scene.input.keyboard;
  const onKey = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === "r" && root.active) onRematch();
  };
  keyboard?.on("keydown", onKey);
  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    focus.destroy();
    keyboard?.off("keydown", onKey);
  });
}
