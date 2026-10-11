/**
 * aceDuelMatchupRow — one selectable matchup row on the Ace Duel setup
 * screen in the holo style: completion tick, name, description and the two
 * sides' faction dots. The hit area is a child rectangle (the scene's
 * track() pins children so real clicks land at any camera scroll).
 */

import Phaser from "phaser";
import type { AceMatchup } from "../../data/AceMatchups";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_RADIUS,
  factionAccent,
} from "../../ui/theme/HoloTheme";

/** Row geometry (px), relative to its centre. */
const ROW = {
  width: 560,
  height: 44,
  tickX: -258,
  textX: -236,
  nameY: -7,
  descriptionY: 10,
  dot1X: 214,
  vsX: 236,
  dot2X: 258,
  dotRadius: 7,
} as const;
/** Fill tint of the selected row. */
const SELECTED_TINT_ALPHA = 0.18;

/** One row to draw. */
export interface MatchupRowSpec {
  readonly x: number;
  readonly y: number;
  readonly matchup: AceMatchup;
  readonly selected: boolean;
  readonly completed: boolean;
  readonly onSelect: () => void;
}

/**
 * Draw a matchup row.
 *
 * @param scene - The setup scene.
 * @param spec - Position, matchup, state and click action.
 * @returns The row container (not yet pinned/tracked).
 */
export function renderMatchupRow(
  scene: Phaser.Scene,
  spec: MatchupRowSpec,
): Phaser.GameObjects.Container {
  const { matchup, selected } = spec;
  const nameColor = selected
    ? HOLO_PALETTE.textPrimary
    : HOLO_PALETTE.textSecondary;
  const parts: Phaser.GameObjects.GameObject[] = [
    rowBackground(scene, selected),
    createHoloText(scene, ROW.textX, ROW.nameY, matchup.name, "body", nameColor)
      .setOrigin(0, 0.5)
      .setFontStyle(selected ? "600" : "400"),
    createHoloText(
      scene,
      ROW.textX,
      ROW.descriptionY,
      matchup.description,
      "caption",
      HOLO_PALETTE.textMuted,
    )
      .setOrigin(0, 0.5)
      .setLetterSpacing(0),
    factionDots(scene, matchup),
    createHoloText(scene, ROW.vsX, 0, "vs", "caption", HOLO_PALETTE.textMuted),
  ];
  if (spec.completed) {
    parts.push(
      createHoloText(
        scene,
        ROW.tickX,
        0,
        "\u2713",
        "heading",
        HOLO_PALETTE.success,
      ),
    );
  }
  const hitArea = scene.add
    .rectangle(0, 0, ROW.width, ROW.height)
    .setInteractive({ useHandCursor: true });
  hitArea.on("pointerdown", spec.onSelect);
  parts.push(hitArea);
  return scene.add.container(spec.x, spec.y, parts);
}

function rowBackground(
  scene: Phaser.Scene,
  selected: boolean,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const left = -ROW.width / 2;
  const top = -ROW.height / 2;
  g.fillStyle(HOLO_PALETTE.panelFill, HOLO_PALETTE.panelAlpha);
  g.fillRoundedRect(left, top, ROW.width, ROW.height, HOLO_RADIUS.md);
  if (selected) {
    g.fillStyle(HOLO_PALETTE.accent, SELECTED_TINT_ALPHA);
    g.fillRoundedRect(left, top, ROW.width, ROW.height, HOLO_RADIUS.md);
  }
  g.lineStyle(
    selected ? HOLO_BORDER.regular : HOLO_BORDER.hairline,
    selected ? HOLO_PALETTE.accent : HOLO_PALETTE.border,
    selected ? 1 : HOLO_PALETTE.borderAlpha,
  );
  g.strokeRoundedRect(left, top, ROW.width, ROW.height, HOLO_RADIUS.md);
  return g;
}

function factionDots(
  scene: Phaser.Scene,
  matchup: AceMatchup,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(factionAccent(matchup.side1.faction), 1);
  g.fillCircle(ROW.dot1X, 0, ROW.dotRadius);
  g.fillStyle(factionAccent(matchup.side2.faction), 1);
  g.fillCircle(ROW.dot2X, 0, ROW.dotRadius);
  return g;
}
