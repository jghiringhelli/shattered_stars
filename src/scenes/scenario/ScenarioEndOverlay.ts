/**
 * ScenarioEndOverlay — the scenario's victory / defeat / draw screen: the
 * scenario's name, how it ended, the score breakdown (objectives,
 * destruction, total for each side), rounds and time, Retry / Menu.
 * Same holographic modal as the Skirmish end screen (camera at zoom 1).
 */

import Phaser from "phaser";
import { createHoloButton } from "../../ui/hud/HoloButton";
import { HoloPanel } from "../../ui/hud/HoloPanel";
import { addPinned, createHoloText } from "../../ui/hud/holoPrimitives";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
  SIDE_COLORS,
} from "../../ui/theme/HoloTheme";
import type { ScenarioEndSummary } from "./scenarioEndModel";

const DIM_ALPHA = 0.7;
const PANEL = { width: 480, height: 380 } as const;
const BUTTON = { width: 200, height: 44 } as const;
const HEADLINE_FONT_PX = 44;
/** Breakdown table: first row offset and row pitch (px). */
const TABLE_TOP = 12;
const ROW_PITCH = 24;
/** Breakdown columns (offsets from the panel centre). */
const COLUMN = { label: -120, player: 40, enemy: 140 } as const;
const HEADLINE_Y = -118;
const NAME_Y = -78;
const REASON_Y = -54;
const HEADER_Y = -20;

/** Button callbacks. */
export interface ScenarioEndActions {
  readonly onRetry: () => void;
  readonly onMenu: () => void;
}

/**
 * Show the end screen.
 *
 * @param scene - The battle scene (camera at zoom 1).
 * @param summary - What to show.
 * @param actions - Retry / Menu.
 * @returns The overlay.
 */
export function createScenarioEndOverlay(
  scene: Phaser.Scene,
  summary: ScenarioEndSummary,
  actions: ScenarioEndActions,
): Phaser.GameObjects.Container {
  const root = scene.add
    .container(0, 0)
    .setScrollFactor(0)
    .setDepth(HOLO_DEPTH.menuPanel);
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, DIM_ALPHA);
  dim.fillRect(0, 0, scene.scale.width, scene.scale.height);
  addPinned(root, dim);
  const accent = accentOf(summary.outcome);
  const panel = new HoloPanel(
    scene,
    scene.scale.width / 2,
    scene.scale.height / 2,
    {
      ...PANEL,
      accentColor: accent,
      title: summary.title,
    },
  );
  panel.setScrollFactor(0, 0, true);
  root.add(panel);
  const headline = createHoloText(
    scene,
    0,
    HEADLINE_Y,
    summary.headline,
    "title",
    accent,
  );
  headline.setFontSize(HEADLINE_FONT_PX);
  addPinned(
    panel,
    headline,
    createHoloText(
      scene,
      0,
      NAME_Y,
      summary.scenarioName.toUpperCase(),
      "heading",
    ),
    createHoloText(
      scene,
      0,
      REASON_Y,
      summary.reason,
      "body",
      HOLO_PALETTE.textSecondary,
    ),
  );
  addBreakdown(scene, panel, summary);
  addButtons(scene, panel, actions);
  return root;
}

function accentOf(outcome: ScenarioEndSummary["outcome"]): number {
  if (outcome === "victory") return HOLO_PALETTE.success;
  if (outcome === "defeat") return HOLO_PALETTE.danger;
  return HOLO_PALETTE.warning;
}

function addBreakdown(
  scene: Phaser.Scene,
  panel: HoloPanel,
  summary: ScenarioEndSummary,
): void {
  const caption = (x: number, y: number, text: string, color: number) =>
    createHoloText(scene, x, y, text, "caption", color);
  addPinned(
    panel,
    caption(COLUMN.player, HEADER_Y, "YOU", SIDE_COLORS.player),
    caption(COLUMN.enemy, HEADER_Y, "FOE", SIDE_COLORS.enemy),
  );
  summary.rows.forEach((row, i) => {
    const y = TABLE_TOP + i * ROW_PITCH;
    addPinned(
      panel,
      caption(COLUMN.label, y, row.label, HOLO_PALETTE.textSecondary),
      createHoloText(scene, COLUMN.player, y, row.player, "numeric"),
      createHoloText(scene, COLUMN.enemy, y, row.enemy, "numeric"),
    );
  });
  const footerY = TABLE_TOP + summary.rows.length * ROW_PITCH + HOLO_SPACING.sm;
  addPinned(panel, caption(0, footerY, summary.footer, HOLO_PALETTE.textMuted));
}

function addButtons(
  scene: Phaser.Scene,
  panel: HoloPanel,
  actions: ScenarioEndActions,
): void {
  const y = PANEL.height / 2 - HOLO_SPACING.lg - BUTTON.height / 2;
  const half = BUTTON.width / 2 + HOLO_SPACING.sm;
  const retry = createHoloButton(
    scene,
    -half,
    y,
    { ...BUTTON, label: "Retry", variant: "primary" },
    actions.onRetry,
  );
  const menu = createHoloButton(
    scene,
    half,
    y,
    { ...BUTTON, label: "Menu", variant: "secondary" },
    actions.onMenu,
  );
  for (const button of [retry, menu]) {
    button.setScrollFactor(0, 0, true);
    panel.add(button);
  }
}
